# Domain evaluator registry

`DomainEvaluatorRegistry` is the first narrow seam for creative-domain evaluation.
Keep aggregate scoring in `ScoringEngine` stable, then attach domain-specific output signals under `result.report.domainEvaluation`.

Pattern for future domains:
1. implement `DomainEvaluator` with output-relevant signals for one domain;
2. register it in `DomainEvaluatorRegistry.withDefaults()`;
3. prove the aggregate score is unchanged while the domain report exposes useful signals.
