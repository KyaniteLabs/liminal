package app

import (
	"fmt"
	"strings"
	"time"

	"github.com/Pastorsimon1798/liminal/bubbletea/internal/ui"
	"github.com/charmbracelet/bubbles/progress"
	"github.com/charmbracelet/bubbles/table"
	"github.com/charmbracelet/lipgloss"
)

func (m Model) renderOperatorSurface(width int) string {
	contentWidth := max(20, width)
	panels := []string{m.renderTaskCard(contentWidth)}

	if m.hasOperatorResult() {
		panels = append(panels, m.renderResultPanel(contentWidth))
	}
	if m.CortexSnapshot != nil {
		panels = append(panels, m.renderCortexStatus(contentWidth))
	}
	if len(m.CortexGoals) > 0 {
		panels = append(panels, m.renderCortexGoalPanel(contentWidth))
	}
	if m.CortexVisible {
		panels = append(panels, m.renderCortexPanel(contentWidth))
	}

	if m.hasGenerationTelemetry() {
		panels = append(panels, m.renderGenerationCard(contentWidth))
	}
	if m.TimelineVisible {
		panels = append(panels, m.renderToolTimeline(contentWidth))
	}
	if len(m.ChangedFiles) > 0 || m.MutationCount > 0 {
		panels = append(panels, m.renderChangedFiles(contentWidth))
	}
	if len(m.VerificationJobs) > 0 {
		panels = append(panels, m.renderVerificationJobs(contentWidth))
	}
	if m.QueueVisible && len(m.TaskQueue) > 0 {
		panels = append(panels, m.renderTaskQueue(contentWidth))
	}
	if m.ArtifactsVisible {
		panels = append(panels, m.renderArtifactsDrawer(contentWidth))
	}
	if m.PreviewVisible && strings.TrimSpace(m.PreviewContent) != "" {
		panels = append(panels, m.renderPreviewCard(contentWidth))
	}
	if m.ReviewVisible && len(m.ReviewCandidates) > 0 {
		panels = append(panels, m.renderReviewPanel(contentWidth))
	}
	if m.DiffContent != "" {
		panels = append(panels, m.renderDiffView(contentWidth))
	}
	if len(m.OnboardingSteps) > 0 {
		panels = append(panels, m.renderOnboardingPanel(contentWidth))
	}
	if len(m.DiagnosticChecks) > 0 {
		panels = append(panels, m.renderDiagnosticsPanel(contentWidth))
	}
	if len(m.SessionList) > 0 {
		panels = append(panels, m.renderSessionList(contentWidth))
	}
	if m.HelpVisible {
		panels = append(panels, m.renderHelpDrawer(contentWidth))
	} else if len(m.ActivityLog) > 0 {
		panels = append(panels, m.renderActivityLog(contentWidth))
	}

	return lipgloss.JoinVertical(lipgloss.Left, panels...)
}

func (m Model) renderResultPanel(width int) string {
	status := m.operatorRunStatus()
	lines := []string{ui.PanelTitleStyle.Render("Final report"), ui.PanelMetaStyle.Render("Status: " + status)}
	if m.PendingAction != nil {
		lines = append(lines, ui.TaskHintStyle.Render("Review required before mutation: [y] confirm  [n] cancel"))
	}
	if result := strings.TrimSpace(m.lastAssistantResponse()); result != "" {
		lines = append(lines, ui.PanelValueStyle.Render(previewSummary(result, 8, width-6)))
	}
	return ui.PreviewCardStyle.Width(width).Render(lipgloss.JoinVertical(lipgloss.Left, lines...))
}

func (m Model) hasOperatorResult() bool {
	return strings.TrimSpace(m.lastAssistantResponse()) != "" || m.PendingAction != nil || m.ActiveResponse != ""
}

func (m Model) operatorRunStatus() string {
	if m.PendingAction != nil || m.Mode == "ACTION" {
		return "Needs review"
	}
	if strings.TrimSpace(m.ActiveResponse) != "" {
		return "In progress"
	}
	if status, ok := finalReportStatus(m.lastAssistantResponse()); ok {
		return status
	}
	for _, job := range m.VerificationJobs {
		if job.Status == "fail" {
			return "Failed"
		}
		if job.Status == "running" {
			return "Partial"
		}
	}
	for _, step := range m.ToolTimeline {
		if step.Status == "failed" {
			return "Failed"
		}
		if step.Status == "running" {
			return "Partial"
		}
	}
	if strings.TrimSpace(m.lastAssistantResponse()) != "" {
		return "Success"
	}
	return "Idle"
}

func finalReportStatus(response string) (string, bool) {
	for _, line := range strings.Split(response, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		lower := strings.ToLower(trimmed)
		if !strings.HasPrefix(lower, "status:") {
			continue
		}
		value := strings.TrimSpace(strings.TrimPrefix(trimmed, trimmed[:len("Status:")]))
		switch strings.ToLower(value) {
		case "success", "succeeded", "pass", "passed":
			return "Success", true
		case "failed", "failure", "fail":
			return "Failed", true
		case "partial":
			return "Partial", true
		}
		return "", false
	}
	return "", false
}

func (m Model) renderTaskCard(width int) string {
	title := ui.TaskTitleStyle.Render("Task")
	phase := m.renderPhaseBadge(m.Task.Phase)
	progress := ui.TaskProgressStyle.Render(formatStepProgress(m.Task.StepCurrent, m.Task.StepTotal))
	header := lipgloss.JoinHorizontal(lipgloss.Left, title, "  ", phase, "  ", progress)
	progressBar := renderGradientProgressBar(max(width-10, 16), taskProgressPercent(m.Task.StepCurrent, m.Task.StepTotal), string(ui.AccentCyan), string(ui.AccentMagenta))

	objective := strings.TrimSpace(m.Task.Objective)
	if objective == "" {
		objective = "Waiting for operator instructions"
	}

	lines := []string{
		header,
		ui.TaskObjectiveStyle.Render(objective),
		ui.PanelLabelStyle.Render("Progress"),
		progressBar,
	}
	if strings.TrimSpace(m.Task.ActiveFile) != "" {
		lines = append(lines, ui.PanelLabelStyle.Render("File:")+" "+ui.TaskFileStyle.Render(m.Task.ActiveFile))
	}
	if m.Mode == "ACTION" && m.PendingAction != nil {
		lines = append(lines,
			ui.Separator(width-4),
			ui.TaskPendingStyle.Render("Pending approval"),
			ui.PanelValueStyle.Render(m.PendingAction.Title),
			ui.TaskHintStyle.Render("[y] confirm  [n] cancel"),
		)
	}

	return ui.TaskCardStyle.Width(width).Render(lipgloss.JoinVertical(lipgloss.Left, lines...))
}

func (m Model) renderGenerationCard(width int) string {
	ratio := generationProgressPercent(m.CurrentIteration, m.GenerationIterations)
	bar := renderGradientProgressBar(max(width-10, 16), ratio, string(ui.AccentGreen), string(ui.AccentPurple))

	lines := []string{
		ui.GenerationTitleStyle.Render("Generation"),
		bar,
	}

	if m.GenerationModel != "" {
		lines = append(lines, ui.PanelLabelStyle.Render("Model:")+" "+ui.GenerationValueStyle.Render(m.GenerationModel))
	}
	if m.GenerationScore > 0 {
		lines = append(lines, ui.PanelLabelStyle.Render("Score:")+" "+ui.GenerationValueStyle.Render(fmt.Sprintf("%.2f", m.GenerationScore)))
	}
	if m.GenerationDuration > 0 {
		lines = append(lines, ui.PanelLabelStyle.Render("Duration:")+" "+ui.GenerationMetaStyle.Render(formatDurationMs(m.GenerationDuration)))
	}
	if strings.TrimSpace(m.GenerationReason) != "" {
		lines = append(lines, ui.GenerationMetaStyle.Render(trimToWidth(m.GenerationReason, width-6)))
	}

	return ui.GenerationCardStyle.Width(width).Render(lipgloss.JoinVertical(lipgloss.Left, lines...))
}

func (m Model) renderToolTimeline(width int) string {
	lines := []string{ui.PanelTitleStyle.Render("Tool trace")}
	if len(m.ToolTimeline) == 0 {
		lines = append(lines, ui.EmptyStateStyle.Render("No tool activity yet."))
		return ui.PanelStyle.Width(width).Render(lipgloss.JoinVertical(lipgloss.Left, lines...))
	}

	start := 0
	if len(m.ToolTimeline) > 6 {
		start = len(m.ToolTimeline) - 6
	}
	for _, step := range m.ToolTimeline[start:] {
		status := timelineStatusToken(step.Status)
		primary := fmt.Sprintf("#%d %s %s", step.StepNum, status, step.ToolName)
		if step.ArgsSummary != "" && step.Status == "running" {
			primary += " " + step.ArgsSummary
		}
		lines = append(lines, ui.TimelineStepStyle.Render(primary))
		if step.Thought != "" {
			lines = append(lines, ui.TimelineThoughtStyle.Render("  ↳ "+trimToWidth(step.Thought, width-8)))
		}
		if step.ResultSummary != "" {
			lines = append(lines, ui.TimelineResultStyle.Render("  ↳ "+trimToWidth(step.ResultSummary, width-8)))
		}
	}

	return ui.PanelStyle.Width(width).Render(lipgloss.JoinVertical(lipgloss.Left, lines...))
}

func (m Model) renderChangedFiles(width int) string {
	count := max(len(m.ChangedFiles), m.MutationCount)
	label := "files"
	if count == 1 {
		label = "file"
	}
	title := fmt.Sprintf("Changed: %d %s", count, label)
	lines := []string{ui.PanelTitleStyle.Render(title)}
	if len(m.ChangedFiles) == 0 {
		lines = append(lines, ui.EmptyStateStyle.Render("No file mutations reported."))
		return ui.PanelStyle.Width(width).Render(lipgloss.JoinVertical(lipgloss.Left, lines...))
	}

	rows := make([]table.Row, 0, len(m.ChangedFiles))
	for _, file := range m.ChangedFiles {
		latest := ""
		if file.IsLatest {
			latest = "latest"
		}
		rows = append(rows, table.Row{strings.ToUpper(file.Status[:1]), trimToWidth(file.Path, width-24), latest})
	}

	lines = append(lines, renderDataTable(
		width-4,
		min(max(len(rows)+1, 3), 6),
		[]table.Column{
			{Title: "Status", Width: 8},
			{Title: "Path", Width: max(width-24, 18)},
			{Title: "Latest", Width: 8},
		},
		rows,
	))
	return ui.PanelStyle.Width(width).Render(lipgloss.JoinVertical(lipgloss.Left, lines...))
}

func (m Model) renderVerificationJobs(width int) string {
	lines := []string{ui.PanelTitleStyle.Render("Verification")}
	rows := make([]table.Row, 0, len(m.VerificationJobs))
	for _, job := range m.VerificationJobs {
		rows = append(rows, table.Row{
			strings.ToUpper(job.Status),
			trimToWidth(job.Command, max(width/2-4, 12)),
			trimToWidth(job.OutputTail, max(width/2-6, 12)),
		})
	}
	lines = append(lines, renderDataTable(
		width-4,
		min(max(len(rows)+1, 3), 6),
		[]table.Column{
			{Title: "Status", Width: 10},
			{Title: "Command", Width: max(width/2-4, 12)},
			{Title: "Output", Width: max(width/2-6, 12)},
		},
		rows,
	))
	return ui.PanelStyle.Width(width).Render(lipgloss.JoinVertical(lipgloss.Left, lines...))
}

func (m Model) renderTaskQueue(width int) string {
	queued, running, completed := 0, 0, 0
	for _, t := range m.TaskQueue {
		switch t.Status {
		case "queued":
			queued++
		case "running":
			running++
		case "completed":
			completed++
		}
	}
	summary := fmt.Sprintf("Tasks: %d queued · %d running · %d done", queued, running, completed)
	lines := []string{ui.PanelTitleStyle.Render(summary)}

	rows := make([]table.Row, 0, len(m.TaskQueue))
	for _, t := range m.TaskQueue {
		statusIcon := queueStatusToken(t.Status)
		desc := trimToWidth(t.Description, max(width-30, 12))
		dur := ""
		if t.DurationMs > 0 {
			dur = formatDurationMs(t.DurationMs)
		}
		rows = append(rows, table.Row{statusIcon, desc, dur})
	}

	lines = append(lines, renderDataTable(
		width-4,
		min(max(len(rows)+1, 3), 8),
		[]table.Column{
			{Title: "Status", Width: 10},
			{Title: "Task", Width: max(width-30, 12)},
			{Title: "Time", Width: 8},
		},
		rows,
	))
	return ui.PanelStyle.Width(width).Render(lipgloss.JoinVertical(lipgloss.Left, lines...))
}

func queueStatusToken(status string) string {
	switch status {
	case "completed":
		return "Done"
	case "running":
		return "Run"
	case "failed":
		return "Fail"
	default:
		return "Wait"
	}
}

func (m Model) renderArtifactsDrawer(width int) string {
	lines := []string{ui.PanelTitleStyle.Render("Artifacts")}
	if len(m.Artifacts) == 0 {
		lines = append(lines, ui.EmptyStateStyle.Render("No artifacts discovered yet."))
		return ui.PanelStyle.Width(width).Render(lipgloss.JoinVertical(lipgloss.Left, lines...))
	}

	for _, artifact := range m.Artifacts {
		label := ui.ArtifactLabelStyle.Render(artifact.Label + ":")
		path := ui.ArtifactPathStyle.Render(trimToWidth(artifact.Path, width-8))
		lines = append(lines, lipgloss.JoinHorizontal(lipgloss.Left, label, " ", path))
	}

	return ui.PanelStyle.Width(width).Render(lipgloss.JoinVertical(lipgloss.Left, lines...))
}

func (m Model) renderPhaseBadge(phase AgentPhase) string {
	label := string(phase)
	if label == "" {
		label = string(PhaseIdle)
	}
	return ui.PhaseBadgeStyle.Background(ui.PhaseColor(label)).Render("Phase:" + label)
}

func (m Model) renderPreviewCard(width int) string {
	lines := []string{ui.PreviewLabelStyle.Render("Preview")}
	previewType := m.PreviewType
	if previewType == "" {
		previewType = "output"
	}
	lines = append(lines, ui.PanelMetaStyle.Render("Type: "+previewType))
	lines = append(lines, ui.PreviewContentStyle.Render(previewSummary(m.PreviewContent, 4, width-8)))
	return ui.PreviewCardStyle.Width(width).Render(lipgloss.JoinVertical(lipgloss.Left, lines...))
}

func (m Model) renderActivityLog(width int) string {
	lines := []string{ui.PanelTitleStyle.Render("Activity")}
	start := 0
	if len(m.ActivityLog) > 4 {
		start = len(m.ActivityLog) - 4
	}
	for _, entry := range m.ActivityLog[start:] {
		stamp := ui.ActivityTimeStyle.Render(entry.Timestamp.Format("15:04:05"))
		msg := ui.ActivityLogStyle.Render(trimToWidth(entry.Message, width-12))
		lines = append(lines, lipgloss.JoinHorizontal(lipgloss.Left, stamp, " ", msg))
	}
	return ui.PanelStyle.Width(width).Render(lipgloss.JoinVertical(lipgloss.Left, lines...))
}

func (m Model) renderHelpDrawer(width int) string {
	lines := []string{
		ui.PanelTitleStyle.Render("Help / Shortcuts"),
		helpRow("Enter", "send message"),
		helpRow("Alt+Enter", "insert newline"),
		helpRow("Tab", "focus operator column"),
		helpRow("Ctrl+T", "toggle timeline"),
		helpRow("Ctrl+A", "toggle artifacts"),
		helpRow("Ctrl+Q", "toggle task queue"),
		helpRow("Ctrl+R", "toggle review panel"),
		helpRow("Ctrl+E", "toggle preview card"),
		helpRow("Ctrl+X", "toggle cortex dashboard"),
		helpRow("Ctrl+Y", "copy last assistant response"),
		helpRow("/setup", "run setup wizard"),
		helpRow("/diagnostics", "run env checks"),
		helpRow("/sessions", "list session history"),
		helpRow("/workspace", "manage workspaces"),
		helpRow("/report", "generate session report"),
		helpRow("/autonomy", "set autonomy level"),
		helpRow("/cortex", "cortex dashboard"),
		helpRow("?", "toggle this help"),
	}
	return ui.HelpCardStyle.Width(width).Render(lipgloss.JoinVertical(lipgloss.Left, lines...))
}

func helpRow(shortcut, description string) string {
	return lipgloss.JoinHorizontal(lipgloss.Left,
		ui.HelpShortcutStyle.Render(shortcut),
		"  ",
		ui.HelpDescriptionStyle.Render(description),
	)
}

func formatStepProgress(current, total int) string {
	if total <= 0 {
		return "Step:—"
	}
	if current <= 0 {
		current = 1
	}
	return fmt.Sprintf("Step:%d/%d", current, total)
}

func renderDataTable(width int, height int, columns []table.Column, rows []table.Row) string {
	t := table.New(
		table.WithColumns(columns),
		table.WithRows(rows),
		table.WithFocused(false),
		table.WithHeight(height),
		table.WithWidth(max(width, 20)),
	)
	t.SetStyles(ui.DataTableStyles())
	return t.View()
}

func timelineStatusToken(status string) string {
	switch status {
	case "success":
		return ui.TimelineSuccessStyle.Render("✓")
	case "failed":
		return ui.TimelineFailedStyle.Render("✗")
	default:
		return ui.TimelineRunningStyle.Render("⟳")
	}
}

func verificationStatusToken(status string) string {
	switch status {
	case "pass":
		return ui.VerificationPassStyle.Render("PASS")
	case "fail":
		return ui.VerificationFailStyle.Render("FAIL")
	default:
		return ui.VerificationRunningStyle.Render("RUN")
	}
}

func fileStatusToken(status string) string {
	switch status {
	case "created":
		return ui.FileCreatedStyle.Render("A")
	case "deleted":
		return ui.FileDeletedStyle.Render("D")
	default:
		return ui.FileModifiedStyle.Render("M")
	}
}

func previewSummary(content string, maxLines, width int) string {
	lines := strings.Split(strings.TrimSpace(content), "\n")
	if len(lines) == 0 || lines[0] == "" {
		return "(no preview)"
	}
	if len(lines) > maxLines {
		lines = lines[:maxLines]
		lines = append(lines, "…")
	}
	for i, line := range lines {
		lines[i] = trimToWidth(line, width)
	}
	return strings.Join(lines, "\n")
}

func trimToWidth(value string, width int) string {
	value = strings.TrimSpace(value)
	if width <= 4 || lipgloss.Width(value) <= width {
		return value
	}
	runes := []rune(value)
	if len(runes) <= width {
		return value
	}
	return string(runes[:max(0, width-1)]) + "…"
}

func formatRelativeTime(ts time.Time) string {
	if ts.IsZero() {
		return ""
	}
	return ts.Format(time.Kitchen)
}

var _ = formatRelativeTime

func (m Model) hasGenerationTelemetry() bool {
	return m.CurrentIteration > 0 || m.GenerationIterations > 0 || m.GenerationScore > 0 || strings.TrimSpace(m.GenerationModel) != ""
}

func taskProgressPercent(current, total int) float64 {
	if total <= 0 {
		return 0
	}
	if current < 0 {
		current = 0
	}
	if current > total {
		current = total
	}
	return float64(current) / float64(total)
}

func generationProgressPercent(current, total int) float64 {
	if total <= 0 {
		return 0
	}
	if current < 0 {
		current = 0
	}
	if current > total {
		current = total
	}
	return float64(current) / float64(total)
}

func renderGradientProgressBar(width int, percent float64, startColor, endColor string) string {
	bar := progress.New(
		progress.WithWidth(max(width, 12)),
		progress.WithScaledGradient(startColor, endColor),
	)
	bar.PercentFormat = "%3.0f%%"
	return bar.ViewAs(clampPercent(percent))
}

func clampPercent(percent float64) float64 {
	if percent < 0 {
		return 0
	}
	if percent > 1 {
		return 1
	}
	return percent
}

func formatDurationMs(ms int64) string {
	if ms < 1000 {
		return fmt.Sprintf("%dms", ms)
	}
	return fmt.Sprintf("%.1fs", float64(ms)/1000.0)
}

func (m Model) renderReviewPanel(width int) string {
	lines := []string{ui.PanelTitleStyle.Render("Review Candidates")}
	if len(m.ReviewCandidates) == 0 {
		lines = append(lines, ui.EmptyStateStyle.Render("No candidates yet."))
		return ui.PanelStyle.Width(width).Render(lipgloss.JoinVertical(lipgloss.Left, lines...))
	}

	start := 0
	if len(m.ReviewCandidates) > 6 {
		start = len(m.ReviewCandidates) - 6
	}
	for _, c := range m.ReviewCandidates[start:] {
		statusIcon := "…"
		switch c.Status {
		case "accepted":
			statusIcon = "✓"
		case "rejected":
			statusIcon = "✗"
		}
		favIcon := ""
		if m.FavoriteIDs[c.ID] {
			favIcon = " ★"
		}
		score := fmt.Sprintf("%.2f", c.Score)
		line := fmt.Sprintf("%s %s  %s  %s%s", statusIcon, c.ID[:min(20, len(c.ID))], score, c.Label, favIcon)
		lines = append(lines, ui.TimelineStepStyle.Render(line))
	}
	lines = append(lines, ui.TaskHintStyle.Render("/accept <id>  /reject <id>  /pin <id>  /diff <a> <b>"))
	return ui.PanelStyle.Width(width).Render(lipgloss.JoinVertical(lipgloss.Left, lines...))
}

func (m Model) renderDiffView(width int) string {
	lines := []string{ui.PanelTitleStyle.Render("Diff")}
	diffLines := strings.Split(m.DiffContent, "\n")
	start := 0
	if len(diffLines) > 12 {
		start = len(diffLines) - 12
	}
	for _, dl := range diffLines[start:] {
		trimmed := trimToWidth(dl, width-4)
		if strings.HasPrefix(dl, "+ ") {
			lines = append(lines, lipgloss.NewStyle().Foreground(ui.AccentGreen).Render(trimmed))
		} else if strings.HasPrefix(dl, "- ") {
			lines = append(lines, lipgloss.NewStyle().Foreground(ui.AccentRed).Render(trimmed))
		} else {
			lines = append(lines, ui.PanelValueStyle.Render(trimmed))
		}
	}
	return ui.PanelStyle.Width(width).Render(lipgloss.JoinVertical(lipgloss.Left, lines...))
}

func (m Model) renderOnboardingPanel(width int) string {
	lines := []string{ui.PanelTitleStyle.Render("Setup Wizard")}
	for _, step := range m.OnboardingSteps {
		statusIcon := "…"
		switch step.Status {
		case "complete":
			statusIcon = "✓"
		case "failed":
			statusIcon = "✗"
		case "in_progress":
			statusIcon = "⟳"
		}
		line := fmt.Sprintf("%s %s: %s", statusIcon, step.Title, step.Status)
		if step.Value != "" {
			line += " — " + trimToWidth(step.Value, width-20)
		}
		lines = append(lines, ui.TimelineStepStyle.Render(line))
	}
	if m.OnboardingComplete {
		lines = append(lines, ui.GenerationValueStyle.Render("Config: "+m.OnboardingConfigPath))
	}
	return ui.PanelStyle.Width(width).Render(lipgloss.JoinVertical(lipgloss.Left, lines...))
}

func (m Model) renderDiagnosticsPanel(width int) string {
	lines := []string{ui.PanelTitleStyle.Render("Diagnostics")}
	for _, check := range m.DiagnosticChecks {
		statusIcon := "⚠"
		switch check.Status {
		case "pass":
			statusIcon = "✓"
		case "fail":
			statusIcon = "✗"
		}
		line := fmt.Sprintf("%s %s: %s", statusIcon, check.Name, trimToWidth(check.Message, width-12))
		lines = append(lines, ui.TimelineStepStyle.Render(line))
	}
	summary := "All checks passed."
	if !m.DiagnosticsAllPassed {
		summary = "Some checks need attention."
	}
	lines = append(lines, ui.PanelMetaStyle.Render(summary))
	return ui.PanelStyle.Width(width).Render(lipgloss.JoinVertical(lipgloss.Left, lines...))
}

func (m Model) renderCortexStatus(width int) string {
	s := m.CortexSnapshot
	pending := s.TaskPipeline.Pending + s.TaskPipeline.InProgress
	acceptPct := s.TaskPipeline.AcceptanceRate * 100

	var latency string
	if s.LLMHealth.AvgLatencyMs >= 1000 {
		latency = fmt.Sprintf("%.1fs", s.LLMHealth.AvgLatencyMs/1000)
	} else {
		latency = fmt.Sprintf("%.0fms", s.LLMHealth.AvgLatencyMs)
	}

	lines := []string{fmt.Sprintf("Cortex: %d pending | %d done | %.0f%% accept | %s avg",
		pending, s.TaskPipeline.Completed, acceptPct, latency)}

	// Budget bar
	if m.CortexBudget != nil {
		actionPct := 0
		if m.CortexBudget.ActionsLimit > 0 {
			actionPct = m.CortexBudget.ActionsTaken * 100 / m.CortexBudget.ActionsLimit
		}
		barWidth := max(10, width-30)
		filled := actionPct * barWidth / 100
		bar := strings.Repeat("█", filled) + strings.Repeat("░", barWidth-filled)
		lines = append(lines, fmt.Sprintf("Budget: %s %d/%d actions", bar,
			m.CortexBudget.ActionsTaken, m.CortexBudget.ActionsLimit))
	}

	// Latest decision reasoning
	if len(m.CortexDecisions) > 0 {
		latest := m.CortexDecisions[len(m.CortexDecisions)-1]
		tag := "auto"
		if latest.ReviewRequired {
			tag = "review"
		}
		lines = append(lines, fmt.Sprintf("Decision [%s %.2f]: %s",
			tag, latest.Score, trimToWidth(latest.Reasoning, width-25)))
	}

	// Stuck workers warning
	if len(m.CortexStuckWorkers) > 0 {
		details := make([]string, 0, len(m.CortexStuckWorkers))
		for _, sw := range m.CortexStuckWorkers {
			details = append(details, fmt.Sprintf("%s: %s", sw.ProcessName, formatDurationMs(int64(sw.DurationMs))))
		}
		warning := fmt.Sprintf("WARNING - %d stuck: %s", len(m.CortexStuckWorkers), strings.Join(details, ", "))
		lines = append(lines, lipgloss.NewStyle().Foreground(ui.AccentYellow).Render(trimToWidth(warning, width-4)))
	}

	return lipgloss.NewStyle().
		Foreground(ui.AccentCyan).
		Width(width).
		Padding(0, 1).
		Render(lipgloss.JoinVertical(lipgloss.Left, lines...))
}

func (m Model) renderCortexGoalPanel(width int) string {
	lines := []string{ui.PanelTitleStyle.Render("Cortex Goals")}
	for _, g := range m.CortexGoals {
		marker := "  "
		if g.Priority == "critical" {
			marker = "!!"
		} else if g.Priority == "high" {
			marker = " !"
		}
		line := fmt.Sprintf("%s %s", marker, trimToWidth(g.Text, width-6))
		lines = append(lines, ui.TimelineStepStyle.Render(line))
	}
	lines = append(lines, ui.TaskHintStyle.Render("/goal add <text>  /goal done <id>  /goal remove <id>"))
	return ui.PanelStyle.Width(width).Render(lipgloss.JoinVertical(lipgloss.Left, lines...))
}

func (m Model) renderCortexPanel(width int) string {
	lines := []string{ui.PanelTitleStyle.Render("Cortex Dashboard")}
	if strings.TrimSpace(m.CortexDashboard) != "" {
		for _, line := range strings.Split(m.CortexDashboard, "\n") {
			lines = append(lines, trimToWidth(line, width-4))
		}
	} else {
		lines = append(lines, ui.EmptyStateStyle.Render("No Cortex data yet. Use /cortex to generate a dashboard."))
	}
	lines = append(lines, ui.TaskHintStyle.Render("Ctrl+X close  /cortex refresh"))
	return ui.PanelStyle.Width(width).Render(lipgloss.JoinVertical(lipgloss.Left, lines...))
}

func (m Model) renderSessionList(width int) string {
	lines := []string{ui.PanelTitleStyle.Render("Sessions")}
	if len(m.SessionList) == 0 {
		lines = append(lines, ui.EmptyStateStyle.Render("No sessions recorded."))
		return ui.PanelStyle.Width(width).Render(lipgloss.JoinVertical(lipgloss.Left, lines...))
	}
	start := 0
	if len(m.SessionList) > 8 {
		start = len(m.SessionList) - 8
	}
	for _, s := range m.SessionList[start:] {
		turns := fmt.Sprintf("%d turns", s.TurnCount)
		intent := ""
		if s.LastIntent != "" {
			intent = " — " + trimToWidth(s.LastIntent, width/2)
		}
		line := fmt.Sprintf("%s  %s  %s%s", trimToWidth(s.SessionID, 24), turns, trimToWidth(s.UpdatedAt, 19), intent)
		lines = append(lines, ui.TimelineStepStyle.Render(line))
	}
	return ui.PanelStyle.Width(width).Render(lipgloss.JoinVertical(lipgloss.Left, lines...))
}
