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
}

// --- ChatBlock Accumulation Tests ---

func TestCommittedEventCreatesChatBlock(t *testing.T) {
	m := NewModel("http://localhost:0")
	m.Connected = true
	m.SessionID = "s1"

	// Stream deltas then commit
	m.ApplyEvent(bridge.Event{Type: "response.delta", SessionID: "s1", Delta: "hello"})
	m.ApplyEvent(bridge.Event{Type: "response.delta", SessionID: "s1", Delta: " world"})
	m.ApplyEvent(bridge.Event{Type: "response.committed", SessionID: "s1", Content: "hello world"})

	if len(m.ChatBlocks) != 1 {
		t.Fatalf("expected 1 chat block after commit, got %d", len(m.ChatBlocks))
	}
	if m.ChatBlocks[0].Content != "hello world" {
		t.Fatalf("expected chat block content 'hello world', got %q", m.ChatBlocks[0].Content)
	}
	if m.ChatBlocks[0].Type != "assistant" {
		t.Fatalf("expected assistant type, got %q", m.ChatBlocks[0].Type)
	}
}

func TestCodeDetectionTriggersPreview(t *testing.T) {
	m := NewModel("http://localhost:0")
	m.Connected = true
	m.SessionID = "s1"

	codeContent := "Here is some code:\n```javascript\nfunction setup() {\n  createCanvas(400, 400);\n}\n```"
	m.ApplyEvent(bridge.Event{Type: "response.committed", SessionID: "s1", Content: codeContent})

	if !m.PreviewVisible {
		t.Fatal("expected preview to become visible when code is detected")
	}
	if m.PreviewType != "code" {
		t.Fatalf("expected preview type 'code', got %q", m.PreviewType)
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

func TestViewRendersConnectionDot(t *testing.T) {
	m := NewModel("http://localhost:0")
	m.Connected = true
	m.Ready = true
	m.Width = 120
	m.Height = 32

	view := m.View()
	if !strings.Contains(view, "●") {
		t.Fatal("expected connected dot ● in view")
	}
}

func TestPreviewEventsUpdateState(t *testing.T) {
	m := NewModel("http://localhost:0")

	m.ApplyEvent(bridge.Event{Type: "preview.started", SessionID: "s1", PreviewType: "image"})
	if !m.PreviewVisible || m.PreviewType != "image" {
		t.Fatal("expected preview visible with type image after preview.started")
	}

	m.ApplyEvent(bridge.Event{Type: "preview.content", SessionID: "s1", Content: "base64data", PreviewType: "image"})
	if m.PreviewContent != "base64data" {
		t.Fatalf("expected preview content 'base64data', got %q", m.PreviewContent)
	}

	m.ApplyEvent(bridge.Event{Type: "preview.completed", SessionID: "s1", Content: "final", PreviewType: "code"})
	if m.PreviewContent != "final" || m.PreviewType != "code" {
		t.Fatalf("expected final code preview, got %q / %q", m.PreviewContent, m.PreviewType)
	}
}
