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
	AccentGreen   = lipgloss.Color("#9ece6a") // Success, user input
	AccentBlue    = lipgloss.Color("#7aa2f7") // Assistant, links
	AccentPurple  = lipgloss.Color("#bb9af7") // Code, highlights, brand
	AccentCyan    = lipgloss.Color("#7dcfff") // Info, tags, mode
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

	// ── Primary panes ──
	ChatPaneStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(BgOverlay).
			Padding(0, 1)

	PreviewPaneStyle = lipgloss.NewStyle().
				Border(lipgloss.RoundedBorder()).
				BorderForeground(AccentPurple).
				Padding(0, 1)

	OperatorPaneStyle = lipgloss.NewStyle().
				Border(lipgloss.RoundedBorder()).
				BorderForeground(AccentPurple).
				Padding(0, 1)

	OperatorPaneFocusedStyle = lipgloss.NewStyle().
					Border(lipgloss.RoundedBorder()).
					BorderForeground(AccentGreen).
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

	PreviewCardStyle = lipgloss.NewStyle().
				Border(lipgloss.NormalBorder()).
				BorderForeground(BgOverlay).
				Padding(0, 1)

	PreviewLabelStyle = lipgloss.NewStyle().
				Foreground(AccentCyan).
				Bold(true)

	PreviewContentStyle = lipgloss.NewStyle().
				Foreground(FgSubtle)

	// ── Status items ──
	StatusLabelStyle = lipgloss.NewStyle().
				Foreground(FgMuted)

	StatusValueStyle = lipgloss.NewStyle().
				Foreground(FgSubtle)

	StatusPillStyle = lipgloss.NewStyle().
			Foreground(FgSubtle).
			Background(BgOverlay).
			Padding(0, 1)

	// ── Pending action card ──
	ActionCardStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(AccentOrange).
			Padding(0, 1)

	ActionTitleStyle = lipgloss.NewStyle().
				Foreground(AccentOrange).
				Bold(true)

	// ── Operator panels ──
	PanelStyle = lipgloss.NewStyle().
			Border(lipgloss.NormalBorder()).
			BorderForeground(BgOverlay).
			Padding(0, 1)

	PanelDimStyle = lipgloss.NewStyle().
			Border(lipgloss.HiddenBorder()).
			Foreground(FgMuted)

	PanelTitleStyle = lipgloss.NewStyle().
			Foreground(FgText).
			Bold(true)

	PanelMetaStyle = lipgloss.NewStyle().
			Foreground(FgMuted)

	PanelLabelStyle = lipgloss.NewStyle().
			Foreground(FgMuted)

	PanelValueStyle = lipgloss.NewStyle().
			Foreground(FgSubtle)

	EmptyStateStyle = lipgloss.NewStyle().
			Foreground(FgMuted).
			Italic(true)

	TaskCardStyle = lipgloss.NewStyle().
			Border(lipgloss.NormalBorder()).
			BorderForeground(AccentCyan).
			Padding(0, 1)

	TaskTitleStyle = lipgloss.NewStyle().
			Foreground(FgText).
			Bold(true)

	TaskObjectiveStyle = lipgloss.NewStyle().
				Foreground(FgSubtle)

	TaskFileStyle = lipgloss.NewStyle().
			Foreground(AccentBlue)

	TaskProgressStyle = lipgloss.NewStyle().
				Foreground(AccentCyan)

	TaskPendingStyle = lipgloss.NewStyle().
				Foreground(AccentOrange)

	TaskHintStyle = lipgloss.NewStyle().
			Foreground(FgMuted)

	PhaseBadgeStyle = lipgloss.NewStyle().
			Foreground(BgBase).
			Bold(true).
			Padding(0, 1)

	TimelineStepStyle = lipgloss.NewStyle().
				Foreground(FgSubtle)

	TimelineIndexStyle = lipgloss.NewStyle().
				Foreground(AccentCyan).
				Bold(true)

	TimelineThoughtStyle = lipgloss.NewStyle().
				Foreground(FgMuted)

	TimelineArgsStyle = lipgloss.NewStyle().
				Foreground(FgMuted)

	TimelineResultStyle = lipgloss.NewStyle().
				Foreground(FgSubtle)

	TimelineRunningStyle = lipgloss.NewStyle().
				Foreground(AccentYellow).
				Bold(true)

	TimelineSuccessStyle = lipgloss.NewStyle().
				Foreground(AccentGreen).
				Bold(true)

	TimelineFailedStyle = lipgloss.NewStyle().
				Foreground(AccentRed).
				Bold(true)

	FileSummaryStyle = lipgloss.NewStyle().
				Foreground(FgSubtle)

	FileRowStyle = lipgloss.NewStyle().
			Foreground(FgSubtle)

	FileModifiedStyle = lipgloss.NewStyle().
				Foreground(AccentYellow)

	FileCreatedStyle = lipgloss.NewStyle().
				Foreground(AccentGreen)

	FileDeletedStyle = lipgloss.NewStyle().
				Foreground(AccentRed)

	FileLatestBadgeStyle = lipgloss.NewStyle().
				Foreground(BgBase).
				Background(AccentCyan).
				Padding(0, 1)

	VerificationJobStyle = lipgloss.NewStyle().
				Foreground(FgSubtle)

	VerificationCommandStyle = lipgloss.NewStyle().
					Foreground(FgText)

	VerificationOutputStyle = lipgloss.NewStyle().
				Foreground(FgMuted)

	VerificationRunningStyle = lipgloss.NewStyle().
					Foreground(AccentYellow).
					Bold(true)

	VerificationPassStyle = lipgloss.NewStyle().
				Foreground(AccentGreen).
				Bold(true)

	VerificationFailStyle = lipgloss.NewStyle().
				Foreground(AccentRed).
				Bold(true)

	ArtifactRowStyle = lipgloss.NewStyle().
				Foreground(FgSubtle)

	ArtifactLabelStyle = lipgloss.NewStyle().
				Foreground(AccentPurple).
				Bold(true)

	ArtifactPathStyle = lipgloss.NewStyle().
				Foreground(AccentBlue)

	ActivityLogStyle = lipgloss.NewStyle().
				Foreground(FgSubtle)

	ActivityTimeStyle = lipgloss.NewStyle().
				Foreground(FgMuted)

	HelpCardStyle = lipgloss.NewStyle().
			Border(lipgloss.NormalBorder()).
			BorderForeground(AccentPurple).
			Padding(0, 1)

	HelpShortcutStyle = lipgloss.NewStyle().
				Foreground(AccentPurple).
				Bold(true)

	HelpDescriptionStyle = lipgloss.NewStyle().
				Foreground(FgSubtle)

	MetricGoodStyle = lipgloss.NewStyle().
			Foreground(AccentGreen)

	MetricWarnStyle = lipgloss.NewStyle().
			Foreground(AccentYellow)

	MetricBadStyle = lipgloss.NewStyle().
			Foreground(AccentRed)

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

// PhaseColor returns the badge color for an agent phase label.
func PhaseColor(phase string) lipgloss.Color {
	switch phase {
	case "Plan":
		return AccentCyan
	case "Inspect":
		return AccentBlue
	case "Edit":
		return AccentPurple
	case "Verify":
		return AccentGreen
	case "Report":
		return AccentOrange
	default:
		return BgMuted
	}
}

// ToolStatusColor returns the color for a tool timeline status.
func ToolStatusColor(status string) lipgloss.Color {
	switch status {
	case "success", "pass":
		return AccentGreen
	case "failed", "fail":
		return AccentRed
	case "running":
		return AccentYellow
	default:
		return FgMuted
	}
}

// FileStatusColor returns the color for a file mutation label.
func FileStatusColor(status string) lipgloss.Color {
	switch status {
	case "created":
		return AccentGreen
	case "deleted":
		return AccentRed
	case "modified":
		return AccentYellow
	default:
		return FgMuted
	}
}

// VerificationStatusColor returns the color for a verification state label.
func VerificationStatusColor(status string) lipgloss.Color {
	return ToolStatusColor(status)
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
