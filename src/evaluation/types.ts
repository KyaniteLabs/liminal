/**
 * Evaluation Fabric Types — Phase 11 Increment 4
 *
 * Types for the unified evaluation pipeline that merges code scoring
 * (ScoringEngine) with aesthetic critique (AestheticCritic) into a
 * single confidence-rated result.
 */

import type { ScoringResult } from '../core/ScoringEngine.js';
import type { AestheticReport } from '../aesthetic/types.js';

// ── Input Types ──

/** A candidate artifact to evaluate */
export interface EvaluationCandidate {
  /** The code/artifact content to evaluate */
  code: string;
  /** The prompt that generated this candidate */
  prompt?: string;
  /** Domain hint (e.g. 'p5', 'strudel', 'tone') */
  domain?: string;
  /** Previous outputs for novelty comparison */
  previousOutputs?: string[];
  /** Metadata about the generation run */
  metadata?: Record<string, unknown>;
}

// ── Confidence Types ──

/** A single dimension in a confidence report */
export interface ConfidenceDimension {
  /** Dimension name (e.g. 'technical', 'aesthetic', 'creative') */
  name: string;
  /** Score 0-1 */
  score: number;
  /** Where this score came from */
  source: 'scoring-engine' | 'aesthetic-critic' | 'hybrid';
}

/** Agreement level between scoring critics */
export type AgreementLevel = 'consensus' | 'minor-divergence' | 'major-divergence';

/** Result of synthesizing multiple critic scores into confidence */
export interface ConfidenceReport {
  /** Overall confidence score 0-1 (higher = more certain) */
  confidence: number;
  /** Overall quality score 0-1 (weighted average of critics) */
  quality: number;
  /** Per-dimension breakdown */
  dimensions: ConfidenceDimension[];
  /** Whether the critics agree or diverge */
  agreement: AgreementLevel;
  /** Any issues detected across all critics */
  issues: string[];
  /** The raw ScoringEngine result */
  scoringResult: ScoringResult;
  /** The raw AestheticCritic result */
  aestheticReport: AestheticReport;
}

// ── Hybrid Judge Types ──

/** Weights for blending code vs creative scores */
export interface HybridWeights {
  /** Weight for code quality dimensions (default 0.5) */
  code: number;
  /** Weight for creative/aesthetic dimensions (default 0.5) */
  creative: number;
}

/** Result from the hybrid judge combining both paths */
export interface HybridJudgment {
  /** Overall blended score 0-1 */
  score: number;
  /** The confidence report synthesizing both critics */
  confidence: ConfidenceReport;
  /** Whether the candidate passes the quality threshold */
  passed: boolean;
  /** Which scoring strategies were used */
  strategies: string[];
}

// ── Golden Suite Types ──

/** A single golden test case with expected outcomes */
export interface GoldenCase {
  /** Unique case ID */
  id: string;
  /** The prompt that generates the candidate */
  prompt: string;
  /** The expected output domain */
  domain: string;
  /** Minimum acceptable score (0-1) */
  minScore: number;
  /** Maximum acceptable score (0-1), for detecting regressions */
  maxScore?: number;
  /** Tags for categorizing test cases */
  tags: string[];
}

/** A collection of golden test cases for regression testing */
export interface GoldenSuite {
  /** Suite name */
  name: string;
  /** Suite description */
  description?: string;
  /** The test cases */
  cases: GoldenCase[];
  /** When this suite was created */
  createdAt: string;
}

/** Result of evaluating a single golden case */
export interface GoldenCaseResult {
  /** The golden case that was evaluated */
  caseId: string;
  /** The candidate produced for this case */
  candidate: EvaluationCandidate;
  /** The hybrid judgment */
  judgment: HybridJudgment;
  /** Whether the case passed its threshold */
  passed: boolean;
  /** How far above/below the threshold (positive = margin, negative = gap) */
  margin: number;
}

/** Result of running an entire golden suite */
export interface GoldenSuiteResult {
  /** The suite that was run */
  suiteName: string;
  /** Results for each case */
  caseResults: GoldenCaseResult[];
  /** How many cases passed */
  passed: number;
  /** How many cases failed */
  failed: number;
  /** Total cases */
  total: number;
  /** Average score across all cases */
  averageScore: number;
  /** Whether the suite passes as a whole (all cases pass) */
  suitePassed: boolean;
}

// ── Evaluation Fabric Result ──

/** The unified result from the evaluation fabric */
export interface EvaluationFabricResult {
  /** The hybrid judgment (always present) */
  judgment: HybridJudgment;
  /** Golden suite results (only when a suite was run) */
  suiteResult?: GoldenSuiteResult;
  /** Wall-clock duration of the full evaluation */
  durationMs: number;
  /** Timestamp */
  timestamp: string;
}

/** Configuration for the evaluation fabric */
export interface EvaluationFabricConfig {
  /** Quality threshold for pass/fail (default 0.6) */
  qualityThreshold?: number;
  /** Minimum confidence to trust the result (default 0.3) */
  minConfidence?: number;
  /** Scoring strategy to use (default 'comprehensive') */
  scoringStrategy?: string;
  /** Hybrid weights for code vs creative blending */
  hybridWeights?: HybridWeights;
  /** Whether to use LLM-enhanced evaluation (default false) */
  useLLM?: boolean;
}
