package app

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/Pastorsimon1798/liminal/bubbletea/internal/ui"
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

	// ── Calculate column widths ──
	chatWidth := m.Width * 3 / 5       // 60% for chat
	previewWidth := m.Width * 2 / 5    // 40% for preview
	paneHeight := m.Height - 6         // minus header(2) + footer(2) + borders(2)

	if chatWidth < 30 {
		chatWidth = 30
	}
	if previewWidth < 24 {
		previewWidth = 24
	}
	if paneHeight < 5 {
		paneHeight = 5
	}

	// ── Chat pane (left) ──
	chatPane := ui.ChatPaneStyle.
		Width(chatWidth).
		Height(paneHeight).
		Render(m.ChatViewport.View())

	// ── Right column ──
	var rightPane string
	if m.PreviewVisible {
		rightPane = ui.PreviewPaneStyle.
			Width(previewWidth).
			Height(paneHeight).
			Render(m.renderPreviewSection(previewWidth, paneHeight))
	} else {
		rightPane = ui.ChatPaneStyle.
			Width(previewWidth).
			Height(paneHeight).
			Render(m.renderCompactStatus())
	}

	// ── Focus indicator ──
	if m.FocusPane == FocusPreview {
		rightPane = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(ui.AccentGreen).
			Width(previewWidth).
			Height(paneHeight).
			Render(m.renderPreviewSection(previewWidth, paneHeight))
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

	// Spacing between elements
	spacer := lipgloss.NewStyle().Foreground(ui.FgMuted).Render(" ")

	header := lipgloss.NewStyle().
		Background(ui.BgSurface).
		Foreground(ui.FgText).
		Padding(0, 1).
		Width(m.Width).
		Render(brand + spacer + mode + spacer + provider + spacer + connDot)

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

	return lipgloss.NewStyle().
		Width(width-4).
		Foreground(ui.FgMuted).
		Render(model + "  " + mode + "  " + trust)
}

// ── Compact status when preview is hidden ──

func (m Model) renderCompactStatus() string {
	var lines []string
	lines = append(lines, ui.StatusLabelStyle.Render("Provider: ")+ui.StatusValueStyle.Render(m.Provider+"/"+m.ModelName))
	lines = append(lines, ui.StatusLabelStyle.Render("Mode: ")+ui.StatusValueStyle.Render(m.Mode))
	lines = append(lines, ui.StatusLabelStyle.Render("Trust: ")+ui.StatusValueStyle.Render(m.TrustLabel))

	if m.PendingAction != nil {
		lines = append(lines, "")
		lines = append(lines, ui.ActionTitleStyle.Render("⚠ Pending Action"))
		lines = append(lines, ui.ActionCardStyle.Render(m.PendingAction.Title))
		lines = append(lines, ui.HintStyle.Render("[y] confirm  [n] cancel"))
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

	// Append active streaming response
	if m.ActiveResponse != "" {
		sb.WriteString(ui.AssistantMsgStyle.Render("◆"))
		sb.WriteString("\n")
		rendered := m.renderMarkdown(m.ActiveResponse)
		sb.WriteString(rendered)
		sb.WriteString(ui.StreamingStyle.Render("▌"))
	}

	if len(m.ChatBlocks) == 0 && m.ActiveResponse == "" {
		sb.WriteString(lipgloss.NewStyle().
			Foreground(ui.FgMuted).
			Render("Welcome to Liminal. Type a message to begin."))
	}

	return sb.String()
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
