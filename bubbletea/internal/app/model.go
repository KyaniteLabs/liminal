package app

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Pastorsimon1798/liminal/bubbletea/internal/bridge"
	"github.com/Pastorsimon1798/liminal/bubbletea/internal/ui"
	"github.com/atotto/clipboard"
	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/glamour"
)

// ChatBlock represents a single structured entry in the chat history.
type ChatBlock struct {
	Type    string // "user" | "assistant" | "code" | "system" | "error"
	Content string
	Time    time.Time
	Preview string // Optional inline preview (base64 image or code snippet)
}

// FocusPane tracks which pane has keyboard focus.
type FocusPane int

const (
	FocusChat FocusPane = iota
	FocusPreview
)

type Model struct {
	// Layout dimensions
	Width  int
	Height int

	// Two-column viewports
	ChatViewport    viewport.Model
	PreviewViewport viewport.Model
	TextInput       textinput.Model
	Spinner         spinner.Model
	Program         *tea.Program
	Ready           bool
	FocusPane       FocusPane

	// Chat state
	ChatBlocks      []ChatBlock
	ActiveResponse  string
	Input           string
	IsStreaming     bool
	ActivityMessage string
	ActivityLog     []string
	LastNotice      string
	TranscriptPath  string
	LastCopy        string // tracks what was last copied so user can re-copy

	// Preview state
	PreviewContent string // Current preview content
	PreviewType    string // "code" | "image" | "html" | "music" | ""
	PreviewTab     string // "code" | "output" | "log"
	PreviewVisible bool

	// Session metadata
	Mode          string
	Provider      string
	ModelName     string
	TrustLabel    string
	PendingAction *bridge.PendingAction

	// Generation telemetry
	GenerationModel      string
	GenerationDuration   int64 // ms
	GenerationIterations int
	GenerationScore      float64
	GenerationReason     string
	CurrentIteration     int

	// Swarm round telemetry
	SwarmRound          int
	SwarmTotalRounds    int
	SwarmVocabularySize int

	// Live bridge state
	Bridge       *bridge.Client
	SessionID    string
	Connected    bool
	Reconnecting bool
	Err          string

	// Glamour markdown renderer
	Renderer *glamour.TermRenderer
}

func NewModel(bridgeURL string) Model {
	ti := textinput.New()
	ti.Placeholder = "Type your message..."
	ti.Prompt = "> "
	ti.CharLimit = 16000 // generous limit for pasted content
	ti.Width = 80

	// Create glamour renderer for markdown + syntax highlighting
	renderer, err := glamour.NewTermRenderer(
		glamour.WithStandardStyle("dark"),
		glamour.WithWordWrap(80),
	)
	if err != nil {
		renderer = nil
	}
	spin := spinner.New(
		spinner.WithSpinner(spinner.MiniDot),
		spinner.WithStyle(ui.StreamingStyle),
	)

	return Model{
		Mode:            "CHAT",
		ChatBlocks:      []ChatBlock{},
		ActiveResponse:  "",
		Input:           "",
		IsStreaming:     false,
		ActivityMessage: "",
		ActivityLog:     []string{},
		LastNotice:      "",
		TranscriptPath:  os.Getenv("LIMINAL_TUI_TRANSCRIPT_PATH"),
		Width:           120,
		Height:          32,
		Provider:        "pending",
		ModelName:       "bridge",
		TrustLabel:      "Generated code is untrusted by default",
		Bridge:          bridge.NewClient(bridgeURL),
		TextInput:       ti,
		Spinner:         spin,
		Renderer:        renderer,
		FocusPane:       FocusChat,
		PreviewTab:      "code",
		PreviewVisible:  true,
	}
}

func (m *Model) ApplyEvent(event bridge.Event) {
	switch event.Type {
	case "response.started":
		m.ActiveResponse = ""
		m.IsStreaming = true
		m.ActivityMessage = "GLM is thinking"
	case "response.delta":
		m.ActiveResponse += event.Delta
		m.IsStreaming = true
	case "response.completed":
		m.ActiveResponse = event.Content
		m.ActivityMessage = "finalizing response"
	case "response.committed":
		// Add assistant block to chat history
		m.ChatBlocks = append(m.ChatBlocks, ChatBlock{
			Type:    "assistant",
			Content: event.Content,
			Time:    time.Now(),
		})
		m.appendTranscript("assistant", event.Content)
		// Check for code content to show in preview
		if containsCode(event.Content) {
			m.PreviewContent = extractCode(event.Content)
			m.PreviewType = "code"
			m.PreviewVisible = true
		}
		m.ActiveResponse = ""
		m.IsStreaming = false
		m.ActivityMessage = ""
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
	case "error":
		m.ChatBlocks = append(m.ChatBlocks, ChatBlock{
			Type:    "error",
			Content: event.Message,
			Time:    time.Now(),
		})
		m.appendTranscript("error", event.Message)
		m.ActiveResponse = ""
		m.IsStreaming = false
		m.ActivityMessage = ""
	case "activity.updated":
		m.ActivityMessage = event.Message
		m.addActivity(event.Message)
		m.IsStreaming = true
	case "preview.started":
		m.PreviewType = event.PreviewType
		m.PreviewVisible = true
	case "preview.content":
		m.PreviewContent = event.Content
		m.PreviewType = event.PreviewType
		m.PreviewVisible = true
	case "preview.completed":
		m.PreviewContent = event.Content
		m.PreviewType = event.PreviewType
		if event.ImageUrl != "" {
			m.PreviewContent = event.ImageUrl
			m.PreviewType = "image"
		}
		m.PreviewVisible = true
	case "generation.iteration":
		m.CurrentIteration = event.Iteration
		m.GenerationScore = event.Score
	case "generation.complete":
		m.GenerationIterations = event.Iterations
		m.GenerationScore = event.FinalScore
		m.GenerationDuration = event.Duration
		m.GenerationModel = event.Model
		m.GenerationReason = event.Reason
		// Add generation summary as a system block
		summary := fmt.Sprintf("Generation complete: %d iterations, score %.2f, model %s (%s)",
			event.Iterations, event.FinalScore, event.Model, event.Reason)
		m.ChatBlocks = append(m.ChatBlocks, ChatBlock{
			Type:    "system",
			Content: summary,
			Time:    time.Now(),
		})
		m.appendTranscript("system", summary)
		m.IsStreaming = false
		m.ActivityMessage = ""
	case "response.metadata":
		if event.Model != "" {
			m.ModelName = event.Model
		}
		if event.Duration > 0 {
			m.GenerationDuration = event.Duration
		}
	case "swarm.round":
		m.SwarmRound = event.Round
		m.SwarmTotalRounds = event.TotalRounds
		m.SwarmVocabularySize = event.VocabularySize
	}
}

func (m Model) lastAssistantResponse() string {
	for i := len(m.ChatBlocks) - 1; i >= 0; i-- {
		if m.ChatBlocks[i].Type == "assistant" {
			return m.ChatBlocks[i].Content
		}
	}
	return m.ActiveResponse
}

func (m *Model) addActivity(message string) {
	message = strings.TrimSpace(message)
	if message == "" {
		return
	}
	m.ActivityLog = append(m.ActivityLog, message)
	if len(m.ActivityLog) > 8 {
		m.ActivityLog = m.ActivityLog[len(m.ActivityLog)-8:]
	}
	m.appendTranscript("activity", message)
}

func (m *Model) saveLastResponse() {
	content := m.lastAssistantResponse()
	if strings.TrimSpace(content) == "" {
		m.LastNotice = "nothing to copy yet"
		return
	}
	path, fileErr := m.writeLastResponseFile(content)
	clipErr := clipboard.WriteAll(content)
	m.LastCopy = content
	switch {
	case clipErr == nil && fileErr == nil:
		m.LastNotice = "copied to clipboard and saved to " + path
	case clipErr == nil:
		m.LastNotice = "copied to clipboard; file save failed: " + fileErr.Error()
	case fileErr == nil:
		m.LastNotice = "clipboard failed: " + clipErr.Error() + "; saved to " + path
	default:
		m.LastNotice = "copy failed: " + clipErr.Error() + "; file save failed: " + fileErr.Error()
	}
}

func (m *Model) writeLastResponseFile(content string) (string, error) {
	root := os.Getenv("LIMINAL_ROOT")
	if root == "" {
		root = "."
	}
	path := filepath.Join(root, ".omx", "logs", "bubbletea-last-response.md")
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return path, err
	}
	return path, os.WriteFile(path, []byte(content), 0o644)
}

func (m *Model) appendTranscript(role, content string) {
	if m.TranscriptPath == "" || strings.TrimSpace(content) == "" {
		return
	}
	if err := os.MkdirAll(filepath.Dir(m.TranscriptPath), 0o755); err != nil {
		m.LastNotice = "transcript failed: " + err.Error()
		return
	}
	entry := fmt.Sprintf("\n\n## %s — %s\n\n%s\n", role, time.Now().Format(time.RFC3339), content)
	if err := appendFile(m.TranscriptPath, entry); err != nil {
		m.LastNotice = "transcript failed: " + err.Error()
	}
}

func appendFile(path, content string) error {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = f.WriteString(content)
	return err
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

// containsCode checks if content has code blocks.
func containsCode(content string) bool {
	return strings.Contains(content, "```") ||
		strings.Contains(content, "function ") ||
		strings.Contains(content, "const ") && strings.Contains(content, " = ")
}

// extractCode pulls code from markdown fences or raw code.
func extractCode(content string) string {
	// Try markdown fence extraction
	if idx := strings.Index(content, "```"); idx >= 0 {
		rest := content[idx+3:]
		// Skip language tag line
		if nlIdx := strings.Index(rest, "\n"); nlIdx >= 0 {
			rest = rest[nlIdx+1:]
		}
		if endIdx := strings.Index(rest, "```"); endIdx >= 0 {
			return strings.TrimSpace(rest[:endIdx])
		}
		return strings.TrimSpace(rest)
	}
	return content
}
