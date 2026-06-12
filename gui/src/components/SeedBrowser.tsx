import { useState, useEffect, useMemo } from 'react';

interface Seed {
  id: string;
  content: string;
  score: number;
  source: {
    fragments: string[];
    collisionType: string;
    domains: string[];
  };
  promotedAt: string;
  usedBy: string[];
  useCount: number;
}

interface SeedsResponse {
  seeds: Seed[];
  total: number;
}

interface SeedBrowserProps {
  apiBase: string;
}

const DOMAIN_COLORS: Record<string, string> = {
  text: 'var(--sinter-code-blue)',
  code: 'var(--sinter-code-green)',
  audio: 'var(--sinter-code-gold)',
  image: 'var(--sinter-code-purple)',
  video: 'var(--sinter-code-orange)',
  unknown: '#888',
};

function scoreColor(score: number): string {
  if (score >= 6) return 'var(--sinter-code-green)';
  if (score >= 4) return 'var(--sinter-code-blue)';
  return 'var(--sinter-code-gold)';
}

export function SeedBrowser({ apiBase }: SeedBrowserProps) {
  const [seeds, setSeeds] = useState<Seed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDomain, setFilterDomain] = useState<string>('all');
  const [filterMinScore, setFilterMinScore] = useState<number>(0);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'score' | 'domain' | 'date'>('score');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/seeds`);
        if (!res.ok) throw new Error(await res.text());
        const data: SeedsResponse = await res.json();
        if (!cancelled) setSeeds(data.seeds || []);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [apiBase]);

  const domains = useMemo(() => {
    const set = new Set<string>();
    for (const s of seeds) {
      for (const d of s.source?.domains ?? []) set.add(d);
    }
    return ['all', ...Array.from(set).sort()];
  }, [seeds]);

  const filtered = useMemo(() => {
    let list = seeds;
    if (filterDomain !== 'all') {
      list = list.filter(s => s.source?.domains?.includes(filterDomain));
    }
    if (filterMinScore > 0) {
      list = list.filter(s => (s.score ?? 0) >= filterMinScore);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.content?.toLowerCase().includes(q) ||
        s.id?.toLowerCase().includes(q) ||
        s.source?.collisionType?.toLowerCase().includes(q)
      );
    }
    if (sortBy === 'score') list.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    else if (sortBy === 'domain') list.sort((a, b) => (a.source?.domains?.[0] ?? '').localeCompare(b.source?.domains?.[0] ?? ''));
    else if (sortBy === 'date') list.sort((a, b) => (b.promotedAt ?? '').localeCompare(a.promotedAt ?? ''));
    return list;
  }, [seeds, filterDomain, filterMinScore, search, sortBy]);

  // Score distribution for the mini histogram
  const scoreDist = useMemo(() => {
    const buckets = { high: 0, mid: 0, low: 0 };
    for (const s of seeds) {
      const sc = s.score ?? 0;
      if (sc >= 6) buckets.high++;
      else if (sc >= 4) buckets.mid++;
      else buckets.low++;
    }
    return buckets;
  }, [seeds]);

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--sinter-muted)', fontFamily: 'var(--font-body)' }}>
        Loading seeds...
      </div>
    );
  }

  if (error) {
    return (
      <div className="sinter-alert sinter-alert--warn">
        Could not load seeds: {error}. Run <code>sinter compost digest</code> first.
      </div>
    );
  }

  const expanded = expandedId ? seeds.find(s => s.id === expandedId) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 960 }}>
      {/* Stats bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: 12,
      }}>
        {[
          { label: 'Total seeds', value: seeds.length, color: 'var(--sinter-cyan)' },
          { label: 'High (6+)', value: scoreDist.high, color: 'var(--sinter-code-green)' },
          { label: 'Mid (4-6)', value: scoreDist.mid, color: 'var(--sinter-code-blue)' },
          { label: 'Low (<4)', value: scoreDist.low, color: 'var(--sinter-code-gold)' },
          { label: 'Domains', value: domains.length - 1, color: 'var(--sinter-muted)' },
        ].map(stat => (
          <div key={stat.label} className="sinter-panel" style={{ padding: '12px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: 'var(--sinter-muted)', marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="sinter-panel" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search content, tags..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="sinter-input"
            style={{ flex: 1, minWidth: 160 }}
          />
          <select
            value={filterDomain}
            onChange={e => setFilterDomain(e.target.value)}
            className="sinter-select"
            style={{ width: 'auto', minWidth: 100 }}
          >
            {domains.map(d => (
              <option key={d} value={d}>{d === 'all' ? 'All domains' : d}</option>
            ))}
          </select>
          <select
            value={filterMinScore}
            onChange={e => setFilterMinScore(Number(e.target.value))}
            className="sinter-select"
            style={{ width: 'auto', minWidth: 80 }}
          >
            <option value={0}>Score: all</option>
            <option value={4}>Score: 4+</option>
            <option value={5}>Score: 5+</option>
            <option value={6}>Score: 6+</option>
            <option value={7}>Score: 7+</option>
          </select>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as 'score' | 'domain' | 'date')}
            className="sinter-select"
            style={{ width: 'auto', minWidth: 100 }}
          >
            <option value="score">Sort: score</option>
            <option value="domain">Sort: domain</option>
            <option value="date">Sort: date</option>
          </select>
          <span style={{ fontSize: 12, color: 'var(--sinter-muted)' }}>
            {filtered.length} of {seeds.length}
          </span>
        </div>
      </div>

      {/* Expanded seed detail */}
      {expanded && (
        <div className="sinter-panel sinter-panel--raised" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 className="sinter-heading" style={{ margin: 0 }}>
              <span style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: DOMAIN_COLORS[expanded.source?.domains?.[0] ?? 'unknown'],
                marginRight: 8,
              }} />
              {expanded.id}
            </h3>
            <button type="button" onClick={() => setExpandedId(null)} className="sinter-btn sinter-btn--secondary" style={{ padding: '4px 10px', fontSize: 12 }}>
              Close
            </button>
          </div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap', fontSize: 13 }}>
            <span>Score: <strong style={{ color: scoreColor(expanded.score ?? 0) }}>{(expanded.score ?? 0).toFixed(1)}</strong></span>
            <span>Domains: <strong>{expanded.source?.domains?.join(', ') ?? '?'}</strong></span>
            <span>Collision: <strong>{expanded.source?.collisionType ?? '?'}</strong></span>
            {expanded.promotedAt && <span>Promoted: <strong>{new Date(expanded.promotedAt).toLocaleDateString()}</strong></span>}
            {expanded.useCount > 0 && <span>Used: <strong>{expanded.useCount}x</strong></span>}
          </div>
          {expanded.source?.fragments && expanded.source.fragments.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {expanded.source.fragments.map(frag => (
                <span key={frag} style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid var(--sinter-line)',
                  borderRadius: 4,
                  padding: '2px 8px',
                  fontSize: 11,
                  color: 'var(--sinter-muted)',
                }}>
                  {frag.slice(0, 20)}
                </span>
              ))}
            </div>
          )}
          <pre className="sinter-code" style={{ maxHeight: 320, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {expanded.content ?? '(no content)'}
          </pre>
        </div>
      )}

      {/* Seed list */}
      <div style={{ maxHeight: 500, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--sinter-muted)', padding: 24 }}>
            No seeds match your filters.
          </div>
        )}
        {filtered.map(seed => {
          const score = seed.score ?? 0;
          const preview = (seed.content ?? '').slice(0, 140);
          const primaryDomain = seed.source?.domains?.[0] ?? 'unknown';
          return (
            <button
              key={seed.id}
              type="button"
              onClick={() => setExpandedId(expandedId === seed.id ? null : seed.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                background: expandedId === seed.id ? 'var(--sinter-cyan-dim)' : 'var(--sinter-surface-1)',
                border: '1px solid var(--sinter-line)',
                borderRadius: 'var(--sinter-radius-sm)',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                fontFamily: 'var(--font-body)',
                color: 'var(--sinter-text)',
                transition: 'background 0.15s',
              }}
            >
              <span style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: DOMAIN_COLORS[primaryDomain],
                flexShrink: 0,
              }} />
              <span style={{
                fontWeight: 600,
                fontSize: 13,
                minWidth: 44,
                color: scoreColor(score),
                textAlign: 'right',
                flexShrink: 0,
              }}>
                {score.toFixed(1)}
              </span>
              <span style={{
                fontSize: 12,
                color: 'var(--sinter-muted)',
                minWidth: 60,
                flexShrink: 0,
                textTransform: 'uppercase',
              }}>
                {seed.source?.domains?.join('+') ?? '?'}
              </span>
              <span style={{
                fontSize: 13,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                minWidth: 0,
              }}>
                {preview || '(empty)'}
              </span>
              {seed.source?.collisionType && (
                <span style={{
                  fontSize: 10,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--sinter-line)',
                  borderRadius: 4,
                  padding: '2px 6px',
                  color: 'var(--sinter-muted)',
                  flexShrink: 0,
                }}>
                  {seed.source.collisionType}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
