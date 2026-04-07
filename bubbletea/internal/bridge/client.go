package bridge

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

type Client struct {
	BaseURL string
	HTTP    *http.Client
}

func NewClient(baseURL string) *Client {
	return &Client{BaseURL: strings.TrimRight(baseURL, "/"), HTTP: &http.Client{}}
}

func (c *Client) CreateSession(ctx context.Context) (SessionStatus, error) {
	var status SessionStatus
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/api/tui/session", nil)
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return status, err
	}
	defer resp.Body.Close()
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
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		var event Event
		if err := json.Unmarshal([]byte(strings.TrimPrefix(line, "data: ")), &event); err == nil {
			onEvent(event)
		}
	}
	if err := scanner.Err(); err != nil && ctx.Err() == nil {
		return err
	}
	return nil
}
