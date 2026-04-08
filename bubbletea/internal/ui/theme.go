package ui

import "github.com/charmbracelet/lipgloss"

// Design tokens — 256-color palette matching the dark OLED design system.
// Background: deep navy (#020617 → 17), Surface: slate (#1E293B → 236)
// Accent: vivid green (#22C55E → 40), Text: near-white (#F8FAFC → 231)
// Muted: slate gray (#334155 → 60), Error: red (#EF4444 → 203)
const (
	CBackground   = "17"   // Deep navy black
	CSurface      = "236"  // Slate surface
	CSurfaceHi    = "239"  // Raised surface
	CText         = "231"  // Near-white foreground
	CTextMuted    = "145"  // Muted slate
	CTextDim      = "60"   // Dim border gray
	CAccent       = "40"   // Vivid green (CTA, active state)
	CAccentDim    = "28"   // Dimmer green for secondary accent
	CError        = "203"  // Red for errors
	CWarn         = "220"  // Amber for warnings
	CInfo         = "117"  // Soft blue for info/connection
	CTrustOk      = "35"   // Green trust label
	CTrustCaution = "220"  // Amber trust label
	CTrustWarn    = "203"  // Red trust label
)

var (
	// Header — bold title with accent foreground
	HeaderStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color(CAccent)).
			Background(lipgloss.Color(CSurface)).
			Padding(0, 1)

	// ModeBadge — high-contrast mode indicator
	ModeBadgeStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color(CText)).
			Background(lipgloss.Color(CAccent)).
			Padding(0, 1)

	// TrustBadge — provider/model identity pill
	TrustBadgeStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color(CTextMuted)).
			Background(lipgloss.Color(CSurfaceHi)).
			Padding(0, 1)

	// ConnStyle — connection status (uses dynamic color in view.go)
	ConnStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color(CInfo)).
			Padding(0, 1)

	// PaneStyle — bordered content panes
	PaneStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color(CTextDim)).
			Background(lipgloss.Color(CBackground)).
			Padding(1)

	// Footer — input bar
	FooterStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color(CText)).
			Background(lipgloss.Color(CSurface)).
			Padding(0, 1)

	// RowStyle — horizontal layout container
	RowStyle = lipgloss.NewStyle().Align(lipgloss.Top)

	// ModeHint — keyboard shortcut hints
	ModeHintStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color(CTextDim)).
			Padding(0, 1)
)

// ConnColor returns the appropriate color for connection state.
func ConnColor(status string) string {
	switch status {
	case "connected":
		return CAccent
	case "error":
		return CError
	default: // "connecting...", "reconnecting..."
		return CWarn
	}
}

// TrustColor returns the appropriate color for a trust label.
func TrustColor(label string) string {
	switch {
	case len(label) > 0 && label[0] == 'T': // Trusted
		return CTrustOk
	case len(label) > 0 && label[0] == 'U': // Untrusted
		return CTrustWarn
	default:
		return CTrustCaution
	}
}
