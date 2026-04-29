import { useEffect, useMemo, useRef } from 'react';

interface BusEvent {
  type: string;
  source: string;
  data: Record<string, unknown>;
  timestamp: string;
}

interface CompostVisualizerProps {
  events: BusEvent[];
  connected: boolean;
}

const DOMAIN_COLORS: Record<string, string> = {
  text: '#7eb8da',
  code: '#a8d8a8',
  audio: '#f0c674',
  image: '#cc99cd',
  video: '#f99157',
  unknown: '#8892a6',
};

const STAGE_LABELS = ['EXTRACT', 'SHRED', 'COLLIDE', 'SCORE', 'PROMOTE'];

type Particle = {
  id: string;
  domain: string;
  stage: number;
  createdAt: number;
  lane: number;
  label: string;
};

function eventDomain(event: BusEvent): string {
  const domain = event.data?.domain ?? event.data?.type ?? event.source;
  return typeof domain === 'string' && domain in DOMAIN_COLORS ? domain : 'unknown';
}

function stageFor(event: BusEvent): number {
  const text = `${event.type} ${event.source}`.toLowerCase();
  if (text.includes('promote') || text.includes('accepted')) return 4;
  if (text.includes('score') || text.includes('eval')) return 3;
  if (text.includes('collide') || text.includes('merge')) return 2;
  if (text.includes('shred') || text.includes('digest')) return 1;
  return 0;
}

function buildParticles(events: BusEvent[]): Particle[] {
  return events.slice(-80).map((event, index) => ({
    id: `${event.timestamp}-${index}`,
    domain: eventDomain(event),
    stage: stageFor(event),
    createdAt: Date.parse(event.timestamp) || Date.now() - index * 180,
    lane: index % 9,
    label: String(event.data?.id || event.type || event.source).slice(0, 14),
  }));
}

export function CompostVisualizer({ events, connected }: CompostVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useMemo(() => buildParticles(events), [events]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext('2d');
    if (!context) return undefined;

    let frame = 0;
    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      width = Math.max(640, Math.floor(rect.width || 960));
      height = 500;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = () => {
      const now = Date.now();
      context.clearRect(0, 0, width, height);
      context.fillStyle = '#0c0e14';
      context.fillRect(0, 0, width, height);

      context.strokeStyle = 'rgba(145, 161, 190, 0.12)';
      context.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }
      for (let y = 0; y < height; y += 40) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }

      const left = 52;
      const right = width - 52;
      const zoneY = height - 70;
      const stageGap = (right - left) / (STAGE_LABELS.length - 1);
      context.font = '11px JetBrains Mono, ui-monospace, monospace';
      context.textAlign = 'center';
      context.textBaseline = 'middle';

      for (let i = 0; i < STAGE_LABELS.length; i++) {
        const x = left + i * stageGap;
        const isActive = particles.some((particle) => particle.stage === i && now - particle.createdAt < 6_000);
        context.fillStyle = isActive ? 'rgba(89, 225, 255, 0.16)' : 'rgba(145, 161, 190, 0.08)';
        context.strokeStyle = isActive ? 'rgba(89, 225, 255, 0.42)' : 'rgba(145, 161, 190, 0.18)';
        context.beginPath();
        context.roundRect(x - 48, zoneY - 18, 96, 36, 8);
        context.fill();
        context.stroke();
        context.fillStyle = isActive ? '#eef3ff' : '#9aa7bd';
        context.fillText(STAGE_LABELS[i], x, zoneY);
        if (i < STAGE_LABELS.length - 1) {
          context.strokeStyle = 'rgba(145, 161, 190, 0.26)';
          context.beginPath();
          context.moveTo(x + 52, zoneY);
          context.lineTo(x + stageGap - 52, zoneY);
          context.stroke();
        }
      }

      const gradient = context.createRadialGradient(width * 0.5, 180, 12, width * 0.5, 180, width * 0.55);
      gradient.addColorStop(0, connected ? 'rgba(89, 225, 255, 0.18)' : 'rgba(217, 87, 99, 0.14)');
      gradient.addColorStop(1, 'rgba(7, 9, 13, 0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      for (const particle of particles) {
        const age = Math.max(0, now - particle.createdAt);
        const drift = (age / 24_000) % 1;
        const stageX = left + particle.stage * stageGap;
        const x = Math.min(right, stageX - 42 + drift * 84 + Math.sin(frame / 40 + particle.lane) * 8);
        const y = 52 + particle.lane * 34 + Math.sin(frame / 30 + particle.lane * 1.7) * 10;
        const alpha = Math.max(0.18, 1 - age / 60_000);
        const radius = 4 + particle.stage * 1.2;
        context.globalAlpha = alpha;
        context.fillStyle = DOMAIN_COLORS[particle.domain] ?? DOMAIN_COLORS.unknown;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = alpha * 0.35;
        context.beginPath();
        context.arc(x, y, radius + 8 + Math.sin(frame / 18) * 4, 0, Math.PI * 2);
        context.strokeStyle = DOMAIN_COLORS[particle.domain] ?? DOMAIN_COLORS.unknown;
        context.stroke();
        context.globalAlpha = alpha;
        context.fillStyle = '#cbd5e1';
        context.font = '10px JetBrains Mono, ui-monospace, monospace';
        context.textAlign = 'left';
        context.fillText(particle.label, x + 10, y - 10);
      }
      context.globalAlpha = 1;

      context.fillStyle = connected ? '#58c777' : '#d95763';
      context.textAlign = 'left';
      context.font = '12px JetBrains Mono, ui-monospace, monospace';
      context.fillText(connected ? 'compost stream connected' : 'compost stream offline', 18, 24);
      context.fillStyle = '#9aa7bd';
      context.fillText(`${particles.length} recent events`, 18, 42);

      frame = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    frame = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frame);
    };
  }, [connected, particles]);

  return (
    <div className="atelier-panel" style={{ padding: 0, overflow: 'hidden' }}>
      <canvas ref={canvasRef} aria-label="Compost pipeline event visualization" style={{ display: 'block', width: '100%' }} />
    </div>
  );
}
