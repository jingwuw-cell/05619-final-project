// src/lib/data/aqi.ts
import * as d3 from 'd3';

function norm(s: string): string {
  return String(s ?? '').trim().toUpperCase();
}
function normalizeCountyName(raw: string): string {
  let s = norm(raw);
  const suffixes = [
    ' COUNTY', ' PARISH', ' BOROUGH', ' CENSUS AREA', ' MUNICIPALITY',
    ' CITY AND BOROUGH', ' MUNICIPIO'
  ];
  for (const suf of suffixes) {
    if (s.endsWith(suf)) { s = s.slice(0, -suf.length); break; }
  }
  return s;
}

function pick<T extends object>(r: T, keys: string[]): any {
  for (const k of keys) if ((r as any)[k] != null) return (r as any)[k];
  return undefined;
}

// NEW: helpers to pad FIPS
function pad2(x: any) { return String(x ?? '').padStart(2, '0'); }
function pad3(x: any) { return String(x ?? '').padStart(3, '0'); }

export async function loadAQIFromCsv(csvUrl: string): Promise<{
  stateAQIByName: Map<string, number>,            // now keyed by 2-digit state FIPS "SS"
  countyAQIByStateCounty: Map<string, number>     // now keyed by 5-digit county FIPS "SSCCC"
}> {
  const rows = await d3.csv(csvUrl);

  const stateVals = new Map<string, number[]>();   // key: SS
  const countyVals = new Map<string, number[]>();  // key: SSCCC

  for (const r of rows) {
    // Use codes instead of names
    const stCodeRaw = (r as any)['State Code'];
    const coCodeRaw = (r as any)['County Code'];
    const aqiRaw    = (r as any)['AQI'];

    const ss  = pad2(stCodeRaw);
    const ccc = pad3(coCodeRaw);
    const aqi = Number(aqiRaw);

    if (!ss || !ccc || !Number.isFinite(aqi)) continue;

    // aggregate state by SS
    if (!stateVals.has(ss)) stateVals.set(ss, []);
    stateVals.get(ss)!.push(aqi);

    // aggregate county by SSCCC
    const fips5 = ss + ccc;
    if (!countyVals.has(fips5)) countyVals.set(fips5, []);
    countyVals.get(fips5)!.push(aqi);
  }

  const stateAQIByName = new Map<string, number>();
  for (const [ss, arr] of stateVals) stateAQIByName.set(ss, d3.mean(arr)!);

  const countyAQIByStateCounty = new Map<string, number>();
  for (const [fips5, arr] of countyVals) countyAQIByStateCounty.set(fips5, d3.mean(arr)!);

  return { stateAQIByName, countyAQIByStateCounty };
}

export function makeCountyKey(stateName: string, countyName: string): string {
  // Kept for compatibility (not used when you key by codes)
  return `${norm(stateName)}||${normalizeCountyName(countyName)}`;
}

export const FIPS2STATE: Record<string, string> = {
  '01':'ALABAMA','02':'ALASKA','04':'ARIZONA','05':'ARKANSAS','06':'CALIFORNIA','08':'COLORADO',
  '09':'CONNECTICUT','10':'DELAWARE','11':'DISTRICT OF COLUMBIA','12':'FLORIDA','13':'GEORGIA',
  '15':'HAWAII','16':'IDAHO','17':'ILLINOIS','18':'INDIANA','19':'IOWA','20':'KANSAS','21':'KENTUCKY',
  '22':'LOUISIANA','23':'MAINE','24':'MARYLAND','25':'MASSACHUSETTS','26':'MICHIGAN','27':'MINNESOTA',
  '28':'MISSISSIPPI','29':'MISSOURI','30':'MONTANA','31':'NEBRASKA','32':'NEVADA','33':'NEW HAMPSHIRE',
  '34':'NEW JERSEY','35':'NEW MEXICO','36':'NEW YORK','37':'NORTH CAROLINA','38':'NORTH DAKOTA','39':'OHIO',
  '40':'OKLAHOMA','41':'OREGON','42':'PENNSYLVANIA','44':'RHODE ISLAND','45':'SOUTH CAROLINA',
  '46':'SOUTH DAKOTA','47':'TENNESSEE','48':'TEXAS','49':'UTAH','50':'VERMONT','51':'VIRGINIA',
  '53':'WASHINGTON','54':'WEST VIRGINIA','55':'WISCONSIN','56':'WYOMING','72':'PUERTO RICO'
};

/** Logarithmic AQI → Score (0–100). 
 *  Anything >300 → 0,  anything ≤0 → 100.
 *  Below 300, uses a log-based smooth falloff.
 */
export function aqiToScore(aqi: number | null | undefined): number | null {
  if (aqi == null || !isFinite(+aqi)) return null;
  const x = +aqi;

  // Clamp range
  if (x >= 300) return 0;
  if (x <= 0) return 100;

  // Logarithmic mapping: score decays as log(AQI)
  // Adjust scale to roughly match human perception:
  // AQI=25 ≈ 90+, 100 ≈ 60–70, 200 ≈ 30, 300 ≈ 0
  const a = 0.03;                 // scaling factor
  const logFactor = Math.log1p(a * x); // log(1 + a*x)
  const maxLog = Math.log1p(a * 300);  // normalization base
  const score = 100 * (1 - logFactor / maxLog);

  return Math.max(0, Math.min(100, score));
}