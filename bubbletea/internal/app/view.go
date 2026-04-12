package app

import (
	"fmt"
	"strings"

	"github.com/Pastorsimon1798/liminal/bubbletea/internal/ui"
	"github.com/charmbracelet/lipgloss"
)

func (m Model) View() string {
	if !m.Ready {
		return lipgloss.NewStyle().
			Foreground(ui.AccentPurple).
			Bold(true).
			Render("◆ LIMINAL") + "  Initializing..."
	}

	header := m.renderHeader()
	footer := m.renderFooter()

	metrics := m.layoutMetrics()

	// ── Chat pane (left) ──
	chatPane := ui.ChatPaneStyle.
		Width(metrics.chatContentWidth).
		MaxWidth(metrics.chatContentWidth).
		Height(metrics.paneContentHeight).
		MaxHeight(metrics.paneContentHeight).
		Render(m.ChatViewport.View())

	// ── Right column ──
	var rightPane string
	if m.PreviewVisible {
		rightPane = ui.PreviewPaneStyle.
			Width(metrics.previewContentWidth).
			MaxWidth(metrics.previewContentWidth).
			Height(metrics.paneContentHeight).
			MaxHeight(metrics.paneContentHeight).
			Render(m.renderPreviewSection(metrics.previewContentWidth, metrics.paneContentHeight))
	} else {
		rightPane = ui.ChatPaneStyle.
			Width(metrics.previewContentWidth).
			MaxWidth(metrics.previewContentWidth).
			Height(metrics.paneContentHeight).
			MaxHeight(metrics.paneContentHeight).
			Render(m.renderCompactStatus())
	}

	// ── Focus indicator ──
	if m.FocusPane == FocusPreview {
		rightPane = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(ui.AccentGreen).
			Padding(0, 1).
			Width(metrics.previewContentWidth).
			MaxWidth(metrics.previewContentWidth).
			Height(metrics.paneContentHeight).
			MaxHeight(metrics.paneContentHeight).
			Render(m.renderPreviewSection(metrics.previewContentWidth, metrics.paneContentHeight))
	}

	// ── Join columns ──
	body := lipgloss.JoinHorizontal(lipgloss.Top, chatPane, rightPane)

	return lipgloss.JoinVertical(lipgloss.Left, header, body, footer)
}

// ── Header ──

func (m Model) renderHeader() string {
	brand := ui.BrandStyle.Render("◆ LIMINAL")
	mode := ui.ModeStyle.Render(strings.ToLower(m.Mode))
	provider := ui.ProviderStyle.Render(m.Provider + " / " + m.ModelName)
	connDot := ui.StatusDot(m.Connected, m.Reconnecting)

	// Generation telemetry display
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

	// Swarm round progress display
	var swarmTelemetry string
	if m.SwarmRound > 0 {
		swarmTelemetry = lipgloss.NewStyle().
			Foreground(ui.AccentMagenta).
			Render(fmt.Sprintf("Swarm %d/%d — %d sym", m.SwarmRound, m.SwarmTotalRounds, m.SwarmVocabularySize))
	}

	// Spacing between elements
	spacer := lipgloss.NewStyle().Foreground(ui.FgMuted).Render(" ")

	headerContent := brand + spacer + mode + spacer + provider + spacer + connDot
	if m.shouldSpin() {
		headerContent += spacer + ui.ActivityStyle.Render(m.Spinner.View()+" "+m.currentActivityText())
	}
	if telemetry != "" {
		headerContent += spacer + telemetry
	}
	if swarmTelemetry != "" {
		headerContent += spacer + swarmTelemetry
	}

	header := lipgloss.NewStyle().
		Background(ui.BgSurface).
		Foreground(ui.FgText).
		Padding(0, 1).
		Width(m.Width).
		Render(headerContent)

	return header
}

// ── Footer with textinput ──

func (m Model) renderFooter() string {
	// Input field
	inputView := m.TextInput.View()

	// Keybinding hints
	var hints []string
	if m.FocusPane == FocusChat {
		switch m.Mode {
		case "CHAT":
			hints = []string{
				ui.KeyStyle.Render("Tab") + ui.HintStyle.Render(":preview"),
				ui.KeyStyle.Render("Enter") + ui.HintStyle.Render(":send"),
				ui.KeyStyle.Render("Ctrl+E") + ui.HintStyle.Render(":toggle"),
				ui.KeyStyle.Render("PgUp/PgDn") + ui.HintStyle.Render(":scroll"),
				ui.KeyStyle.Render("Ctrl+Y") + ui.HintStyle.Render(":copy"),
			}
		case "ACTION":
			hints = []string{
				ui.KeyStyle.Render("y") + ui.HintStyle.Render(":confirm"),
				ui.KeyStyle.Render("n") + ui.HintStyle.Render(":cancel"),
			}
		default:
			hints = []string{
				ui.KeyStyle.Render("Enter") + ui.HintStyle.Render(":send"),
			}
		}
	} else {
		hints = []string{
			ui.KeyStyle.Render("Tab") + ui.HintStyle.Render(":chat"),
			ui.KeyStyle.Render("Ctrl+T") + ui.HintStyle.Render(":tab"),
			ui.KeyStyle.Render("Esc") + ui.HintStyle.Render(":back"),
		}
	}
	hintStr := strings.Join(hints, "  ")

	footer := lipgloss.NewStyle().
		Background(ui.BgSurface).
		Foreground(ui.FgText).
		Padding(0, 1).
		Width(m.Width).
		Render(inputView + "  " + hintStr)

	return footer
}

// ── Preview section (right column) ──

func (m Model) renderPreviewSection(width, height int) string {
	// Tab bar
	codeTab := ui.InactiveTabStyle.Render("Code")
	outputTab := ui.InactiveTabStyle.Render("Output")
	logTab := ui.InactiveTabStyle.Render("Log")

	switch m.PreviewTab {
	case "code":
		codeTab = ui.ActiveTabStyle.Render("Code")
	case "output":
		outputTab = ui.ActiveTabStyle.Render("Output")
	case "log":
		logTab = ui.ActiveTabStyle.Render("Log")
	}

	tabBar := ui.TabBarStyle.Width(width - 4).Render(codeTab + outputTab + logTab)

	// Preview content viewport
	previewView := m.PreviewViewport.View()

	// Status at bottom
	statusLine := m.renderStatusLine(width)

	return lipgloss.JoinVertical(lipgloss.Left, tabBar, previewView, statusLine)
}

// ── Status line in preview pane ──

func (m Model) renderStatusLine(width int) string {
	trustColor := ui.TrustColor(m.TrustLabel)

	trust := lipgloss.NewStyle().
		Foreground(trustColor).
		Render(m.TrustLabel)

	mode := ui.StatusLabelStyle.Render("Mode: ") + ui.StatusValueStyle.Render(m.Mode)
	model := ui.StatusLabelStyle.Render("Model: ") + ui.StatusValueStyle.Render(m.Provider+"/"+m.ModelName)

	statusLine := model + "  " + mode + "  " + trust

	// Add generation telemetry if available
	if m.GenerationScore > 0 || m.CurrentIteration > 0 {
		scoreStr := fmt.Sprintf("%.2f", m.GenerationScore)
		iterStr := fmt.Sprintf("%d", m.CurrentIteration)
		if m.GenerationIterations > 0 {
			iterStr = fmt.Sprintf("%d/%d", m.CurrentIteration, m.GenerationIterations)
		}
		genInfo := ui.StatusLabelStyle.Render("Gen: ") +
			ui.StatusValueStyle.Render("iter:"+iterStr+" score:"+scoreStr)
		if m.GenerationDuration > 0 {
			durationStr := fmt.Sprintf("%.1fs", float64(m.GenerationDuration)/1000.0)
			genInfo = ui.StatusLabelStyle.Render("Gen: ") +
				ui.StatusValueStyle.Render("iter:"+iterStr+" score:"+scoreStr+" "+durationStr)
		}
		statusLine += "  " + genInfo
	}

	return lipgloss.NewStyle().
		Width(width - 4).
		Foreground(ui.FgMuted).
		Render(statusLine)
}

// ── Compact status when preview is hidden ──

func (m Model) renderCompactStatus() string {
	var lines []string
	lines = append(lines, ui.StatusLabelStyle.Render("Provider: ")+ui.StatusValueStyle.Render(m.Provider+"/"+m.ModelName))
	lines = append(lines, ui.StatusLabelStyle.Render("Mode: ")+ui.StatusValueStyle.Render(m.Mode))
	trustColor := ui.TrustColor(m.TrustLabel)
	lines = append(lines, ui.StatusLabelStyle.Render("Trust: ")+lipgloss.NewStyle().Foreground(trustColor).Render(m.TrustLabel))
	if m.TranscriptPath != "" {
		lines = append(lines, ui.StatusLabelStyle.Render("Transcript: ")+ui.StatusValueStyle.Render(m.TranscriptPath))
	}

	if m.PendingAction != nil {
		lines = append(lines, "")
		lines = append(lines, ui.ActionTitleStyle.Render("⚠ Pending Action"))
		lines = append(lines, ui.ActionCardStyle.Render(m.PendingAction.Title))
		lines = append(lines, ui.HintStyle.Render("[y] confirm  [n] cancel"))
	}
	if m.LastNotice != "" {
		lines = append(lines, "")
		lines = append(lines, ui.ActivityStyle.Render(m.LastNotice))
	}

	return strings.Join(lines, "\n")
}

// ── Chat content rendering ──

func (m Model) renderChatContent() string {
	var sb strings.Builder

	// Render structured chat blocks
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
			if block.Preview != "" {
				sb.WriteString(ui.PreviewBadgeStyle.Render(" ▶ Preview"))
			}
			sb.WriteString("\n\n")

		case "error":
			sb.WriteString(ui.ErrorStyle.Render("✗ " + block.Content))
			sb.WriteString("\n\n")

		case "system":
			sb.WriteString(ui.SystemStyle.Render("— " + block.Content))
			sb.WriteString("\n\n")
		}
	}
	if m.LastNotice != "" {
		sb.WriteString(ui.ActivityStyle.Render(m.LastNotice))
		sb.WriteString("\n\n")
	}
	if len(m.ActivityLog) > 0 && (m.IsStreaming || m.ActivityMessage != "") {
		sb.WriteString(ui.ActivityStyle.Render("Live tool/thought trace"))
		sb.WriteString("\n")
		start := 0
		if len(m.ActivityLog) > 6 {
			start = len(m.ActivityLog) - 6
		}
		for _, line := range m.ActivityLog[start:] {
			sb.WriteString(ui.StreamingStyle.Render("• " + line))
			sb.WriteString("\n")
		}
		sb.WriteString("\n")
	}

	// Append active streaming response
	if m.ActiveResponse != "" {
		sb.WriteString(ui.AssistantMsgStyle.Render("◆"))
		sb.WriteString(" ")
		sb.WriteString(ui.TypingPillStyle.Render(m.Spinner.View() + " streaming"))
		sb.WriteString("\n")
		rendered := m.renderMarkdown(m.ActiveResponse)
		sb.WriteString(rendered)
		// Show live iteration progress during generation
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
		} else {
			sb.WriteString("\n")
			sb.WriteString(ui.StreamingStyle.Render(m.Spinner.View() + " GLM is typing"))
		}
	} else if m.IsStreaming || m.ActivityMessage != "" {
		sb.WriteString(ui.AssistantMsgStyle.Render("◆"))
		sb.WriteString(" ")
		sb.WriteString(ui.TypingPillStyle.Render(m.Spinner.View() + " " + m.currentActivityText()))
	}

	if len(m.ChatBlocks) == 0 && m.ActiveResponse == "" {
		sb.WriteString(lipgloss.NewStyle().
			Foreground(ui.FgMuted).
			Render("Welcome to Liminal. Type a message to begin."))
	}

	return sb.String()
}

func (m Model) currentActivityText() string {
	if m.ActivityMessage != "" {
		return m.ActivityMessage
	}
	if m.Reconnecting {
		return "reconnecting"
	}
	if m.IsStreaming {
		return "GLM is typing"
	}
	return "idle"
}

// renderPreviewContent returns content for the preview viewport.
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

// renderMarkdown uses glamour to render markdown with syntax highlighting.
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

// ── Viewport style helpers ──

func chatViewportStyle() lipgloss.Style {
	return lipgloss.NewStyle()
}

func previewViewportStyle() lipgloss.Style {
	return lipgloss.NewStyle()
}

// max returns the larger of a and b.
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// min returns the smaller of a and b.
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// Format intentionally kept as a helper for future use.
func formatBytes(n int) string {
	if n < 1024 {
		return fmt.Sprintf("%d B", n)
	}
	return fmt.Sprintf("%.1f KB", float64(n)/1024)
}
