/**
 * SlotManager — manages named site regions (slots) for the living website.
 *
 * Each slot represents a region on kyanitelabs.tech where Liminal injects
 * creative output. Slots track an active variant and an optional challenger.
 * State is persisted to a JSON file on disk.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Domain } from '../types/domains.js';

export interface SlotVariant {
  /** Path to the HTML file served by nginx */
  htmlPath: string;
  /** PostHog experiment/feature flag key */
  experimentId: string;
  /** Combined fitness score (0-1) */
  fitness: number;
  /** ISO timestamp when deployed */
  deployedAt: string;
  /** LLM model used for generation */
  model: string;
  /** Creative domain (p5, three, glsl, etc.) */
  domain: Domain;
}

export interface SiteSlot {
  /** Unique slot identifier, e.g. 'home-hero' */
  id: string;
  /** Page path on the site, e.g. '/' */
  page: string;
  /** Which creative domains can fill this slot */
  domains: Domain[];
  /** Currently active (live) variant */
  active: SlotVariant;
  /** Optional challenger variant (A/B test in progress) */
  challenger: SlotVariant | null;
}

export class SlotManager {
  private slots: Map<string, SiteSlot> = new Map();

  constructor(private readonly statePath: string) {}

  /** Load slot state from disk */
  async load(): Promise<void> {
    try {
      const raw = await readFile(this.statePath, 'utf-8');
      const data = JSON.parse(raw) as SiteSlot[];
      this.slots.clear();
      for (const slot of data) {
        this.slots.set(slot.id, slot);
      }
    } catch {
      // File doesn't exist yet — start empty
      this.slots.clear();
    }
  }

  /** Save slot state to disk */
  async save(): Promise<void> {
    const data = Array.from(this.slots.values());
    await mkdir(dirname(this.statePath), { recursive: true });
    await writeFile(this.statePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /** Get a slot by ID */
  getSlot(id: string): SiteSlot | undefined {
    return this.slots.get(id);
  }

  /** Get all slots */
  getAllSlots(): SiteSlot[] {
    return Array.from(this.slots.values());
  }

  /** Add or replace a slot */
  setSlot(slot: SiteSlot): void {
    this.slots.set(slot.id, slot);
  }

  /** Set the active variant for a slot */
  setActive(slotId: string, variant: SlotVariant): void {
    const slot = this.slots.get(slotId);
    if (!slot) throw new Error(`Slot not found: ${slotId}`);
    slot.active = variant;
  }

  /** Set the challenger variant for a slot */
  setChallenger(slotId: string, variant: SlotVariant): void {
    const slot = this.slots.get(slotId);
    if (!slot) throw new Error(`Slot not found: ${slotId}`);
    slot.challenger = variant;
  }

  /** Clear the challenger for a slot */
  clearChallenger(slotId: string): void {
    const slot = this.slots.get(slotId);
    if (!slot) throw new Error(`Slot not found: ${slotId}`);
    slot.challenger = null;
  }

  /** Promote the challenger to active. Clears challenger after promotion. */
  promoteChallenger(slotId: string): void {
    const slot = this.slots.get(slotId);
    if (!slot) throw new Error(`Slot not found: ${slotId}`);
    if (!slot.challenger) throw new Error(`No challenger to promote for slot: ${slotId}`);
    slot.active = slot.challenger;
    slot.challenger = null;
  }

  /** Returns true if the slot has no challenger and needs one generated */
  needsChallenger(slotId: string): boolean {
    const slot = this.slots.get(slotId);
    if (!slot) return false;
    return slot.challenger === null;
  }
}
