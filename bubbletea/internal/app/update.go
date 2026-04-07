package app

import (
	"context"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/Pastorsimon1798/liminal/bubbletea/internal/bridge"
)

// Messages for async bridge operations

type sessionCreatedMsg struct {
	status bridge.SessionStatus
}

type sessionErrorMsg struct {
	err error
}

type bridgeEventMsg struct {
	event bridge.Event
}

type inputSubmittedMsg struct{}

type inputErrorMsg struct {
	err error
}

type actionConfirmedMsg struct{}

type actionErrorMsg struct {
	err error
}

func (m Model) Init() tea.Cmd {
	return func() tea.Msg {
		ctx := context.Background()
		status, err := m.Bridge.CreateSession(ctx)
		if err != nil {
			return sessionErrorMsg{err: err}
		}
		return sessionCreatedMsg{status: status}
	}
}

// startStreamCmd returns a Cmd that opens the SSE stream and pumps events
// into the program. It blocks until the context is cancelled or the stream ends.
func (m Model) startStreamCmd() tea.Cmd {
	return func() tea.Msg {
		ctx := context.Background()
		var lastEvent bridge.Event
		err := m.Bridge.StreamEvents(ctx, m.SessionID, func(e bridge.Event) {
			lastEvent = e
		})
		if err != nil && lastEvent.Type == "" {
			return sessionErrorMsg{err: err}
		}
		// When the stream ends (server closed, etc), return the last event
		// so the UI doesn't hang. A real production client would reconnect.
		if lastEvent.Type != "" {
			return bridgeEventMsg{event: lastEvent}
		}
		return nil
	}
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.Width = msg.Width
		m.Height = msg.Height
		return m, nil

	case sessionCreatedMsg:
		m.SessionID = msg.status.SessionID
		m.Connected = true
		m.ActiveResponse = "Connected. Awaiting input."
		if msg.status.Provider != "" {
			m.Provider = msg.status.Provider
		}
		if msg.status.Model != "" {
			m.ModelName = msg.status.Model
		}
		return m, m.startStreamCmd()

	case sessionErrorMsg:
		m.Connected = false
		m.Err = msg.err.Error()
		m.ActiveResponse = "Bridge error: " + msg.err.Error()
		return m, nil

	case bridgeEventMsg:
		m.ApplyEvent(msg.event)
		return m, nil

	case inputSubmittedMsg:
		m.ActiveResponse = "Streaming response..."
		return m, nil

	case inputErrorMsg:
		m.ActiveResponse = "Input error: " + msg.err.Error()
		return m, nil

	case actionConfirmedMsg:
		return m, nil

	case actionErrorMsg:
		m.ActiveResponse = "Action error: " + msg.err.Error()
		return m, nil

	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit

		case "y":
			if cmd := m.ConfirmPendingAction(); cmd != nil {
				return m, cmd
			}

		case "n":
			if cmd := m.CancelPendingAction(); cmd != nil {
				return m, cmd
			}

		case "backspace":
			if len(m.Input) > 0 {
				m.Input = m.Input[:len(m.Input)-1]
			}

		case "enter":
			if m.Input == "" {
				return m, nil
			}
			input := m.Input
			m.Input = ""
			if !m.Connected {
				m.ActiveResponse = "Not connected to bridge."
				return m, nil
			}
			// Submit input asynchronously through the bridge
			cmd := func() tea.Msg {
				err := m.Bridge.SubmitInput(context.Background(), m.SessionID, "chat", input, "chat")
				if err != nil {
					return inputErrorMsg{err: err}
				}
				return inputSubmittedMsg{}
			}
			return m, cmd

		default:
			if len(msg.String()) == 1 {
				m.Input += msg.String()
			}
		}
	}
	return m, nil
}
