/**
 * Export selected iteration as HTML (reuse Exporter).
 */

import type { Exporter } from '../export/Exporter.js';

export interface GuiIteration {
  id: number;
  code: string;
  timestamp: number;
}

/**
 * Exports the selected iteration's code as standalone HTML using Exporter.
 * @throws Error if selectedIndex is out of range or code is empty
 */
export async function exportSelectedIterationAsHTML(
  iterations: GuiIteration[],
  selectedIndex: number,
  outputPath: string,
  exporter: Exporter
): Promise<void> {
  const iteration = iterations[selectedIndex];
  if (!iteration || !iteration.code?.trim()) {
    throw new Error('Selected iteration not found or has no code');
  }
  await exporter.exportHTML(iteration.code, outputPath);
}
