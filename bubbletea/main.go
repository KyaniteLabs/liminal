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
	program := tea.NewProgram(app.NewModel(bridgeURL), tea.WithAltScreen())
	if _, err := program.Run(); err != nil {
		log.Fatal(err)
	}
}
