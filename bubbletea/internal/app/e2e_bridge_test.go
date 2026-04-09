package app

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Pastorsimon1798/liminal/bubbletea/internal/bridge"
)

// TestEndToEndBridgeFlow verifies the full lifecycle:
// bridge server → Go client connects → session created → SSE events received → model updated
func TestEndToEndBridgeFlow(t *testing.T) {
	sessionID := "e2e-test-session"

	// Create a mock bridge server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == "POST" && r.URL.Path == "/api/tui/session":
			w.Header().Set("Content-Type", "application/json")
			fmt.Fprintf(w, `{"sessionId":"%s","mode":"chat","provider":"test","model":"mock-v1","trust":{"level":"untrusted","label":"Generated code is untrusted by default"}}`, sessionID)

		case r.Method == "GET" && strings.Contains(r.URL.Path, "/status"):
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"sessionId":"` + sessionID + `","mode":"chat","provider":"test","model":"mock-v1","trust":{"level":"untrusted","label":"Generated code is untrusted by default"}}`))

		case r.Method == "GET" && strings.Contains(r.URL.Path, "/events"):
			w.Header().Set("Content-Type", "text/event-stream")
			w.Header().Set("Cache-Control", "no-cache")
			w.Header().Set("Connection", "keep-alive")
			flusher, ok := w.(http.Flusher)
			if !ok {
				t.Fatal("response writer does not support flushing")
			}

			// Send a series of SSE events
			events := []string{
				"event: message\ndata: {\"type\":\"response.started\",\"sessionId\":\"" + sessionID + "\"}\n\n",
				"event: message\ndata: {\"type\":\"response.delta\",\"sessionId\":\"" + sessionID + "\",\"delta\":\"Hello\"}\n\n",
				"event: message\ndata: {\"type\":\"response.delta\",\"sessionId\":\"" + sessionID + "\",\"delta\":\" World\"}\n\n",
				"event: message\ndata: {\"type\":\"response.completed\",\"sessionId\":\"" + sessionID + "\",\"content\":\"Hello World\"}\n\n",
				"event: message\ndata: {\"type\":\"response.committed\",\"sessionId\":\"" + sessionID + "\",\"content\":\"Hello World\"}\n\n",
			}
			for _, evt := range events {
				w.Write([]byte(evt))
				flusher.Flush()
			}

		case r.Method == "POST" && strings.Contains(r.URL.Path, "/input"):
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"reviewRequired":false}`))

		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	// Step 1: Create bridge client and connect
	client := bridge.NewClient(server.URL)
	status, err := client.CreateSession(context.Background())
	if err != nil {
		t.Fatalf("CreateSession failed: %v", err)
	}
	if status.SessionID != sessionID {
		t.Fatalf("expected session ID %s, got %s", sessionID, status.SessionID)
	}
	t.Logf("Session created: %s", status.SessionID)

	// Step 2: Create model and apply initial state
	m := NewModel(server.URL)
	m.SessionID = status.SessionID
	m.Connected = true
	if status.Provider != "" {
		m.Provider = status.Provider
	}
	if status.Model != "" {
		m.ModelName = status.Model
	}

	// Step 3: Stream events and collect them
	var events []bridge.Event
	done := make(chan struct{})
	go func() {
		defer close(done)
		_ = client.StreamEvents(context.Background(), sessionID, func(e bridge.Event) {
			events = append(events, e)
		})
	}()

	// Wait for events to be received
	time.Sleep(500 * time.Millisecond)

	// Step 4: Apply all received events to model
	for _, e := range events {
		m.ApplyEvent(e)
	}

	// Step 5: Verify model state
	if m.ActiveResponse != "" {
		t.Logf("ActiveResponse after deltas+completed: %q", m.ActiveResponse)
	}

	// After committed, ActiveResponse should be cleared and ChatBlocks should have the entry
	if len(m.ChatBlocks) != 1 {
		t.Fatalf("expected 1 chat block after committed, got %d", len(m.ChatBlocks))
	}
	if m.ChatBlocks[0].Content != "Hello World" {
		t.Fatalf("expected chat block 'Hello World', got %q", m.ChatBlocks[0].Content)
	}
	if m.ChatBlocks[0].Type != "assistant" {
		t.Fatalf("expected assistant type, got %q", m.ChatBlocks[0].Type)
	}

	// Step 6: Verify model rendering doesn't crash
	m.Ready = true
	m.Width = 120
	m.Height = 32
	view := m.View()
	if !strings.Contains(view, "test/mock-v1") {
		t.Fatalf("expected provider in view, got:\n%s", view)
	}
	if !strings.Contains(view, "chat") {
		t.Fatalf("expected mode badge in view")
	}

	t.Logf("View rendered successfully (%d chars)", len(view))
	t.Logf("Event types received: %v", eventTypes(events))
	t.Log("END-TO-END FLOW VERIFIED")
}

func eventTypes(events []bridge.Event) []string {
	types := make([]string, len(events))
	for i, e := range events {
		types[i] = e.Type
	}
	return types
}
