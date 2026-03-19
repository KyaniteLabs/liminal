import React, { useState, useEffect, useCallback } from 'react';

/** A single candidate from the MAP-Elites archive grid. */
export interface CuratorCandidate {
  id: string;
  fitness: number;
  behavior: number[];
  /** Aesthetic model prediction score (0-1). */
  aestheticPrediction?: number;
  /** User star rating (1-5). */
  rating?: number;
  /** Thumbnail URL or data URI for preview. */
  thumbnailUrl?: string;
}

interface CuratorModeProps {
  /** API base URL (defaults to current origin + /api). */
  apiBase?: string;
  /** Callback when user wants to evolve from a selected candidate. */
  onEvolve?: (candidateId: string) => void;
}

/** CuratorMode -- browse, rate, and select MAP-Elites candidates for further evolution. */
export const CuratorMode: React.FC<CuratorModeProps> = ({ apiBase = '/api', onEvolve }) => {
  const [candidates, setCandidates] = useState<CuratorCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`${apiBase}/curator/candidates`);
      if (!res.ok) {
        // API not available yet -- show empty state gracefully
        if (res.status === 404) {
          setCandidates([]);
          return;
        }
        throw new Error(`Failed to load candidates: ${res.statusText}`);
      }
      const data = await res.json();
      setCandidates(data.candidates ?? []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load candidates';
      setFetchError(msg);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  const handleRate = async (id: string, rating: number) => {
    // Optimistic update
    setCandidates(prev => prev.map(c =>
      c.id === id ? { ...c, rating } : c
    ));
    // Persist to API (fire-and-forget, the backend may not exist yet)
    try {
      await fetch(`${apiBase}/curator/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: id, rating }),
      });
    } catch {
      // Silently ignore -- rating is stored locally via state
    }
  };

  const handleEvolve = () => {
    if (selectedId && onEvolve) {
      onEvolve(selectedId);
    }
  };

  const selected = candidates.find(c => c.id === selectedId) ?? null;

  return (
    <div className="curator-mode" style={{ maxWidth: 960, margin: '0 auto' }}>
      <div className="atelier-panel" style={{ marginBottom: 16 }}>
        <h2 className="atelier-heading">Curator Mode</h2>
        <p style={{ color: 'var(--atelier-text-muted)', fontSize: 14, margin: '0 0 16px', lineHeight: 1.5 }}>
          Rate creations to train the aesthetic model. Select a parent to evolve from.
        </p>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="atelier-btn atelier-btn--secondary"
            onClick={loadCandidates}
            disabled={loading}
          >
            {loading ? 'Loading\u2026' : 'Refresh'}
          </button>
          <button
            type="button"
            className="atelier-btn atelier-btn--primary"
            onClick={handleEvolve}
            disabled={!selectedId}
          >
            Evolve from Selection
          </button>
        </div>
      </div>

      {fetchError && (
        <div className="atelier-alert atelier-alert--warn" style={{ marginBottom: 16 }}>
          {fetchError}
        </div>
      )}

      {candidates.length === 0 && !loading && !fetchError ? (
        <div className="atelier-panel" style={{
          padding: '32px',
          textAlign: 'center',
          color: 'var(--atelier-text-dim)',
          borderStyle: 'dashed',
        }}>
          <p style={{ margin: '0 0 8px', fontSize: 15, color: 'var(--atelier-text-muted)' }}>
            No candidates yet.
          </p>
          <p style={{ margin: 0, fontSize: 13 }}>
            Run a creative session with MAP-Elites enabled to populate this view.
          </p>
        </div>
      ) : (
        <div className="curator-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 12,
        }}>
          {candidates.map(candidate => (
            <div
              key={candidate.id}
              className={`curator-card ${selectedId === candidate.id ? 'curator-card--selected' : ''}`}
              onClick={() => setSelectedId(candidate.id)}
              style={{
                background: 'var(--atelier-surface)',
                border: selectedId === candidate.id
                  ? '2px solid var(--atelier-accent)'
                  : '1px solid var(--atelier-border)',
                borderRadius: 'var(--atelier-radius)',
                padding: 12,
                cursor: 'pointer',
                transition: 'border-color 0.15s ease, background 0.15s ease',
              }}
            >
              {/* Thumbnail or placeholder */}
              {candidate.thumbnailUrl ? (
                <img
                  src={candidate.thumbnailUrl}
                  alt={`Candidate ${candidate.id}`}
                  style={{
                    width: '100%',
                    height: 120,
                    objectFit: 'cover',
                    borderRadius: 'var(--atelier-radius-sm)',
                    marginBottom: 8,
                  }}
                />
              ) : (
                <div style={{
                  width: '100%',
                  height: 80,
                  background: 'var(--atelier-surface-raised)',
                  borderRadius: 'var(--atelier-radius-sm)',
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--atelier-text-dim)',
                  fontSize: 12,
                }}>
                  no preview
                </div>
              )}

              {/* ID */}
              <div style={{ fontSize: 11, color: 'var(--atelier-text-dim)', marginBottom: 4 }}>
                {candidate.id}
              </div>

              {/* Fitness */}
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                Fitness: {candidate.fitness.toFixed(2)}
              </div>

              {/* Aesthetic prediction */}
              {candidate.aestheticPrediction !== undefined && (
                <div style={{
                  fontSize: 12,
                  color: 'var(--atelier-accent)',
                  marginTop: 4,
                }}>
                  Aesthetic: {candidate.aestheticPrediction.toFixed(2)}
                </div>
              )}

              {/* Behavior descriptors */}
              {candidate.behavior.length > 0 && (
                <div style={{
                  fontSize: 11,
                  color: 'var(--atelier-text-dim)',
                  marginTop: 4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  [{candidate.behavior.map(b => b.toFixed(2)).join(', ')}]
                </div>
              )}

              {/* Star rating */}
              <div style={{ marginTop: 8, display: 'flex', gap: 2 }}>
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleRate(candidate.id, star); }}
                    style={{
                      border: 'none',
                      background: 'none',
                      fontSize: 16,
                      cursor: 'pointer',
                      padding: '0 1px',
                      lineHeight: 1,
                      color: (candidate.rating ?? 0) >= star
                        ? 'var(--atelier-accent)'
                        : 'var(--atelier-text-dim)',
                      opacity: (candidate.rating ?? 0) >= star ? 1 : 0.4,
                    }}
                    aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                  >
                    &#9733;
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected candidate detail */}
      {selected && (
        <div className="atelier-panel atelier-panel--raised" style={{ marginTop: 16 }}>
          <h3 className="atelier-heading">Selected: {selected.id}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
            <div>
              <span style={{ color: 'var(--atelier-text-muted)' }}>Fitness: </span>
              <span style={{ fontWeight: 600 }}>{selected.fitness.toFixed(4)}</span>
            </div>
            {selected.aestheticPrediction !== undefined && (
              <div>
                <span style={{ color: 'var(--atelier-text-muted)' }}>Aesthetic: </span>
                <span style={{ fontWeight: 600, color: 'var(--atelier-accent)' }}>
                  {selected.aestheticPrediction.toFixed(4)}
                </span>
              </div>
            )}
            {selected.behavior.length > 0 && (
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: 'var(--atelier-text-muted)' }}>Behavior: </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  [{selected.behavior.map(b => b.toFixed(3)).join(', ')}]
                </span>
              </div>
            )}
            {selected.rating !== undefined && (
              <div>
                <span style={{ color: 'var(--atelier-text-muted)' }}>Your rating: </span>
                <span style={{ color: 'var(--atelier-accent)' }}>
                  {'★'.repeat(selected.rating)}{'☆'.repeat(5 - selected.rating)}
                </span>
              </div>
            )}
          </div>
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              className="atelier-btn atelier-btn--primary"
              onClick={handleEvolve}
            >
              Evolve from this candidate
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CuratorMode;
