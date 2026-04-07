package app

import (
	"context"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/Pastorsimon1798/liminal/bubbletea/internal/bridge"
)

type Model struct {
	Mode           string
	History        []string
	ActiveResponse string
	Input          string
	Width          int
	Height         int
	Provider       string
	ModelName      string
	TrustLabel     string
	PendingAction  *bridge.PendingAction

	// Live bridge state
	Bridge       *bridge.Client
	SessionID    string
	Connected    bool
	Reconnecting bool
	Err          string

	// Scroll state
	HistoryOffset int
}

func NewModel(bridgeURL string) Model {
	return Model{
		Mode:           "CHAT",
		History:        []string{},
		ActiveResponse: "Connecting to bridge...",
		Input: "",
		Width:  120,
		Height: 32,
		Provider: "pending",
		ModelName: "bridge",
		TrustLabel: "Generated code is untrusted by default",
		Bridge:    bridge.NewClient(bridgeURL),
	}
}

func (m *Model) ApplyEvent(event bridge.Event) {
	switch event.Type {
	case "response.started":
		m.ActiveResponse = ""
	case "response.delta":
		m.ActiveResponse += event.Delta
	case "response.completed":
		m.ActiveResponse = event.Content
	case "response.committed":
		m.History = append(m.History, event.Content)
	case "action.review_required":
		m.Mode = "ACTION"
		m.PendingAction = event.Action
	case "action.confirmed":
		m.Mode = "CONFIRM"
		m.PendingAction = nil
	case "action.cancelled":
		m.Mode = "CHAT"
		m.PendingAction = nil
	case "mode.changed":
		m.Mode = strings.ToUpper(event.Mode)
	case "status.updated":
		if event.Status != nil {
			m.Mode = strings.ToUpper(event.Status.Mode)
			m.PendingAction = event.Status.PendingAction
			if event.Status.Provider != "" {
				m.Provider = event.Status.Provider
			}
			if event.Status.Model != "" {
				m.ModelName = event.Status.Model
			}
			m.TrustLabel = event.Status.Trust.Label
		}
	case "trust.updated":
		if event.Trust != nil {
			m.TrustLabel = event.Trust.Label
		}
	}
}

func (m Model) StatusLines() []string {
	lines := []string{
		"Provider/Model: " + m.Provider + "/" + m.ModelName,
		"Trust: " + m.TrustLabel,
		"Mode: " + m.Mode,
	}
	if m.PendingAction != nil {
		lines = append(lines, "Pending: "+m.PendingAction.Title)
	}
	return lines
}

// ConfirmPendingAction sends a confirm request to the bridge.
// Returns nil if not in ACTION mode, no pending action, or not connected.
func (m Model) ConfirmPendingAction() tea.Cmd {
	if m.Mode != "ACTION" || m.PendingAction == nil || !m.Connected {
		return nil
	}
	actionID := m.PendingAction.ID
	client := m.Bridge
	sessionID := m.SessionID
	return func() tea.Msg {
		err := client.ConfirmAction(context.Background(), sessionID, actionID)
		if err != nil {
			return actionErrorMsg{err: err}
		}
		return actionConfirmedMsg{}
	}
}

// CancelPendingAction sends a cancel request to the bridge.
// Returns nil if not in ACTION mode, no pending action, or not connected.
func (m Model) CancelPendingAction() tea.Cmd {
	if m.Mode != "ACTION" || m.PendingAction == nil || !m.Connected {
		return nil
	}
	actionID := m.PendingAction.ID
	client := m.Bridge
	sessionID := m.SessionID
	return func() tea.Msg {
		err := client.CancelAction(context.Background(), sessionID, actionID)
		if err != nil {
			return actionErrorMsg{err: err}
		}
		return actionConfirmedMsg{}
	}
}
