/**
 * Autonomy Module — Phase 15-16
 */

// Phase 15
export { GardenHealthMonitor } from './GardenHealthMonitor.js';
export type { GardenHealthMetrics, GardenHealthConfig } from './GardenHealthMonitor.js';
export { GardenPolicy } from './GardenPolicy.js';
export type { GardenAction, GardenPolicyDecision, GardenPolicyConfig } from './GardenPolicy.js';
export { NicheQuotaPolicy } from './NicheQuotaPolicy.js';
export type { NicheQuotaConfig, NicheAllocation } from './NicheQuotaPolicy.js';
export { StagnationDetector } from './StagnationDetector.js';
export type { StagnationResult, StagnationDetectorConfig } from './StagnationDetector.js';

// Phase 14
export { ArchiveTaskPlanner } from './ArchiveTaskPlanner.js';
export type { ArchiveTaskPlannerConfig, ArchiveTaskPlan } from './ArchiveTaskPlanner.js';

// Phase 15 — Learning feedback
export { PromisingStateSelector } from './PromisingStateSelector.js';
export type { PromisingStateSelectorConfig } from './PromisingStateSelector.js';
export { ReplayBudgetPolicy } from './ReplayBudgetPolicy.js';
export type { ReplayBudgetPolicyConfig } from './ReplayBudgetPolicy.js';

// Phase 16
export { AutonomousGardener } from './AutonomousGardener.js';
export type { GardenerCycleResult, AutonomousGardenerConfig } from './AutonomousGardener.js';
export { GardenScheduler } from './GardenScheduler.js';
export type { GardenMode, ScheduledAction, GardenSchedulerConfig } from './GardenScheduler.js';
export { LoopMixPolicy } from './LoopMixPolicy.js';
export type { LoopActivity, LoopMix, LoopMixPolicyConfig } from './LoopMixPolicy.js';
export { CreativeWeaknessEmitter } from './CreativeWeaknessEmitter.js';
export type { WeaknessCategory, CreativeWeakness, CreativeWeaknessEmitterConfig } from './CreativeWeaknessEmitter.js';
export { ChallengeGenerator } from './ChallengeGenerator.js';
export type { CreativeChallenge, ChallengeGeneratorConfig } from './ChallengeGenerator.js';
export { PolicyExperimentRunner } from './PolicyExperimentRunner.js';
export type { PolicyKind, PolicyVariant, ExperimentResult, ExperimentOutcome, PolicyExperimentRunnerConfig } from './PolicyExperimentRunner.js';
