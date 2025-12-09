// src/lib/data/scores.ts
import * as d3 from 'd3';

/* ---------- parsing helpers ---------- */
const pad5 = (x: any) => String(x ?? '').padStart(5, '0');

const toNum = (v: any): number | null => {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

const toPct01 = (v: any): number | null => {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  if (s === '-1' || s.toUpperCase() === 'N/A') return null;
  if (s.endsWith('%')) {
    const n = Number(s.slice(0, -1).replace(/,/g, ''));
    return Number.isFinite(n) ? n / 100 : null;
  }
  const n = Number(s.replace(/,/g, ''));
  // if it looks like a whole percent (e.g., 3.7), treat as %; else assume 0..1
  if (Number.isFinite(n)) return n > 1 ? n / 100 : n;
  return null;
};

const toCurrency = (v: any): number | null => {
  if (v == null || v === '') return null;
  const s = String(v).replace(/\$/g, '').replace(/,/g, '').trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const canon = (s: string) => s.replace(/\s+/g, '').toUpperCase();
const pickKey = (row: any, candidates: string[]): string | null => {
  const keys = Object.keys(row ?? {});
  const want = new Set(candidates.map(canon));
  for (const k of keys) if (want.has(canon(k))) return k;
  return null;
};

/* ---------- scoring helpers (0..100, higher = better) ---------- */

// AQI: column is % Good in [0..1] or [0..100%] → convert to [0..100]
const scoreAQIFromPctGood = (pctGood01: number | null): number | null =>
  pctGood01 == null ? null : Math.max(0, Math.min(100, pctGood01 * 100));

// Affordability: r = (income - cost) / cost  -> clamp [-0.5, 1.0] -> 0..100
//   -50% (cost >> income) => 0
//   +100% (income = 2x cost) => 100
const scoreAffordability = (income: number | null, cost: number | null): number | null => {
  if (income == null || cost == null || cost <= 0) return null;
  const r = (income - cost) / cost;            // could be negative
  const rc = Math.min(0.5, Math.max(-0.5, r)); // clamp
  return ((rc + 0.5) / 1.5) * 100;             // map [-0.5,1.0] -> [0,100]
};

// Unemployment u in [0..1]: lower is better → convert to an EMPLOYMENT score [0..100]
// Log curve so high unemployment is penalized more; cap at 20%.
const scoreEmploymentFromUnemployment = (u01: number | null, cap = 0.10, k = 8): number | null => {
  if (u01 == null || u01 < 0) return null;
  const u = Math.min(u01, cap);
  const score = 100 * (1 - Math.log1p(k * u) / Math.log1p(k * cap));
  return Math.max(0, Math.min(100, score));
};

/* ---------- main loader returning SCORE maps ---------- */
export async function loadScoreMaps(csvUrl: string): Promise<{
  scoreAQIByFips: Map<string, number>;        // FIPS -> 0..100
  scoreAffordByFips: Map<string, number>;     // FIPS -> 0..100
  scoreEmployByFips: Map<string, number>;     // FIPS -> 0..100  (already “higher=better”)
}> {
  const rows: any[] = await d3.csv(csvUrl);
  const outAQI  = new Map<string, number>();
  const outAff  = new Map<string, number>();
  const outEmp  = new Map<string, number>();

  if (!rows.length) {
    return { scoreAQIByFips: outAQI, scoreAffordByFips: outAff, scoreEmployByFips: outEmp };
  }

  // Header variants covered by screenshots
  const kFIPS  = pickKey(rows[0], ['FIPS', 'FIPS Code'])!;
  const kAQI   = pickKey(rows[0], ['AQI%Good', 'AQI % Good', 'AQI_Good'])!;
  const kInc   = pickKey(rows[0], ['2022 Median Income', 'Median Income'])!;
  const kCost  = pickKey(rows[0], ['Cost of Living', 'CostOfLiving'])!;
  const kUnemp = pickKey(rows[0], ['Unemployment', 'Unemployment Rate'])!;

  for (const r of rows) {
    const fips5 = pad5(r[kFIPS]);
    if (!fips5) continue;

    // AQI % good
    const pctGood01 = toPct01(r[kAQI]);
    const scoreAQI  = scoreAQIFromPctGood(pctGood01);
    if (scoreAQI != null) outAQI.set(fips5, scoreAQI);

    // Affordability
    const income = toCurrency(r[kInc]);
    const cost   = toCurrency(r[kCost]);
    const scoreA = scoreAffordability(income, cost);
    if (scoreA != null) outAff.set(fips5, scoreA);

    // Employment (from unemployment)
    const u01    = toPct01(r[kUnemp]); // accepts "3.2%" or 0.032 or 3.2
    const scoreE = scoreEmploymentFromUnemployment(u01);
    if (scoreE != null) outEmp.set(fips5, scoreE);
  }

  // IMPORTANT: return name matches page.svelte destructuring
  return { scoreAQIByFips: outAQI, scoreAffordByFips: outAff, scoreEmployByFips: outEmp };
}