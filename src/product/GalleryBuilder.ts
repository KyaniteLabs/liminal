/**
 * GalleryBuilder — Phase 16
 *
 * Builds a viewable gallery from archive contents:
 * groups by lineage, sorts by quality, and provides
 * summary statistics for the TUI gallery pane.
 */

import type { ArchiveCell, ArchiveEntry } from '../emergence/types.js';

export interface GalleryItem {
  entry: ArchiveEntry;
  cellId: string;
  rank: number;
}

export interface GalleryGroup {
  title: string;
  items: GalleryItem[];
  avgQuality: number;
  avgNovelty: number;
}

export interface Gallery {
  groups: GalleryGroup[];
  totalItems: number;
  topItem: GalleryItem | null;
  avgQuality: number;
}

export class GalleryBuilder {
  /**
   * Build a gallery from archive cells.
   */
  build(cells: ArchiveCell[]): Gallery {
    const items: GalleryItem[] = [];

    // Collect all entries with their cell IDs
    for (const cell of cells) {
      if (cell.elite) {
        items.push({ entry: cell.elite, cellId: cell.cellId, rank: 0 });
      }
      for (const ne of cell.nearElites) {
        items.push({ entry: ne, cellId: cell.cellId, rank: 0 });
      }
    }

    // Sort by quality descending and assign ranks
    items.sort((a, b) => b.entry.qualityScore - a.entry.qualityScore);
    items.forEach((item, i) => { item.rank = i + 1; });

    // Group by provenance type
    const groupMap = new Map<string, GalleryItem[]>();
    for (const item of items) {
      const provenance = item.entry.lineage.provenance;
      const group = groupMap.get(provenance) ?? [];
      group.push(item);
      groupMap.set(provenance, group);
    }

    const groups: GalleryGroup[] = [...groupMap.entries()]
      .map(([provenance, groupItems]) => ({
        title: this.provenanceLabel(provenance),
        items: groupItems,
        avgQuality: groupItems.reduce((s, i) => s + i.entry.qualityScore, 0) / groupItems.length,
        avgNovelty: groupItems.reduce((s, i) => s + i.entry.signals.novelty, 0) / groupItems.length,
      }))
      .sort((a, b) => b.avgQuality - a.avgQuality);

    const totalItems = items.length;
    const topItem = items[0] ?? null;
    const avgQuality = totalItems > 0
      ? items.reduce((s, i) => s + i.entry.qualityScore, 0) / totalItems
      : 0;

    return { groups, totalItems, topItem, avgQuality };
  }

  private provenanceLabel(provenance: string): string {
    const labels: Record<string, string> = {
      'fresh-generation': 'Fresh Generation',
      remix: 'Remixes',
      'compost-promotion': 'Compost Promotions',
      'dream-recombination': 'Dream Recombinations',
      branch: 'Branches',
      mutation: 'Mutations',
      'perturbation-probe': 'Perturbation Probes',
    };
    return labels[provenance] ?? provenance;
  }
}
