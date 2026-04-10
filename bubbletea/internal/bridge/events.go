package bridge

type TrustState struct {
	Level string `json:"level"`
	Label string `json:"label"`
}

type PendingAction struct {
	ID                  string `json:"id"`
	Title               string `json:"title"`
	Description         string `json:"description"`
	Kind                string `json:"kind"`
	RequiresConfirmation bool   `json:"requiresConfirmation"`
	CreatedAt           string `json:"createdAt"`
}

type SessionStatus struct {
	SessionID     string         `json:"sessionId"`
	Mode          string         `json:"mode"`
	Provider      string         `json:"provider,omitempty"`
	Model         string         `json:"model,omitempty"`
	Trust         TrustState     `json:"trust"`
	ActiveTask    string         `json:"activeTask,omitempty"`
	PendingAction *PendingAction `json:"pendingAction,omitempty"`
}

type Event struct {
	Type      string         `json:"type"`
	SessionID string         `json:"sessionId"`
	Delta     string         `json:"delta,omitempty"`
	Content   string         `json:"content,omitempty"`
	Mode      string         `json:"mode,omitempty"`
	ActionID  string         `json:"actionId,omitempty"`
	Action    *PendingAction `json:"action,omitempty"`
	Status    *SessionStatus `json:"status,omitempty"`
	Message     string         `json:"message,omitempty"`
	Trust       *TrustState    `json:"trust,omitempty"`
	PreviewType string         `json:"previewType,omitempty"`
	ImageUrl    string         `json:"imageUrl,omitempty"`

	// Event fields for generation.iteration
	Iteration int     `json:"iteration,omitempty"`
	Score     float64 `json:"score,omitempty"`

	// Event fields for generation.complete
	Iterations int     `json:"iterations,omitempty"`
	FinalScore float64 `json:"finalScore,omitempty"`
	Duration   int64   `json:"duration,omitempty"`
	Model      string  `json:"model,omitempty"`
	Reason     string  `json:"reason,omitempty"`

	// Event fields for swarm.round
	Round          int    `json:"round,omitempty"`
	TotalRounds    int    `json:"totalRounds,omitempty"`
	VocabularySize int    `json:"vocabularySize,omitempty"`
	Winner         string `json:"winner,omitempty"`
	Converged      bool   `json:"converged,omitempty"`
	Outputs        map[string]any `json:"outputs,omitempty"`
	Votes          map[string]any `json:"votes,omitempty"`
	Timestamp      int64  `json:"timestamp,omitempty"`
}
