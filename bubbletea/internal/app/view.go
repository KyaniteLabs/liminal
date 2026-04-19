package app

import (
	"fmt"
	"strings"

	"github.com/Pastorsimon1798/liminal/bubbletea/internal/ui"
	"github.com/charmbracelet/lipgloss"
	"github.com/muesli/reflow/wordwrap"
)

func (m Model) View() string {
	if !m.Ready {
		return ui.BrandStyle.Render("◆ LIMINAL") + "  Initializing..."
	}

	header := m.renderHeader()
	footer := m.renderFooter()

	metrics := m.layoutMetrics()

	chatContent := m.ChatViewport.View()
	if strings.TrimSpace(chatContent) == "" {
		chatContent = m.renderChatContent()
	}
	chatPaneContent := lipgloss.JoinVertical(
		lipgloss.Left,
		m.renderPaneHeader("Conversation", m.chatPaneStatus()),
		chatContent,
	)
	chatPane := ui.ChatPaneStyle.
		Width(metrics.chatContentWidth).
		MaxWidth(metrics.chatContentWidth).
		Height(metrics.paneContentHeight).
		MaxHeight(metrics.paneContentHeight).
		Render(chatPaneContent)

	rightStyle := ui.OperatorPaneStyle
	if m.FocusPane == FocusPreview {
		rightStyle = ui.OperatorPaneFocusedStyle
	}

	var rightContent string
	if m.PreviewVisible {
		operatorContent := m.PreviewViewport.View()
		if strings.TrimSpace(operatorContent) == "" {
			operatorContent = m.renderOperatorSurface(max(metrics.operatorContentWidth, 24))
		}
		rightContent = lipgloss.JoinVertical(
			lipgloss.Left,
			m.renderPaneHeader("Operator surface", m.operatorPaneStatus()),
			operatorContent,
		)
	} else {
		rightContent = m.renderCompactStatus()
	}

	rightPane := rightStyle.
		Width(metrics.operatorContentWidth).
		MaxWidth(metrics.operatorContentWidth).
		Height(metrics.paneContentHeight).
		MaxHeight(metrics.paneContentHeight).
		Render(rightContent)

	body := lipgloss.JoinHorizontal(lipgloss.Top, chatPane, rightPane)
	return lipgloss.JoinVertical(lipgloss.Left, header, body, footer)
}

func (m Model) renderPaneHeader(title string, status string) string {
	header := ui.PaneTitleStyle.Render(title)
	if strings.TrimSpace(status) == "" {
		return header
	}
	return lipgloss.JoinHorizontal(
		lipgloss.Left,
		header,
		" ",
		ui.PaneStatusPillStyle.Render(status),
	)
}

func (m Model) chatPaneStatus() string {
	if strings.TrimSpace(m.ActiveResponse) != "" {
		return "Streaming"
	}
	if !m.Connected {
		return "Offline"
	}
	return "Live"
}

func (m Model) operatorPaneStatus() string {
	if m.Mode == "ACTION" {
		return "Review first"
	}
	if m.FocusPane == FocusPreview {
		return "Focused"
	}
	return "Live state"
}

func (m Model) renderHeader() string {
	brand := ui.BrandStyle.Render("◆ LIMINAL")
	mode := ui.ModeStyle.Render(strings.ToLower(m.Mode))
	provider := ui.ProviderStyle.Render(m.Provider + "/" + m.ModelName)
	connDot := ui.StatusDot(m.Connected, m.Reconnecting)
	spacer := lipgloss.NewStyle().Foreground(ui.FgMuted).Render(" ")

	headerParts := []string{brand, mode, provider, connDot}
	if strings.TrimSpace(m.ProductMode) != "" {
		headerParts = append(headerParts, ui.ModeStyle.Render("⬡ "+m.ProductModeLabel))
	}
	if strings.TrimSpace(m.ActiveSkill) != "" {
		headerParts = append(headerParts, lipgloss.NewStyle().Foreground(ui.AccentOrange).Render("⚡ "+m.ActiveSkill))
	}
	if strings.TrimSpace(m.ActiveWorkspace) != "" {
		headerParts = append(headerParts, lipgloss.NewStyle().Foreground(ui.AccentPurple).Render("▣ "+m.ActiveWorkspace))
	}
	if strings.TrimSpace(m.AutonomyLevel) != "" && m.AutonomyLevel != "assist" {
		headerParts = append(headerParts, lipgloss.NewStyle().Foreground(ui.AccentGreen).Render("⚡ "+m.AutonomyLabel))
	}
	headerParts = append(headerParts, m.renderPhaseBadge(m.Task.Phase))
	if m.Task.StepTotal > 0 {
		headerParts = append(headerParts, ui.StatusPillStyle.Render(formatStepProgress(m.Task.StepCurrent, m.Task.StepTotal)))
	}
	if strings.TrimSpace(m.TrustLabel) != "" {
		headerParts = append(headerParts, ui.StatusValueStyle.Render(trimToWidth(m.TrustLabel, 32)))
	}

	var telemetry string
	if m.GenerationScore > 0 || m.CurrentIteration > 0 {
		scoreStr := fmt.Sprintf("%.2f", m.GenerationScore)
		iterStr := fmt.Sprintf("%d", m.CurrentIteration)
		if m.GenerationIterations > 0 {
			iterStr = fmt.Sprintf("%d/%d", m.CurrentIteration, m.GenerationIterations)
		}
		telemetry = lipgloss.NewStyle().
			Foreground(ui.AccentCyan).
			Render("Score:" + scoreStr + " Iter:" + iterStr)
		if m.GenerationDuration > 0 {
			durationStr := fmt.Sprintf("%.1fs", float64(m.GenerationDuration)/1000.0)
			telemetry = lipgloss.NewStyle().
				Foreground(ui.AccentCyan).
				Render("Score:" + scoreStr + " Iter:" + iterStr + " " + durationStr)
		}
	}

	var swarmTelemetry string
	if m.SwarmRound > 0 {
		swarmTelemetry = lipgloss.NewStyle().
			Foreground(ui.AccentMagenta).
			Render(fmt.Sprintf("Swarm %d/%d — %d sym", m.SwarmRound, m.SwarmTotalRounds, m.SwarmVocabularySize))
	}

	headerContent := strings.Join(headerParts, spacer)
	if telemetry != "" {
		headerContent += spacer + telemetry
	}
	if swarmTelemetry != "" {
		headerContent += spacer + swarmTelemetry
	}

	return ui.HeaderStyle.Width(m.Width).Render(headerContent)
}

func (m Model) renderFooter() string {
	inputView := m.TextInput.View()

	var hints []string
	if m.FocusPane == FocusChat {
		hints = []string{
			ui.KeyStyle.Render("Enter") + ui.HintStyle.Render(":send"),
			ui.KeyStyle.Render("Alt+Enter") + ui.HintStyle.Render(":newline"),
			ui.KeyStyle.Render("Tab") + ui.HintStyle.Render(":operator"),
			ui.KeyStyle.Render("Ctrl+T") + ui.HintStyle.Render(":timeline"),
			ui.KeyStyle.Render("Ctrl+A") + ui.HintStyle.Render(":artifacts"),
			ui.KeyStyle.Render("Ctrl+Q") + ui.HintStyle.Render(":queue"),
			ui.KeyStyle.Render("Ctrl+R") + ui.HintStyle.Render(":review"),
			ui.KeyStyle.Render("Ctrl+X") + ui.HintStyle.Render(":cortex"),
			ui.KeyStyle.Render("Ctrl+Y") + ui.HintStyle.Render(":copy"),
			ui.KeyStyle.Render("?") + ui.HintStyle.Render(":help"),
		}
		if m.Mode == "ACTION" {
			hints = append(hints,
				ui.KeyStyle.Render("y")+ui.HintStyle.Render(":confirm"),
				ui.KeyStyle.Render("n")+ui.HintStyle.Render(":cancel"),
			)
		}
	} else {
		hints = []string{
			ui.KeyStyle.Render("Tab") + ui.HintStyle.Render(":chat"),
			ui.KeyStyle.Render("↑↓") + ui.HintStyle.Render(":scroll"),
			ui.KeyStyle.Render("Ctrl+T") + ui.HintStyle.Render(":timeline"),
			ui.KeyStyle.Render("Ctrl+A") + ui.HintStyle.Render(":artifacts"),
			ui.KeyStyle.Render("Ctrl+Q") + ui.HintStyle.Render(":queue"),
			ui.KeyStyle.Render("Ctrl+R") + ui.HintStyle.Render(":review"),
			ui.KeyStyle.Render("Ctrl+X") + ui.HintStyle.Render(":cortex"),
			ui.KeyStyle.Render("Ctrl+Y") + ui.HintStyle.Render(":copy"),
			ui.KeyStyle.Render("?") + ui.HintStyle.Render(":help"),
			ui.KeyStyle.Render("Esc") + ui.HintStyle.Render(":back"),
		}
	}

	return ui.FooterStyle.
		Width(m.Width).
		Render(inputView + "  " + strings.Join(hints, "  "))
}

func (m Model) renderCompactStatus() string {
	lines := []string{
		ui.StatusLabelStyle.Render("Provider:") + " " + ui.StatusValueStyle.Render(m.Provider+"/"+m.ModelName),
		ui.StatusLabelStyle.Render("Mode:") + " " + ui.StatusValueStyle.Render(strings.ToLower(m.Mode)),
		ui.StatusLabelStyle.Render("Trust:") + " " + ui.StatusValueStyle.Render(m.TrustLabel),
	}
	if strings.TrimSpace(m.Task.Objective) != "" {
		lines = append(lines, ui.StatusLabelStyle.Render("Task:")+" "+ui.StatusValueStyle.Render(m.Task.Objective))
	}
	if len(m.ChangedFiles) > 0 {
		lines = append(lines, ui.StatusLabelStyle.Render("Changed:")+" "+ui.StatusValueStyle.Render(fmt.Sprintf("%d files", len(m.ChangedFiles))))
	}
	if m.PendingAction != nil {
		lines = append(lines,
			"",
			ui.ActionTitleStyle.Render("Pending review"),
			ui.ActionCardStyle.Render(m.PendingAction.Title),
			ui.HintStyle.Render("[y] confirm  [n] cancel"),
		)
	}
	lines = append(lines, "", ui.HintStyle.Render("Ctrl+E operator  Ctrl+T timeline  Ctrl+A artifacts  ?:help"))
	return strings.Join(lines, "\n")
}

// ── Chat content rendering ──

func (m Model) renderChatContent() string {
	var sb strings.Builder

	for _, block := range m.ChatBlocks {
		switch block.Type {
		case "user":
			sb.WriteString(ui.UserMsgStyle.Render("You:"))
			sb.WriteString("\n")
			sb.WriteString(block.Content)
			sb.WriteString("\n\n")

		case "assistant":
			sb.WriteString(ui.AssistantMsgStyle.Render("◆"))
			sb.WriteString("\n")
			rendered := m.renderMarkdown(block.Content)
			sb.WriteString(rendered)
			sb.WriteString("\n\n")

		case "code":
			rendered := m.renderMarkdown("```javascript\n" + block.Content + "\n```")
			sb.WriteString(rendered)
			sb.WriteString("\n\n")

		case "error":
			sb.WriteString(ui.ErrorStyle.Render("✗ " + block.Content))
			sb.WriteString("\n\n")

		case "system":
			sb.WriteString(ui.SystemStyle.Render("— " + block.Content))
			sb.WriteString("\n\n")
		}
	}

	if m.ActiveResponse != "" {
		sb.WriteString(ui.AssistantMsgStyle.Render("◆"))
		sb.WriteString("\n")
		if m.IsStreaming {
			sb.WriteString(m.renderStreamingText(m.ActiveResponse))
		} else {
			sb.WriteString(m.renderMarkdown(m.ActiveResponse))
		}
		if m.CurrentIteration > 0 {
			scoreStr := fmt.Sprintf("%.2f", m.GenerationScore)
			iterStr := fmt.Sprintf("%d", m.CurrentIteration)
			if m.GenerationIterations > 0 {
				iterStr = fmt.Sprintf("%d/%d", m.CurrentIteration, m.GenerationIterations)
			}
			progress := lipgloss.NewStyle().
				Foreground(ui.AccentGreen).
				Render("▌ iter:" + iterStr + " score:" + scoreStr)
			sb.WriteString(progress)
		} else if m.IsStreaming {
			sb.WriteString(ui.StreamingStyle.Render(" ▌"))
		}
	}

	if len(m.ChatBlocks) == 0 && m.ActiveResponse == "" {
		sb.WriteString(lipgloss.NewStyle().
			Foreground(ui.FgMuted).
			Render("Welcome to Liminal. Type a message to begin."))
	}

	return sb.String()
}

func (m Model) renderPreviewContent() string {
	if m.PreviewContent == "" {
		return lipgloss.NewStyle().
			Foreground(ui.FgMuted).
			Render("(no preview — generate code to see it here)")
	}

	switch m.PreviewTab {
	case "code":
		return m.renderMarkdown("```javascript\n" + m.PreviewContent + "\n```")
	case "output":
		if m.PreviewType == "image" {
			return lipgloss.NewStyle().
				Foreground(ui.AccentCyan).
				Render("Image preview: " + m.PreviewContent + "\n\n(Rendered in browser for now)")
		}
		return m.renderMarkdown(m.PreviewContent)
	case "log":
		return lipgloss.NewStyle().
			Foreground(ui.FgMuted).
			Render("Log output will appear here.")
	default:
		return m.renderMarkdown(m.PreviewContent)
	}
}

func (m Model) renderAudioReactivePreview(width int) string {
	lines := []string{}
	for _, raw := range strings.Split(m.PreviewContent, "\n") {
		line := strings.TrimSpace(raw)
		if line == "" {
			continue
		}
		lower := strings.ToLower(line)
		if strings.HasPrefix(lower, "rms") || strings.HasPrefix(lower, "peak") || strings.HasPrefix(lower, "level") {
			value := parsePreviewMetric(line)
			bar := renderGradientProgressBar(max(width-10, 16), value, string(ui.AccentGreen), string(ui.AccentCyan))
			lines = append(lines, ui.PanelLabelStyle.Render(metricLabel(line))+": "+ui.PanelValueStyle.Render(metricValue(line)))
			lines = append(lines, bar)
			continue
		}
		lines = append(lines, ui.PreviewContentStyle.Render(trimToWidth(line, width-6)))
	}
	if len(lines) == 0 {
		lines = append(lines, ui.EmptyStateStyle.Render("Waiting for microphone levels."))
	}
	return lipgloss.JoinVertical(lipgloss.Left, lines...)
}

// renderStreamingText renders active streaming content in a lightweight readable
// form without invoking the expensive glamour markdown renderer. This keeps the
// UI responsive during long streaming runs.
func (m Model) renderStreamingText(content string) string {
	if content == "" {
		return ""
	}
	text := strings.TrimSpace(content)
	wrapWidth := 80
	if m.ChatViewport.Width > 0 {
		wrapWidth = max(m.ChatViewport.Width-2, 40)
	}
	return wordwrap.String(text, wrapWidth) + "\n"
}

func (m Model) renderMarkdown(content string) string {
	if m.Renderer == nil {
		return content
	}
	rendered, err := m.Renderer.Render(content)
	if err != nil {
		return content
	}
	return rendered
}

func chatViewportStyle() lipgloss.Style {
	return lipgloss.NewStyle()
}

func previewViewportStyle() lipgloss.Style {
	return lipgloss.NewStyle()
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

func formatBytes(n int) string {
	if n < 1024 {
		return fmt.Sprintf("%d B", n)
	}
	return fmt.Sprintf("%.1f KB", float64(n)/1024)
}
