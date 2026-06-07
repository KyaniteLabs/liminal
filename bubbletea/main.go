package main

import (
	"log"
	"os"

	"github.com/Pastorsimon1798/liminal/bubbletea/internal/app"
	tea "github.com/charmbracelet/bubbletea"
)

func main() {
	// Canonical SINTER_BRIDGE_URL, with the legacy LIMINAL_BRIDGE_URL honored for
	// back-compat (the Node env-mirror can't reach this separate Go process).
	bridgeURL := os.Getenv("SINTER_BRIDGE_URL")
	if bridgeURL == "" {
		bridgeURL = os.Getenv("LIMINAL_BRIDGE_URL")
	}
	if bridgeURL == "" {
		bridgeURL = "http://localhost:3000"
	}

	model := app.NewModel(bridgeURL)
	program := tea.NewProgram(model, tea.WithAltScreen(), tea.WithMouseCellMotion(), tea.WithFPS(30))

	// Pass program reference to model so SSE goroutines can send events
	app.GlobalProgram = program

	if _, err := program.Run(); err != nil {
		log.Fatal(err)
	}
}
