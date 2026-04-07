package app

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Pastorsimon1798/liminal/bubbletea/internal/bridge"
)

func TestInitCreatesSessionAndUpdatesState(t *testing.T) {
	sessionID := "test-session-42"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/tui/session":
			w.Header().Set("Content-Type", "application/json")
			fmt.Fprintf(w, `{"sessionId":"%s","mode":"chat","trust":{"level":"untrusted","label":"Generated code is untrusted by default"}}`, sessionID)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	m := NewModel(server.URL)
	cmd := m.Init()
	msg := cmd()

	created, ok := msg.(sessionCreatedMsg)
	if !ok {
		t.Fatalf("expected sessionCreatedMsg, got %T", msg)
	}
	if created.status.SessionID != sessionID {
		t.Fatalf("expected session ID %s, got %s", sessionID, created.status.SessionID)
	}
}

func TestUpdateHandlesSessionCreatedMsg(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	}))
	defer server.Close()

	m := NewModel(server.URL)
	updated, _ := m.Update(sessionCreatedMsg{
		status: bridge.SessionStatus{
			SessionID: "s1",
			Mode:      "chat",
			Trust:     bridge.TrustState{Level: "untrusted", Label: "Generated code is untrusted"},
		},
	})

	model := updated.(Model)
	if model.SessionID != "s1" {
		t.Fatalf("expected session ID s1, got %s", model.SessionID)
	}
	if !model.Connected {
		t.Fatal("expected connected=true after session created")
	}
	if model.ActiveResponse != "Connected. Awaiting input." {
		t.Fatalf("expected connected message, got %q", model.ActiveResponse)
	}
}

func TestUpdateHandlesSessionErrorMsg(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	}))
	defer server.Close()

	m := NewModel(server.URL)
	updated, _ := m.Update(sessionErrorMsg{err: fmt.Errorf("connection refused")})

	model := updated.(Model)
	if model.Connected {
		t.Fatal("expected connected=false after session error")
	}
	if model.ActiveResponse != "Bridge error: connection refused" {
		t.Fatalf("expected error message in active response, got %q", model.ActiveResponse)
	}
}

func TestUpdateHandlesBridgeEventDelta(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	}))
	defer server.Close()

	m := NewModel(server.URL)
	m.Connected = true
	m.SessionID = "s1"

	// response.started clears the active buffer
	started, _ := m.Update(bridgeEventMsg{
		event: bridge.Event{Type: "response.started", SessionID: "s1"},
	})
	m = started.(Model)
	if m.ActiveResponse != "" {
		t.Fatalf("expected empty active response after started, got %q", m.ActiveResponse)
	}

	// response.delta appends
	updated, _ := m.Update(bridgeEventMsg{
		event: bridge.Event{
			Type:      "response.delta",
			SessionID: "s1",
			Delta:     "world",
		},
	})

	model := updated.(Model)
	if model.ActiveResponse != "world" {
		t.Fatalf("expected active response 'world', got %q", model.ActiveResponse)
	}
}

func TestUpdateHandlesBridgeEventCommitHistory(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	}))
	defer server.Close()

	m := NewModel(server.URL)
	m.Connected = true
	m.SessionID = "s1"

	updated, _ := m.Update(bridgeEventMsg{
		event: bridge.Event{
			Type:      "response.committed",
			SessionID: "s1",
			Content:   "final answer",
		},
	})

	model := updated.(Model)
	if len(model.History) != 1 || model.History[0] != "final answer" {
		t.Fatalf("expected committed history [final answer], got %v", model.History)
	}
}
