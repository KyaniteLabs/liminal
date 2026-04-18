package app

import (
	"fmt"
	"strings"
	"testing"

	"github.com/Pastorsimon1798/liminal/bubbletea/internal/bridge"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

func readyModelForLayout(width, height int) Model {
	m := NewModel("http://localhost:0")
	m.Width = width
	m.Height = height
	m.Ready = true
	m.Connected = true
	metrics := m.layoutMetrics()
	m.ChatViewport = viewport.New(metrics.chatContentWidth, metrics.paneContentHeight)
	m.PreviewViewport = viewport.New(metrics.previewContentWidth, metrics.previewViewHeight)
	m.TextInput.SetWidth(metrics.chatContentWidth)
	return m
}

func TestViewHeightStaysWithinTerminalDuringStreaming(t *testing.T) {
	m := readyModelForLayout(120, 32)
	m.ApplyEvent(bridge.Event{Type: "response.started", SessionID: "s1"})
	m.ApplyEvent(bridge.Event{Type: "response.delta", SessionID: "s1", Delta: strings.Repeat("streaming response line\n", 80)})
	m.refreshViewports()

	view := m.View()
	if got := lipgloss.Height(view); got > m.Height {
		t.Fatalf("view height = %d, want <= %d", got, m.Height)
	}
}

func TestLayoutMetricsFitTerminalWidth(t *testing.T) {
	m := readyModelForLayout(120, 32)
	metrics := m.layoutMetrics()
	if metrics.chatOuterWidth+metrics.previewOuterWidth != m.Width {
		t.Fatalf("outer widths = %d, want %d", metrics.chatOuterWidth+metrics.previewOuterWidth, m.Width)
	}
	if metrics.paneContentHeight+uiFrameHeight() > metrics.bodyHeight {
		t.Fatalf("pane content overflows body: content=%d body=%d", metrics.paneContentHeight, metrics.bodyHeight)
	}
}

func uiFrameHeight() int { return 2 }

func TestViewShowsTypingIndicatorDuringStreaming(t *testing.T) {
	m := readyModelForLayout(120, 32)
	m.ApplyEvent(bridge.Event{Type: "response.started", SessionID: "s1"})
	m.ApplyEvent(bridge.Event{Type: "response.delta", SessionID: "s1", Delta: "streaming"})
	m.refreshViewports()

	view := m.View()
	if !strings.Contains(view, "Streaming") || !strings.Contains(view, "streaming") {
		t.Fatalf("expected streaming state in view, got %q", view)
	}
}

func TestActiveStreamingUsesLightweightRendering(t *testing.T) {
	m := readyModelForLayout(120, 32)
	m.ApplyEvent(bridge.Event{Type: "response.started", SessionID: "s1"})
	m.ApplyEvent(bridge.Event{Type: "response.delta", SessionID: "s1", Delta: "**streaming bold**"})

	view := visibleText(m.renderChatContent())
	if !strings.Contains(view, "**streaming bold**") {
		t.Fatalf("expected active stream to preserve lightweight markdown text, got %q", view)
	}
}

func TestActiveStreamingWrapsUnicodeSafely(t *testing.T) {
	m := readyModelForLayout(48, 32)
	m.ApplyEvent(bridge.Event{Type: "response.started", SessionID: "s1"})
	m.ApplyEvent(bridge.Event{Type: "response.delta", SessionID: "s1", Delta: "streaming café música 日本語 emoji ✨ without byte corruption"})

	view := visibleText(m.renderChatContent())
	for _, want := range []string{"café", "música", "日本語", "✨"} {
		if !strings.Contains(view, want) {
			t.Fatalf("expected unicode token %q to survive wrapping, got %q", want, view)
		}
	}
}

func TestCommittedResponseUsesMarkdownRendering(t *testing.T) {
	m := readyModelForLayout(120, 32)
	m.ApplyEvent(bridge.Event{Type: "response.committed", SessionID: "s1", Content: "**committed bold**"})

	view := visibleText(m.renderChatContent())
	if strings.Contains(view, "**committed bold**") {
		t.Fatalf("expected committed response to use markdown renderer, got %q", view)
	}
	if !strings.Contains(view, "committed bold") {
		t.Fatalf("expected committed response text, got %q", view)
	}
}

func TestCompletedResponseLeavesStreamingModeBeforeCommit(t *testing.T) {
	m := readyModelForLayout(120, 32)
	m.ApplyEvent(bridge.Event{Type: "response.started", SessionID: "s1"})
	m.ApplyEvent(bridge.Event{Type: "response.delta", SessionID: "s1", Delta: "**completed bold**"})
	m.ApplyEvent(bridge.Event{Type: "response.completed", SessionID: "s1", Content: "**completed bold**"})

	if m.IsStreaming {
		t.Fatal("expected response.completed to leave streaming mode")
	}
	view := visibleText(m.renderChatContent())
	if strings.Contains(view, "**completed bold**") {
		t.Fatalf("expected completed response to use markdown renderer, got %q", view)
	}
	if !strings.Contains(view, "completed bold") {
		t.Fatalf("expected completed response text, got %q", view)
	}
}

func TestViewShowsLiveToolThoughtTrace(t *testing.T) {
	m := readyModelForLayout(120, 32)
	m.ApplyEvent(bridge.Event{Type: "activity.updated", SessionID: "s1", Message: "readFile: inspect TuiBridgeService"})
	m.refreshViewports()

	view := m.View()
	if !strings.Contains(view, "Activity") {
		t.Fatalf("expected activity heading in view, got %q", view)
	}
	if !strings.Contains(view, "readFile: inspect TuiBridgeService") {
		t.Fatalf("expected live tool thought in view, got %q", view)
	}
}

func TestActivityLogKeepsRecentEntries(t *testing.T) {
	m := readyModelForLayout(120, 32)
	for i := 0; i < 12; i++ {
		m.ApplyEvent(bridge.Event{Type: "activity.updated", SessionID: "s1", Message: fmt.Sprintf("tool %d", i)})
	}

	if got := len(m.ActivityLog); got != 12 {
		t.Fatalf("activity log length = %d, want 12", got)
	}
	if m.ActivityLog[0].Message != "tool 0" {
		t.Fatalf("oldest retained activity = %q, want tool 0", m.ActivityLog[0].Message)
	}
}

func TestCopyLastResponseCopiesMarkdownToClipboard(t *testing.T) {
	m := readyModelForLayout(120, 32)
	m.ChatBlocks = append(m.ChatBlocks, ChatBlock{Type: "assistant", Content: "copy me"})
	copied := ""
	prev := copyToClipboard
	copyToClipboard = func(v string) error {
		copied = v
		return nil
	}
	defer func() { copyToClipboard = prev }()

	m.copyLastResponse()

	if copied != "copy me" {
		t.Fatalf("copied content = %q, want copy me", copied)
	}
}

func TestChatFocusCanScrollViewport(t *testing.T) {
	m := readyModelForLayout(120, 32)
	for i := 0; i < 80; i++ {
		m.ChatBlocks = append(m.ChatBlocks, ChatBlock{Type: "assistant", Content: fmt.Sprintf("line %d", i)})
	}
	m.refreshViewports()
	start := m.ChatViewport.YOffset

	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyPgUp})
	m2 := updated.(Model)
	if m2.ChatViewport.YOffset >= start {
		t.Fatalf("expected chat viewport to move up, got start=%d end=%d", start, m2.ChatViewport.YOffset)
	}
}
