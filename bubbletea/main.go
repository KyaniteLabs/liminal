package main

import (
	"log"
	"os"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/Pastorsimon1798/liminal/bubbletea/internal/app"
)

func main() {
	bridgeURL := os.Getenv("LIMINAL_BRIDGE_URL")
	if bridgeURL == "" {
		bridgeURL = "http://localhost:3000"
	}

	model := app.NewModel(bridgeURL)
	program := tea.NewProgram(model, tea.WithAltScreen(), tea.WithMouseCellMotion())

	// Pass program reference to model so SSE goroutines can send events
	model.Program = program

	if _, err := program.Run(); err != nil {
		log.Fatal(err)
	}
}
