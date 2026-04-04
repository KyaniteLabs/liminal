import { describe, it, expect } from 'vitest';
import { generateArpeggio } from '../../src/music/Arpeggiator.js';

describe('Arpeggiator', () => {
  it('generates the correct number of notes in up mode', () => {
    const notes = generateArpeggio(
      { mode: 'up', octaveRange: 1, notesPerBeat: 4, baseNotes: [60, 64, 67] },
      12, 0.25,
    );
    expect(notes).toHaveLength(12);
    expect(notes[0].pitch).toBe(60);
    expect(notes[0].time).toBe(0);
  });

  it('throws on empty baseNotes', () => {
    expect(() =>
      generateArpeggio(
        { mode: 'up', octaveRange: 1, notesPerBeat: 4, baseNotes: [] },
        8, 0.25,
      ),
    ).toThrow('at least one base note');
  });

  it('returns empty array for zero totalNotes', () => {
    const notes = generateArpeggio(
      { mode: 'up', octaveRange: 1, notesPerBeat: 4, baseNotes: [60] },
      0, 0.25,
    );
    expect(notes).toHaveLength(0);
  });
});
