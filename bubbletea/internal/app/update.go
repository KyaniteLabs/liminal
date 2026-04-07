package app

import (
	"context"
	"fmt"
	"strings"
	"time"

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

type streamDisconnectedMsg struct {
	err error
}

type reconnectTickMsg struct{}

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

// startStreamCmd opens the SSE stream in a goroutine that calls program.Send
// for each event. When the stream disconnects, it sends streamDisconnectedMsg
// which triggers a reconnect attempt with backoff.
func (m Model) startStreamCmd() tea.Cmd {
	return func() tea.Msg {
		ctx := context.Background()
		var lastEvent bridge.Event
		err := m.Bridge.StreamEvents(ctx, m.SessionID, func(e bridge.Event) {
			lastEvent = e
		})
		if err != nil && ctx.Err() == nil {
			return streamDisconnectedMsg{err: err}
		}
		if lastEvent.Type != "" {
			return bridgeEventMsg{event: lastEvent}
		}
		return streamDisconnectedMsg{err: fmt.Errorf("stream ended")}
	}
}

// reconnectCmd waits with exponential backoff then attempts to reconnect
// by fetching status and restarting the stream.
func (m Model) reconnectCmd() tea.Cmd {
	return tea.Tick(2*time.Second, func(_ time.Time) tea.Msg {
		ctx := context.Background()
		_, err := m.Bridge.GetStatus(ctx, m.SessionID)
		if err != nil {
			return streamDisconnectedMsg{err: err}
		}
		return reconnectTickMsg{}
	})
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
		m.Reconnecting = false
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
		m.Reconnecting = false
		m.Err = msg.err.Error()
		m.ActiveResponse = "Bridge error: " + msg.err.Error()
		return m, nil

	case bridgeEventMsg:
		m.ApplyEvent(msg.event)
		// Auto-scroll history to bottom on new committed entries
		if msg.event.Type == "response.committed" {
			m.HistoryOffset = max(0, len(m.History)-historyPaneHeight(m.Height))
		}
		return m, nil

	case streamDisconnectedMsg:
		m.Connected = false
		m.Reconnecting = true
		m.ActiveResponse = "Reconnecting..."
		return m, m.reconnectCmd()

	case reconnectTickMsg:
		m.Connected = true
		m.Reconnecting = false
		m.ActiveResponse = "Reconnected. Awaiting input."
		return m, m.startStreamCmd()

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

		case "pgup":
			visibleHeight := historyPaneHeight(m.Height)
			m.HistoryOffset = max(0, m.HistoryOffset-visibleHeight)
			return m, nil

		case "pgdown":
			visibleHeight := historyPaneHeight(m.Height)
			maxOffset := max(0, len(m.History)-visibleHeight)
			m.HistoryOffset = min(maxOffset, m.HistoryOffset+visibleHeight)
			return m, nil

		case "up":
			if m.HistoryOffset > 0 {
				m.HistoryOffset--
			}
			return m, nil

		case "down":
			visibleHeight := historyPaneHeight(m.Height)
			maxOffset := max(0, len(m.History)-visibleHeight)
			if m.HistoryOffset < maxOffset {
				m.HistoryOffset++
			}
			return m, nil

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
			// Detect command intent from /prefix
			mode, intent := parseInputIntent(input)
			cmd := func() tea.Msg {
				err := m.Bridge.SubmitInput(context.Background(), m.SessionID, mode, input, intent)
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

// historyPaneHeight returns the number of lines the history pane can show.
func historyPaneHeight(termHeight int) int {
	// Header ~1, footer ~1, borders ~2, padding ~2 => ~6 overhead.
	// Pane height is hardcoded to 20 in view.go, but compute dynamically.
	paneHeight := 20
	if termHeight > 10 {
		paneHeight = (termHeight - 6) * 2 / 3
		if paneHeight < 5 {
			paneHeight = 5
		}
	}
	return paneHeight
}

// parseInputIntent detects /command prefixes and returns appropriate mode and intent.
func parseInputIntent(input string) (mode, intent string) {
	if strings.HasPrefix(input, "/") {
		parts := strings.SplitN(input, " ", 2)
		cmd := parts[0]
		switch cmd {
		case "/status", "/tasks", "/help", "/dogfood":
			return "inspect", "command"
		case "/confirm", "/cancel", "/run", "/agent":
			return "action", "command"
		case "/preview", "/play", "/browser":
			return "action", "command"
		case "/stop":
			return "chat", "command"
		default:
			return "chat", "command"
		}
	}
	return "chat", "chat"
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
