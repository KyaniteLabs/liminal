package main

import (
	"log"
	"os"

	"github.com/Pastorsimon1798/liminal/bubbletea/internal/app"
	tea "github.com/charmbracelet/bubbletea"
)

func main() {
	bridgeURL := os.Getenv("LIMINAL_BRIDGE_URL")
	if bridgeURL == "" {
		bridgeURL = "http://localhost:3000"
	}

	model := app.NewModel(bridgeURL)
	program := tea.NewProgram(model, tea.WithAltScreen())

	// Pass program reference to model so SSE goroutines can send events
	app.GlobalProgram = program

	if _, err := program.Run(); err != nil {
		log.Fatal(err)
	}
}
