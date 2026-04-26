/**
 * CognitiveArchitectureAtlas
 *
 * Machine-readable finish-line contract for Liminal's creative body and
 * learning-inspired cognitive organs. This keeps proof slices from silently
 * becoming product scope.
 */

export type CapabilityMaturity = 'gold' | 'beta' | 'scaffold' | 'paused';

export interface CreativeDomainCapability {
  id: string;
  label: string;
  maturity: CapabilityMaturity;
  role: string;
  gates: string[];
}

export interface CognitiveOrganCapability {
  id: string;
  label: string;
  role: string;
  sourcePaths: string[];
}

export interface CognitiveLoop {
  name: string;
  steps: string[];
}

export interface CognitiveArchitectureReport {
  title: string;
  purpose: string;
  domains: CreativeDomainCapability[];
  organs: CognitiveOrganCapability[];
  loops: CognitiveLoop[];
}

const DOMAIN_GATES = ['generate', 'validate', 'preview/export', 'evaluate honestly', 'revise'];

export class CognitiveArchitectureAtlas {
  build(): CognitiveArchitectureReport {
    return {
      title: 'Liminal Cognitive Architecture',
      purpose: 'Every creative act becomes material for future intelligence: perception -> memory -> compost -> dreaming -> intuition -> creation -> evaluation -> self-improvement.',
      domains: [
        this.domain('svg', 'SVG', 'gold', 'Inspectable vector art and agent-editable visual structure'),
        this.domain('p5', 'p5.js', 'gold', 'Browser-native generative sketches'),
        this.domain('glsl', 'GLSL', 'beta', 'Shader and fragment-program visual generation'),
        this.domain('hydra', 'Hydra', 'beta', 'Live-coded video synthesis'),
        this.domain('three', 'Three.js', 'beta', '3D scenes and WebGL objects'),
        this.domain('tone', 'Tone.js', 'beta', 'Programmatic audio and music logic'),
        this.domain('strudel', 'Strudel', 'beta', 'Pattern-based live music code'),
        this.domain('revideo', 'Revideo', 'beta', 'Timeline/video composition generation'),
        this.domain('html', 'HTML', 'beta', 'Self-contained browser artifacts'),
        this.domain('ascii', 'ASCII', 'scaffold', 'Text-mode visual artifacts'),
        this.domain('kinetic', 'Kinetic Typography', 'scaffold', 'Animated typographic compositions'),
        this.domain('textgen', 'TextGen', 'scaffold', 'Generative text and poetic artifacts'),
      ],
      organs: [
        { id: 'perception', label: 'Perception', role: 'Captures prompts, artifacts, previews, failures, user reactions, provider behavior, and repair attempts.', sourcePaths: ['src/core/TelemetryBridge.ts', 'src/cortex/CortexPerceptionBus.ts', 'src/tui-bridge/TuiBridgeService.ts'] },
        { id: 'memory', label: 'Memory', role: 'Stores episodic, semantic, taste, procedural, and model-role experience outside the model context window.', sourcePaths: ['src/brain/archive/EpisodicMemory.ts', 'src/brain/archive/SemanticArtMemory.ts', 'src/harness/HarnessMemory.ts'] },
        { id: 'compost', label: 'Compost', role: 'Digests discarded or completed material into reusable seeds, motifs, warnings, and creative nutrients.', sourcePaths: ['src/compost/CompostMill.ts', 'src/compost/CompostRehydrator.ts', 'src/compost/SeedBank.ts'] },
        { id: 'dreaming', label: 'Dreaming', role: 'Runs offline recombination and cross-modal transfer so past work can become new possibilities.', sourcePaths: ['src/dreaming/DreamPlanner.ts', 'src/dreaming/DreamQueue.ts', 'src/dreaming/RecombinationEngine.ts', 'src/dreaming/CrossModalTransfer.ts'] },
        { id: 'intuition', label: 'Intuition', role: 'Provides fast learned guidance for domain choice, promising fragments, novelty, and explore/exploit tradeoffs.', sourcePaths: ['src/intuition/IntuitionEngine.ts', 'src/intuition/IntuitionCache.ts', 'src/intuition/MemoryConsolidator.ts'] },
        { id: 'cortex', label: 'Cortex', role: 'Allocates attention, goals, budget, stuck detection, and human-readable self-awareness.', sourcePaths: ['src/cortex/LiminalCortex.ts', 'src/cortex/GoalStore.ts', 'src/cortex/ActionProposer.ts', 'src/cortex/BudgetTracker.ts'] },
        { id: 'garden-evolution', label: 'Garden + Evolution', role: 'Maintains creative ecosystem health through diversity, novelty, lineage, stagnation checks, and quality-diversity archives.', sourcePaths: ['src/autonomy/AutonomousGardener.ts', 'src/autonomy/GardenHealthMonitor.ts', 'src/evolution/MapElites.ts', 'src/evolution/NoveltyArchive.ts'] },
        { id: 'immune-truth', label: 'Immune / Truth System', role: 'Keeps failures visible with validation, guardrails, honest scoring, artifact receipts, and no fake fallbacks.', sourcePaths: ['src/core/validators', 'src/guardrails', 'src/harness/FailureLogger.ts', 'src/aesthetic'] },
        { id: 'model-assimilation', label: 'Model Assimilation', role: 'Auditions new models by role and domain, promotes from evidence, and preserves fallback provenance.', sourcePaths: ['src/harness/MultiProviderConfig.ts', 'src/config', 'scripts/proof'] },
      ],
      loops: [
        { name: 'Creative Loop', steps: ['intent', 'route', 'generate', 'preview/export', 'evaluate', 'user reaction', 'memory', 'compost', 'dream', 'next creation'] },
        { name: 'Self-Improvement Loop', steps: ['failure perceived', 'weakness classified', 'repair proposed', 'isolated worktree patch', 'verification', 'procedural memory'] },
        { name: 'Model Assimilation Loop', steps: ['new model added', 'domain/role audition', 'compare baseline', 'promote or demote route', 'show provenance', 'reuse evidence'] },
      ],
    };
  }

  format(report: CognitiveArchitectureReport = this.build()): string {
    const lines: string[] = [`=== ${report.title} ===`, `  ${report.purpose}`, '', 'Creative Body:'];
    for (const domain of report.domains) lines.push(`  - ${domain.label} [${domain.maturity}] — ${domain.role}`);
    lines.push('', 'Cognitive Organs:');
    for (const organ of report.organs) lines.push(`  - ${organ.label} — ${organ.role}`);
    lines.push('', 'Visible Loops:');
    for (const loop of report.loops) lines.push(`  ${loop.name}: ${loop.steps.join(' -> ')}`);
    return lines.join('\n');
  }

  private domain(id: string, label: string, maturity: CapabilityMaturity, role: string): CreativeDomainCapability {
    return { id, label, maturity, role, gates: [...DOMAIN_GATES] };
  }
}
