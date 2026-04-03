/**
 * Routing module - Smart model selection based on A/B test results
 */

export {
  AB_TEST_RESULTS,
  DOMAIN_ROUTING_DATA,
  OVERALL_FITNESS,
  DOMAIN_KEYWORDS,
  recordRoutingOutcome,
  getRollingPerformance,
  getOptimalModelBandit,
  getBanditStats,
} from './RoutingData.js';
export type {
  DomainType,
  ModelChoice,
  DomainFitness,
  DomainRoutingConfig,
} from './RoutingData.js';

export {
  SmartRouter,
  defaultRouter,
  route,
  routeByPrompt,
} from './SmartRouter.js';
export type {
  RoutingDecision,
  RoutingConfig,
} from './SmartRouter.js';

export {
  GeneratorBanditRouter,
  generatorBanditRouter,
} from './GeneratorBanditRouter.js';
export type {
  BanditArm,
  BanditState,
} from './GeneratorBanditRouter.js';
