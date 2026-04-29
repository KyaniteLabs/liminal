package app

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Pastorsimon1798/liminal/bubbletea/internal/bridge"
	tea "github.com/charmbracelet/bubbletea"
)

func TestApplyEventTracksActionAndConfirmModes(t *testing.T) {
	m := NewModel("http://localhost:0")
	action := &bridge.PendingAction{ID: "a1", Title: "Delete file", Description: "Delete file", Kind: "llm", RequiresConfirmation: true}

	m.ApplyEvent(bridge.Event{Type: "action.review_required", SessionID: "s1", Action: action})
	if m.Mode != "ACTION" {
		t.Fatalf("expected ACTION mode, got %s", m.Mode)
	}
	if m.PendingAction == nil || m.PendingAction.ID != "a1" {
		t.Fatalf("expected pending action a1, got %#v", m.PendingAction)
	}
	if len(m.ChatBlocks) == 0 || !strings.Contains(m.ChatBlocks[len(m.ChatBlocks)-1].Content, "Press y to approve") {
		t.Fatalf("expected visible approve instruction in chat blocks, got %#v", m.ChatBlocks)
	}
	if len(m.ActivityLog) == 0 || !strings.Contains(m.ActivityLog[len(m.ActivityLog)-1].Message, "Press y to approve") {
		t.Fatalf("expected visible approve instruction in activity log, got %#v", m.ActivityLog)
	}

	m.ApplyEvent(bridge.Event{Type: "action.confirmed", SessionID: "s1", ActionID: "a1"})
	if m.Mode != "CONFIRM" {
		t.Fatalf("expected CONFIRM mode, got %s", m.Mode)
	}
	if m.PendingAction != nil {
		t.Fatalf("expected pending action cleared after confirm")
	}
}

func TestConfirmActionSendsBridgeRequest(t *testing.T) {
	confirmCalled := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/tui/session/s1/actions/a1/confirm" && r.Method == http.MethodPost {
			confirmCalled = true
			fmt.Fprint(w, `{"ok":true}`)
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	m := NewModel(server.URL)
	m.Connected = true
	m.SessionID = "s1"
	m.Mode = "ACTION"
	m.PendingAction = &bridge.PendingAction{ID: "a1", Title: "Delete file", Kind: "llm", RequiresConfirmation: true}

	cmd := m.ConfirmPendingAction()
	if cmd == nil {
		t.Fatal("expected cmd from ConfirmPendingAction")
	}
	msg := cmd()
	if _, ok := msg.(actionConfirmedMsg); !ok {
		t.Fatalf("expected actionConfirmedMsg, got %T", msg)
	}
	if !confirmCalled {
		t.Fatal("expected confirm endpoint to be called")
	}
}

func TestConfirmKeyUsesPendingActionEvenWhenModeIsStale(t *testing.T) {
	confirmCalled := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/tui/session/s1/actions/a1/confirm" && r.Method == http.MethodPost {
			confirmCalled = true
			fmt.Fprint(w, `{"ok":true}`)
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	m := NewModel(server.URL)
	m.Connected = true
	m.SessionID = "s1"
	m.Mode = "IDLE"
	m.PendingAction = &bridge.PendingAction{ID: "a1", Title: "Approve task", Kind: "llm", RequiresConfirmation: true}

	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'y'}})
	if cmd == nil {
		t.Fatal("expected confirm command when pending action exists")
	}
	msg := cmd()
	if _, ok := msg.(actionConfirmedMsg); !ok {
		t.Fatalf("expected actionConfirmedMsg, got %T", msg)
	}
	if !confirmCalled {
		t.Fatal("expected confirm endpoint to be called")
	}
}

func TestCancelActionSendsBridgeRequest(t *testing.T) {
	cancelCalled := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/tui/session/s1/actions/a1/cancel" && r.Method == http.MethodPost {
			cancelCalled = true
			fmt.Fprint(w, `{"ok":true}`)
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	m := NewModel(server.URL)
	m.Connected = true
	m.SessionID = "s1"
	m.Mode = "ACTION"
	m.PendingAction = &bridge.PendingAction{ID: "a1", Title: "Delete file", Kind: "llm", RequiresConfirmation: true}

	cmd := m.CancelPendingAction()
	if cmd == nil {
		t.Fatal("expected cmd from CancelPendingAction")
	}
	msg := cmd()
	if _, ok := msg.(actionConfirmedMsg); !ok {
		t.Fatalf("expected actionConfirmedMsg (ack), got %T", msg)
	}
	if !cancelCalled {
		t.Fatal("expected cancel endpoint to be called")
	}
}

func TestConfirmReturnsNilOutsideActionMode(t *testing.T) {
	m := NewModel("http://localhost:0")
	m.Connected = true
	m.Mode = "CHAT"
	m.PendingAction = nil

	cmd := m.ConfirmPendingAction()
	if cmd != nil {
		t.Fatal("expected nil cmd when no pending action")
	}
}

func TestCancelReturnsNilWhenDisconnected(t *testing.T) {
	m := NewModel("http://localhost:0")
	m.Connected = false
	m.Mode = "ACTION"
	m.PendingAction = &bridge.PendingAction{ID: "a1", Title: "test", Kind: "llm", RequiresConfirmation: true}

	cmd := m.CancelPendingAction()
	if cmd != nil {
		t.Fatal("expected nil cmd when disconnected")
	}
}

func TestStopCommandCancelsActiveRun(t *testing.T) {
	cancelRunCalled := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/tui/session/s1/cancel" && r.Method == http.MethodPost {
			cancelRunCalled = true
			fmt.Fprint(w, `{"ok":true}`)
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	m := NewModel(server.URL)
	m.Connected = true
	m.SessionID = "s1"
	m.Ready = true
	m.Width = 120
	m.Height = 32
	m.TextInput.SetValue("/stop")

	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	if cmd == nil {
		t.Fatal("expected cancel command for /stop")
	}
	msg := cmd()
	if _, ok := msg.(runCancelledMsg); !ok {
		t.Fatalf("expected runCancelledMsg, got %T", msg)
	}
	if !cancelRunCalled {
		t.Fatal("expected active run cancel endpoint to be called")
	}
}

func TestViewShowsReviewCardHintsInActionMode(t *testing.T) {
	m := NewModel("http://localhost:0")
	m.Connected = true
	m.Mode = "ACTION"
	m.Ready = true
	m.Width = 120
	m.Height = 32
	m.PreviewVisible = false // compact status shows action card
	m.PendingAction = &bridge.PendingAction{ID: "a1", Title: "Delete file", Kind: "llm", RequiresConfirmation: true}

	view := m.View()
	if !strings.Contains(view, "Delete file") {
		t.Fatal("expected review card title in view")
	}
	if !strings.Contains(view, "[y] confirm") {
		t.Fatal("expected confirm hint in view")
	}
	if !strings.Contains(view, "[n] cancel") {
		t.Fatal("expected cancel hint in view")
	}
}

func TestViewShowsReviewInstructionsInConversationPane(t *testing.T) {
	m := NewModel("http://localhost:0")
	m.Connected = true
	m.Ready = true
	m.Width = 120
	m.Height = 32
	metrics := m.layoutMetrics()
	m.ChatViewport.Width = metrics.chatContentWidth
	m.ChatViewport.Height = metrics.chatViewportHeight
	m.PreviewViewport.Width = metrics.operatorContentWidth
	m.PreviewViewport.Height = metrics.operatorViewportHeight

	m.ApplyEvent(bridge.Event{
		Type: "action.review_required",
		Action: &bridge.PendingAction{
			ID:                   "a1",
			Title:                "Inspect repository",
			Description:          "Inspect git status",
			Kind:                 "structured",
			RequiresConfirmation: true,
		},
	})
	m.refreshViewports()

	view := m.View()
	for _, want := range []string{"Review required", "Inspect repository", "Press y to approve", "n to cancel"} {
		if !strings.Contains(view, want) {
			t.Fatalf("expected view to contain %q\n%s", want, view)
		}
	}
}
