package app

import (
	"testing"

	"github.com/Pastorsimon1798/liminal/bubbletea/internal/bridge"
)

func TestApplyEventSeparatesActiveResponseFromCommittedHistory(t *testing.T) {
	m := NewModel("http://localhost:0")
	m.History = []string{}

	m.ApplyEvent(bridge.Event{Type: "response.started", SessionID: "s1"})
	if m.ActiveResponse != "" {
		t.Fatalf("expected empty active response after start, got %q", m.ActiveResponse)
	}

	m.ApplyEvent(bridge.Event{Type: "response.delta", SessionID: "s1", Delta: "hel"})
	m.ApplyEvent(bridge.Event{Type: "response.delta", SessionID: "s1", Delta: "lo"})
	if m.ActiveResponse != "hello" {
		t.Fatalf("expected active response hello, got %q", m.ActiveResponse)
	}
	if len(m.History) != 0 {
		t.Fatalf("expected no committed history before commit, got %d entries", len(m.History))
	}

	m.ApplyEvent(bridge.Event{Type: "response.completed", SessionID: "s1", Content: "hello"})
	m.ApplyEvent(bridge.Event{Type: "response.committed", SessionID: "s1", Content: "hello"})
	if len(m.History) != 1 || m.History[0] != "hello" {
		t.Fatalf("expected committed history to contain hello, got %#v", m.History)
	}
}
