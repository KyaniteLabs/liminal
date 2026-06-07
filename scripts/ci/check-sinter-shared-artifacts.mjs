#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const fixtureDir = path.join(root, 'docs/contracts/fixtures');
const outDir = path.join(root, '.omx/proof');
const outPath = path.join(outDir, 'sinter-shared-artifact-contracts.json');
const schemaVersion = '2026-05-25.phase1';

const fileRoles = new Set(['source', 'style', 'script', 'asset', 'manifest', 'receipt']);
const receiptKinds = new Set([
  'generation',
  'evaluation',
  'preview',
  'export',
  'safety',
  'aesthetic',
  'performance',
  'telemetry',
]);
const generatedByValues = new Set(['studio', 'sites', 'instrument', 'codex', 'manual']);
const reviewActionKinds = new Set([
  'apply_site_skin',
  'open_site_pr',
  'export_instrument_preset',
  'ingest_session',
  'promote_phrase',
  'discard_variant',
]);
const reviewActionStatuses = new Set(['proposed', 'approved', 'rejected', 'applied', 'discarded']);
const reviewActionRisks = new Set(['low', 'medium', 'high']);
const reviewActionTargetKinds = new Set([
  'repo',
  'deployed_site',
  'artifact',
  'instrument_preset',
  'session',
]);
const mutatingKinds = new Set([
  'apply_site_skin',
  'open_site_pr',
  'export_instrument_preset',
  'ingest_session',
  'promote_phrase',
]);

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function extractUnionLiterals(relativePath, typeName) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const match = source.match(new RegExp(`export type ${typeName} =([\\s\\S]*?);`));
  if (!match) throw new Error(`Could not find ${typeName} union in ${relativePath}`);
  return new Set([...match[1].matchAll(/["']([^"']+)["']/g)].map((item) => item[1]));
}

function fail(failures, pathLabel, message) {
  failures.push(`${pathLabel}: ${message}`);
}

function requireString(failures, pathLabel, value, field) {
  if (typeof value !== 'string' || value.length === 0) fail(failures, pathLabel, `missing string ${field}`);
}

function validateSchema(failures, pathLabel, value, expectedSchema) {
  if (value.schema !== expectedSchema) fail(failures, pathLabel, `schema must be ${expectedSchema}`);
  if (value.schemaVersion !== schemaVersion) fail(failures, pathLabel, `schemaVersion must be ${schemaVersion}`);
}

function validateFiles(failures, pathLabel, files) {
  if (!Array.isArray(files) || files.length === 0) {
    fail(failures, pathLabel, 'files must be a non-empty array');
    return;
  }
  for (const [index, file] of files.entries()) {
    const label = `${pathLabel}.files[${index}]`;
    requireString(failures, label, file.path, 'path');
    if (!fileRoles.has(file.role)) fail(failures, label, `invalid role ${file.role}`);
  }
}

function validateReceipts(failures, pathLabel, receipts) {
  if (!Array.isArray(receipts)) {
    fail(failures, pathLabel, 'receipts must be an array');
    return;
  }
  for (const [index, receipt] of receipts.entries()) {
    const label = `${pathLabel}.receipts[${index}]`;
    requireString(failures, label, receipt.id, 'id');
    if (!receiptKinds.has(receipt.kind)) fail(failures, label, `invalid kind ${receipt.kind}`);
    requireString(failures, label, receipt.summary, 'summary');
    requireString(failures, label, receipt.createdAt, 'createdAt');
  }
}

function validateProvenance(failures, pathLabel, provenance, expectedArtifactId) {
  if (!provenance || typeof provenance !== 'object') {
    fail(failures, pathLabel, 'missing provenance');
    return;
  }
  if (provenance.artifactId !== expectedArtifactId) {
    fail(failures, pathLabel, `provenance.artifactId must be ${expectedArtifactId}`);
  }
  requireString(failures, pathLabel, provenance.prompt, 'provenance.prompt');
  requireString(failures, pathLabel, provenance.generatedAt, 'provenance.generatedAt');
  if (!generatedByValues.has(provenance.generatedBy)) {
    fail(failures, pathLabel, `invalid generatedBy ${provenance.generatedBy}`);
  }
  validateReceipts(failures, `${pathLabel}.provenance`, provenance.receipts);
}

function validateReviewAction(failures, action) {
  const pathLabel = `review-actions.json:${action?.id ?? 'unknown'}`;
  validateSchema(failures, pathLabel, action, 'sinter.review-action');
  requireString(failures, pathLabel, action.id, 'id');
  requireString(failures, pathLabel, action.summary, 'summary');
  if (!reviewActionKinds.has(action.kind)) fail(failures, pathLabel, `invalid kind ${action.kind}`);
  if (!reviewActionStatuses.has(action.status)) fail(failures, pathLabel, `invalid status ${action.status}`);
  if (!reviewActionRisks.has(action.risk)) fail(failures, pathLabel, `invalid risk ${action.risk}`);
  if (!action.target || typeof action.target !== 'object') {
    fail(failures, pathLabel, 'missing target');
  } else {
    if (!reviewActionTargetKinds.has(action.target.kind)) {
      fail(failures, pathLabel, `invalid target.kind ${action.target.kind}`);
    }
    if (action.target.kind === 'repo' && !action.target.repo) {
      fail(failures, pathLabel, 'repo target requires repo');
    }
    if (action.target.kind === 'deployed_site' && !action.target.url) {
      fail(failures, pathLabel, 'deployed_site target requires url');
    }
    if ((action.target.kind === 'artifact' || action.target.kind === 'instrument_preset') && !action.target.artifactId) {
      fail(failures, pathLabel, `${action.target.kind} target requires artifactId`);
    }
    if (action.target.kind === 'session' && !action.target.id) {
      fail(failures, pathLabel, 'session target requires id');
    }
  }
  if (mutatingKinds.has(action.kind)) {
    if (action.requiresConfirmation !== true) fail(failures, pathLabel, 'mutating actions require confirmation');
    if (action.status !== 'approved' && action.status !== 'applied') {
      fail(failures, pathLabel, 'mutating actions must be approved or applied before execution');
    }
    requireString(failures, pathLabel, action.reviewedBy, 'reviewedBy');
    requireString(failures, pathLabel, action.reviewedAt, 'reviewedAt');
  }
  if (action.status === 'applied') requireString(failures, pathLabel, action.executionReceiptId, 'executionReceiptId');
}

function main() {
  const failures = [];

  const compositionDomains = extractUnionLiterals('src/composition/types.ts', 'DomainType');
  const validatorDomains = extractUnionLiterals('src/core/validators/types.ts', 'Domain');
  const contractDomains = extractUnionLiterals(
    'docs/contracts/sinter-shared-artifact-contracts.md',
    'SinterDomain',
  );

  const domainMap = readJson('docs/contracts/fixtures/domain-map.json');
  validateSchema(failures, 'domain-map.json', domainMap, 'sinter.shared-artifact.domain-map');
  const entries = Array.isArray(domainMap.domains) ? domainMap.domains : [];
  const sharedDomains = entries.map((entry) => entry.shared).sort();
  const expectedDomains = [...contractDomains].sort();
  if (JSON.stringify(sharedDomains) !== JSON.stringify(expectedDomains)) {
    fail(failures, 'domain-map.json', `shared domains must match SinterDomain: ${expectedDomains.join(', ')}`);
  }
  for (const entry of entries) {
    const label = `domain-map.json:${entry.shared}`;
    if (!compositionDomains.has(entry.composition)) {
      fail(failures, label, `composition domain ${entry.composition} is not in src/composition/types.ts`);
    }
    if (!validatorDomains.has(entry.validator)) {
      fail(failures, label, `validator domain ${entry.validator} is not in src/core/validators/types.ts`);
    }
  }

  const allowedSharedDomains = contractDomains;
  const reviewActions = readJson('docs/contracts/fixtures/review-actions.json');
  if (!Array.isArray(reviewActions) || reviewActions.length === 0) {
    fail(failures, 'review-actions.json', 'must contain review actions');
  }
  const reviewActionIds = new Set();
  for (const action of reviewActions) {
    validateReviewAction(failures, action);
    reviewActionIds.add(action.id);
  }

  const studioArtifact = readJson('docs/contracts/fixtures/studio-artifact.json');
  validateSchema(failures, 'studio-artifact.json', studioArtifact, 'sinter.shared-artifact');
  requireString(failures, 'studio-artifact.json', studioArtifact.id, 'id');
  requireString(failures, 'studio-artifact.json', studioArtifact.title, 'title');
  if (!allowedSharedDomains.has(studioArtifact.domain)) {
    fail(failures, 'studio-artifact.json', `invalid domain ${studioArtifact.domain}`);
  }
  validateFiles(failures, 'studio-artifact.json', studioArtifact.files);
  validateProvenance(failures, 'studio-artifact.json', studioArtifact.provenance, studioArtifact.id);

  const siteArtifact = readJson('docs/contracts/fixtures/site-artifact.json');
  validateSchema(failures, 'site-artifact.json', siteArtifact, 'sinter.shared-site-artifact');
  requireString(failures, 'site-artifact.json', siteArtifact.id, 'id');
  requireString(failures, 'site-artifact.json', siteArtifact.siteProfileId, 'siteProfileId');
  if (!Array.isArray(siteArtifact.aestheticTags) || siteArtifact.aestheticTags.length === 0) {
    fail(failures, 'site-artifact.json', 'aestheticTags must be a non-empty array');
  }
  validateProvenance(failures, 'site-artifact.json', siteArtifact.provenance, siteArtifact.id);
  if (siteArtifact.patchPlan) {
    validateFiles(failures, 'site-artifact.json.patchPlan', siteArtifact.patchPlan.files);
    if (!reviewActionIds.has(siteArtifact.patchPlan.reviewActionId)) {
      fail(failures, 'site-artifact.json', `unknown reviewActionId ${siteArtifact.patchPlan.reviewActionId}`);
    }
  }

  const instrumentPreset = readJson('docs/contracts/fixtures/instrument-preset.json');
  validateSchema(failures, 'instrument-preset.json', instrumentPreset, 'sinter.shared-instrument-preset');
  requireString(failures, 'instrument-preset.json', instrumentPreset.id, 'id');
  validateFiles(failures, 'instrument-preset.json', instrumentPreset.files);
  validateProvenance(failures, 'instrument-preset.json', instrumentPreset.provenance, instrumentPreset.id);
  const controlIds = new Set((instrumentPreset.controls ?? []).map((control) => control.id));
  if (controlIds.size === 0) fail(failures, 'instrument-preset.json', 'controls must be non-empty');
  for (const mapping of instrumentPreset.mappings ?? []) {
    if (!controlIds.has(mapping.controlPortId)) {
      fail(failures, 'instrument-preset.json', `mapping ${mapping.id} points at unknown control ${mapping.controlPortId}`);
    }
  }

  const instrumentSession = readJson('docs/contracts/fixtures/instrument-session.json');
  validateSchema(failures, 'instrument-session.json', instrumentSession, 'sinter.shared-instrument-session');
  requireString(failures, 'instrument-session.json', instrumentSession.id, 'id');
  requireString(failures, 'instrument-session.json', instrumentSession.telemetryFile, 'telemetryFile');
  if (!Array.isArray(instrumentSession.presetIds) || instrumentSession.presetIds.length === 0) {
    fail(failures, 'instrument-session.json', 'presetIds must be non-empty');
  }
  validateProvenance(failures, 'instrument-session.json', instrumentSession.provenance, instrumentSession.id);

  const result = {
    generatedAt: new Date().toISOString(),
    contract: 'sinter-shared-artifact-contracts',
    schemaVersion,
    passed: failures.length === 0,
    checked: {
      fixtures: fs.readdirSync(fixtureDir).filter((entry) => entry.endsWith('.json')).sort(),
      contractDomains: [...contractDomains].sort(),
      compositionDomains: [...compositionDomains].sort(),
      validatorDomains: [...validatorDomains].sort(),
    },
    failures,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  if (failures.length > 0) {
    console.error(`Sinter shared artifact contract check failed. See ${outPath}`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(`Sinter shared artifact contract check passed: ${outPath}`);
}

main();
