/**
 * Meta-Harness Integration Coordinator
 * 
 * Central coordinator that wires up:
 * - FailureLogger (captures failures)
 * - PatternDetector (detects patterns in failures)
 * - HarnessUpdater (applies adaptations)
 * - MultiProviderConfig (manages LLM providers)
 * 
 * Usage:
 *   import { metaHarness } from './MetaHarnessIntegration.js';
 *   metaHarness.initialize();
 *   metaHarness.onGenerationComplete(result);
 */

import { failureLogger, type FailureRecord } from './FailureLogger.js';
import { patternDetector, type Pattern } from './PatternDetector.js';
import { harnessUpdater, type HarnessAdaptation } from './HarnessUpdater.js';
import { 
  getActiveProvider, 
  getActiveProviderConfig,
  getHarnessProviderConfig,
  listConfiguredProviders,
  type ProviderType 
} from './MultiProviderConfig.js';
import { LLMClient } from '../llm/LLMClient.js';

export interface MetaHarnessStatus {
  initialized: boolean;
  activeProvider: ProviderType;
  configuredProviders: ProviderType[];
  recentFailures: number;
  detectedPatterns: Pattern[];
  appliedAdaptations: HarnessAdaptation[];
}

export class MetaHarnessIntegration {
  private initialized = false;
  private appliedAdaptations: HarnessAdaptation[] = [];
  private llmClient?: LLMClient;

  /**
   * Initialize the Meta-Harness
   * - Loads previous state
   * - Detects available providers
   * - Applies any pending adaptations
   */
  initialize(): void {
    if (this.initialized) return;
    
    console.log('[MetaHarness] Initializing...');
    
    // Detect available providers
    const providers = listConfiguredProviders();
    const activeProvider = getActiveProvider();
    
    console.log(`[MetaHarness] Available providers: ${providers.join(', ') || 'none'}`);
    console.log(`[MetaHarness] Active provider: ${activeProvider}`);
    
    // Initialize LLM client with harness-specific config (lower temp for code fixes)
    const config = getHarnessProviderConfig() || getActiveProviderConfig();
    if (config) {
      this.llmClient = new LLMClient(config);
      console.log(`[MetaHarness] LLM client configured: ${config.model} @ ${config.baseUrl} (temp: ${config.temperature})`);
    } else {
      console.warn('[MetaHarness] No LLM provider configured. Set LIMINAL_LLM_BASE_URL or provider API key.');
    }
    
    // Load recent failures for pattern detection
    const recentFailures = failureLogger.getRecentFailures(100);
    console.log(`[MetaHarness] Loaded ${recentFailures.length} recent failures`);
    
    // Detect patterns from history
    for (const failure of recentFailures) {
      const patterns = patternDetector.analyze(failure);
      if (patterns.length > 0) {
        console.log(`[MetaHarness] Detected patterns in historical failure: ${patterns.map((p: Pattern) => p.name).join(', ')}`);
      }
    }
    
    this.initialized = true;
    console.log('[MetaHarness] Initialization complete');
  }

  /**
   * Call when a generation completes (success or failure)
   */
  async onGenerationComplete(result: {
    success: boolean;
    model: string;
    domain: string;
    prompt: string;
    code?: string;
    error?: string;
    duration: number;
  }): Promise<void> {
    if (!this.initialized) {
      this.initialize();
    }

    if (!result.success && result.error) {
      // Log the failure
      const failure: Omit<FailureRecord, 'timestamp' | 'sessionId'> = {
        model: result.model,
        domain: result.domain,
        prompt: result.prompt,
        code: result.code,
        error: result.error,
        errorType: 'generation',
        duration: result.duration,
      };
      
      failureLogger.log(failure);
      
      // Detect patterns
      const detectedPatterns = patternDetector.analyze({
        ...failure,
        timestamp: new Date().toISOString(),
        sessionId: failureLogger.getSessionId(),
      });
      
      // Apply adaptations for detected patterns
      for (const pattern of detectedPatterns) {
        console.log(`[MetaHarness] Applying adaptation for pattern: ${pattern.name}`);
        const adaptation = await harnessUpdater.applyAdaptation(pattern);
        if (adaptation) {
          this.appliedAdaptations.push(adaptation);
        }
      }
    }
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
      appliedAdaptations: [...this.appliedAdaptations, ...harnessUpdater.getAdaptations()],
    };
  }

  /**
   * Get the LLM client (for harness operations)
   */
  getLLMClient(): LLMClient | undefined {
    return this.llmClient;
  }

  /**
   * Check if Meta-Harness is online
   */
  isOnline(): boolean {
    return this.initialized && !!this.llmClient;
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
    try {
      metaHarness.initialize();
    } catch (err) {
      console.warn('[MetaHarness] Auto-initialization failed:', err);
    }
  }, 100);
}
