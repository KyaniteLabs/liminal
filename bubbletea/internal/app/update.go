package app

import (
	"context"
	"strings"
	"time"

	"github.com/Pastorsimon1798/liminal/bubbletea/internal/bridge"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
)

// ── Messages for async bridge operations ──

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

type streamDoneMsg struct{}

type reconnectTickMsg struct{}

// ── Init ──

func (m Model) Init() tea.Cmd {
	return tea.Batch(m.TextInput.Focus(), m.createSessionCmd())
}

func (m Model) createSessionCmd() tea.Cmd {
	return func() tea.Msg {
		ctx := context.Background()
		status, err := m.Bridge.CreateSession(ctx)
		if err != nil {
			return sessionErrorMsg{err: err}
		}
		return sessionCreatedMsg{status: status}
	}
}

// ── SSE Streaming — FIXED: uses program.Send for real-time events ──

// startStreamCmd opens the SSE stream and sends each event via program.Send()
// as it arrives. This fixes the critical bug where only the last event was returned.
func (m Model) startStreamCmd() tea.Cmd {
	return func() tea.Msg {
		ctx := context.Background()
		// GlobalProgram fix (m.Program is nil inside Bubble Tea event loop)
		err := m.Bridge.StreamEvents(ctx, m.SessionID, func(e bridge.Event) {
			if GlobalProgram != nil {
				GlobalProgram.Send(bridgeEventMsg{event: e})
			}
		})
		if err != nil && ctx.Err() == nil {
			return streamDisconnectedMsg{err: err}
		}
		return streamDoneMsg{}
	}
}

// ── Reconnect with backoff ──

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

// ── Update ──

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.Width = msg.Width
		m.Height = msg.Height

		metrics := m.layoutMetrics()
		if !m.Ready {
			m.ChatViewport = viewport.New(metrics.chatContentWidth, metrics.chatViewportHeight)
			m.ChatViewport.Style = chatViewportStyle()
			m.ChatViewport.SetContent("Welcome to Liminal. Type a message to begin.")

			m.PreviewViewport = viewport.New(metrics.operatorContentWidth, metrics.operatorViewportHeight)
			m.PreviewViewport.Style = previewViewportStyle()
			m.PreviewViewport.SetContent(m.renderOperatorSurface(metrics.operatorContentWidth))

			m.TextInput.SetWidth(metrics.chatContentWidth)
			m.TextInput.SetHeight(ChatInputHeight)
			m.Ready = true
		} else {
			m.ChatViewport.Width = metrics.chatContentWidth
			m.ChatViewport.Height = metrics.chatViewportHeight
			m.PreviewViewport.Width = metrics.operatorContentWidth
			m.PreviewViewport.Height = metrics.operatorViewportHeight
			m.TextInput.SetWidth(metrics.chatContentWidth)
			m.TextInput.SetHeight(ChatInputHeight)
			m.refreshViewports()
		}
		return m, nil

	case sessionCreatedMsg:
		m.SessionID = msg.status.SessionID
		m.Connected = true
		m.Reconnecting = false
		if msg.status.Provider != "" {
			m.Provider = msg.status.Provider
		}
		if msg.status.Model != "" {
			m.ModelName = msg.status.Model
		}
		m.updateChatViewport("Connected. Type a message to begin.")
		return m, m.startStreamCmd()

	case sessionErrorMsg:
		m.Connected = false
		m.Reconnecting = false
		m.Err = msg.err.Error()
		m.updateChatViewport("Bridge error: " + msg.err.Error())
		return m, nil

	case bridgeEventMsg:
		m.ApplyEvent(msg.event)
		m.refreshViewports()
		return m, nil

	case streamDoneMsg:
		// Stream ended normally — restart it
		if m.Connected {
			return m, m.startStreamCmd()
		}
		return m, nil

	case streamDisconnectedMsg:
		m.Connected = false
		m.Reconnecting = true
		m.updateChatViewport("Reconnecting to bridge...")
		return m, m.reconnectCmd()

	case reconnectTickMsg:
		m.Connected = true
		m.Reconnecting = false
		m.updateChatViewport("Reconnected.")
		return m, m.startStreamCmd()

	case inputSubmittedMsg:
		return m, nil

	case inputErrorMsg:
		m.updateChatViewport("Input error: " + msg.err.Error())
		return m, nil

	case actionConfirmedMsg:
		return m, nil

	case actionErrorMsg:
		m.updateChatViewport("Action error: " + msg.err.Error())
		return m, nil

	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+y":
			m.copyLastResponse()
			m.refreshViewports()
			return m, nil
		case "ctrl+t":
			m.TimelineVisible = !m.TimelineVisible
			m.refreshViewports()
			return m, nil
		case "ctrl+a":
			m.ArtifactsVisible = !m.ArtifactsVisible
			m.refreshViewports()
			return m, nil
		case "ctrl+e":
			m.PreviewVisible = !m.PreviewVisible
			m.refreshViewports()
			return m, nil
		}

		if msg.String() == "?" {
			m.HelpVisible = !m.HelpVisible
			m.refreshViewports()
			return m, nil
		}

		// If textinput is focused and it's a regular key, pass to textinput first
		if m.FocusPane == FocusChat {
			if msg.Type == tea.KeyEnter {
				if msg.Alt {
					var cmd tea.Cmd
					m.TextInput, cmd = m.TextInput.Update(tea.KeyMsg{Type: tea.KeyEnter})
					return m, cmd
				}

				input := m.TextInput.Value()
				if input == "" {
					return m, nil
				}
				m.TextInput.SetValue("")

				// Add user block to chat
				m.ChatBlocks = append(m.ChatBlocks, ChatBlock{
					Type:    "user",
					Content: input,
					Time:    time.Now(),
				})

				if !m.Connected {
					m.updateChatViewport("Not connected to bridge.")
					return m, nil
				}

				mode, intent := parseInputIntent(input)
				cmd := func() tea.Msg {
					err := m.Bridge.SubmitInput(context.Background(), m.SessionID, mode, input, intent)
					if err != nil {
						return inputErrorMsg{err: err}
					}
					return inputSubmittedMsg{}
				}
				m.refreshViewports()
				return m, cmd
			}

			switch msg.String() {
			case "ctrl+c":
				return m, tea.Quit
			case "tab":
				m.FocusPane = FocusPreview
				m.TextInput.Blur()
				return m, nil

			case "y":
				if m.Mode == "ACTION" {
					if cmd := m.ConfirmPendingAction(); cmd != nil {
						return m, cmd
					}
				}
				// Fall through to textinput for normal typing
				var cmd tea.Cmd
				m.TextInput, cmd = m.TextInput.Update(msg)
				return m, cmd

			case "n":
				if m.Mode == "ACTION" {
					if cmd := m.CancelPendingAction(); cmd != nil {
						return m, cmd
					}
				}
				var cmd tea.Cmd
				m.TextInput, cmd = m.TextInput.Update(msg)
				return m, cmd

			default:
				var cmd tea.Cmd
				m.TextInput, cmd = m.TextInput.Update(msg)
				return m, cmd
			}
		}

		// Preview pane focus
		if m.FocusPane == FocusPreview {
			switch msg.String() {
			case "ctrl+c", "q":
				return m, tea.Quit
			case "tab":
				m.FocusPane = FocusChat
				m.TextInput.Focus()
				return m, nil
			case "esc":
				m.FocusPane = FocusChat
				m.TextInput.Focus()
				return m, nil
			default:
				var cmd tea.Cmd
				m.PreviewViewport, cmd = m.PreviewViewport.Update(msg)
				return m, cmd
			}
		}
	}

	return m, tea.Batch(cmds...)
}

// ── Viewport helpers ──

// updateChatViewport sets the chat content and scrolls to bottom.
func (m *Model) updateChatViewport(content string) {
	if m.Ready {
		m.ChatViewport.SetContent(content)
		m.ChatViewport.GotoBottom()
	}
}

// refreshViewports rebuilds both viewport contents from model state.
func (m *Model) refreshViewports() {
	if !m.Ready {
		return
	}

	// Rebuild chat content
	chatContent := m.renderChatContent()
	m.ChatViewport.SetContent(chatContent)
	m.ChatViewport.GotoBottom()

	m.PreviewViewport.SetContent(m.renderOperatorSurface(m.PreviewViewport.Width))
}

// ── Input parsing ──

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
