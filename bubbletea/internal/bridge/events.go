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
	Message   string         `json:"message,omitempty"`
	Trust     *TrustState    `json:"trust,omitempty"`
}
