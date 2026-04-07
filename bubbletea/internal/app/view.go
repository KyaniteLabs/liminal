package app

import (
	"strings"

	"github.com/Pastorsimon1798/liminal/bubbletea/internal/ui"
)

func (m Model) View() string {
	connStatus := "connecting..."
	if m.Connected {
		connStatus = "connected"
	}
	if m.Err != "" {
		connStatus = "error"
	}
	header := ui.HeaderStyle.Render("LIMINAL") + " " + ui.ModeBadgeStyle.Render(m.Mode) + " " + ui.TrustBadgeStyle.Render(m.Provider+"/"+m.ModelName) + " " + ui.ConnStyle.Render(connStatus)
	footer := ui.FooterStyle.Render("Input: " + m.Input)

	historyText := strings.Join(m.History, "\n")
	if historyText == "" {
		historyText = "(no committed history yet)"
	}
	activeText := m.ActiveResponse
	if activeText == "" {
		activeText = "(awaiting response)"
	}
	history := ui.PaneStyle.Width(34).Height(20).Render(historyText)
	active := ui.PaneStyle.Width(38).Height(20).Render(activeText)
	statusBody := strings.Join(m.StatusLines(), "\n")
	if m.PendingAction != nil {
		statusBody += "\n\nReview Card:\n" + m.PendingAction.Title + "\n[y] confirm  [n] cancel"
	}
	status := ui.PaneStyle.Width(40).Height(20).Render(statusBody)

	body := ui.RowStyle.Render(history, active, status)
	return strings.Join([]string{header, body, footer}, "\n")
}
