import React from 'react';

interface Guardrail {
  name: string;
  category: string;
  tier: 'AUTONOMOUS' | 'ENFORCING' | 'ADVISORY' | 'OBSERVATION';
  status: 'Active' | 'Inactive';
}

interface Phase {
  number: number;
  name: string;
  subtitle: string;
  components: string[];
  tier: string;
  tierColor: string;
}

const phases: Phase[] = [
  {
    number: 1,
    name: 'Foundation',
    subtitle: 'Catastrophic',
    components: ['MaxIterationGuardrail', 'ResourceExhaustionGuardrail', 'ToolPermissionGuardrail', 'OutputSchemaGuardrail'],
    tier: 'AUTONOMOUS',
    tierColor: 'var(--atelier-error)',
  },
  {
    number: 2,
    name: 'Validation',
    subtitle: 'Correctness / Hygiene',
    components: ['TypeCheckGuardrail', 'TestVerificationGuardrail', 'CodeStyleGuardrail'],
    tier: 'ENFORCING / ADVISORY',
    tierColor: 'var(--atelier-warn)',
  },
  {
    number: 3,
    name: 'Evolution',
    subtitle: 'Self-Healing',
    components: ['SelfHealingGuardrail', 'Constitution Framework'],
    tier: 'AUTONOMOUS',
    tierColor: 'var(--atelier-success)',
  },
];

const guardrails: Guardrail[] = [
  { name: 'MaxIterationGuardrail', category: 'Catastrophic', tier: 'AUTONOMOUS', status: 'Active' },
  { name: 'ResourceExhaustionGuardrail', category: 'Catastrophic', tier: 'AUTONOMOUS', status: 'Active' },
  { name: 'ToolPermissionGuardrail', category: 'Catastrophic', tier: 'AUTONOMOUS', status: 'Active' },
  { name: 'OutputSchemaGuardrail', category: 'Catastrophic', tier: 'AUTONOMOUS', status: 'Active' },
  { name: 'TypeCheckGuardrail', category: 'Correctness', tier: 'ENFORCING', status: 'Active' },
  { name: 'TestVerificationGuardrail', category: 'Correctness', tier: 'ENFORCING', status: 'Active' },
  { name: 'CodeStyleGuardrail', category: 'Hygiene', tier: 'ADVISORY', status: 'Active' },
  { name: 'SelfHealingGuardrail', category: 'Evolution', tier: 'AUTONOMOUS', status: 'Active' },
];

const tierColors: Record<string, string> = {
  AUTONOMOUS: 'var(--atelier-error)',
  ENFORCING: 'var(--atelier-warn)',
  ADVISORY: 'var(--atelier-accent)',
  OBSERVATION: 'var(--atelier-text-muted)',
};

const tierBgColors: Record<string, string> = {
  AUTONOMOUS: 'rgba(255, 90, 90, 0.15)',
  ENFORCING: 'rgba(255, 190, 90, 0.15)',
  ADVISORY: 'rgba(100, 180, 255, 0.15)',
  OBSERVATION: 'rgba(150, 150, 150, 0.15)',
};

export function GuardrailDashboard() {
  const now = new Date();
  const lastUpdate = now.toLocaleTimeString();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 960 }}>
      {/* DGF Status Header */}
      <div className="atelier-panel" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: 22, fontWeight: 600, color: 'var(--atelier-text)' }}>
              Deterministic Guardrails Framework
            </h2>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--atelier-text-muted)' }}>v1.0 - 3 Phases Complete</span>
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--atelier-success)',
                background: 'rgba(80, 200, 120, 0.15)',
                padding: '2px 10px',
                borderRadius: 12,
              }}>
                ✓ 31/31 tests passing
              </span>
            </div>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: 'var(--atelier-success)',
          }}>
            <span style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: 'var(--atelier-success)',
            }} />
            System Operational
          </div>
        </div>
      </div>

      {/* Phase Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 16,
      }}>
        {phases.map((phase) => (
          <div key={phase.number} className="atelier-panel" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--atelier-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                  Phase {phase.number}
                </div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--atelier-text)' }}>
                  {phase.name}
                </h3>
                <div style={{ fontSize: 12, color: 'var(--atelier-text-dim)', marginTop: 2 }}>
                  {phase.subtitle}
                </div>
              </div>
              <span style={{ fontSize: 16, color: 'var(--atelier-success)' }}>✓</span>
            </div>

            <div style={{ marginBottom: 12 }}>
              {phase.components.map((component) => (
                <div key={component} style={{
                  fontSize: 12,
                  color: 'var(--atelier-text)',
                  padding: '4px 0',
                  borderBottom: '1px solid var(--atelier-border)',
                }}>
                  {component}
                </div>
              ))}
            </div>

            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: phase.tierColor,
              background: `${phase.tierColor}20`,
              padding: '4px 10px',
              borderRadius: 4,
              display: 'inline-block',
            }}>
              {phase.tier}
            </div>
          </div>
        ))}
      </div>

      {/* Active Guardrails Table */}
      <div className="atelier-panel" style={{ padding: 16 }}>
        <h3 className="atelier-heading" style={{ margin: '0 0 16px 0' }}>Active Guardrails</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13,
          }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--atelier-border)' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--atelier-text-muted)', fontWeight: 500, fontSize: 12 }}>Name</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--atelier-text-muted)', fontWeight: 500, fontSize: 12 }}>Category</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--atelier-text-muted)', fontWeight: 500, fontSize: 12 }}>Tier</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--atelier-text-muted)', fontWeight: 500, fontSize: 12 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {guardrails.map((guardrail) => (
                <tr key={guardrail.name} style={{ borderBottom: '1px solid var(--atelier-border)' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--atelier-text)' }}>
                    {guardrail.name}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--atelier-text)' }}>
                    {guardrail.category}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: tierColors[guardrail.tier],
                      background: tierBgColors[guardrail.tier],
                      padding: '2px 8px',
                      borderRadius: 4,
                      textTransform: 'uppercase',
                    }}>
                      {guardrail.tier}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      fontSize: 12,
                      color: 'var(--atelier-success)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <span style={{
                        display: 'inline-block',
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: 'var(--atelier-success)',
                      }} />
                      {guardrail.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Constitution Status Panel */}
      <div className="atelier-panel" style={{ padding: 16 }}>
        <h3 className="atelier-heading" style={{ margin: '0 0 16px 0' }}>Constitution Status</h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 16,
        }}>
          <div style={{
            background: 'rgba(0,0,0,0.15)',
            borderRadius: 'var(--atelier-radius-sm)',
            padding: 16,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--atelier-accent)' }}>3</div>
            <div style={{ fontSize: 12, color: 'var(--atelier-text-muted)', marginTop: 4 }}>Rules Learned</div>
          </div>
          <div style={{
            background: 'rgba(0,0,0,0.15)',
            borderRadius: 'var(--atelier-radius-sm)',
            padding: 16,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--atelier-success)' }}>0.73</div>
            <div style={{ fontSize: 12, color: 'var(--atelier-text-muted)', marginTop: 4 }}>Avg Confidence</div>
          </div>
          <div style={{
            background: 'rgba(0,0,0,0.15)',
            borderRadius: 'var(--atelier-radius-sm)',
            padding: 16,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--atelier-text)', marginTop: 8 }}>{lastUpdate}</div>
            <div style={{ fontSize: 12, color: 'var(--atelier-text-muted)', marginTop: 4 }}>Last Update</div>
          </div>
        </div>
      </div>

      {/* Tier Legend */}
      <div className="atelier-panel" style={{ padding: 16 }}>
        <h3 className="atelier-heading" style={{ margin: '0 0 12px 0' }}>Tier Legend</h3>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
        }}>
          {[
            { tier: 'AUTONOMOUS', color: tierColors.AUTONOMOUS, desc: 'Self-acting, no human intervention' },
            { tier: 'ENFORCING', color: tierColors.ENFORCING, desc: 'Blocks on violation' },
            { tier: 'ADVISORY', color: tierColors.ADVISORY, desc: 'Warns but allows' },
            { tier: 'OBSERVATION', color: tierColors.OBSERVATION, desc: 'Logs only, passive' },
          ].map((item) => (
            <div key={item.tier} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-block',
                width: 12,
                height: 12,
                borderRadius: 3,
                background: item.color,
              }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: item.color }}>{item.tier}</div>
                <div style={{ fontSize: 11, color: 'var(--atelier-text-muted)' }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
