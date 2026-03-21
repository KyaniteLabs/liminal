import { useEffect, useRef, useCallback } from 'react';
import p5 from 'p5';

// ── Types ──

interface BusEvent {
  type: string;
  source: string;
  data: Record<string, unknown>;
  timestamp: string;
}

// ── Constants ──

const DOMAIN_COLORS: Record<string, [number, number, number]> = {
  text: [126, 184, 218],
  code: [168, 216, 168],
  audio: [240, 198, 116],
  image: [204, 153, 205],
  video: [249, 145, 87],
  unknown: [136, 136, 136],
};

const STAGES = ['extract', 'shred', 'collide', 'score', 'promote'] as const;
const STAGE_LABELS = ['EXTRACT', 'SHRED', 'COLLIDE', 'SCORE', 'PROMOTE'];

// ── Particle ──

interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  radius: number;
  maxRadius: number;
  domain: string;
  layer: string;
  color: [number, number, number];
  alpha: number;
  stage: number; // index into STAGES
  alive: boolean;
  scored: boolean;
  score: number;
  merging: boolean;
  mergePartner?: string;
  promoted: boolean;
  promotedAt: number;
  rejected: boolean;
  age: number;
  label: string;
  ringRadius: number;
  ringAlpha: number;
}

function makeParticle(id: string, domain: string, w: number, h: number): Particle {
  const color = DOMAIN_COLORS[domain] ?? DOMAIN_COLORS.unknown;
  return {
    id,
    x: -20,
    y: h * 0.2 + Math.random() * h * 0.6,
    vx: 0.5 + Math.random() * 1.5,
    vy: (Math.random() - 0.5) * 0.3,
    targetX: 0,
    targetY: 0,
    radius: 3 + Math.random() * 3,
    maxRadius: 8,
    domain,
    layer: 'semantic',
    color,
    alpha: 0,
    stage: 0,
    alive: true,
    scored: false,
    score: 0,
    merging: false,
    promoted: false,
    promotedAt: 0,
    rejected: false,
    age: 0,
    label: id.slice(0, 12),
    ringRadius: 0,
    ringAlpha: 0,
  };
}

// ── Collision flash ──

interface Flash {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  color: [number, number, number];
}

// ── Seed bank entry ──

interface SeedEntry {
  id: string;
  score: number;
  domains: string[];
  color: [number, number, number];
  y: number;
  targetY: number;
  alpha: number;
  bobPhase: number;
}

// ── Component ──

interface CompostVisualizerProps {
  events: BusEvent[];
  connected: boolean;
}

export function CompostVisualizer({ events, connected }: CompostVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const p5Ref = useRef<p5 | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const flashesRef = useRef<Flash[]>([]);
  const seedsRef = useRef<SeedEntry[]>([]);
  const statsRef = useRef({ extracted: 0, shredded: 0, collided: 0, scored: 0, promoted: 0 });
  const lastEventTimeRef = useRef(0);
  const replayIndexRef = useRef(0);
  const replayEventsRef = useRef<BusEvent[]>([]);

  const stageX = useCallback((stage: number, w: number) => {
    const margin = 60;
    const bankWidth = 120;
    const usable = w - margin * 2 - bankWidth;
    return margin + (stage / (STAGES.length - 1)) * usable;
  }, []);

  const sketch = useCallback((p: p5) => {
    const W = () => p.width;
    const H = () => p.height;
    let bg: p5.Graphics | null = null;

    p.setup = () => {
      const cnv = p.createCanvas(p.windowWidth, 500);
      cnv.parent(containerRef.current!);
      p.textFont('monospace');
    };

    p.windowResized = () => {
      p.resizeCanvas(p.windowWidth, 500);
    };

    p.draw = () => {
      const w = W();
      const h = H();
      const particles = particlesRef.current;
      const flashes = flashesRef.current;
      const seeds = seedsRef.current;
      const stats = statsRef.current;
      const now = p.millis();

      // ── Background ──
      p.background(12, 14, 20);

      // Subtle grid
      p.stroke(25, 28, 38);
      p.strokeWeight(0.5);
      for (let x = 0; x < w; x += 40) p.line(x, 0, x, h);
      for (let y = 0; y < h; y += 40) p.line(0, y, w, y);

      // ── Pipeline zones ──
      const zoneTop = h - 50;
      const zoneH = 30;
      for (let i = 0; i < STAGES.length; i++) {
        const x1 = stageX(i, w) - 30;
        const x2 = i < STAGES.length - 1 ? stageX(i + 1, w) - 30 : w - 130;

        // Zone background
        const isActive = particles.some(pt => pt.alive && pt.stage === i);
        p.noStroke();
        p.fill(isActive ? 30 : 18, isActive ? 35 : 22, isActive ? 48 : 32, 200);
        p.rect(x1, zoneTop, x2 - x1, zoneH, 4);

        // Zone label
        p.fill(isActive ? 180 : 80);
        p.textSize(10);
        p.textAlign(p.CENTER, p.CENTER);
        p.text(STAGE_LABELS[i], (x1 + x2) / 2, zoneTop + zoneH / 2);

        // Count badge
        const count = [stats.extracted, stats.shredded, stats.collided, stats.scored, stats.promoted][i];
        if (count > 0) {
          p.fill(60, 65, 80);
          p.ellipse((x1 + x2) / 2, zoneTop + zoneH + 14, 22, 14);
          p.fill(200);
          p.textSize(9);
          p.text(count, (x1 + x2) / 2, zoneTop + zoneH + 15);
        }

        // Connecting arrow
        if (i < STAGES.length - 1) {
          const ax = x2 + 5;
          p.stroke(50, 55, 70);
          p.strokeWeight(1);
          p.line(ax, zoneTop + zoneH / 2, ax + 12, zoneTop + zoneH / 2);
          p.line(ax + 12, zoneTop + zoneH / 2, ax + 8, zoneTop + zoneH / 2 - 4);
          p.line(ax + 12, zoneTop + zoneH / 2, ax + 8, zoneTop + zoneH / 2 + 4);
        }
      }

      // Scoring beam (vertical line at score stage)
      const scoreX = stageX(3, w);
      p.stroke(80, 180, 255, 30 + 20 * Math.sin(now * 0.003));
      p.strokeWeight(2);
      p.line(scoreX, 20, scoreX, zoneTop - 10);

      // ── Seed bank zone ──
      const bankX = w - 120;
      const bankTop = 20;
      const bankH = zoneTop - 30;

      p.noFill();
      p.stroke(40, 50, 60);
      p.strokeWeight(1);
      p.rect(bankX, bankTop, 110, bankH, 6);

      p.fill(80);
      p.noStroke();
      p.textSize(10);
      p.textAlign(p.CENTER, p.TOP);
      p.text('SEED BANK', bankX + 55, bankTop + 4);
      p.text(`${seeds.length}`, bankX + 55, bankTop + 18);

      // ── Update particles ──
      for (const pt of particles) {
        if (!pt.alive) continue;
        pt.age++;

        // Fade in
        if (pt.alpha < 255) pt.alpha = Math.min(255, pt.alpha + 8);

        // Move toward stage target
        const tx = stageX(pt.stage, w);
        const ty = h * 0.15 + Math.sin(pt.age * 0.02 + pt.x * 0.01) * (h * 0.3);

        if (pt.merging) {
          // Move toward merge partner
          const partner = particles.find(pp => pp.id === pt.mergePartner);
          if (partner && partner.alive) {
            pt.vx += (partner.x - pt.x) * 0.05;
            pt.vy += (partner.y - pt.y) * 0.05;
            pt.vx *= 0.9;
            pt.vy *= 0.9;
          }
        } else if (pt.promoted) {
          // Float to seed bank
          const bankTargetX = bankX + 20 + Math.random() * 70;
          const bankTargetY = bankTop + 40 + seeds.indexOf(seeds.find(s => s.id === pt.id)) * 16;
          pt.vx += (bankTargetX - pt.x) * 0.03;
          pt.vy += (bankTargetY - pt.y) * 0.03;
          pt.vx *= 0.92;
          pt.vy *= 0.92;
          pt.alpha = Math.max(0, pt.alpha - 0.5);
          if (pt.alpha <= 0) pt.alive = false;
        } else if (pt.rejected) {
          // Drift down and fade
          pt.vy += 0.05;
          pt.alpha -= 2;
          if (pt.alpha <= 0) pt.alive = false;
        } else {
          // Normal stage progression
          pt.vx += (tx - pt.x) * 0.008;
          pt.vy += (ty - pt.y) * 0.005;
          pt.vx *= 0.96;
          pt.vy *= 0.96;
        }

        pt.x += pt.vx;
        pt.y += pt.vy;

        // Score ring animation
        if (pt.ringAlpha > 0) {
          pt.ringRadius += 2;
          pt.ringAlpha -= 5;
        }

        // Promoted ring
        if (pt.promoted && now - pt.promotedAt < 1000) {
          const t = (now - pt.promotedAt) / 1000;
          pt.ringRadius = t * 40;
          pt.ringAlpha = (1 - t) * 200;
        }
      }

      // ── Draw connections (collision pairs approaching) ──
      p.strokeWeight(1);
      for (const pt of particles) {
        if (!pt.alive || !pt.merging) continue;
        const partner = particles.find(pp => pp.id === pt.mergePartner);
        if (partner && partner.alive) {
          const [r, g, b] = pt.color;
          p.stroke(r, g, b, 40);
          p.line(pt.x, pt.y, partner.x, partner.y);
        }
      }

      // ── Draw particles ──
      for (const pt of particles) {
        if (!pt.alive) continue;
        const [r, g, b] = pt.color;
        const a = pt.alpha / 255;

        // Glow
        p.noStroke();
        p.fill(r, g, b, 15 * a);
        p.ellipse(pt.x, pt.y, pt.radius * 4);

        // Core
        p.fill(r, g, b, 200 * a);
        p.ellipse(pt.x, pt.y, pt.radius * 2);

        // Bright center
        p.fill(255, 255, 255, 100 * a);
        p.ellipse(pt.x, pt.y, pt.radius * 0.8);

        // Score ring
        if (pt.ringAlpha > 0) {
          p.noFill();
          p.stroke(r, g, b, pt.ringAlpha * a);
          p.strokeWeight(1.5);
          p.ellipse(pt.x, pt.y, pt.ringRadius);
        }

        // Label on hover / when close to cursor
        if (p.dist(p.mouseX, p.mouseY, pt.x, pt.y) < pt.radius * 3) {
          p.noStroke();
          p.fill(20, 22, 30, 220);
          p.rect(pt.x + 10, pt.y - 18, p.textWidth(pt.label) + 16, 22, 4);
          p.fill(r, g, b);
          p.textSize(10);
          p.textAlign(p.LEFT, p.CENTER);
          p.text(pt.label, pt.x + 18, pt.y - 7);
          if (pt.scored) {
            p.fill(180);
            p.text(`score: ${pt.score.toFixed(1)}`, pt.x + 18, pt.y + 5);
          }
        }
      }

      // ── Draw flashes ──
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i];
        f.radius += 3;
        f.alpha -= 8;
        if (f.alpha <= 0) { flashes.splice(i, 1); continue; }
        const [r, g, b] = f.color;
        p.noFill();
        p.stroke(r, g, b, f.alpha);
        p.strokeWeight(2);
        p.ellipse(f.x, f.y, f.radius);
      }

      // ── Draw seed bank entries ──
      for (const seed of seeds) {
        seed.bobPhase += 0.02;
        const drawY = bankTop + 40 + seed.y * 14 + Math.sin(seed.bobPhase) * 2;
        const [r, g, b] = seed.color;

        p.noStroke();
        p.fill(r, g, b, 40 + seed.alpha * 0.6);
        p.ellipse(bankX + 15, drawY, 8);

        p.fill(r, g, b, 150 + seed.alpha * 0.4);
        p.textSize(8);
        p.textAlign(p.LEFT, p.CENTER);
        p.text(`${seed.score.toFixed(1)}`, bankX + 24, drawY);
      }

      // ── HUD: connection status + stats ──
      p.noStroke();
      p.fill(connected ? [80, 200, 120] : [200, 80, 80]);
      p.ellipse(16, 16, 8);
      p.fill(connected ? 140 : 120);
      p.textSize(10);
      p.textAlign(p.LEFT, p.CENTER);
      p.text(connected ? 'LIVE' : 'OFFLINE', 24, 16);

      p.fill(80);
      p.textAlign(p.RIGHT, p.TOP);
      p.textSize(10);
      p.text(
        `particles: ${particles.filter(pp => pp.alive).length}  |  seeds: ${seeds.length}  |  collisions: ${stats.collided}`,
        w - 16, 8
      );

      // ── Replay mode indicator ──
      if (!connected && replayEventsRef.current.length > 0) {
        p.fill(60, 50, 30);
        p.noStroke();
        p.rect(w / 2 - 60, h - 18, 120, 16, 4);
        p.fill(200, 180, 100);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(9);
        p.text('REPLAY MODE', w / 2, h - 10);
      }

      // ── Cleanup dead particles (keep last 200) ──
      for (let i = particles.length - 1; i >= 0; i--) {
        if (!particles[i].alive) particles.splice(i, 1);
      }
      if (particles.length > 200) particles.splice(0, particles.length - 200);

      // ── Replay: if no events for 5s, replay history ──
      const timeSinceEvent = now - lastEventTimeRef.current;
      if (!connected && timeSinceEvent > 5000 && replayEventsRef.current.length > 0) {
        const replay = replayEventsRef.current;
        const idx = replayIndexRef.current;
        if (idx < replay.length) {
          processEvent(replay[idx]);
          replayIndexRef.current = idx + 1;
          lastEventTimeRef.current = now; // reset so we pace replays
        } else {
          // Loop
          replayIndexRef.current = 0;
          // Reset particles for clean replay
          particles.length = 0;
          seeds.length = 0;
          stats.extracted = 0;
          stats.shredded = 0;
          stats.collided = 0;
          stats.scored = 0;
          stats.promoted = 0;
        }
      }
    };

    // ── Event processing ──

    function processEvent(event: BusEvent) {
      const particles = particlesRef.current;
      const flashes = flashesRef.current;
      const seeds = seedsRef.current;
      const stats = statsRef.current;
      const w = p.width;
      const h = p.height;

      if (event.type === 'compost:stage') {
        const stage = String(event.data.stage ?? '');
        const message = String(event.data.message ?? '');

        if (stage === 'extract' || message.includes('Extracting')) {
          // Spawn fragments for extraction
          const count = 3 + Math.floor(Math.random() * 5);
          const domains = Object.keys(DOMAIN_COLORS);
          for (let i = 0; i < count; i++) {
            const domain = domains[Math.floor(Math.random() * domains.length)];
            const id = `frag-${Date.now()}-${i}`;
            const pt = makeParticle(id, domain, w, h);
            pt.y = h * 0.15 + (i / count) * h * 0.55;
            pt.vx = 1 + Math.random() * 2;
            particles.push(pt);
            stats.extracted++;
          }
        } else if (stage === 'shred' || message.includes('Shredding')) {
          // Split existing extract-stage particles
          for (const pt of particles) {
            if (pt.alive && pt.stage === 0 && !pt.merging) {
              pt.stage = 1;
              stats.shredded++;
            }
          }
        } else if (stage === 'collide' || message.includes('Colliding') || message.includes('collision')) {
          // Move to collide stage
          for (const pt of particles) {
            if (pt.alive && pt.stage === 1) pt.stage = 2;
          }
        }
      }

      if (event.type === 'compost:collision') {
        const fragA = String(event.data.fragmentA ?? '');
        const fragB = String(event.data.fragmentB ?? '');
        const strategy = String(event.data.strategy ?? 'random');
        const domains = (event.data.domains as string[]) ?? [];

        // Find two particles at collide stage and merge them
        const candidates = particles.filter(pt => pt.alive && pt.stage === 2 && !pt.merging);
        if (candidates.length >= 2) {
          const a = candidates[0];
          const b = candidates[1];
          a.merging = true;
          a.mergePartner = b.id;
          b.merging = true;
          b.mergePartner = a.id;

          // After a delay, merge them (simulate with a timeout-like approach using age)
          setTimeout(() => {
            if (!a.alive || !b.alive) return;

            // Create flash at midpoint
            flashes.push({
              x: (a.x + b.x) / 2,
              y: (a.y + b.y) / 2,
              radius: 5,
              alpha: 200,
              color: a.color,
            });

            // Merge: a absorbs b
            a.radius = Math.min(a.maxRadius, a.radius + b.radius * 0.5);
            a.merging = false;
            a.mergePartner = undefined;
            a.stage = 3; // move to score stage
            a.label = `${strategy.slice(0, 8)}`;
            if (domains.length > 0) a.domain = domains[0];
            const dc = DOMAIN_COLORS[a.domain] ?? DOMAIN_COLORS.unknown;
            a.color = dc;

            b.alive = false;
            stats.collided++;
          }, 800 + Math.random() * 600);
        }
      }

      if (event.type === 'compost:score') {
        const fragId = String(event.data.fragmentId ?? '');
        const score = Number(event.data.total ?? 5);
        const domain = String(event.data.domain ?? 'unknown');

        const pt = particles.find(pp => pp.id === fragId) ??
                   particles.find(pp => pp.alive && pp.stage === 3 && !pp.scored);
        if (pt) {
          pt.scored = true;
          pt.score = score;
          pt.radius = 4 + score * 0.8;
          stats.scored++;

          // Score ring
          pt.ringRadius = pt.radius;
          pt.ringAlpha = score > 5 ? 200 : 100;

          if (score >= 4) {
            // High score: keep moving right
            pt.stage = 4;
          } else {
            // Low score: reject
            pt.rejected = true;
            pt.vy = 1;
          }
        }
      }

      if (event.type === 'compost:seed') {
        const seedId = String(event.data.seedId ?? '');
        const score = Number(event.data.score ?? 0);
        const domains = (event.data.domains as string[]) ?? ['unknown'];

        const pt = particles.find(pp => pp.alive && pp.stage === 4 && !pp.promoted);
        if (pt) {
          pt.promoted = true;
          pt.promotedAt = p.millis();
          pt.ringRadius = 5;
          pt.ringAlpha = 255;
          stats.promoted++;

          // Add to seed bank
          const domain = domains[0] ?? 'unknown';
          const color = DOMAIN_COLORS[domain] ?? DOMAIN_COLORS.unknown;
          seeds.push({
            id: seedId,
            score,
            domains,
            color,
            y: seeds.length,
            targetY: seeds.length,
            alpha: 0,
            bobPhase: Math.random() * Math.PI * 2,
          });
          if (seeds.length > 30) seeds.shift();
        }
      }

      // Also handle process progress for compost
      if (event.type === 'process:progress') {
        const process = String(event.data.process ?? '');
        if (process.includes('compost') || process.includes('digest')) {
          lastEventTimeRef.current = p.millis();
        }
      }

      // Store events for replay
      if (event.type.startsWith('compost:')) {
        replayEventsRef.current.push({ ...event });
        if (replayEventsRef.current.length > 200) replayEventsRef.current.shift();
      }
    }

    // ── Expose processEvent for external use ──
    (p as any)._processEvent = processEvent;
  }, [stageX]);

  // ── Mount/unmount p5 ──

  useEffect(() => {
    if (!containerRef.current) return;

    const instance = new p5(sketch);
    p5Ref.current = instance;

    return () => {
      instance.remove();
      p5Ref.current = null;
    };
  }, [sketch]);

  // ── Feed events into the sketch ──

  useEffect(() => {
    const instance = p5Ref.current;
    if (!instance) return;
    const processEvent = (instance as any)._processEvent;
    if (!processEvent) return;

    for (const event of events) {
      processEvent(event);
      lastEventTimeRef.current = Date.now();
    }
  }, [events]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        minHeight: 520,
        borderRadius: 'var(--atelier-radius)',
        overflow: 'hidden',
        border: '1px solid var(--atelier-border)',
        background: '#0c0e14',
      }}
    />
  );
}
