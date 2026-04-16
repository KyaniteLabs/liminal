package app

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/Pastorsimon1798/liminal/bubbletea/internal/bridge"
	"github.com/Pastorsimon1798/liminal/bubbletea/internal/ui"
	"github.com/atotto/clipboard"
	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/glamour"
)

var copyToClipboard = clipboard.WriteAll

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

// AgentPhase represents the current phase of agent execution.
type AgentPhase string

const (
	PhaseIdle    AgentPhase = "Idle"
	PhasePlan    AgentPhase = "Plan"
	PhaseInspect AgentPhase = "Inspect"
	PhaseEdit    AgentPhase = "Edit"
	PhaseVerify  AgentPhase = "Verify"
	PhaseReport  AgentPhase = "Report"
)

// ToolStep represents a single tool invocation on the timeline.
type ToolStep struct {
	StepNum       int
	ToolName      string
	Thought       string // Sanitized operator-safe rationale
	ArgsSummary   string // Short summary of arguments
	Status        string // "running" | "success" | "failed"
	ResultSummary string
	StartedAt     time.Time
	CompletedAt   time.Time
}

// ChangedFile tracks a file modified by the agent.
type ChangedFile struct {
	Path     string
	Status   string // "modified" | "created" | "deleted"
	IsLatest bool
}

// VerificationJob tracks a build/test/typecheck command.
type VerificationJob struct {
	JobID       string
	Command     string
	Status      string // "running" | "pass" | "fail"
	OutputTail  string
	StartedAt   time.Time
	CompletedAt time.Time
	Duration    int64 // ms
}

// ArtifactRef is a discoverable artifact path.
type ArtifactRef struct {
	Label     string
	Path      string
	UpdatedAt time.Time
}

// ActivityLogEntry is a timestamped operator-facing log message.
type ActivityLogEntry struct {
	Message   string
	Timestamp time.Time
}

// TaskQueueEntry tracks an engineering task in the queue.
type TaskQueueEntry struct {
	TaskID      string
	Description string
	Status      string // "queued" | "running" | "completed" | "failed"
	QueuedAt    time.Time
	StartedAt   time.Time
	CompletedAt time.Time
	DurationMs  int64
}

// SessionTurnEntry records a StudioAgent routing decision.
type SessionTurnEntry struct {
	TurnID      string
	Intent      string
	DelegatedTo string
	DurationMs  int64
	Timestamp   time.Time
}

// TaskCard holds the current agent objective and progress.
type TaskCard struct {
	Objective   string
	Phase       AgentPhase
	StepCurrent int
	StepTotal   int
	ActiveFile  string
}

const (
	// MaxTimelineEntries bounds the tool timeline display.
	MaxTimelineEntries = 50
	// MaxActivityLog bounds the activity log.
	MaxActivityLog = 100
	// MaxChangedFiles bounds the changed files list.
	MaxChangedFiles = 100
	// ChatInputHeight keeps the textarea compact while supporting multiline input.
	ChatInputHeight = 3
)

type Model struct {
	// Layout dimensions
	Width  int
	Height int

	// Two-column viewports
	ChatViewport    viewport.Model
	PreviewViewport viewport.Model
	TextInput       textarea.Model
	Program         *tea.Program
	Ready           bool
	FocusPane       FocusPane

	// Chat state
	ChatBlocks     []ChatBlock
	ActiveResponse string
	Input          string

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

	// ── Operator surface state ──

	// Task card: what the agent is trying to do
	Task TaskCard

	// Tool timeline: ordered list of tool invocations
	ToolTimeline []ToolStep

	// Changed files: files mutated by the agent
	ChangedFiles  []ChangedFile
	MutationCount int

	// Verification jobs: running build/test/typecheck commands
	VerificationJobs []VerificationJob

	// Artifacts: discoverable output paths
	Artifacts []ArtifactRef

	// Activity log: recent operator-facing messages
	ActivityLog []ActivityLogEntry

	// Task queue: engineering tasks tracked by ConveyorRunner
	TaskQueue    []TaskQueueEntry
	SessionTurns []SessionTurnEntry

	// Surface visibility toggles
	TimelineVisible  bool
	ArtifactsVisible bool
	QueueVisible     bool
	HelpVisible      bool

	// Live bridge state
	Bridge       *bridge.Client
	SessionID    string
	Connected    bool
	Reconnecting bool
	Err          string

	// Glamour markdown renderer
	Renderer *glamour.TermRenderer
}

// layoutMetrics holds computed layout dimensions for the two-column view.
type layoutMetrics struct {
	chatContentWidth      int
	chatOuterWidth        int
	chatViewportHeight    int
	previewContentWidth   int
	previewOuterWidth     int
	previewViewHeight     int
	operatorContentWidth  int
	operatorViewportHeight int
	paneContentHeight     int
	bodyHeight            int
}

const (
	headerHeight = 1
	footerHeight = 2
	paneGap      = 2 // horizontal gap between panes
)

func (m Model) layoutMetrics() layoutMetrics {
	bodyHeight := m.Height - headerHeight - footerHeight
	chatOuterWidth := m.Width / 2
	previewOuterWidth := m.Width - chatOuterWidth
	chatContentWidth := max(chatOuterWidth-paneGap, 20)
	operatorContentWidth := max(previewOuterWidth-paneGap, 20)
	paneContentHeight := max(bodyHeight-2, 4) // minus pane header + border
	chatViewportHeight := max(paneContentHeight-2, 4)
	operatorViewportHeight := max(paneContentHeight-2, 4)

	return layoutMetrics{
		chatContentWidth:      chatContentWidth,
		chatOuterWidth:        chatOuterWidth,
		chatViewportHeight:    chatViewportHeight,
		previewContentWidth:   operatorContentWidth,
		previewOuterWidth:     previewOuterWidth,
		previewViewHeight:     operatorViewportHeight,
		operatorContentWidth:  operatorContentWidth,
		operatorViewportHeight: operatorViewportHeight,
		paneContentHeight:     paneContentHeight,
		bodyHeight:            bodyHeight,
	}
}

func NewModel(bridgeURL string) Model {
	ti := textarea.New()
	ti.Placeholder = "Type your message..."
	ti.Prompt = "> "
	ti.CharLimit = 2000
	ti.ShowLineNumbers = false
	ti.SetHeight(ChatInputHeight)
	ti.SetWidth(80)
	ti.FocusedStyle, ti.BlurredStyle = ui.TextareaStyles()
	_ = ti.Focus()

	// Create glamour renderer for markdown + syntax highlighting
	renderer, err := glamour.NewTermRenderer(
		glamour.WithStandardStyle("dark"),
		glamour.WithWordWrap(80),
	)
	if err != nil {
		renderer = nil
	}

	return Model{
		Mode:           "CHAT",
		ChatBlocks:     []ChatBlock{},
		ActiveResponse: "",
		Input:          "",
		Width:          120,
		Height:         32,
		Provider:       "pending",
		ModelName:      "bridge",
		TrustLabel:     "Generated code is untrusted by default",
		Bridge:         bridge.NewClient(bridgeURL),
		TextInput:      ti,
		Renderer:       renderer,
		FocusPane:      FocusChat,
		PreviewTab:     "code",
		PreviewVisible: true,
		// Operator surface initial state
		Task:             TaskCard{Phase: PhaseIdle},
		ToolTimeline:     []ToolStep{},
		ChangedFiles:     []ChangedFile{},
		VerificationJobs: []VerificationJob{},
		Artifacts:        []ArtifactRef{},
		ActivityLog:      []ActivityLogEntry{},
		TaskQueue:        []TaskQueueEntry{},
		SessionTurns:     []SessionTurnEntry{},
		TimelineVisible:  true,
		ArtifactsVisible: false,
		QueueVisible:     false,
		HelpVisible:      false,
	}
}

func (m *Model) ApplyEvent(event bridge.Event) {
	switch event.Type {
	case "response.started":
		m.ActiveResponse = ""
		m.addActivity("Response started")
	case "response.delta":
		m.ActiveResponse += event.Delta
	case "response.completed":
		m.ActiveResponse = event.Content
	case "response.committed":
		// Add assistant block to chat history
		m.ChatBlocks = append(m.ChatBlocks, ChatBlock{
			Type:    "assistant",
			Content: event.Content,
			Time:    time.Now(),
		})
		// Check for code content to show in preview
		if containsCode(event.Content) {
			m.PreviewContent = extractCode(event.Content)
			m.PreviewType = "code"
			m.PreviewVisible = true
		}
		m.ActiveResponse = ""
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
		m.ActiveResponse = ""
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

	// ── Operator surface events ──

	case "tool.started":
		step := ToolStep{
			StepNum:     event.StepNum,
			ToolName:    event.ToolName,
			Thought:     event.Thought,
			ArgsSummary: event.ArgsSummary,
			Status:      "running",
			StartedAt:   time.Now(),
		}
		m.ToolTimeline = append(m.ToolTimeline, step)
		if len(m.ToolTimeline) > MaxTimelineEntries {
			m.ToolTimeline = m.ToolTimeline[len(m.ToolTimeline)-MaxTimelineEntries:]
		}
		m.addActivity(fmt.Sprintf("Tool #%d: %s", event.StepNum, event.ToolName))

	case "tool.completed":
		for i := len(m.ToolTimeline) - 1; i >= 0; i-- {
			if m.ToolTimeline[i].StepNum == event.StepNum {
				m.ToolTimeline[i].Status = "success"
				if !event.Success {
					m.ToolTimeline[i].Status = "failed"
				}
				m.ToolTimeline[i].ResultSummary = event.ResultSummary
				m.ToolTimeline[i].CompletedAt = time.Now()
				break
			}
		}
		statusIcon := "✓"
		if !event.Success {
			statusIcon = "✗"
		}
		m.addActivity(fmt.Sprintf("%s %s: %s", statusIcon, event.ToolName, event.ResultSummary))

	case "phase.changed":
		m.Task.Phase = AgentPhase(event.Phase)
		if event.StepCurrent > 0 {
			m.Task.StepCurrent = event.StepCurrent
		}
		if event.StepTotal > 0 {
			m.Task.StepTotal = event.StepTotal
		}
		if event.ActiveFile != "" {
			m.Task.ActiveFile = event.ActiveFile
		}
		if event.Objective != "" {
			m.Task.Objective = event.Objective
		}
		m.addActivity(fmt.Sprintf("Phase: %s", event.Phase))

	case "files.changed":
		m.ChangedFiles = make([]ChangedFile, 0, len(event.Files))
		for _, f := range event.Files {
			m.ChangedFiles = append(m.ChangedFiles, ChangedFile{
				Path:     f.Path,
				Status:   f.Status,
				IsLatest: f.IsLatest,
			})
		}
		if len(m.ChangedFiles) > MaxChangedFiles {
			m.ChangedFiles = m.ChangedFiles[len(m.ChangedFiles)-MaxChangedFiles:]
		}
		m.MutationCount = len(m.ChangedFiles)
		// Mark the last one as latest if none is explicitly marked
		if len(m.ChangedFiles) > 0 {
			hasLatest := false
			for _, f := range m.ChangedFiles {
				if f.IsLatest {
					hasLatest = true
					break
				}
			}
			if !hasLatest {
				m.ChangedFiles[len(m.ChangedFiles)-1].IsLatest = true
			}
		}
		m.addActivity(fmt.Sprintf("Changed %d file(s)", len(m.ChangedFiles)))

	case "verification.started":
		job := VerificationJob{
			JobID:     event.JobID,
			Command:   event.Command,
			Status:    "running",
			StartedAt: time.Now(),
		}
		m.VerificationJobs = append(m.VerificationJobs, job)
		m.addActivity(fmt.Sprintf("Running: %s", event.Command))

	case "verification.completed":
		for i := len(m.VerificationJobs) - 1; i >= 0; i-- {
			if m.VerificationJobs[i].JobID == event.JobID {
				m.VerificationJobs[i].Status = "pass"
				if !event.Success {
					m.VerificationJobs[i].Status = "fail"
				}
				m.VerificationJobs[i].OutputTail = event.OutputTail
				m.VerificationJobs[i].CompletedAt = time.Now()
				if event.Duration > 0 {
					m.VerificationJobs[i].Duration = event.Duration
				}
				break
			}
		}
		statusIcon := "PASS"
		if !event.Success {
			statusIcon = "FAIL"
		}
		m.addActivity(fmt.Sprintf("%s: %s", statusIcon, event.Command))

	case "artifact.found":
		// Update existing or add new
		found := false
		for i := range m.Artifacts {
			if m.Artifacts[i].Label == event.ArtifactLabel {
				m.Artifacts[i].Path = event.ArtifactPath
				m.Artifacts[i].UpdatedAt = time.Now()
				found = true
				break
			}
		}
		if !found {
			m.Artifacts = append(m.Artifacts, ArtifactRef{
				Label:     event.ArtifactLabel,
				Path:      event.ArtifactPath,
				UpdatedAt: time.Now(),
			})
		}
		m.ArtifactsVisible = true
		m.addActivity(fmt.Sprintf("Artifact: %s", event.ArtifactLabel))

		// ── Task queue + session turn events ──

	case "session.turn":
		turn := SessionTurnEntry{
			TurnID:      event.TurnID,
			Intent:      event.Intent,
			DelegatedTo: event.DelegatedTo,
			DurationMs:  event.DurationMs,
			Timestamp:   time.Now(),
		}
		m.SessionTurns = append(m.SessionTurns, turn)
		m.addActivity(fmt.Sprintf("Turn: %s → %s", event.Intent, event.DelegatedTo))

	case "task.queued":
		entry := TaskQueueEntry{
			TaskID:      event.TaskID,
			Description: event.Description,
			Status:      "queued",
			QueuedAt:    time.Now(),
		}
		m.TaskQueue = append(m.TaskQueue, entry)
		m.QueueVisible = true
		m.addActivity(fmt.Sprintf("Queued: %s", event.Description))

	case "task.started":
		for i := range m.TaskQueue {
			if m.TaskQueue[i].TaskID == event.TaskID {
				m.TaskQueue[i].Status = "running"
				m.TaskQueue[i].StartedAt = time.Now()
				break
			}
		}
		m.addActivity(fmt.Sprintf("Started: %s", event.TaskID))

	case "task.completed":
		for i := range m.TaskQueue {
			if m.TaskQueue[i].TaskID == event.TaskID {
				if event.Success {
					m.TaskQueue[i].Status = "completed"
				} else {
					m.TaskQueue[i].Status = "failed"
				}
				m.TaskQueue[i].CompletedAt = time.Now()
				if event.DurationMs > 0 {
					m.TaskQueue[i].DurationMs = event.DurationMs
				}
				break
			}
		}
		statusIcon := "Done"
		if !event.Success {
			statusIcon = "Fail"
		}
		m.addActivity(fmt.Sprintf("%s: %s", statusIcon, event.TaskID))
	}
}

// addActivity appends an operator-facing log entry, bounded by MaxActivityLog.
func (m *Model) addActivity(message string) {
	m.ActivityLog = append(m.ActivityLog, ActivityLogEntry{
		Message:   message,
		Timestamp: time.Now(),
	})
	if len(m.ActivityLog) > MaxActivityLog {
		m.ActivityLog = m.ActivityLog[len(m.ActivityLog)-MaxActivityLog:]
	}
}

func (m Model) lastAssistantResponse() string {
	if strings.TrimSpace(m.ActiveResponse) != "" {
		return m.ActiveResponse
	}
	for i := len(m.ChatBlocks) - 1; i >= 0; i-- {
		if m.ChatBlocks[i].Type == "assistant" && strings.TrimSpace(m.ChatBlocks[i].Content) != "" {
			return m.ChatBlocks[i].Content
		}
	}
	return ""
}

func (m *Model) copyLastResponse() {
	content := m.lastAssistantResponse()
	if content == "" {
		m.addActivity("Nothing to copy yet")
		return
	}
	if err := copyToClipboard(content); err != nil {
		m.addActivity("Copy failed: " + err.Error())
		return
	}
	m.addActivity("Copied last response to clipboard")
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
