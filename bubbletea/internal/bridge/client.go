package bridge

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

type Client struct {
	BaseURL     string
	HTTP        *http.Client
	streamHTTP  *http.Client
	mu          sync.Mutex
	lastEventID map[string]string
}

func NewClient(baseURL string) *Client {
	return &Client{
		BaseURL:     strings.TrimRight(baseURL, "/"),
		HTTP:        &http.Client{Timeout: 30 * time.Second},
		streamHTTP:  &http.Client{}, // no overall timeout; SSE streams are long-lived
		lastEventID: make(map[string]string),
	}
}

func (c *Client) CreateSession(ctx context.Context) (SessionStatus, error) {
	var status SessionStatus
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/api/tui/session", nil)
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return status, err
	}
	defer resp.Body.Close()
	// The standalone bridge returns 201, while the GUI bridge compatibility
	// route returns 200. Treat both as successful session creation.
	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		return status, fmt.Errorf("create session returned status %d", resp.StatusCode)
	}
	err = json.NewDecoder(resp.Body).Decode(&status)
	return status, err
}

func (c *Client) GetStatus(ctx context.Context, sessionID string) (SessionStatus, error) {
	var status SessionStatus
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s/api/tui/session/%s/status", c.BaseURL, sessionID), nil)
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return status, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return status, fmt.Errorf("get status returned status %d", resp.StatusCode)
	}
	err = json.NewDecoder(resp.Body).Decode(&status)
	return status, err
}

func (c *Client) SubmitInput(ctx context.Context, sessionID, mode, text, clientIntent string) error {
	payload, _ := json.Marshal(map[string]string{"mode": mode, "text": text, "clientIntent": clientIntent})
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/api/tui/session/%s/input", c.BaseURL, sessionID), bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("submit input returned status %d", resp.StatusCode)
	}
	return nil
}

func (c *Client) ConfirmAction(ctx context.Context, sessionID, actionID string) error {
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/api/tui/session/%s/actions/%s/confirm", c.BaseURL, sessionID, actionID), nil)
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("confirm action returned status %d", resp.StatusCode)
	}
	return nil
}

func (c *Client) CancelAction(ctx context.Context, sessionID, actionID string) error {
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/api/tui/session/%s/actions/%s/cancel", c.BaseURL, sessionID, actionID), nil)
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("cancel action returned status %d", resp.StatusCode)
	}
	return nil
}

func (c *Client) StreamEvents(ctx context.Context, sessionID string, onEvent func(Event)) error {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s/api/tui/session/%s/events", c.BaseURL, sessionID), nil)
	if lastID := c.getLastEventID(sessionID); lastID != "" {
		req.Header.Set("Last-Event-ID", lastID)
	}
	resp, err := c.streamHTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("stream events returned status %d", resp.StatusCode)
	}

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	currentEventID := ""
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "id: ") {
			currentEventID = strings.TrimSpace(strings.TrimPrefix(line, "id: "))
			continue
		}
		if strings.HasPrefix(line, ":") {
			continue
		}
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		var event Event
		if err := json.Unmarshal([]byte(strings.TrimPrefix(line, "data: ")), &event); err == nil {
			if currentEventID != "" {
				c.setLastEventID(sessionID, currentEventID)
			}
			onEvent(event)
		}
	}
	if err := scanner.Err(); err != nil && ctx.Err() == nil {
		return err
	}
	return nil
}

func (c *Client) getLastEventID(sessionID string) string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.lastEventID[sessionID]
}

func (c *Client) setLastEventID(sessionID, eventID string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	// Ignore obviously invalid ids so reconnect semantics stay monotonic.
	if _, err := strconv.Atoi(eventID); err != nil {
		return
	}
	c.lastEventID[sessionID] = eventID
}
