package app

import (
	"fmt"
	"strings"
	"time"

	"github.com/Pastorsimon1798/liminal/bubbletea/internal/ui"
	"github.com/charmbracelet/lipgloss"
)

func (m Model) renderOperatorSurface(width int) string {
	contentWidth := max(20, width)
	panels := []string{m.renderTaskCard(contentWidth)}

	if m.TimelineVisible {
		panels = append(panels, m.renderToolTimeline(contentWidth))
	}
	if len(m.ChangedFiles) > 0 || m.MutationCount > 0 {
		panels = append(panels, m.renderChangedFiles(contentWidth))
	}
	if len(m.VerificationJobs) > 0 {
		panels = append(panels, m.renderVerificationJobs(contentWidth))
	}
	if m.ArtifactsVisible {
		panels = append(panels, m.renderArtifactsDrawer(contentWidth))
	}
	if m.PreviewVisible && strings.TrimSpace(m.PreviewContent) != "" {
		panels = append(panels, m.renderPreviewCard(contentWidth))
	}
	if m.HelpVisible {
		panels = append(panels, m.renderHelpDrawer(contentWidth))
	} else if len(m.ActivityLog) > 0 {
		panels = append(panels, m.renderActivityLog(contentWidth))
	}

	return lipgloss.JoinVertical(lipgloss.Left, panels...)
}

func (m Model) renderTaskCard(width int) string {
	title := ui.TaskTitleStyle.Render("Task")
	phase := m.renderPhaseBadge(m.Task.Phase)
	progress := ui.TaskProgressStyle.Render(formatStepProgress(m.Task.StepCurrent, m.Task.StepTotal))
	header := lipgloss.JoinHorizontal(lipgloss.Left, title, "  ", phase, "  ", progress)

	objective := strings.TrimSpace(m.Task.Objective)
	if objective == "" {
		objective = "Waiting for operator instructions"
	}

	lines := []string{
		header,
		ui.TaskObjectiveStyle.Render(objective),
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

func (m Model) renderToolTimeline(width int) string {
	lines := []string{ui.PanelTitleStyle.Render("Timeline")}
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

	for _, file := range m.ChangedFiles {
		row := fmt.Sprintf("%s %s", fileStatusToken(file.Status), file.Path)
		if file.IsLatest {
			row += " ← latest"
		}
		lines = append(lines, ui.FileRowStyle.Render(row))
	}

	return ui.PanelStyle.Width(width).Render(lipgloss.JoinVertical(lipgloss.Left, lines...))
}

func (m Model) renderVerificationJobs(width int) string {
	lines := []string{ui.PanelTitleStyle.Render("Verification")}
	for _, job := range m.VerificationJobs {
		status := verificationStatusToken(job.Status)
		command := trimToWidth(job.Command, width-10)
		lines = append(lines, ui.VerificationJobStyle.Render(fmt.Sprintf("%s %s", status, command)))
		if strings.TrimSpace(job.OutputTail) != "" {
			lines = append(lines, ui.VerificationOutputStyle.Render("  ↳ "+trimToWidth(job.OutputTail, width-8)))
		}
	}
	return ui.PanelStyle.Width(width).Render(lipgloss.JoinVertical(lipgloss.Left, lines...))
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
		ui.PanelTitleStyle.Render("Shortcuts"),
		helpRow("Enter", "send message"),
		helpRow("Tab", "focus operator column"),
		helpRow("Ctrl+T", "toggle timeline"),
		helpRow("Ctrl+A", "toggle artifacts"),
		helpRow("Ctrl+E", "toggle preview card"),
		helpRow("Ctrl+Y", "copy last assistant response"),
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
