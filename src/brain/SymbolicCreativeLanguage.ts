/**
 * SymbolicCreativeLanguage — Emergent symbolic language for creative composition.
 *
 * Ported from hydra-creative-agent's symbolic_language.py. Discovers recurring
 * technique patterns in creative outputs, maintains a vocabulary of reusable
 * symbols, and composes new expressions by combining symbols through sequential,
 * parallel, or hierarchical strategies.
 *
 * Also tracks notation token effectiveness via EMA (exponential moving average),
 * allowing the CompostSoup loop to learn which creative-notation tokens correlate
 * with winning offspring.
 *
 * Pure TypeScript, ESM, zero external dependencies.
 */

import { NOTATION_REGISTRY, compressToNotation } from '../swarm/CreativeNotation.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single creative symbol discovered from past creations.
 *
 * Symbols capture recurring technique patterns (e.g. "gradient mesh lighting",
 * "polyrhythmic subdivision") together with quantitative effectiveness data so
 * the language can learn which patterns produce strong results.
 */
export interface CreativeSymbol {
  /** Unique identifier for this symbol. */
  id: string;
  /** Human-readable name (e.g. "gradient-mesh-lighting"). */
  name: string;
  /** Creative domain the symbol was discovered in (e.g. "visual", "audio", "typography"). */
  domain: string;
  /** Regex-style pattern used to recognise this technique in text. */
  pattern: string;
  /** Natural-language description of what the symbol means. */
  semantics: string;
  /** Number of times the symbol has been used in compositions. */
  usageCount: number;
  /** Rolling effectiveness score (0–1) updated via {@link recordOutcome}. */
  effectiveness: number;
  /** Unix timestamp (ms) of the last time this symbol was used. */
  lastUsed: number;
}

/**
 * Strategy for combining multiple symbols into a single expression.
 *
 * - `sequential`  — "X then Y" temporal ordering.
 * - `parallel`    — "X blended with Y" simultaneous combination.
 * - `hierarchical` — "X modified by Y" modifier relationship.
 */
export type CompositionStrategy = 'sequential' | 'parallel' | 'hierarchical';

/**
 * The result of composing several symbols via a {@link CompositionStrategy}.
 */
export interface ComposedExpression {
  /** The strategy used to combine the symbols. */
  strategy: CompositionStrategy;
  /** The symbols that were composed, in order. */
  symbols: CreativeSymbol[];
  /** The human-readable composed expression string. */
  expression: string;
  /** Weighted average effectiveness of the constituent symbols (0–1). */
  estimatedEffectiveness: number;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Emergent symbolic language for creative composition.
 *
 * Maintains a bounded vocabulary of {@link CreativeSymbol} entries that are
 * discovered from creative outputs, tracks their effectiveness, and supports
 * composition via three strategies. Vocabulary is automatically pruned when it
 * exceeds the configured maximum size.
 */
export class SymbolicCreativeLanguage {
  /** Internal symbol store keyed by symbol id. */
  private vocabulary: Map<string, CreativeSymbol> = new Map();

  /** EMA scores for notation tokens (token string -> effectiveness 0-1). */
  private notationEma: Map<string, number> = new Map();

  /** Maximum number of symbols to retain after pruning. */
  private maxVocabularySize: number;

  /**
   * Create a new SymbolicCreativeLanguage instance.
   *
   * @param maxVocabularySize - Maximum vocabulary capacity (default 100).
   */
  constructor(maxVocabularySize: number = 100) {
    this.maxVocabularySize = maxVocabularySize;
  }

  // -----------------------------------------------------------------------
  // Symbol discovery
  // -----------------------------------------------------------------------

  /**
   * Analyse a creative output and discover recurring technique patterns.
   *
   * The method applies a set of lightweight heuristic extractors to surface
   * candidate symbols from the text. Each discovered symbol is added to the
   * vocabulary (or increments the usage count if it already exists) and
   * returned to the caller.
   *
   * @param creation - The creative output text to analyse.
   * @param domain   - The creative domain label (e.g. "visual", "audio").
   * @returns Array of newly discovered (or updated) symbols.
   */
  discoverSymbols(creation: string, domain: string): CreativeSymbol[] {
    const discovered: CreativeSymbol[] = [];
    const techniques = this.extractTechniques(creation, domain);

    for (const technique of techniques) {
      const existing = this.findSymbolByPattern(technique.pattern, domain);
      if (existing) {
        existing.usageCount += 1;
        existing.lastUsed = Date.now();
        discovered.push(existing);
      } else {
        const symbol: CreativeSymbol = {
          id: this.generateId(technique.name, domain),
          name: technique.name,
          domain,
          pattern: technique.pattern,
          semantics: technique.semantics,
          usageCount: 1,
          effectiveness: 0.5,
          lastUsed: Date.now(),
        };
        this.vocabulary.set(symbol.id, symbol);
        discovered.push(symbol);
      }
    }

    return discovered;
  }

  // -----------------------------------------------------------------------
  // Composition
  // -----------------------------------------------------------------------

  /**
   * Compose an expression from the given symbol IDs using the specified strategy.
   *
   * Composition templates:
   * - **sequential**  — `"X then Y then Z"`
   * - **parallel**    — `"X blended with Y blended with Z"`
   * - **hierarchical** — `"X modified by Y modified by Z"`
   *
   * If any symbol ID cannot be found it is silently skipped. The estimated
   * effectiveness is the usage-weighted average of the resolved symbols.
   *
   * @param symbolIds - IDs of the symbols to compose (must exist in vocabulary).
   * @param strategy  - Composition strategy to apply.
   * @returns A {@link ComposedExpression}, or `null` if no valid symbols were found.
   */
  composeFromSymbols(
    symbolIds: string[],
    strategy: CompositionStrategy,
  ): ComposedExpression | null {
    const symbols: CreativeSymbol[] = [];

    for (const id of symbolIds) {
      const symbol = this.vocabulary.get(id);
      if (symbol) {
        symbols.push(symbol);
      }
    }

    if (symbols.length === 0) {
      return null;
    }

    const expression = this.buildExpression(symbols, strategy);
    const estimatedEffectiveness = this.calculateEstimatedEffectiveness(symbols);

    return {
      strategy,
      symbols,
      expression,
      estimatedEffectiveness,
    };
  }

  // -----------------------------------------------------------------------
  // Outcome tracking
  // -----------------------------------------------------------------------

  /**
   * Record the observed effectiveness of a symbol combination.
   *
   * For each symbol referenced by `symbolIds`, the effectiveness is updated
   * using an exponential moving average with a smoothing factor of 0.3. Symbols
   * that do not exist in the vocabulary are silently ignored.
   *
   * @param symbolIds    - IDs of the symbols that were used.
   * @param effectiveness - Measured effectiveness of the result (0–1).
   */
  recordOutcome(symbolIds: string[], effectiveness: number): void {
    const alpha = 0.3;
    for (const id of symbolIds) {
      const symbol = this.vocabulary.get(id);
      if (symbol) {
        symbol.effectiveness =
          alpha * effectiveness + (1 - alpha) * symbol.effectiveness;
        symbol.usageCount += 1;
        symbol.lastUsed = Date.now();
      }
    }
  }

  // -----------------------------------------------------------------------
  // Vocabulary access
  // -----------------------------------------------------------------------

  /**
   * Return all symbols in the vocabulary sorted by effectiveness (descending).
   *
   * @returns Sorted array of all symbols.
   */
  getVocabulary(): CreativeSymbol[] {
    return Array.from(this.vocabulary.values()).sort(
      (a, b) => b.effectiveness - a.effectiveness,
    );
  }

  /**
   * Return the top-N symbols for a given domain, sorted by effectiveness.
   *
   * @param domain - Domain to filter by (e.g. "visual", "audio").
   * @param count  - Maximum number of symbols to return (default 10).
   * @returns Filtered and sorted array of symbols.
   */
  getTopSymbols(domain: string, count: number = 10): CreativeSymbol[] {
    return Array.from(this.vocabulary.values())
      .filter((s) => s.domain === domain)
      .sort((a, b) => b.effectiveness - a.effectiveness)
      .slice(0, count);
  }

  // -----------------------------------------------------------------------
  // Pruning
  // -----------------------------------------------------------------------

  /**
   * Remove the least effective symbols to keep the vocabulary within bounds.
   *
   * Symbols are ranked by effectiveness (ascending) and the lowest-ranked
   * entries are removed until only `maxVocabularySize` symbols remain.
   *
   * @returns The number of symbols that were pruned.
   */
  pruneVocabulary(): number {
    if (this.vocabulary.size <= this.maxVocabularySize) {
      return 0;
    }

    const sorted = Array.from(this.vocabulary.values()).sort(
      (a, b) => a.effectiveness - b.effectiveness,
    );

    const excessCount = this.vocabulary.size - this.maxVocabularySize;
    const toRemove = sorted.slice(0, excessCount);

    for (const symbol of toRemove) {
      this.vocabulary.delete(symbol.id);
    }

    return toRemove.length;
  }

  // -----------------------------------------------------------------------
  // Cross-domain transfer
  // -----------------------------------------------------------------------

  /**
   * Transfer a symbol to a different creative domain.
   *
   * Creates a shallow clone of the source symbol under the target domain with a
   * fresh ID and reset statistics. This enables cross-pollination of techniques
   * between domains (e.g. applying an audio rhythm pattern to visual motion).
   *
   * @param symbolId     - ID of the source symbol to transfer.
   * @param targetDomain - The domain to transfer the symbol into.
   * @returns The newly created symbol, or `null` if the source was not found.
   */
  transferToDomain(
    symbolId: string,
    targetDomain: string,
  ): CreativeSymbol | null {
    const source = this.vocabulary.get(symbolId);
    if (!source) {
      return null;
    }

    const transferred: CreativeSymbol = {
      id: this.generateId(source.name, targetDomain),
      name: source.name,
      domain: targetDomain,
      pattern: source.pattern,
      semantics: `Transferred from ${source.domain}: ${source.semantics}`,
      usageCount: 0,
      effectiveness: source.effectiveness * 0.8, // slight decay on transfer
      lastUsed: Date.now(),
    };

    this.vocabulary.set(transferred.id, transferred);
    return transferred;
  }

  // -----------------------------------------------------------------------
  // Notation evolution
  // -----------------------------------------------------------------------

  /**
   * Evolve notation token effectiveness based on soup round outcomes.
   *
   * For each winning seed, compresses its content to notation tokens via
   * {@link compressToNotation}, then boosts the EMA of any tokens present in
   * {@link NOTATION_REGISTRY}. For each losing seed, the matching tokens have
   * their EMA decayed. Logs the top 3 boosted and top 3 decayed tokens.
   *
   * Tokens not in NOTATION_REGISTRY are silently ignored (no crash).
   *
   * @param winningSeeds - Content strings of seeds that won their round.
   * @param losingSeeds  - Content strings of seeds that lost their round.
   */
  evolveNotation(winningSeeds: string[], losingSeeds: string[]): void {
    const BOOST_ALPHA = 0.3;
    const DECAY_ALPHA = 0.15;
    const BOOST_TARGET = 1.0;
    const DECAY_TARGET = 0.0;

    const boosted: Array<{ token: string; score: number }> = [];
    const decayed: Array<{ token: string; score: number }> = [];

    for (const seed of winningSeeds) {
      const notation = compressToNotation(seed);
      const tokens = notation.split(/\s+/).filter(Boolean);
      for (const token of tokens) {
        if (NOTATION_REGISTRY.has(token)) {
          const prev = this.notationEma.get(token) ?? 0.5;
          const next = BOOST_ALPHA * BOOST_TARGET + (1 - BOOST_ALPHA) * prev;
          this.notationEma.set(token, next);
          boosted.push({ token, score: next });
        }
      }
    }

    for (const seed of losingSeeds) {
      const notation = compressToNotation(seed);
      const tokens = notation.split(/\s+/).filter(Boolean);
      for (const token of tokens) {
        if (NOTATION_REGISTRY.has(token)) {
          const prev = this.notationEma.get(token) ?? 0.5;
          const next = DECAY_ALPHA * DECAY_TARGET + (1 - DECAY_ALPHA) * prev;
          this.notationEma.set(token, next);
          decayed.push({ token, score: next });
        }
      }
    }

    // Log top 3 boosted (highest final score)
    const topBoosted = boosted
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((b) => `${b.token}=${b.score.toFixed(3)}`)
      .join(', ');

    // Log top 3 decayed (lowest final score)
    const topDecayed = decayed
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map((d) => `${d.token}=${d.score.toFixed(3)}`)
      .join(', ');

    if (topBoosted) {
      console.log(`[NotationEvolution] boosted: ${topBoosted}`);
    }
    if (topDecayed) {
      console.log(`[NotationEvolution] decayed: ${topDecayed}`);
    }
  }

  /**
   * Return a snapshot of all tracked notation token EMA scores.
   *
   * Useful for inspection, debugging, and seeding future soup rounds with
   * token-effectiveness context.
   *
   * @returns Map of notation token string to its current EMA score (0-1).
   */
  getNotationStats(): Map<string, number> {
    return new Map(this.notationEma);
  }

  // -----------------------------------------------------------------------
  // Quality reporting
  // -----------------------------------------------------------------------

  /**
   * Produce a summary of vocabulary health and balance.
   *
   * @returns An object with total symbol count, average effectiveness, and a
   *          per-domain breakdown of symbol counts.
   */
  getQualityReport(): {
    totalSymbols: number;
    avgEffectiveness: number;
    domainBalance: Record<string, number>;
  } {
    const symbols = Array.from(this.vocabulary.values());
    const totalSymbols = symbols.length;

    const avgEffectiveness =
      totalSymbols > 0
        ? symbols.reduce((sum, s) => sum + s.effectiveness, 0) / totalSymbols
        : 0;

    const domainBalance: Record<string, number> = {};
    for (const symbol of symbols) {
      domainBalance[symbol.domain] = (domainBalance[symbol.domain] ?? 0) + 1;
    }

    return { totalSymbols, avgEffectiveness, domainBalance };
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Extract candidate technique patterns from a creative text.
   *
   * Uses heuristic rules per domain to surface named patterns. The current
   * implementation recognises common creative technique keywords and wraps
   * them into a structured form suitable for symbol creation.
   *
   * @param creation - The text to scan for techniques.
   * @param domain   - The creative domain guiding extraction heuristics.
   * @returns Array of raw technique descriptors.
   */
  private extractTechniques(
    creation: string,
    domain: string,
  ): Array<{ name: string; pattern: string; semantics: string }> {
    const techniques: Array<{
      name: string;
      pattern: string;
      semantics: string;
    }> = [];

    const lower = creation.toLowerCase();

    // Domain-specific technique keyword sets
    const domainKeywords: Record<string, string[]> = {
      visual: [
        'gradient',
        'layer',
        'contrast',
        'saturation',
        'blur',
        'opacity',
        'perspective',
        'shadow',
        'glow',
        'mesh',
        'pattern',
        'texture',
        'depth',
        'reflection',
        'composition',
        'rhythm',
        'balance',
        'emphasis',
        'harmony',
        'movement',
      ],
      audio: [
        'reverb',
        'delay',
        'chorus',
        'distortion',
        'compression',
        'panning',
        'pitch',
        'harmony',
        'rhythm',
        'tempo',
        'dynamics',
        'timbre',
        'resonance',
        'decay',
        'attack',
        'sustain',
        'modulation',
        'filter',
        'oscillation',
        'polyphony',
      ],
      typography: [
        'kerning',
        'leading',
        'tracking',
        'weight',
        'serif',
        'sans-serif',
        'ligature',
        'baseline',
        'x-height',
        'ascender',
        'descender',
        'whitespace',
        'alignment',
        'hierarchy',
        'contrast',
        'scale',
        'spacing',
        'indent',
        'justification',
        'column',
      ],
    };

    // Merge domain-specific keywords with a general creative set
    const keywords = [
      ...(domainKeywords[domain] ?? []),
      ...(domainKeywords['visual'] ?? []).slice(0, 5),
    ];

    // Deduplicate
    const seen = new Set<string>();
    for (const keyword of keywords) {
      if (seen.has(keyword)) continue;
      seen.add(keyword);

      // Match keyword as a whole word
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(lower)) {
        const name = this.toKebabCase(keyword);
        techniques.push({
          name,
          pattern: `\\b${keyword}\\b`,
          semantics: `${domain} technique: ${keyword}`,
        });
      }
    }

    return techniques;
  }

  /**
   * Look up an existing symbol by its pattern and domain.
   *
   * @param pattern - The regex pattern string to search for.
   * @param domain  - The domain to constrain the search to.
   * @returns The matching symbol, or `undefined` if none found.
   */
  private findSymbolByPattern(
    pattern: string,
    domain: string,
  ): CreativeSymbol | undefined {
    for (const symbol of Array.from(this.vocabulary.values())) {
      if (symbol.pattern === pattern && symbol.domain === domain) {
        return symbol;
      }
    }
    return undefined;
  }

  /**
   * Build a human-readable expression from symbols and a composition strategy.
   *
   * @param symbols  - Ordered list of symbols to compose.
   * @param strategy - The composition strategy.
   * @returns The composed expression string.
   */
  private buildExpression(
    symbols: CreativeSymbol[],
    strategy: CompositionStrategy,
  ): string {
    const names = symbols.map((s) => s.name);

    switch (strategy) {
      case 'sequential':
        return names.join(' then ');
      case 'parallel':
        return names.join(' blended with ');
      case 'hierarchical':
        return names.join(' modified by ');
    }
  }

  /**
   * Calculate the estimated effectiveness of a symbol combination.
   *
   * Uses usage-count weighting so frequently-used symbols contribute more to
   * the estimate.
   *
   * @param symbols - Symbols to average.
   * @returns Weighted effectiveness estimate (0–1).
   */
  private calculateEstimatedEffectiveness(symbols: CreativeSymbol[]): number {
    if (symbols.length === 0) return 0;

    const totalWeight = symbols.reduce((sum, s) => sum + s.usageCount, 0);
    if (totalWeight === 0) {
      // All symbols have zero usage — simple average
      return (
        symbols.reduce((sum, s) => sum + s.effectiveness, 0) / symbols.length
      );
    }

    const weightedSum = symbols.reduce(
      (sum, s) => sum + s.effectiveness * s.usageCount,
      0,
    );
    return weightedSum / totalWeight;
  }

  /**
   * Generate a deterministic symbol ID from a name and domain.
   *
   * @param name   - The kebab-case symbol name.
   * @param domain - The creative domain.
   * @returns A string ID in the form `domain:name`.
   */
  private generateId(name: string, domain: string): string {
    return `${domain}:${name}`;
  }

  /**
   * Convert a space-separated or camelCase string to kebab-case.
   *
   * @param value - The input string.
   * @returns The kebab-cased result.
   */
  private toKebabCase(value: string): string {
    return value
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }
}
