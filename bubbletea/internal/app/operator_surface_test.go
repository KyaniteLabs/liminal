package app

import (
	"errors"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/Pastorsimon1798/liminal/bubbletea/internal/bridge"
	"github.com/Pastorsimon1798/liminal/bubbletea/internal/ui"
	tea "github.com/charmbracelet/bubbletea"
)

func readyOperatorModel(t *testing.T) Model {
	t.Helper()
	m := NewModel("http://localhost:0")
	updated, _ := m.Update(tea.WindowSizeMsg{Width: 120, Height: 48})
	model := updated.(Model)
	model.Connected = true
	model.Provider = "glm"
	model.ModelName = "m2.7"
	return model
}

func TestViewRendersOperatorSurface(t *testing.T) {
	m := readyOperatorModel(t)
	m.ChatBlocks = []ChatBlock{{Type: "assistant", Content: "latest response", Time: nowForTest()}}
	m.Task = TaskCard{
		Objective:   "Build login page",
		Phase:       PhaseEdit,
		StepCurrent: 3,
		StepTotal:   8,
		ActiveFile:  "src/auth.ts",
	}
	m.ToolTimeline = []ToolStep{
		{StepNum: 1, ToolName: "readFile", Status: "success", ResultSummary: "loaded src/auth.ts", StartedAt: nowForTest(), CompletedAt: nowForTest()},
		{StepNum: 2, ToolName: "editFile", Status: "running", ArgsSummary: "src/auth.ts", StartedAt: nowForTest()},
	}
	m.ChangedFiles = []ChangedFile{{Path: "src/auth.ts", Status: "modified", IsLatest: true}}
	m.VerificationJobs = []VerificationJob{{JobID: "job-1", Command: "vitest auth", Status: "running", StartedAt: nowForTest()}}
	m.Artifacts = []ArtifactRef{{Label: "Transcript", Path: ".omx/logs/session.log", UpdatedAt: nowForTest()}}
	m.ArtifactsVisible = true
	m.HelpVisible = true
	m.refreshViewports()

	view := m.View()
	for _, want := range []string{"Conversation", "Operator surface", "Task", "Build login page", "Phase", "Edit", "readFile", "Changed: 1 file", "src/auth.ts", "Verification", "Status", "Path", "Ctrl+T", "Ctrl+A", "Ctrl+Y"} {
		if !strings.Contains(view, want) {
			t.Fatalf("expected view to contain %q\n%s", want, view)
		}
	}
}

func TestUpdateTogglesOperatorPanelsAndHelp(t *testing.T) {
	m := readyOperatorModel(t)

	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyCtrlT})
	m = updated.(Model)
	if m.TimelineVisible {
		t.Fatal("expected ctrl+t to hide timeline")
	}

	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyCtrlA})
	m = updated.(Model)
	if !m.ArtifactsVisible {
		t.Fatal("expected ctrl+a to show artifacts drawer")
	}

	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'?'}})
	m = updated.(Model)
	if !m.HelpVisible {
		t.Fatal("expected ? to toggle help on")
	}

	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'?'}})
	m = updated.(Model)
	if m.HelpVisible {
		t.Fatal("expected ? to toggle help off")
	}
}

func TestCtrlYCopiesLastAssistantResponseFromAnyPane(t *testing.T) {
	m := readyOperatorModel(t)
	m.ChatBlocks = []ChatBlock{{Type: "assistant", Content: "copy me", Time: nowForTest()}}

	copied := ""
	prev := copyToClipboard
	copyToClipboard = func(v string) error {
		copied = v
		return nil
	}
	defer func() { copyToClipboard = prev }()

	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyCtrlY})
	m = updated.(Model)
	if copied != "copy me" {
		t.Fatalf("expected copied assistant response, got %q", copied)
	}
	if len(m.ActivityLog) == 0 || !strings.Contains(m.ActivityLog[len(m.ActivityLog)-1].Message, "Copied") {
		t.Fatalf("expected copy activity log, got %#v", m.ActivityLog)
	}

	m.FocusPane = FocusPreview
	updated, _ = m.Update(tea.KeyMsg{Type: tea.KeyCtrlY})
	m = updated.(Model)
	if copied != "copy me" {
		t.Fatalf("expected ctrl+y to work in preview/operator pane too, got %q", copied)
	}
}

func TestCtrlYCopyErrorIsReported(t *testing.T) {
	m := readyOperatorModel(t)
	m.ChatBlocks = []ChatBlock{{Type: "assistant", Content: "copy me", Time: nowForTest()}}

	prev := copyToClipboard
	copyToClipboard = func(string) error {
		return errors.New("clipboard down")
	}
	defer func() { copyToClipboard = prev }()

	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyCtrlY})
	m = updated.(Model)
	if len(m.ActivityLog) == 0 || !strings.Contains(m.ActivityLog[len(m.ActivityLog)-1].Message, "clipboard down") {
		t.Fatalf("expected clipboard error in activity log, got %#v", m.ActivityLog)
	}
}

func TestApplyEventOperatorSurfaceRefreshesView(t *testing.T) {
	m := readyOperatorModel(t)
	m.ApplyEvent(bridge.Event{Type: "phase.changed", Phase: "Verify", StepCurrent: 4, StepTotal: 5, ActiveFile: "bubbletea/internal/app/view.go", Objective: "Polish operator layout"})
	m.ApplyEvent(bridge.Event{Type: "tool.started", StepNum: 4, ToolName: "go test", Thought: "Verify the surface", ArgsSummary: "./internal/app"})
	m.ApplyEvent(bridge.Event{Type: "verification.started", JobID: "verify-1", Command: "go test ./internal/app"})
	m.ApplyEvent(bridge.Event{Type: "files.changed", Files: []bridge.FileChange{{Path: "bubbletea/internal/app/view.go", Status: "modified", IsLatest: true}}})
	m.refreshViewports()

	view := m.View()
	for _, want := range []string{"Polish operator layout", "Verify", "go test", "bubbletea/internal/app/view.go"} {
		if !strings.Contains(view, want) {
			t.Fatalf("expected operator view to contain %q\n%s", want, view)
		}
	}
}

func nowForTest() time.Time {
	return time.Unix(1710000000, 0)
}

func visibleText(s string) string {
	ansi := regexp.MustCompile(`\x1b\[[0-9;]*m`)
	return ansi.ReplaceAllString(s, "")
}

func TestTaskCardShowsProgressPercentage(t *testing.T) {
	m := readyOperatorModel(t)
	m.Task = TaskCard{
		Objective:   "Polish Bubble Tea operator UI",
		Phase:       PhaseEdit,
		StepCurrent: 3,
		StepTotal:   8,
	}

	card := m.renderTaskCard(52)
	for _, want := range []string{"Progress", "38%"} {
		if !strings.Contains(card, want) {
			t.Fatalf("expected task card to contain %q\n%s", want, card)
		}
	}
}

func TestOperatorSurfaceRendersGenerationProgressCard(t *testing.T) {
	m := readyOperatorModel(t)
	m.ApplyEvent(bridge.Event{Type: "generation.domain_plan", Domains: []string{"three", "p5", "hydra"}})
	m.ApplyEvent(bridge.Event{Type: "generation.attempt.started", Domain: "three", Attempt: 1, AttemptTotal: 3})
	m.ApplyEvent(bridge.Event{Type: "generation.candidate.generated", Domain: "three", Attempt: 1, AttemptTotal: 3, Iteration: 1, CandidateCount: 3, CodeSize: 2048})
	m.CurrentIteration = 2
	m.GenerationIterations = 4
	m.GenerationScore = 0.82
	m.GenerationModel = "glm-5.1"
	m.GenerationReason = "Best convergence"
	m.GenerationDuration = 4200

	surface := m.renderOperatorSurface(56)
	for _, want := range []string{"Generation", "50%", "glm-5.1", "0.82", "Plan:", "three", "Attempt:", "1/3", "2048b"} {
		if !strings.Contains(surface, want) {
			t.Fatalf("expected operator surface to contain %q\n%s", want, surface)
		}
	}
}

func TestOperatorSurfaceShowsFinalReportBeforeToolTrace(t *testing.T) {
	m := readyOperatorModel(t)
	m.ChatBlocks = []ChatBlock{{Type: "assistant", Content: "Status: success\nVerdict:\nThe result panel is compact.\nFiles changed:\n- bubbletea/internal/app/layout.go", Time: nowForTest()}}
	m.ToolTimeline = []ToolStep{{StepNum: 1, ToolName: "readFile", Status: "success", Thought: "Inspect layout", ResultSummary: "loaded layout.go"}}

	surface := m.renderOperatorSurface(56)
	for _, want := range []string{"Final report", "Status: Success", "The result panel is compact.", "Tool trace", "Inspect layout"} {
		if !strings.Contains(surface, want) {
			t.Fatalf("expected operator surface to contain %q\n%s", want, surface)
		}
	}
	if strings.Index(surface, "Final report") > strings.Index(surface, "Tool trace") {
		t.Fatalf("expected result panel to render before tool trace\n%s", surface)
	}
	// Verify the full answer body is NOT duplicated in the right column
	if strings.Contains(surface, "- bubbletea/internal/app/layout.go") {
		t.Fatalf("expected operator surface NOT to contain full answer body (file list), but it did\n%s", surface)
	}
}

func TestConversationRetainsFullFinalAnswerWhenOperatorPanelIsCompact(t *testing.T) {
	m := readyOperatorModel(t)
	answer := "Status: success\nVerdict:\nThe result panel is compact.\nFiles changed:\n- bubbletea/internal/app/layout.go"
	m.ChatBlocks = []ChatBlock{{Type: "assistant", Content: answer, Time: nowForTest()}}

	chat := visibleText(m.renderChatContent())
	for _, want := range []string{"The result panel is compact.", "bubbletea/internal/app/layout.go"} {
		if !strings.Contains(chat, want) {
			t.Fatalf("expected conversation to retain %q\n%s", want, chat)
		}
	}
}

func TestResultPanelShowsFailedToolNamesWithoutLongTrace(t *testing.T) {
	m := readyOperatorModel(t)
	m.ChatBlocks = []ChatBlock{{Type: "assistant", Content: "Status: success\nVerdict: Compact summary", Time: nowForTest()}}
	m.ToolTimeline = []ToolStep{
		{StepNum: 1, ToolName: "readFile", Status: "success", ResultSummary: "loaded layout.go"},
		{StepNum: 2, ToolName: "runTests", Status: "failed", ResultSummary: "very long failure text that belongs in the tool trace, not the result panel"},
	}

	panel := m.renderResultPanel(56)
	for _, want := range []string{"Status: Success", "Compact summary", "Failed: runTests"} {
		if !strings.Contains(panel, want) {
			t.Fatalf("expected result panel to contain %q\n%s", want, panel)
		}
	}
	if strings.Contains(panel, "very long failure text") {
		t.Fatalf("expected result panel not to duplicate long tool trace\n%s", panel)
	}
}

func TestResultPanelShowsLastError(t *testing.T) {
	m := readyOperatorModel(t)
	m.ApplyEvent(bridge.Event{Type: "error", SessionID: "s1", Message: "all generation candidates failed: p5 validation failed"})

	panel := m.renderResultPanel(72)
	for _, want := range []string{"Status: Failed", "Last error:", "all generation candidates failed"} {
		if !strings.Contains(panel, want) {
			t.Fatalf("expected result panel to contain %q\n%s", want, panel)
		}
	}
	if len(m.ActivityLog) == 0 || !strings.Contains(m.ActivityLog[len(m.ActivityLog)-1].Message, "Error:") {
		t.Fatalf("expected error to be added to activity log, got %#v", m.ActivityLog)
	}
}

func TestPreviewCardRendersImageInline(t *testing.T) {
	m := readyOperatorModel(t)
	m.PreviewType = "image"
	m.PreviewContent = "not-valid-base64"

	panel := m.renderPreviewCard(72)
	if !strings.Contains(panel, "Type: image") {
		t.Fatalf("expected image preview type\n%s", panel)
	}
	if !strings.Contains(panel, "image decode error") {
		t.Fatalf("expected inline image render attempt\n%s", panel)
	}
}

func TestPreviewCardRendersAudioReactivityInOperatorPanel(t *testing.T) {
	m := readyOperatorModel(t)
	m.PreviewType = "music"
	m.PreviewContent = "RMS: 0.42\nPeak: 0.81\nbrightnessDriven: true\nrippleScaleDriven: true"

	panel := m.renderPreviewCard(72)
	for _, want := range []string{"Type: music", "RMS:", "Peak:", "brightnessDriven", "rippleScaleDriven"} {
		if !strings.Contains(panel, want) {
			t.Fatalf("expected audio reactive preview panel to contain %q\n%s", want, panel)
		}
	}
}

func TestCodeBlockDoesNotRenderInlinePreviewBadge(t *testing.T) {
	m := readyOperatorModel(t)
	m.ChatBlocks = []ChatBlock{{Type: "code", Content: "function setup() {}", Preview: "base64"}}

	chat := visibleText(m.renderChatContent())
	if strings.Contains(chat, "Preview") {
		t.Fatalf("expected preview affordance to stay out of chat transcript\n%s", chat)
	}
}

func TestOperatorRunStatusLabels(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		m := readyOperatorModel(t)
		m.ChatBlocks = []ChatBlock{{Type: "assistant", Content: "done", Time: nowForTest()}}
		if got := m.operatorRunStatus(); got != "Success" {
			t.Fatalf("expected Success, got %q", got)
		}
	})

	t.Run("final report success overrides failed supporting tool", func(t *testing.T) {
		m := readyOperatorModel(t)
		m.ChatBlocks = []ChatBlock{{Type: "assistant", Content: "Status: success\nVerdict: Build passed cleanly.", Time: nowForTest()}}
		m.ToolTimeline = []ToolStep{{StepNum: 10, ToolName: "typeCheck", Status: "failed", ResultSummary: "Rate limit exceeded"}}
		panel := m.renderResultPanel(56)
		if !strings.Contains(panel, "Status: Success") {
			t.Fatalf("expected final report status to be Success\n%s", panel)
		}
	})

	t.Run("final report success does not override failed verification", func(t *testing.T) {
		m := readyOperatorModel(t)
		m.ChatBlocks = []ChatBlock{{Type: "assistant", Content: "Status: success\nVerdict: I think tests passed.", Time: nowForTest()}}
		m.VerificationJobs = []VerificationJob{{JobID: "job-1", Command: "go test ./...", Status: "fail"}}
		if got := m.operatorRunStatus(); got != "Failed" {
			t.Fatalf("expected failed verification to stay authoritative, got %q", got)
		}
	})

	t.Run("parses lowercase final status", func(t *testing.T) {
		m := readyOperatorModel(t)
		m.ChatBlocks = []ChatBlock{{Type: "assistant", Content: "status: passed\nVerdict: ok", Time: nowForTest()}}
		if got := m.operatorRunStatus(); got != "Success" {
			t.Fatalf("expected lowercase status to parse as Success, got %q", got)
		}
	})

	t.Run("partial", func(t *testing.T) {
		m := readyOperatorModel(t)
		m.ChatBlocks = []ChatBlock{{Type: "assistant", Content: "draft", Time: nowForTest()}}
		m.ToolTimeline = []ToolStep{{StepNum: 1, ToolName: "runTests", Status: "running"}}
		if got := m.operatorRunStatus(); got != "Partial" {
			t.Fatalf("expected Partial, got %q", got)
		}
	})

	t.Run("failed", func(t *testing.T) {
		m := readyOperatorModel(t)
		m.ChatBlocks = []ChatBlock{{Type: "assistant", Content: "attempted fix", Time: nowForTest()}}
		m.VerificationJobs = []VerificationJob{{JobID: "job-1", Command: "go test ./...", Status: "fail"}}
		if got := m.operatorRunStatus(); got != "Failed" {
			t.Fatalf("expected Failed, got %q", got)
		}
	})

	t.Run("needs review", func(t *testing.T) {
		m := readyOperatorModel(t)
		m.Mode = "ACTION"
		m.PendingAction = &bridge.PendingAction{ID: "a1", Title: "Approve patch"}
		panel := m.renderResultPanel(56)
		for _, want := range []string{"Status: Needs review", "Review required before mutation"} {
			if !strings.Contains(panel, want) {
				t.Fatalf("expected result panel to contain %q\n%s", want, panel)
			}
		}
	})
}

func TestWindowResizeKeepsTextareaWidthInSync(t *testing.T) {
	m := NewModel("http://localhost:0")

	updated, _ := m.Update(tea.WindowSizeMsg{Width: 120, Height: 36})
	m = updated.(Model)
	initialWidth := m.TextInput.Width()
	if initialWidth <= 0 {
		t.Fatalf("expected positive initial textarea width, got %d", initialWidth)
	}

	updated, _ = m.Update(tea.WindowSizeMsg{Width: 100, Height: 30})
	m = updated.(Model)
	resizedWidth := m.TextInput.Width()
	if resizedWidth <= 0 {
		t.Fatalf("expected positive resized textarea width, got %d", resizedWidth)
	}
	if resizedWidth >= initialWidth {
		t.Fatalf("expected resized textarea width to shrink (initial=%d resized=%d)", initialWidth, resizedWidth)
	}
}

func TestAltEnterAddsNewlineWithoutSubmitting(t *testing.T) {
	m := readyOperatorModel(t)
	m.TextInput.SetValue("hello")

	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter, Alt: true})
	m = updated.(Model)

	if got := m.TextInput.Value(); !strings.Contains(got, "\n") {
		t.Fatalf("expected alt+enter to insert newline, got %q", got)
	}
	if len(m.ChatBlocks) != 0 {
		t.Fatalf("expected alt+enter not to submit chat, got %d chat blocks", len(m.ChatBlocks))
	}
}

func TestFooterExplainsMultilineShortcut(t *testing.T) {
	m := readyOperatorModel(t)

	footer := m.renderFooter()
	for _, want := range []string{"Enter:send", "Alt+Enter:newline"} {
		if !strings.Contains(footer, want) {
			t.Fatalf("expected footer to contain %q\n%s", want, footer)
		}
	}
}

func TestChatViewportSupportsPageScrollWhileInputFocused(t *testing.T) {
	m := readyOperatorModel(t)
	for i := 0; i < 80; i++ {
		m.ChatBlocks = append(m.ChatBlocks, ChatBlock{Type: "assistant", Content: "line", Time: nowForTest()})
	}
	m.refreshViewports()
	m.ChatViewport.GotoBottom()
	bottomOffset := m.ChatViewport.YOffset

	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyPgUp})
	m = updated.(Model)

	if m.ChatViewport.YOffset >= bottomOffset {
		t.Fatalf("expected page up to scroll chat viewport (before=%d after=%d)", bottomOffset, m.ChatViewport.YOffset)
	}
}

func TestRefreshViewportsPreservesManualChatScroll(t *testing.T) {
	m := readyOperatorModel(t)
	for i := 0; i < 80; i++ {
		m.ChatBlocks = append(m.ChatBlocks, ChatBlock{Type: "assistant", Content: "line", Time: nowForTest()})
	}
	m.refreshViewports()
	m.ChatViewport.GotoBottom()
	m.ChatViewport.PageUp()
	manualOffset := m.ChatViewport.YOffset

	m.ApplyEvent(bridge.Event{Type: "response.delta", SessionID: "s1", Delta: "new streaming text"})
	m.refreshViewports()

	if m.ChatViewport.YOffset != manualOffset {
		t.Fatalf("expected refresh to preserve manual scroll offset %d, got %d", manualOffset, m.ChatViewport.YOffset)
	}
}

func TestMouseWheelScrollsPaneUnderCursor(t *testing.T) {
	m := readyOperatorModel(t)
	updated, _ := m.Update(tea.WindowSizeMsg{Width: 120, Height: 16})
	m = updated.(Model)
	m.HelpVisible = true
	m.refreshViewports()
	metrics := m.layoutMetrics()

	updated, _ = m.Update(tea.MouseMsg{
		X:      metrics.chatOuterWidth + 2,
		Y:      headerHeight + 2,
		Button: tea.MouseButtonWheelDown,
	})
	m = updated.(Model)

	if m.FocusPane != FocusPreview {
		t.Fatalf("expected mouse wheel over operator pane to focus operator pane, got %v", m.FocusPane)
	}
	if m.PreviewViewport.YOffset == 0 {
		t.Fatal("expected mouse wheel to scroll operator viewport down")
	}
}

func TestNewModelUsesLiminalTextareaStyles(t *testing.T) {
	m := NewModel("http://localhost:0")

	if got, want := m.TextInput.FocusedStyle.Prompt.Render(">"), ui.TextareaPromptFocusedStyle.Render(">"); got != want {
		t.Fatalf("expected focused prompt style to match theme")
	}
	if got, want := m.TextInput.BlurredStyle.Prompt.Render(">"), ui.TextareaPromptBlurredStyle.Render(">"); got != want {
		t.Fatalf("expected blurred prompt style to match theme")
	}
}

func TestChangedFilesRenderAsTable(t *testing.T) {
	m := readyOperatorModel(t)
	m.ChangedFiles = []ChangedFile{
		{Path: "src/auth.ts", Status: "modified", IsLatest: true},
		{Path: "src/new.ts", Status: "created"},
	}

	panel := m.renderChangedFiles(56)
	for _, want := range []string{"Status", "Path", "Latest", "src/auth.ts", "src/new.ts"} {
		if !strings.Contains(panel, want) {
			t.Fatalf("expected changed-files table to contain %q\n%s", want, panel)
		}
	}
}

func TestVerificationJobsRenderAsTable(t *testing.T) {
	m := readyOperatorModel(t)
	m.VerificationJobs = []VerificationJob{
		{JobID: "job-1", Command: "go test ./...", Status: "running", OutputTail: "still running"},
	}

	panel := m.renderVerificationJobs(56)
	for _, want := range []string{"Status", "Command", "Output", "go test ./...", "still running"} {
		if !strings.Contains(panel, want) {
			t.Fatalf("expected verification table to contain %q\n%s", want, panel)
		}
	}
}

func TestArtifactsDrawerAndHelpDrawerStillRenderKeyContent(t *testing.T) {
	m := readyOperatorModel(t)
	m.Artifacts = []ArtifactRef{{Label: "Transcript", Path: ".omx/logs/session.log", UpdatedAt: nowForTest()}}

	artifacts := m.renderArtifactsDrawer(56)
	for _, want := range []string{"Artifacts", "Transcript", ".omx/logs/session.log"} {
		if !strings.Contains(artifacts, want) {
			t.Fatalf("expected artifacts drawer to contain %q\n%s", want, artifacts)
		}
	}

	help := m.renderHelpDrawer(56)
	for _, want := range []string{"Help / Shortcuts", "Alt+Enter", "insert newline"} {
		if !strings.Contains(help, want) {
			t.Fatalf("expected help drawer to contain %q\n%s", want, help)
		}
	}
}
