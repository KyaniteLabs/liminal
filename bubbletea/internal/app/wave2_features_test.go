package app

import (
	"strings"
	"testing"

	"github.com/Pastorsimon1798/liminal/bubbletea/internal/bridge"
)

// --- SSE Reconnection Tests ---

func TestStreamDisconnectedSetsReconnecting(t *testing.T) {
	m := NewModel("http://localhost:0")
	m.Connected = true
	m.SessionID = "s1"

	updated, _ := m.Update(streamDisconnectedMsg{err: nil})
	model := updated.(Model)

	if !model.Reconnecting {
		t.Fatal("expected reconnecting=true after stream disconnect")
	}
	if model.Connected {
		t.Fatal("expected connected=false after stream disconnect")
	}
	if model.ActiveResponse != "Reconnecting..." {
		t.Fatalf("expected reconnecting message, got %q", model.ActiveResponse)
	}
}

func TestReconnectTickRestoresConnection(t *testing.T) {
	m := NewModel("http://localhost:0")
	m.Connected = false
	m.Reconnecting = true
	m.SessionID = "s1"

	updated, _ := m.Update(reconnectTickMsg{})
	model := updated.(Model)

	if !model.Connected {
		t.Fatal("expected connected=true after reconnect tick")
	}
	if model.Reconnecting {
		t.Fatal("expected reconnecting=false after reconnect tick")
	}
	if model.ActiveResponse != "Reconnected. Awaiting input." {
		t.Fatalf("expected reconnected message, got %q", model.ActiveResponse)
	}
}

// --- Scrollable History Tests ---

func TestAutoScrollOnCommitted(t *testing.T) {
	m := NewModel("http://localhost:0")
	m.Connected = true
	m.SessionID = "s1"
	// Pre-fill 25 history entries
	for i := 0; i < 25; i++ {
		m.History = append(m.History, "line "+string(rune('A'+i)))
	}
	m.HistoryOffset = 0

	// Commit a new entry — should auto-scroll to bottom
	updated, _ := m.Update(bridgeEventMsg{
		event: bridge.Event{Type: "response.committed", SessionID: "s1", Content: "new line"},
	})
	model := updated.(Model)

	if model.HistoryOffset == 0 {
		t.Fatal("expected auto-scroll on new committed entry, offset stayed at 0")
	}
	if model.History[len(model.History)-1] != "new line" {
		t.Fatal("expected new line appended to history")
	}
}

func TestScrollClamp(t *testing.T) {
	m := NewModel("http://localhost:0")
	m.History = []string{"a", "b", "c"}
	m.HistoryOffset = 10 // way past end

	rendered := m.renderHistoryPane()
	if !strings.Contains(rendered, "a") {
		t.Fatal("expected clamped scroll to show earliest entries")
	}
}

// --- Command Routing Tests ---

func TestParseInputIntentCommands(t *testing.T) {
	tests := []struct {
		input      string
		wantMode   string
		wantIntent string
	}{
		{"/status", "inspect", "command"},
		{"/tasks", "inspect", "command"},
		{"/help", "inspect", "command"},
		{"/run M1", "action", "command"},
		{"/agent fix this", "action", "command"},
		{"/preview file.html", "action", "command"},
		{"/play audio.wav", "action", "command"},
		{"/stop", "chat", "command"},
		{"/confirm a1", "action", "command"},
		{"/cancel a1", "action", "command"},
		{"hello world", "chat", "chat"},
		{"what is p5.js?", "chat", "chat"},
	}
	for _, tt := range tests {
		mode, intent := parseInputIntent(tt.input)
		if mode != tt.wantMode {
			t.Errorf("parseInputIntent(%q) mode = %q, want %q", tt.input, mode, tt.wantMode)
		}
		if intent != tt.wantIntent {
			t.Errorf("parseInputIntent(%q) intent = %q, want %q", tt.input, intent, tt.wantIntent)
		}
	}
}

func TestCommandRoutingSendsCorrectMode(t *testing.T) {
	// Verify parseInputIntent returns correct values for /status
	mode, intent := parseInputIntent("/status")
	if mode != "inspect" || intent != "command" {
		t.Fatalf("expected inspect/command for /status, got %s/%s", mode, intent)
	}
}

// --- Inspect Mode via ApplyEvent ---

func TestApplyEventHandlesModeChangedToInspect(t *testing.T) {
	m := NewModel("http://localhost:0")
	m.ApplyEvent(bridge.Event{Type: "mode.changed", SessionID: "s1", Mode: "inspect"})
	if m.Mode != "INSPECT" {
		t.Fatalf("expected INSPECT mode, got %s", m.Mode)
	}
}

func TestViewRendersReconnectStatus(t *testing.T) {
	m := NewModel("http://localhost:0")
	m.Connected = false
	m.Reconnecting = true
	m.SessionID = "s1"

	view := m.View()
	if !strings.Contains(view, "reconnecting...") {
		t.Fatal("expected reconnecting status in view")
	}
}

func TestViewRendersScrollIndicator(t *testing.T) {
	m := NewModel("http://localhost:0")
	m.Connected = true
	// Add enough history to overflow pane
	for i := 0; i < 25; i++ {
		m.History = append(m.History, "entry "+string(rune('A'+i)))
	}
	m.HistoryOffset = 5

	view := m.View()
	if !strings.Contains(view, "PgUp/PgDn") {
		t.Fatal("expected scroll indicator in view when history overflows")
	}
}
