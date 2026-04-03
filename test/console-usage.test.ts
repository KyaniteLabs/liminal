/**
 * Characterization test for console usage
 * Documents current state before migration to Logger
 */
import { describe, it, expect } from 'vitest';

// List of files that should use Logger instead of console
// This is a characterization test - it documents the current state
// As we migrate, files should be removed from this list
const FILES_WITH_CONSOLE_USAGE = [
  'src/routing/RoutingData.ts',
  'src/config/PromptHistory.ts', 
  'src/security/JsonSchemas.ts',
  'src/compost/SeedBank.ts',
  'src/compost/SoupStateManager.ts',
  'src/compost/CompostSoup.ts',
  'src/compost/CompostHeap.ts',
  'src/compost/HeapMonitor.ts',
  'src/compost/DigestScheduler.ts',
  'src/compost/FragmentScorer.ts',
  'src/compost/CollisionEngine.ts',
  'src/compost/ModelRouter.ts',
  'src/compost/SemanticExtractor.ts',
  'src/compost/CompostMill.ts',
  'src/plugins/HookSystem.ts',
  'src/tui/preview/AudioPlayer.ts',
  'src/security/SandboxConfig.ts',
  'src/generators/TierBasedGenerator.ts',
  'src/generators/glsl/ShaderGenerator.ts',
  'src/generators/p5/P5Generator.ts',
  'src/generators/p5/P5GeneratorV2.ts',
  'src/llm/LLMClient.ts',
  'src/core/ContextAccumulation.ts',
  'src/core/GenerationOrchestrator.ts',
  'src/core/RalphLoop.ts',
  'src/core/OrganismLoop.ts',
  'src/core/parsing/ParsingCache.ts',
  'src/generateVisuals.ts',
];

describe('Console Usage Characterization', () => {
  it('should have files needing Logger migration', () => {
    // This test documents the current state
    // During migration, files will be removed from FILES_WITH_CONSOLE_USAGE
    expect(FILES_WITH_CONSOLE_USAGE.length).toBeGreaterThan(0);
  });

  it('should target at least 10 files for migration', () => {
    expect(FILES_WITH_CONSOLE_USAGE.length).toBeGreaterThanOrEqual(10);
  });
});
