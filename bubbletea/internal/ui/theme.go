package ui

import "github.com/charmbracelet/lipgloss"

// ── Color Palette (Tokyo Night + Dracula inspired) ──
// True-color hex values for maximum visual fidelity.
var (
	// Backgrounds
	BgBase    = lipgloss.Color("#1a1b26") // Deep space navy
	BgSurface = lipgloss.Color("#24283b") // Elevated surface
	BgOverlay = lipgloss.Color("#414868") // Overlay elements
	BgMuted   = lipgloss.Color("#565f89") // Muted elements

	// Foregrounds
	FgText   = lipgloss.Color("#c0caf5") // Primary text
	FgSubtle = lipgloss.Color("#a9b1d6") // Secondary text
	FgMuted  = lipgloss.Color("#565f89") // Dimmed text

	// Accents
	AccentGreen  = lipgloss.Color("#9ece6a") // Success, user input
	AccentBlue   = lipgloss.Color("#7aa2f7") // Assistant, links
	AccentPurple = lipgloss.Color("#bb9af7") // Code, highlights, brand
	AccentCyan   = lipgloss.Color("#7dcfff") // Info, tags, mode
	AccentOrange  = lipgloss.Color("#ff9e64") // Warnings
	AccentRed     = lipgloss.Color("#f7768e") // Errors
	AccentYellow  = lipgloss.Color("#e0af68") // System messages
	AccentMagenta = lipgloss.Color("#ff007c") // Swarm / creative language
)

// ── 256-color fallback constants (for terminals without true-color) ──
const (
	CBackground = "17"  // Deep navy black
	CSurface    = "236" // Slate surface
	CSurfaceHi  = "239" // Raised surface
	CText       = "231" // Near-white foreground
	CTextMuted  = "145" // Muted slate
	CTextDim    = "60"  // Dim border gray
	CAccent     = "40"  // Vivid green
	CAccentDim  = "28"  // Dimmer green
	CError      = "203" // Red
	CWarn       = "220" // Amber
	CInfo       = "117" // Soft blue
)

// ── Style Tokens ──

var (
	// Header bar — spans full width
	HeaderStyle = lipgloss.NewStyle().
			Background(BgSurface).
			Foreground(FgText).
			Padding(0, 1)

	// Brand — "◆ LIMINAL" logo
	BrandStyle = lipgloss.NewStyle().
			Foreground(AccentPurple).
			Bold(true)

	// Mode badge — current mode indicator
	ModeStyle = lipgloss.NewStyle().
			Foreground(AccentCyan).
			Bold(true)

	// Provider pill — model/provider identity
	ProviderStyle = lipgloss.NewStyle().
			Foreground(FgSubtle).
			Background(BgOverlay).
			Padding(0, 1)

	// Connection dot — ● or ○
	ConnectedStyle = lipgloss.NewStyle().
			Foreground(AccentGreen)

	DisconnectedStyle = lipgloss.NewStyle().
			Foreground(AccentRed)

	ReconnectingStyle = lipgloss.NewStyle().
			Foreground(AccentYellow)

	// ── Chat pane ──
	ChatPaneStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("#414868")).
			Padding(0, 1)

	// ── Preview pane ──
	PreviewPaneStyle = lipgloss.NewStyle().
				Border(lipgloss.RoundedBorder()).
				BorderForeground(AccentPurple).
				Padding(0, 1)

	// ── Chat message styles ──
	UserMsgStyle = lipgloss.NewStyle().
			Foreground(AccentGreen).
			Bold(true)

	AssistantMsgStyle = lipgloss.NewStyle().
				Foreground(AccentBlue)

	CodeBlockStyle = lipgloss.NewStyle().
			Foreground(AccentPurple).
			Background(BgOverlay).
			Padding(0, 1)

	ErrorStyle = lipgloss.NewStyle().
			Foreground(AccentRed).
			Bold(true)

	SystemStyle = lipgloss.NewStyle().
			Foreground(AccentYellow)

	StreamingStyle = lipgloss.NewStyle().
			Foreground(FgSubtle)

	// ── Footer / input ──
	FooterStyle = lipgloss.NewStyle().
			Background(BgSurface).
			Foreground(FgText).
			Padding(0, 1)

	// ── Preview tabs ──
	ActiveTabStyle = lipgloss.NewStyle().
			Foreground(AccentPurple).
			Bold(true).
			Background(BgOverlay).
			Padding(0, 2)

	InactiveTabStyle = lipgloss.NewStyle().
				Foreground(FgMuted).
				Padding(0, 2)

	TabBarStyle = lipgloss.NewStyle().
			Background(BgSurface).
			Padding(0, 1)

	// ── Inline preview badge ──
	PreviewBadgeStyle = lipgloss.NewStyle().
				Foreground(AccentCyan).
				Background(BgOverlay).
				Padding(0, 1)

	// ── Status items ──
	StatusLabelStyle = lipgloss.NewStyle().
				Foreground(FgMuted)

	StatusValueStyle = lipgloss.NewStyle().
				Foreground(FgSubtle)

	// ── Pending action card ──
	ActionCardStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(AccentOrange).
			Padding(0, 1)

	ActionTitleStyle = lipgloss.NewStyle().
				Foreground(AccentOrange).
				Bold(true)

	// ── Keybinding hints in footer ──
	KeyStyle = lipgloss.NewStyle().
			Foreground(AccentPurple).
			Bold(true)

	HintStyle = lipgloss.NewStyle().
			Foreground(FgMuted)

	// ── Separator ──
	SeparatorStyle = lipgloss.NewStyle().
			Foreground(BgOverlay)
)

// Separator returns a horizontal divider line.
func Separator(width int) string {
	return SeparatorStyle.Render(lipgloss.NewStyle().Width(width).Render("─"))
}

// ConnColor returns the appropriate color for connection state.
func ConnColor(status string) lipgloss.Color {
	switch status {
	case "connected":
		return AccentGreen
	case "error":
		return AccentRed
	default: // "connecting...", "reconnecting..."
		return AccentYellow
	}
}

// TrustColor returns the appropriate color for a trust label.
func TrustColor(label string) lipgloss.Color {
	switch {
	case len(label) > 0 && label[0] == 'T': // Trusted
		return AccentGreen
	case len(label) > 0 && label[0] == 'U': // Untrusted
		return AccentRed
	default:
		return AccentYellow
	}
}

// StatusDot returns a colored connection indicator.
func StatusDot(connected bool, reconnecting bool) string {
	if connected {
		return ConnectedStyle.Render("●")
	}
	if reconnecting {
		return ReconnectingStyle.Render("●")
	}
	return DisconnectedStyle.Render("○")
}
