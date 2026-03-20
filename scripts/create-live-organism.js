#!/usr/bin/env node
/**
 * Create a live organism project: generate Strudel + Hydra iterations without an LLM.
 * Usage: node scripts/create-live-organism.js [prompt] [maxIterations]
 * Example: node scripts/create-live-organism.js "ambient drift" 5
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { loadConfig, loadProjectConfig } from '../dist/config/ConfigLoader.js';
import { Gallery } from '../dist/gallery/Gallery.js';
import { generateMusicToVisual } from '../dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const prompt = process.argv[2]?.trim() || 'ambient drift with soft pulses';
const maxIterations = Math.min(20, Math.max(1, parseInt(process.argv[3], 10) || 5));
const projectName = `live-organism-${Date.now()}`;

async function main() {
  const cwd = root;
  const configPath = process.env.LIMINAL_CONFIG_PATH || process.env.ATELIER_CONFIG_PATH || path.join(process.env.HOME || '', '.liminal', 'config.json');
  const userConfig = await loadConfig(configPath).catch(() => null);
  const projectConfig = await loadProjectConfig(cwd).catch(() => null);
  const galleryPath = userConfig?.galleryPath ?? projectConfig?.galleryPath ?? 'gallery';
  const resolvedGallery = path.isAbsolute(galleryPath) ? galleryPath : path.join(cwd, galleryPath);

  const gallery = new Gallery(resolvedGallery);
  console.log(`Creating live organism: "${prompt}" (${maxIterations} iterations)`);
  console.log(`Gallery: ${resolvedGallery}`);
  console.log(`Project: ${projectName}\n`);

  for (let i = 1; i <= maxIterations; i++) {
    const result = await generateMusicToVisual(prompt, {
      traits: { bpm: 100 + (i % 40), palette: i % 2 === 0 ? 'warm' : '' },
    });
    await gallery.saveOrganism(projectName, i, result.musicCode, result.visualCode);
    console.log(`  Saved iteration ${i}/${maxIterations}`);
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const projectDirName = `${dateStr}--${projectName}`;
  console.log(`\nDone. Project dir: ${projectDirName}`);
  console.log(`Open the GUI → Live organism → select "${projectDirName}" to view and run in sandbox.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
