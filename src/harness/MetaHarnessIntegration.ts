/**
 * Meta-Harness Integration Coordinator
 * 
 * Central coordinator that wires up:
 * - FailureLogger (captures failures)
 * - PatternDetector (detects patterns in failures)
 * - MultiProviderConfig (manages LLM providers)
 * - HarnessMemory (persistent memory across sessions)
 * 
 * Usage:
 *   import { metaHarness } from './MetaHarnessIntegration.js';
 *   await metaHarness.initialize();
 *   await metaHarness.onGenerationComplete(result);
 *   await metaHarness.shutdown();
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { Logger } from '../utils/Logger.js';
import { failureLogger, type FailureRecord } from './FailureLogger.js';
import { patternDetector, type Pattern } from './PatternDetector.js';
// HarnessUpdater removed - was a no-op that only logged
import { 
  getActiveProvider, 
  getActiveProviderConfig,
  getHarnessProviderConfig,
  listConfiguredProviders,
  type ProviderType 
} from './MultiProviderConfig.js';
import { LLMClient } from '../llm/LLMClient.js';
import { harnessMemory, type HarnessTask } from './HarnessMemory.js';

export interface MetaHarnessStatus {
  initialized: boolean;
  activeProvider: ProviderType;
  configuredProviders: ProviderType[];
  recentFailures: number;
  detectedPatterns: Pattern[];
  appliedAdaptations: string[]; // Pattern names that were detected
  memory: ReturnType<typeof harnessMemory.getStatus>;
}

export class MetaHarnessIntegration {
  private initialized = false;
  private appliedAdaptations: string[] = []; // Pattern names that were detected
  private llmClient?: LLMClient;

  /**
   * Initialize the Meta-Harness
   * - Loads persistent memory (tasks, adaptations, episodes)
   * - Loads previous failures
   * - Detects available providers
   * - Applies any pending adaptations
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    Logger.debug('MetaHarnessIntegration', 'Initializing...');
    
    // Initialize persistent memory FIRST
    await harnessMemory.initialize();
    const memoryStatus = harnessMemory.getStatus();
    Logger.debug('MetaHarnessIntegration', `Memory loaded: ${memoryStatus.tasksTotal} tasks, ${memoryStatus.adaptationsTotal} adaptations, ${memoryStatus.episodesTotal} episodes`);
    
    // Detect available providers
    const providers = listConfiguredProviders();
    const activeProvider = getActiveProvider();
    
    Logger.debug('MetaHarnessIntegration', `Available providers: ${providers.join(', ') || 'none'}`);
    Logger.debug('MetaHarnessIntegration', `Active provider: ${activeProvider}`);
    
    // Initialize LLM client with harness-specific config
    // Note: We pass role:'harness' so LLMClient resolves temperature from RoleConfig (0.5).
    // We only spread provider-level fields (baseUrl, model, apiKey) — NOT temperature,
    // because the role system should own that setting.
    const config = getHarnessProviderConfig() || getActiveProviderConfig();
    if (config) {
      const { temperature: _ignoreTemp, maxTokens: _ignoreTokens, ...providerFields } = config;
      this.llmClient = new LLMClient({ ...providerFields, role: 'harness' });
      Logger.debug('MetaHarnessIntegration', `LLM client configured: ${config.model} @ ${config.baseUrl}`);
    } else {
      Logger.warn('MetaHarnessIntegration', 'No LLM provider configured. Set LIMINAL_LLM_BASE_URL or provider API key.');
    }
    
    // Load recent failures for pattern detection
    const recentFailures = failureLogger.getRecentFailures(100);
    Logger.debug('MetaHarnessIntegration', `Loaded ${recentFailures.length} recent failures`);
    
    // Detect patterns from history and record to memory
    for (const failure of recentFailures) {
      const patterns = patternDetector.analyze(failure);
      if (patterns.length > 0) {
        Logger.debug('MetaHarnessIntegration', `Detected patterns in historical failure: ${patterns.map((p: Pattern) => p.name).join(', ')}`);
        for (const pattern of patterns) {
          harnessMemory.recordPatternOccurrence(pattern.name, failure.domain);
        }
      }
    }
    
    this.initialized = true;
    Logger.debug('MetaHarnessIntegration', 'Initialization complete');
  }

  /**
   * Reset cached state for provider isolation.
   * Call when switching LLM providers at runtime (e.g. triad dogfood)
   * to prevent a stale llmClient from leaking across provider switches.
   */
  reset(): void {
    this.initialized = false;
    this.llmClient = undefined;
    this.appliedAdaptations = [];
    Logger.debug('MetaHarnessIntegration', 'Reset for provider isolation');
  }

  /**
   * Shutdown - save all persistent state
   */
  async shutdown(): Promise<void> {
    Logger.debug('MetaHarnessIntegration', 'Shutting down...');
    await harnessMemory.shutdown();
    Logger.debug('MetaHarnessIntegration', 'Shutdown complete');
  }

  /**
   * Start a harness task (M1-M8 or custom)
   */
  startTask(type: HarnessTask['type'], description: string): string {
    return harnessMemory.startTask({ type, description });
  }

  /**
   * Complete a harness task
   */
  completeTask(taskId: string, outcome: { status: HarnessTask['status']; error?: string; outcome?: string; artifacts?: string[] }): void {
    harnessMemory.completeTask(taskId, outcome);
  }

  /**
   * Get incomplete tasks (for resuming after restart)
   */
  getIncompleteTasks(): HarnessTask[] {
    return harnessMemory.getIncompleteTasks();
  }

  /**
   * Call when a generation completes (success or failure)
   * NOW includes generator thinking for harness analysis
   */
  async onGenerationComplete(result: {
    success: boolean;
    model: string;
    domain: string;
    prompt: string;
    code?: string;
    error?: string;
    duration: number;
    thinking?: string;  // NEW: Generator thinking for harness analysis
    recoveredFromThinking?: boolean;
  }): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Record episode for every generation
    harnessMemory.recordEpisode({
      type: 'generation',
      domain: result.domain,
      prompt: result.prompt,
      code: result.code,
    });

    // CRITICAL: Analyze generator thinking even if successful
    // This helps answer: "WHERE DID IT GO WRONG?" and "HOW CAN I COMMUNICATE BETTER?"
    if (result.thinking) {
      await this.analyzeGeneratorThinking(result);
    }

    if (!result.success && result.error) {
      // Log the failure WITH thinking context
      const failure: Omit<FailureRecord, 'timestamp' | 'sessionId'> = {
        model: result.model,
        domain: result.domain,
        prompt: result.prompt,
        code: result.code,
        error: result.error,
        errorType: 'generation',
        duration: result.duration,
        thinking: result.thinking,  // Include thinking for context
      };
      
      failureLogger.log(failure);
      
      // Detect patterns
      const detectedPatterns = patternDetector.analyze({
        ...failure,
        timestamp: new Date().toISOString(),
        sessionId: failureLogger.getSessionId(),
      });
      
      // Record pattern occurrences
      for (const pattern of detectedPatterns) {
        harnessMemory.recordPatternOccurrence(pattern.name, result.domain);
      }
      
      // Log detected patterns (manual fix required)
      for (const pattern of detectedPatterns) {
        Logger.info('MetaHarnessIntegration', `Detected pattern (manual fix required): ${pattern.name}`);
        this.appliedAdaptations.push(pattern.name);
        
        // Record pattern to persistent memory for later manual fixing
        harnessMemory.recordAdaptation({
          patternName: pattern.name,
          patternSeverity: pattern.severity ?? 'medium',
          fixType: 'manual',
          description: `Pattern detected: ${pattern.name}. Manual fix required.`,
          success: false,
        });
      }
    }
  }

  /**
   * Analyze generator thinking to answer:
   * - WHERE DID IT GO WRONG?
   * - HOW CAN I COMMUNICATE BETTER?
   * 
   * This is the KEY function that lets the harness learn from the generator's reasoning
   */
  private async analyzeGeneratorThinking(result: {
    success: boolean;
    model: string;
    domain: string;
    prompt: string;
    code?: string;
    error?: string;
    thinking?: string;
    recoveredFromThinking?: boolean;
  }): Promise<void> {
    if (!this.llmClient || !result.thinking) return;
    
    Logger.debug('MetaHarnessIntegration', 'Analyzing generator thinking...');
    
    // Build the prompt for the harness model
    const analysisPrompt = `
You are the Meta-Harness analyzing a generator model's thinking process.

PROMPT GIVEN TO GENERATOR:
${result.prompt}

GENERATOR MODEL: ${result.model}
DOMAIN: ${result.domain}
SUCCESS: ${result.success}
${result.error ? `ERROR: ${result.error}` : ''}

GENERATOR'S THINKING PROCESS:
${result.thinking.slice(0, 3000)}

YOUR TASK - Answer these questions:

1. WHERE DID IT GO WRONG?
   - What misunderstanding did the generator have?
   - What confusion is evident in the thinking?
   - What pattern of failure do you see?

2. HOW CAN I COMMUNICATE BETTER?
   - What should the prompt have said differently?
   - What examples or constraints were missing?
   - How should instructions be rephrased?

3. SYSTEM IMPROVEMENT SUGGESTIONS
   - Should validation be changed?
   - Should the prompt template be updated?
   - Is there a model-specific quirk to handle?

Respond with a JSON object:
{
  "whereWentWrong": "specific analysis of the failure",
  "howToCommunicateBetter": "concrete suggestion for prompt improvement",
  "systemImprovement": "what should change in the system",
  "confidence": 0.8
}
`;

    try {
      const response = await this.llmClient.generate(
        'You are a meta-learning analyzer. Output JSON only.',
        analysisPrompt,
        AbortSignal.timeout(30000)
      );
      
      if (response.code) {
        // Try to extract JSON
        const jsonMatch = response.code.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0]);
          
          Logger.debug('MetaHarnessIntegration', 'Analysis complete:');
          Logger.debug('MetaHarnessIntegration', `Where wrong: ${analysis.whereWentWrong?.slice(0, 80)}...`);
          Logger.debug('MetaHarnessIntegration', `How to improve: ${analysis.howToCommunicateBetter?.slice(0, 80)}...`);
          
          // Store this insight
          harnessMemory.recordEpisode({
            type: 'feedback',
            prompt: `Analysis of ${result.model} thinking for ${result.domain}`,
            comment: analysis.whereWentWrong,
            tags: [
              'thinking-analysis',
              `model:${result.model}`,
              `domain:${result.domain}`,
              result.success ? 'success' : 'failure',
            ],
          });

          // Persist insight to disk for observability and external analysis
          try {
            const tracesDir = path.join(process.env.HOME || '/tmp', '.liminal', 'thinking-traces', 'harness');
            await fs.mkdir(tracesDir, { recursive: true });
            const randomSuffix = Math.random().toString(36).slice(2, 8);
            const traceFile = path.join(tracesDir, `harness-insight-${Date.now()}-${randomSuffix}.json`);
            const tracePayload = {
              timestamp: new Date().toISOString(),
              model: result.model,
              domain: result.domain,
              whereWentWrong: analysis.whereWentWrong,
              howToCommunicateBetter: analysis.howToCommunicateBetter,
              systemImprovement: analysis.systemImprovement,
              confidence: analysis.confidence,
            };
            await fs.writeFile(traceFile, JSON.stringify(tracePayload, null, 2), 'utf-8');
            Logger.debug('MetaHarnessIntegration', `Insight persisted to ${traceFile}`);
          } catch (writeErr) {
            Logger.warn('MetaHarnessIntegration', `Failed to persist insight: ${(writeErr as Error).message}`);
          }
          
          // If high confidence suggestion, could auto-adapt prompt templates
          if (analysis.confidence > 0.8 && analysis.systemImprovement) {
            Logger.debug('MetaHarnessIntegration', 'High-confidence system improvement suggested:');
            Logger.debug('MetaHarnessIntegration', `${analysis.systemImprovement}`);
          }
        }
      }
    } catch (err) {
      Logger.warn('MetaHarnessIntegration', `Failed to analyze thinking: ${(err as Error).message}`);
    }
  }

  /**
   * Record a conversation episode
   */
  recordConversation(prompt: string, response: string, tags?: string[]): string {
    return harnessMemory.recordEpisode({
      type: 'conversation',
      prompt: `${prompt} -> ${response.substring(0, 200)}...`,
      tags,
    });
  }

  /**
   * Record feedback episode
   */
  recordFeedback(artworkId: string, rating: number, comment: string): string {
    return harnessMemory.recordEpisode({
      type: 'feedback',
      prompt: artworkId,
      score: rating,
      comment,
    });
  }

  /**
   * Get current status
   */
  getStatus(): MetaHarnessStatus {
    return {
      initialized: this.initialized,
      activeProvider: getActiveProvider(),
      configuredProviders: listConfiguredProviders(),
      recentFailures: failureLogger.getRecentFailures(100).length,
      detectedPatterns: patternDetector.getHighImpactPatterns(1),
      appliedAdaptations: this.appliedAdaptations,
      memory: harnessMemory.getStatus(),
    };
  }

  /**
   * Get the LLM client (for harness operations)
   */
  getLLMClient(): LLMClient | undefined {
    return this.llmClient;
  }

  /**
   * Switch to a different provider at runtime.
   * Creates a new LLMClient with the given provider config.
   */
  switchProvider(baseUrl: string, model: string, apiKey?: string): void {
    this.llmClient = new LLMClient({ baseUrl, model, apiKey, role: 'harness' });
    Logger.info('MetaHarnessIntegration', `Switched to ${model} @ ${baseUrl}`);
  }

  /**
   * Check if Meta-Harness is online
   */
  isOnline(): boolean {
    return this.initialized && !!this.llmClient;
  }

  /**
   * Convert a generator to plugin format
   * Creates plugin.json and index.ts in plugins/<name>/
   */
  async convertGeneratorToPlugin(generatorName: string): Promise<{
    success: boolean;
    pluginPath?: string;
    error?: string;
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    const pluginDir = path.join(process.cwd(), 'plugins', generatorName);
    
    try {
      // Check if generator exists
      const generatorPath = path.join(process.cwd(), 'src', 'generators', generatorName);
      const exists = await fs.access(generatorPath).then(() => true).catch(() => false);
      
      if (!exists) {
        return { success: false, error: `Generator ${generatorName} not found` };
      }

      // Create plugin directory
      await fs.mkdir(pluginDir, { recursive: true });

      // Create plugin.json
      const manifest = {
        id: generatorName.toLowerCase(),
        name: `${generatorName} Generator`,
        version: '2.0.0',
        description: `Auto-converted ${generatorName} generator plugin`,
        entry: 'index.js',
        domains: [generatorName.toLowerCase()],
        keywords: [generatorName.toLowerCase()],
        author: 'Liminal Harness',
        minLiminalVersion: '2.0.0',
      };

      await fs.writeFile(
        path.join(pluginDir, 'plugin.json'),
        JSON.stringify(manifest, null, 2)
      );

      // Create index.ts (template)
      const indexContent = `/**
 * ${generatorName} Generator Plugin
 * Auto-converted by Meta-Harness
 */

import { ${generatorName}Generator } from '../../src/generators/${generatorName}/${generatorName}Generator.js';
import type { GenerateOptions } from '../../src/plugins/types.js';

let generator: ${generatorName}Generator | null = null;

export async function initialize(): Promise<void> {
  if (!generator) {
    generator = new ${generatorName}Generator();
  }
}

export async function generate(
  prompt: string,
  options: GenerateOptions = {}
): Promise<string> {
  if (!generator) {
    await initialize();
  }
  return generator!.generate(prompt);
}

export function canHandle(prompt: string): number {
  // Domain-specific detection using keyword scoring
  // Matches the pattern used by all plugin canHandle implementations
  const lower = prompt.toLowerCase();

  // Generator-specific domain keywords
  const domainKeywords: [string, number][] = [
    // Visual / 3D
    [/three.js|threejs|\bthree\b/i, 0.95],
    [/\b3d\b.*\b(scene|cube|sphere|model|mesh)/i, 0.90],
    [/hydra|video synth|kaleid|oscillator.*video/i, 0.90],
    [/glsl|shader|ray march|sdf|fragment/i, 0.90],
    [/p5.?js|particle|flow field/i, 0.95],
    [/ascii art/i, 0.95],
    [/html generator|landing page|dashboard/i, 0.90],
    // Audio / Music
    [/tone.?js|synthesizer|synth/i, 0.95],
    [/strudel|tidal|drum sequencer|beat/i, 0.95],
    // Code / Analysis
    [/typescript|ts-|.ts\b/i, 0.85],
    [/javascript|js\b/i, 0.80],
    [/\blsp\b|diagnostic|autocomplete|tsserver/i, 0.90],
    // Narrative / Content
    [/blog|article|content|narrative|video script/i, 0.85],
    [/\bredwood\b|\bprisma\b|\bpostgres\b/i, 0.80],
  ];

  let bestScore = 0.0;
  for (const [pattern, score] of domainKeywords) {
    if (pattern.test(lower) && score > bestScore) {
      bestScore = score;
    }
  }

  // No strong match — use default low confidence
  return bestScore;
}
`;

      await fs.writeFile(path.join(pluginDir, 'index.ts'), indexContent);

      Logger.debug('MetaHarnessIntegration', `Converted ${generatorName} to plugin at ${pluginDir}`);
      
      return { success: true, pluginPath: pluginDir };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  /**
   * Register a plugin from a path
   */
  async registerPlugin(pluginPath: string): Promise<{
    success: boolean;
    pluginId?: string;
    error?: string;
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const { pluginLoader } = await import('../plugins/PluginLoader.js');
      const result = await pluginLoader.loadPlugin(pluginPath);
      
      if (result.success && result.plugin) {
        return { success: true, pluginId: result.plugin.manifest.id };
      } else {
        return { success: false, error: result.error?.error || 'Unknown error' };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  /**
   * Run a health check
   */
  async healthCheck(): Promise<{
    online: boolean;
    provider: string;
    model: string;
    responseTime?: number;
    error?: string;
  }> {
    if (!this.llmClient) {
      return { online: false, provider: 'none', model: 'none', error: 'LLM not configured' };
    }

    const startTime = Date.now();
    try {
      // Simple ping - generate a trivial sketch
      const result = await this.llmClient.generate(
        'You are a code generator. Output only code.',
        'Generate a p5.js sketch with just: function setup() { createCanvas(100, 100); }',
        AbortSignal.timeout(30000)
      );
      
      const responseTime = Date.now() - startTime;
      
      return {
        online: result.success,
        provider: getActiveProvider(),
        model: getActiveProviderConfig()?.model || 'unknown',
        responseTime,
        error: result.error,
      };
    } catch (error) {
      return {
        online: false,
        provider: getActiveProvider(),
        model: getActiveProviderConfig()?.model || 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Singleton instance
export const metaHarness = new MetaHarnessIntegration();

// Auto-initialize if in CLI context
if (typeof process !== 'undefined' && process.stdout?.isTTY) {
  // Delay initialization to avoid circular dependencies during module load
  setTimeout(() => {
    void (async () => {
      try {
        await metaHarness.initialize();
      } catch (err) {
        Logger.warn('MetaHarnessIntegration', `Auto-initialization failed: ${err}`);
      }
    })();
  }, 100);
}

// Ensure shutdown on exit
if (typeof process !== 'undefined') {
  const SHUTDOWN_TIMEOUT_MS = 5000;
  
  // Use beforeExit for async cleanup with proper timeout and error handling
  process.on('beforeExit', () => {
    void (async () => {
      try {
        await Promise.race([
          metaHarness.shutdown(),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error('Shutdown timeout')), SHUTDOWN_TIMEOUT_MS)
          ),
        ]);
      } catch (err) {
        Logger.error('MetaHarnessIntegration', 'Shutdown failed on beforeExit:', err);
      }
    })();
  });
  
  process.on('SIGINT', () => {
    void (async () => {
      try {
        await Promise.race([
          metaHarness.shutdown(),
          new Promise<void>((_, reject) => 
            setTimeout(() => reject(new Error('Shutdown timeout')), SHUTDOWN_TIMEOUT_MS)
          ),
        ]);
        process.exit(0);
      } catch (err) {
        Logger.error('MetaHarnessIntegration', 'Shutdown failed on SIGINT:', err);
        process.exit(1);
      }
    })();
  });
  
  process.on('SIGTERM', () => {
    void (async () => {
      try {
        await Promise.race([
          metaHarness.shutdown(),
          new Promise<void>((_, reject) => 
            setTimeout(() => reject(new Error('Shutdown timeout')), SHUTDOWN_TIMEOUT_MS)
          ),
        ]);
        process.exit(0);
      } catch (err) {
        Logger.error('MetaHarnessIntegration', 'Shutdown failed on SIGTERM:', err);
        process.exit(1);
      }
    })();
  });
}
