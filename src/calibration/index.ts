/**
 * @deprecated RETIRED — Calibration module (audit C11).
 *
 * This subsystem is dead in production: `useCalibration && isCalibrated()`
 * can never be true because no code path ever loads calibration weights,
 * so `isCalibrated()` is always false. Exports are kept ONLY for type
 * compatibility with CreativeEvaluator, AestheticCritic and HarnessMemory
 * and MUST NOT be consumed by new code. Marked explicitly retired (C11);
 * pending removal once dependents drop their dead calibration branches.
 */

export { CorrelationCalculator } from './CorrelationCalculator.js';
export type {
  RegressionResult,
  CorrelationResult,
} from './CorrelationCalculator.js';

export {
  CalibrationSuite,
  calibrationSuite,
} from './CalibrationSuite.js';
export type {
  CalibrationSample,
  CalibrationWeights,
  CalibrationResult,
  CalibrationSession,
  CalibrationData,
} from './CalibrationSuite.js';
