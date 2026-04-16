import type { CortexSnapshot, CortexGoal, RankedAction, CortexActionType } from './types.js';
const W_GOAL = 0.45; const W_WEAKNESS = 0.40; const W_RECENCY = 0.15;
interface WeaknessSignal { actionType: CortexActionType; urgency: number; reason: string; keywords: string[]; }
export class PriorityAllocator {
  rank(snapshot: CortexSnapshot, goals: CortexGoal[]): RankedAction[] {
    const weaknesses = this.detectWeaknesses(snapshot); if (weaknesses.length === 0) return [];
    const now = Date.now();
    return weaknesses.map((w) => { const goalScore = this.goalAlignment(w, goals); const total = W_GOAL * goalScore + W_WEAKNESS * w.urgency + W_RECENCY * this.recencyBonus(goals, now); return { actionType: w.actionType, score: Math.round(total * 1000) / 1000, reasoning: w.reason, goalIds: this.matchingGoalIds(w, goals), urgency: w.urgency }; }).sort((a, b) => b.score - a.score);
  }
  private detectWeaknesses(s: CortexSnapshot): WeaknessSignal[] {
    const sig: WeaknessSignal[] = []; const tp = s.taskPipeline; const lh = s.llmHealth; const st = s.scoreTrend;
    if (tp.acceptanceRate < 0.5) sig.push({ actionType: 'improve-coverage', urgency: 1 - tp.acceptanceRate, reason: 'Acceptance rate ' + Math.round(tp.acceptanceRate * 100) + '% is below 50%', keywords: ['coverage', 'test', 'quality'] });
    if (tp.failed > 3) { const top = Object.entries(tp.failureBreakdown).sort(([,a],[,b]) => b-a)[0]; sig.push({ actionType: 'fix-flaky-test', urgency: Math.min(1, tp.failed / 10), reason: tp.failed + ' failed tasks' + (top ? ' (' + top[0] + ': ' + top[1] + ')' : ''), keywords: ['test', 'flaky', 'failure', 'reliability'] }); }
    if (lh.avgLatencyMs > 3000) sig.push({ actionType: 'reduce-latency', urgency: Math.min(1, lh.avgLatencyMs / 10000), reason: 'LLM avg latency ' + Math.round(lh.avgLatencyMs) + 'ms', keywords: ['latency', 'performance', 'speed'] });
    for (const proc of s.activeProcesses) { const ageMs = Date.now() - new Date(proc.startedAt).getTime(); if (ageMs > 5 * 60 * 1000) sig.push({ actionType: 'resolve-stuck-worker', urgency: Math.min(1, ageMs / (15 * 60 * 1000)), reason: 'Process ' + proc.name + ' running for ' + Math.round(ageMs / 60000) + 'm', keywords: ['stuck', 'worker', 'process', proc.name.toLowerCase()] }); }
    if (st.scores.length >= 3) { const r = st.scores.slice(-3); if (r[0] > r[r.length - 1] && st.average < 0.6) sig.push({ actionType: 'increase-score', urgency: 1 - st.average, reason: 'Score declining, avg ' + Math.round(st.average * 100) + '%', keywords: ['score', 'quality', 'generation'] }); }
    return sig;
  }
  private goalAlignment(w: WeaknessSignal, goals: CortexGoal[]): number { if (goals.length === 0) return 0.5; let mx = 0; for (const g of goals) { const gt = g.text.toLowerCase(); const cm = this.categoryMatch(w.actionType, g.category); const km = w.keywords.some(kw => gt.includes(kw)) ? 0.3 : 0; mx = Math.max(mx, Math.min(1, cm + km)); } return mx; }
  private categoryMatch(at: CortexActionType, cat: string): number { const m: Record<string, string[]> = { 'improve-coverage': ['coverage', 'maintenance'], 'fix-flaky-test': ['reliability', 'maintenance'], 'reduce-latency': ['performance'], 'resolve-stuck-worker': ['reliability', 'maintenance'], 'increase-score': ['quality', 'feature'], 'custom': [] }; return m[at]?.includes(cat) ? 0.7 : 0; }
  private matchingGoalIds(w: WeaknessSignal, goals: CortexGoal[]): string[] { return goals.filter(g => w.keywords.some(kw => g.text.toLowerCase().includes(kw)) || this.categoryMatch(w.actionType, g.category) > 0).map(g => g.id); }
  private recencyBonus(goals: CortexGoal[], now: number): number { if (goals.length === 0) return 0; const newest = Math.max(...goals.map(g => new Date(g.createdAt).getTime())); return Math.max(0, 1 - (now - newest) / (1000 * 60 * 60 * 48)); }
}
