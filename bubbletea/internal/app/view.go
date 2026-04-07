package app

import (
	"fmt"
	"strings"

	"github.com/Pastorsimon1798/liminal/bubbletea/internal/ui"
)

func (m Model) View() string {
	connStatus := "connecting..."
	if m.Connected && !m.Reconnecting {
		connStatus = "connected"
	}
	if m.Reconnecting {
		connStatus = "reconnecting..."
	}
	if m.Err != "" {
		connStatus = "error"
	}
	header := ui.HeaderStyle.Render("LIMINAL") + " " + ui.ModeBadgeStyle.Render(m.Mode) + " " + ui.TrustBadgeStyle.Render(m.Provider+"/"+m.ModelName) + " " + ui.ConnStyle.Render(connStatus)

	modeHint := ""
	switch m.Mode {
	case "CHAT":
		modeHint = "[PgUp/PgDn] scroll history"
	case "ACTION":
		modeHint = "[y] confirm  [n] cancel"
	case "INSPECT":
		modeHint = "[Esc] back to chat"
	}
	footer := ui.FooterStyle.Render("Input: "+m.Input) + "  " + ui.ModeHintStyle.Render(modeHint)

	// Render scrollable history pane
	historyText := m.renderHistoryPane()
	activeText := m.ActiveResponse
	if activeText == "" {
		activeText = "(awaiting response)"
	}
	if m.Reconnecting {
		activeText = "Reconnecting to bridge..."
	}
	history := ui.PaneStyle.Width(34).Height(20).Render(historyText)
	active := ui.PaneStyle.Width(38).Height(20).Render(activeText)
	statusBody := strings.Join(m.StatusLines(), "\n")
	if m.PendingAction != nil {
		statusBody += fmt.Sprintf("\n\nReview Card:\n%s\n[y] confirm  [n] cancel", m.PendingAction.Title)
	}
	if m.Reconnecting {
		statusBody += "\n\nReconnecting..."
	}
	status := ui.PaneStyle.Width(40).Height(20).Render(statusBody)

	body := ui.RowStyle.Render(history, active, status)
	return strings.Join([]string{header, body, footer}, "\n")
}

// renderHistoryPane returns only the visible window of history entries
// based on the current HistoryOffset and available pane height.
func (m Model) renderHistoryPane() string {
	if len(m.History) == 0 {
		return "(no committed history yet)\n[PgUp/PgDn to scroll]"
	}

	paneHeight := 18 // 20 - 2 for border/padding
	total := len(m.History)

	// Clamp offset
	if m.HistoryOffset > total-paneHeight {
		m.HistoryOffset = max(0, total-paneHeight)
	}
	if m.HistoryOffset < 0 {
		m.HistoryOffset = 0
	}

	end := m.HistoryOffset + paneHeight
	if end > total {
		end = total
	}

	visible := m.History[m.HistoryOffset:end]
	result := strings.Join(visible, "\n")

	// Show scroll indicator if there's more content
	if total > paneHeight {
		result += fmt.Sprintf("\n--- %d/%d [PgUp/PgDn] ---", m.HistoryOffset+1, total)
	}

	return result
}
