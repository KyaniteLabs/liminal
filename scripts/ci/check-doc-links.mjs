#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_DOCS = [
  'README.md',
  'docs/README.md',
  'docs/features.html',
];

function launchDocs() {
  const dir = path.join(ROOT, 'docs/launch');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((entry) => /\.(?:md|html)$/i.test(entry))
    .map((entry) => `docs/launch/${entry}`)
    .sort();
}

function parseArgs(argv) {
  const files = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--file') files.push(argv[++index]);
    else if (arg.startsWith('--file=')) files.push(arg.slice('--file='.length));
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/ci/check-doc-links.mjs [--file <path> ...]');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return files.length > 0 ? files : [...DEFAULT_DOCS, ...launchDocs()];
}

function extractLinks(filePath, content) {
  const links = [];
  const markdownPattern = /!?\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  const htmlPattern = /\b(?:href|src)=["']([^"']+)["']/g;

  if (/\.md$/i.test(filePath)) {
    for (const match of content.matchAll(markdownPattern)) links.push(match[1]);
  }
  if (/\.(?:html|md)$/i.test(filePath)) {
    for (const match of content.matchAll(htmlPattern)) links.push(match[1]);
  }

  return links;
}

function shouldSkip(rawLink) {
  return !rawLink
    || rawLink.startsWith('#')
    || /^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(rawLink)
    || rawLink.includes('{{')
    || rawLink.includes('}}');
}

function targetExists(sourceFile, rawLink) {
  const withoutQuery = rawLink.split(/[?#]/)[0];
  if (!withoutQuery || shouldSkip(withoutQuery)) return true;
  const decoded = decodeURIComponent(withoutQuery);
  const absolute = path.resolve(path.dirname(sourceFile), decoded);
  const relative = path.relative(ROOT, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return true;
  return fs.existsSync(absolute);
}

function main() {
  const files = parseArgs(process.argv.slice(2));
  const failures = [];

  for (const relativeFile of files) {
    const filePath = path.resolve(ROOT, relativeFile);
    if (!fs.existsSync(filePath)) {
      failures.push(`${relativeFile}: file does not exist`);
      continue;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    for (const link of extractLinks(filePath, content)) {
      if (shouldSkip(link)) continue;
      if (!targetExists(filePath, link)) {
        failures.push(`${relativeFile}: broken local link ${link}`);
      }
    }
  }

  if (failures.length > 0) {
    console.error('Broken documentation links:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(`Documentation links OK (${files.length} files scanned)`);
}

main();
