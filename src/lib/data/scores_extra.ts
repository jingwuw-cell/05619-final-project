import * as d3 from 'd3';

export type ExtraScoreMaps = Record<string, Map<string, number>>;

export async function loadExtraScoreMaps(csvUrl: string): Promise<ExtraScoreMaps> {
  const rows = await d3.csv(csvUrl);

  if (!rows.length) return {};

  const colNames = rows.columns.filter((c) => c && c !== 'FIPS');

  const maps: ExtraScoreMaps = {};
  for (const name of colNames) {
    maps[name] = new Map<string, number>();
  }

for (const row of rows as any[]) {
  const fipsRaw = row.FIPS;
  if (!fipsRaw) continue;

  let fips = String(fipsRaw).trim();
  if (!fips) continue;

  // 关键：补前导 0，保证是 5 位 FIPS
  if (fips.length < 5) {
    fips = fips.padStart(5, '0');
  }

  for (const name of colNames) {
    const raw = row[name];
    if (raw == null || raw === '') continue;
    const v = +raw;
    if (Number.isFinite(v)) {
      maps[name].set(fips, v);
    }
  }
}

  return maps;
}
