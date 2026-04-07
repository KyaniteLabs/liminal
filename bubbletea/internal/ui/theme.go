package ui

import "github.com/charmbracelet/lipgloss"

var (
	HeaderStyle = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("14")).Padding(0, 1)
	ModeBadgeStyle = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("0")).Background(lipgloss.Color("11")).Padding(0, 1)
	TrustBadgeStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("15")).Background(lipgloss.Color("8")).Padding(0, 1)
	ConnStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("6")).Padding(0, 1)
	PaneStyle = lipgloss.NewStyle().Border(lipgloss.NormalBorder()).BorderForeground(lipgloss.Color("8")).Padding(1)
	FooterStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("10")).Padding(0, 1)
	RowStyle = lipgloss.NewStyle().Align(lipgloss.Top)
	ModeHintStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("8")).Padding(0, 1)
)
