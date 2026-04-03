/**
 * Blog theme data for the narrative archaeology video pipeline.
 *
 * Each theme corresponds to a potential blog post / video from the
 * Liminal project's 32-day history. Data extracted from raw-narrative.md.
 */

export interface BlogTheme {
  id: number;
  slug: string;
  title: string;
  coreMetaphor: string;
  era: string;
  keyQuotes: string[];
  dataPoints: string[];
  template: 'layered-reveal' | 'explainer' | 'story-arc' | 'comparison';
  format: 'short-form' | 'long-form';
  platform: 'youtube-shorts' | 'tiktok' | 'reels';
}

export const BLOG_THEMES: BlogTheme[] = [
  {
    id: 1,
    slug: 'frustration-to-infrastructure',
    title: 'From Frustration to Infrastructure',
    coreMetaphor: 'Every major frustration spike produced permanent automated enforcement. The angrier the developer got, the better the system became.',
    era: 'Era 3-5 (March 20-22)',
    keyQuotes: [
      '"The Ralph is a technique. In its purest form, Ralph is a Bash loop." — while :; do cat PROMPT.md | claude-code ; done',
      '"deterministically bad in an undeterministic world." — Geoffrey Huntley',
    ],
    dataPoints: [
      '12 days of silence between initial scaffolding and explosive development',
      '15 commits in 6 minutes from autonomous agent',
      '294 total commits over 32 days',
      '26 custom hooks created to prevent recurring frustrations',
    ],
    template: 'layered-reveal',
    format: 'short-form',
    platform: 'youtube-shorts',
  },
  {
    id: 2,
    slug: 'agricultural-metaphor',
    title: 'The Agricultural Metaphor',
    coreMetaphor: 'Code becomes soil. Dead projects become compost. Seeds grow into new ideas. The entire pipeline borrows from organic farming.',
    era: 'Era 6-7 (March 23-29)',
    keyQuotes: [
      '"Generative approaches produce novel output from minimal seeds."',
      '"Purpose (replication) arises without an explicit fitness function."',
    ],
    dataPoints: [
      'Compost Mill has 6 stages: add → extract → shred → collide → score → promote',
      'Seed bank injects random compost into every generation prompt',
      'Collisions force-merge unrelated creative fragments',
    ],
    template: 'explainer',
    format: 'short-form',
    platform: 'tiktok',
  },
  {
    id: 3,
    slug: 'agent-as-collaborator',
    title: 'The Agent as Collaborator',
    coreMetaphor: 'The relationship evolved from tool (Kai) to pair programmer (Cursor) to collaborator (Claude Code). 26 hooks represent the developer teaching the agent.',
    era: 'Era 1-8 (Feb 28 - Mar 31)',
    keyQuotes: [
      '"Always wire everything up end-to-end." — User instruction',
      '"Not yet implemented stubs are not acceptable deliverables." — User instruction',
    ],
    dataPoints: [
      'Kai produced 29 atomic commits in first session',
      '26 custom hooks enforce process (wiring checklist, process enforcement, review)',
      '58 Claude Code sessions over 32 days',
    ],
    template: 'story-arc',
    format: 'long-form',
    platform: 'youtube-shorts',
  },
  {
    id: 4,
    slug: 'emergent-quality',
    title: 'Emergent Quality Without Optimization',
    coreMetaphor: 'Grounded in computational life research. The system does not optimize for a single "art quality" metric. Improvement emerges from conditions.',
    era: 'Era 7 (March 28-29)',
    keyQuotes: [
      '"Creative quality is inherently multi-perspectival. No single metric captures whether a piece of generative art is good."',
      '"The simulation prompt references UMF analysis, oxide interactions, and thermal expansion — but none of these are actually calculated."',
    ],
    dataPoints: [
      '4 aesthetic critics: Color Harmony, Layout, Typography, Sound Harmony',
      '9 creative domains: p5.js, GLSL, Three.js, Remotion, Strudel, Hydra, Tone.js, HTML, ASCII',
      'RalphLoop iterates with evolutionary pressure, no single fitness function',
    ],
    template: 'explainer',
    format: 'short-form',
    platform: 'reels',
  },
  {
    id: 5,
    slug: 'honesty-crucible',
    title: 'The Honesty Crucible',
    coreMetaphor: 'Running the system against itself and publishing "BRUTALLY HONEST" results. A counterpoint to AI hype.',
    era: 'Era 8 (March 29-31)',
    keyQuotes: [
      '"The question was never whether AI can make art. It was whether the art would be worth looking at."',
    ],
    dataPoints: [
      '8 models evaluated for Remotion generation quality',
      'Granite-350M hallucinated APIs, Qwen3.5-9B produced valid code',
      'Dogfood testing: eating your own creative output',
    ],
    template: 'comparison',
    format: 'short-form',
    platform: 'tiktok',
  },
  {
    id: 6,
    slug: 'solo-at-team-scale',
    title: 'Solo Development at Team Scale',
    coreMetaphor: 'One developer, 294 commits, 32 days. What used to take a team of twenty.',
    era: 'Full timeline (Feb 28 - Mar 31)',
    keyQuotes: [
      '"A single person with AI can now build what used to take a team of twenty."',
    ],
    dataPoints: [
      '32 days from PRD to production system',
      '3,417 files at peak (from 2 initial files)',
      'Growth rate: ~116 files/day on active days',
      '1741 tests passing',
    ],
    template: 'layered-reveal',
    format: 'short-form',
    platform: 'youtube-shorts',
  },
  {
    id: 7,
    slug: 'self-healing-software',
    title: 'Self-Healing Software',
    coreMetaphor: 'The Meta-Harness observes its own failures and rewrites its own code. Recursive self-improvement.',
    era: 'Era 7-9 (March 28 - Apr 1)',
    keyQuotes: [
      '"The Meta-Harness self-evaluation runs the system against itself."',
    ],
    dataPoints: [
      '3-phase guardrails: Observation → Validation → Self-Healing',
      'Constitution defines acceptable behavior boundaries',
      'TelemetryCollector traces every execution',
    ],
    template: 'explainer',
    format: 'short-form',
    platform: 'reels',
  },
  {
    id: 8,
    slug: 'documentation-as-sacred-text',
    title: 'Documentation as Sacred Text',
    coreMetaphor: 'THE BIBLE. Documentation is religion. NO DUPLICATION. The sacred and the practical.',
    era: 'Era 9 (March 31)',
    keyQuotes: [
      '"Liminal is a creative coding agent with self-improving capabilities." — THE_BIBLE.md',
    ],
    dataPoints: [
      '9 eras of development documented',
      'THE_BIBLE.md serves as single source of truth',
      'Architecture Quick Reference maintained alongside',
    ],
    template: 'layered-reveal',
    format: 'short-form',
    platform: 'tiktok',
  },
  {
    id: 9,
    slug: 'parliament-of-minds',
    title: 'The Parliament of Creative Minds',
    coreMetaphor: '5 personas, 3 critics, 4 aesthetic critics. Creative disagreement as architecture.',
    era: 'Era 4-5 (March 20-22)',
    keyQuotes: [
      '"Creative quality is inherently multi-perspectival."',
    ],
    dataPoints: [
      '5 creative personas (Rex the Contrarian, and others)',
      '4 aesthetic critics running parallel evaluation',
      'Aesthetic gate blocks output that fails quality threshold',
    ],
    template: 'comparison',
    format: 'short-form',
    platform: 'reels',
  },
  {
    id: 10,
    slug: 'the-name-liminal',
    title: 'The Name "Liminal"',
    coreMetaphor: 'Why this name? Liminality — thresholds, transitions, productive in-between states. The system exists at the space between domains.',
    era: 'Era 2 (March 19)',
    keyQuotes: [
      '"liminality — from the Latin limen, meaning threshold — refers to states of transition, of being neither here nor there"',
      '"The rename from Atelier to Liminal marks a pivotal identity moment."',
    ],
    dataPoints: [
      'Project renamed from "Atelier" on Day 19',
      '9 creative domains deliberately collide fragments',
      'Name reflects philosophy: operate at intersections, not within domains',
    ],
    template: 'story-arc',
    format: 'short-form',
    platform: 'youtube-shorts',
  },
];

export function getTheme(id: number): BlogTheme | undefined {
  return BLOG_THEMES.find((t) => t.id === id);
}

export function listThemes(): BlogTheme[] {
  return BLOG_THEMES;
}
