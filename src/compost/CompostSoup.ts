/**
 * CompostSoup — continuous evolutionary loop on the compost heap.
 * Picks random fragments, merges via LLM, scores offspring, replaces worst.
 */

import crypto from 'node:crypto';
import type { CompostConfig, CompostFragment, SoupState } from './types.js';
import { SoupStateManager } from './SoupStateManager.js';
import { SeedBank } from './SeedBank.js';
import { FragmentScorer } from './FragmentScorer.js';
import { FitnessCombiner } from '../evolution/FitnessCombiner.js';
import { MapElites } from '../evolution/MapElites.js';
import { eventBus, EventTypes } from '../core/EventBus.js';
import type { LLMClientLike } from './SemanticExtractor.js';
import { Logger } from '../utils/Logger.js';
import { SymbolicCreativeLanguage } from '../brain/SymbolicCreativeLanguage.js';

export class CompostSoup {
  private config: CompostConfig;
  private llm: LLMClientLike;
  private stateManager: SoupStateManager;
  private seedBank: SeedBank;
  private scorer: FragmentScorer;
  private fitnessCombiner: FitnessCombiner;
  private mapElites: MapElites;
  private abortController: AbortController | null = null;
  private notationLang: SymbolicCreativeLanguage;

  constructor(config: CompostConfig, llm: LLMClientLike) {
    this.config = config;
    this.llm = llm;
    this.stateManager = new SoupStateManager(config);
    this.seedBank = new SeedBank(config);
    this.scorer = new FragmentScorer(config, llm);
    this.fitnessCombiner = new FitnessCombiner(config.fitnessWeights);
    this.mapElites = new MapElites(config.mapElitesDims ?? [10, 10]);
    this.notationLang = new SymbolicCreativeLanguage();
    // Evolutionary infrastructure ready for soup fitness scoring
    void this.fitnessCombiner;
    void this.mapElites;
  }

  /** Run a single soup cycle. */
  async cycle(fragments: CompostFragment[]): Promise<SoupState> {
    let state = await this.stateManager.load();
    eventBus.emit(EventTypes.COMPOST_STAGE, 'CompostSoup', { stage: 'soup-cycle', message: `Soup cycle: ${fragments.length} fragments, ${[...new Set(fragments.map(f => f.domain))].length} domains` });

    // Need at least 2 fragments from different domains
    const domains = [...new Set(fragments.map(f => f.domain))];
    if (domains.length < 2 || fragments.length < 2) {
      return state;
    }

    // Pick 2 random fragments from different domains
    const domainA = domains[Math.floor(Math.random() * domains.length)];
    const otherDomains = domains.filter(d => d !== domainA);
    const domainB = otherDomains[Math.floor(Math.random() * otherDomains.length)];

    const fragsA = fragments.filter(f => f.domain === domainA);
    const fragsB = fragments.filter(f => f.domain === domainB);

    if (fragsA.length === 0 || fragsB.length === 0) return state;

    const fragA = fragsA[Math.floor(Math.random() * fragsA.length)];
    const fragB = fragsB[Math.floor(Math.random() * fragsB.length)];

    // Merge via LLM — graceful degradation if LLM fails
    let offspringContent: string;
    try {
      offspringContent = await this.mergeViaLLM(fragA, fragB);
    } catch (mergeErr) {
      Logger.warn('CompostSoup', `LLM merge failed, skipping offspring: ${mergeErr instanceof Error ? mergeErr.message : String(mergeErr)}`);
      return state;
    }

    // Create offspring fragment
    const offspring: CompostFragment = {
      id: `offspring-${crypto.randomBytes(6).toString('hex')}`,
      source: `soup:${fragA.id}+${fragB.id}`,
      domain: 'cross-domain',
      layer: 'semantic',
      content: offspringContent,
      metadata: {
        fileType: 'soup',
        timestamp: new Date().toISOString(),
        hash: crypto.createHash('sha256').update(offspringContent).digest('hex'),
        size: offspringContent.length,
        extractedAt: new Date().toISOString(),
      },
      tags: [domainA, domainB, 'offspring'],
    };

    // Score offspring
    const score = await this.scorer.score(offspring);
    offspring.score = score.total;
    eventBus.emit(EventTypes.COMPOST_SCORE, 'CompostSoup', { fragmentId: offspring.id, domain: 'cross-domain', total: score.total });

    // Update generation
    state = this.stateManager.updateGeneration(state);

    // Replace worst in population
    state = this.stateManager.replaceWorst(state, offspring);

    // Update heatmap
    state = this.stateManager.updateHeatmap(state, domainA, domainB, score.total);

    // Promote to seed bank if score exceeds threshold
    if (score.total >= this.config.soupSeedPromotionThreshold * 10) {
      await this.seedBank.add({
        id: offspring.id,
        content: offspring.content,
        score: score.total,
        source: {
          fragments: [fragA.id, fragB.id],
          collisionType: 'soup-offspring',
          domains: [domainA, domainB],
        },
        promotedAt: new Date().toISOString(),
        usedBy: [],
        useCount: 0,
      });
      eventBus.emit(EventTypes.COMPOST_SEED, 'CompostSoup', { seedId: offspring.id, score: score.total, source: `soup:${fragA.id}+${fragB.id}`, domains: [domainA, domainB] });
      state = this.stateManager.recordPromotion(state, offspring);
    }

    // Evolve notation vocabulary from round outcomes
    if (state.population.length >= 2) {
      const sorted = [...state.population].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      const mid = Math.ceil(sorted.length / 2);
      const winners = sorted.slice(0, mid).map((f) => f.content);
      const losers = sorted.slice(mid).map((f) => f.content);
      this.notationLang.evolveNotation(winners, losers);
    }

    await this.stateManager.save(state);
    return state;
  }

  /** Run continuous soup loop with AbortSignal support. */
  async run(fragments: CompostFragment[], signal?: AbortSignal): Promise<void> {
    this.abortController = new AbortController();
    eventBus.emit(EventTypes.PROCESS_START, 'CompostSoup', { process: 'compost-soup' });
    const controller = this.abortController;

    // Listen for external abort
    if (signal) {
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 5;

    while (!controller.signal.aborted) {
      try {
        await this.cycle(fragments);
        consecutiveFailures = 0;
      } catch (err) {
        consecutiveFailures++;
        Logger.warn('CompostSoup', 'cycle failed, continuing:', err);
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          Logger.error('CompostSoup', `${MAX_CONSECUTIVE_FAILURES} consecutive cycle failures, stopping soup`);
          break;
        }
      }

      // Wait before next cycle
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(resolve, this.config.soupCycleIntervalMs);
        controller.signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      }).catch((err) => {
        // Abort is expected when stopping, but log for debugging
        Logger.debug('CompostSoup', 'Cycle wait aborted:', err);
      });
    }
    eventBus.emit(EventTypes.PROCESS_END, 'CompostSoup', { process: 'compost-soup', success: true });
  }

  /** Stop the soup loop. */
  stop(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  /** Check if the soup is currently running. */
  isRunning(): boolean {
    return this.abortController !== null && !this.abortController.signal.aborted;
  }

  /** Merge two fragments via LLM. Throws on failure so caller can skip the offspring. */
  private async mergeViaLLM(a: CompostFragment, b: CompostFragment): Promise<string> {
    if (!this.llm) {
      throw new Error(`Cannot merge fragments: no LLM client available (${a.id} + ${b.id})`);
    }

    const result = await this.llm.generate(
      'You are a creative evolution engine. Combine these two fragments from different domains into a novel offspring. Be surprising and specific.',
      `[Parent A — domain: ${a.domain}]\n${a.content.slice(0, 1000)}\n\n[Parent B — domain: ${b.domain}]\n${b.content.slice(0, 1000)}\n\nCreate a novel offspring idea:`
    );
    if (!result.success) {
      throw new Error(`LLM merge failed for ${a.id} + ${b.id}: generation unsuccessful`);
    }
    return result.code;
  }
}
