<script lang="ts">
  import { FIPS2STATE } from '$lib/data/aqi';
  import { createEventDispatcher } from 'svelte';
  import type { ExtraScoreMaps } from '$lib/data/scores_extra';

  type Option = { id: string; label: string };

  export let mode: 'states' | 'counties' = 'states';

  export let lockedId: string | null = null;
  export type LockedSlot = { id: string; color: string; index: number };
  export let lockedSlots: LockedSlot[] = [];

  export let maxHeight: number | null = null;

  export let weights: Record<string, Record<string, number>> | null = null;

  export let scoreAQI: Map<string, number> | null = null;
  export let scoreAfford: Map<string, number> | null = null;
  export let scoreEmploy: Map<string, number> | null = null;

  export let scoreAQIState: Map<string, number> | null = null;
  export let scoreAffordState: Map<string, number> | null = null;
  export let scoreEmployState: Map<string, number> | null = null;

  export let optionsState: Option[] = [];
  export let optionsCounty: Option[] = [];

  export let extraScoreMaps: ExtraScoreMaps | null = null;
  export let extraScoreMapsState: ExtraScoreMaps | null = null;

  const dispatch = createEventDispatcher();

  const FIPS2ABBR: Record<string, string> = {
    '01': 'AL',
    '02': 'AK',
    '04': 'AZ',
    '05': 'AR',
    '06': 'CA',
    '08': 'CO',
    '09': 'CT',
    '10': 'DE',
    '11': 'DC',
    '12': 'FL',
    '13': 'GA',
    '15': 'HI',
    '16': 'ID',
    '17': 'IL',
    '18': 'IN',
    '19': 'IA',
    '20': 'KS',
    '21': 'KY',
    '22': 'LA',
    '23': 'ME',
    '24': 'MD',
    '25': 'MA',
    '26': 'MI',
    '27': 'MN',
    '28': 'MS',
    '29': 'MO',
    '30': 'MT',
    '31': 'NE',
    '32': 'NV',
    '33': 'NH',
    '34': 'NJ',
    '35': 'NM',
    '36': 'NY',
    '37': 'NC',
    '38': 'ND',
    '39': 'OH',
    '40': 'OK',
    '41': 'OR',
    '42': 'PA',
    '44': 'RI',
    '45': 'SC',
    '46': 'SD',
    '47': 'TN',
    '48': 'TX',
    '49': 'UT',
    '50': 'VT',
    '51': 'VA',
    '53': 'WA',
    '54': 'WV',
    '55': 'WI',
    '56': 'WY',
    '72': 'PR'
  };

  const EXTRA_STATS = [
    { cat: 'environment', sub: 'greenery',    col: 'score_greenery' },
    { cat: 'environment', sub: 'industry',    col: 'score_industry' },
    { cat: 'health',      sub: 'healthcare',  col: 'score_healthcare' },
    { cat: 'housing',     sub: 'safety',      col: 'score_safety' },
    { cat: 'opportunities', sub: 'education', col: 'score_education' },
    { cat: 'engagement',  sub: 'events',      col: 'score_events' },
    { cat: 'transport',   sub: 'walk',        col: 'score_walk' }
  ];

  function getWeights() {
    const wAQI = Number(weights?.health?.pollution ?? 0);
    const wAff = Number(weights?.housing?.afford ?? 0);
    const wEmploy = Number(weights?.opportunities?.unemployment ?? 0);
    return { wAQI, wAff, wEmploy };
  }

  type Row = {
    id: string;
    label: string;
    total: number | null;
  };

  function labelForId(id: string): string {
    if (mode === 'states') {
      return FIPS2STATE[id] ?? id;
    }
    const opt = optionsCounty.find((o) => o.id === id);
    if (!opt) return id;

    const ss = id.slice(0, 2);
    const ab = FIPS2ABBR[ss] ?? ss;
    const parts = opt.label.split(' — ');
    const stateName = parts[0] ?? '';
    const countyName = parts[1] ?? '';

    const county = countyName || stateName || id;
    return `${county}, ${ab}`;
  }

  function totalForId(id: string): number | null {
    const { wAQI, wAff, wEmploy } = getWeights();

    let aqi: number | null = null;
    let aff: number | null = null;
    let emp: number | null = null;

    if (mode === 'states') {
      const ss = id.slice(0, 2);
      aqi = scoreAQIState?.get(ss) ?? null;
      aff = scoreAffordState?.get(ss) ?? null;
      emp = scoreEmployState?.get(ss) ?? null;
    } else {
      const fips5 = id;
      aqi = scoreAQI?.get(fips5) ?? null;
      aff = scoreAfford?.get(fips5) ?? null;
      emp = scoreEmploy?.get(fips5) ?? null;
    }

    let num = 0;
    let den = 0;

    for (const [w, v] of [
      [wAQI, aqi],
      [wAff, aff],
      [wEmploy, emp]
    ] as Array<[number, number | null]>) {
      if (v != null && isFinite(v) && w !== 0) {
        num += w * v;
        den += Math.abs(w);
      }
    }

    const maps = mode === 'states' ? extraScoreMapsState : extraScoreMaps;
    if (maps && weights) {
      const key = mode === 'states' ? id.slice(0, 2) : id;
      for (const spec of EXTRA_STATS) {
        const w = Number(weights[spec.cat]?.[spec.sub] ?? 0);
        if (!w) continue;
        const colMap = maps[spec.col];
        if (!colMap) continue;
        const v = colMap.get(key);
        if (v == null || !isFinite(v)) continue;
        num += w * v;
        den += Math.abs(w);
      }
    }

    if (den === 0) return null;
    return Math.max(-100, Math.min(100, num / den));
  }

  function buildRows(): Row[] {
    const source = mode === 'states' ? optionsState : optionsCounty;
    const rows: Row[] = source.map((o) => {
      const total = totalForId(o.id);
      return {
        id: o.id,
        label: labelForId(o.id),
        total
      };
    });

    rows.sort((a, b) => {
      if (a.total == null && b.total == null) return 0;
      if (a.total == null) return 1;
      if (b.total == null) return -1;
      return b.total - a.total;
    });

    return rows;
  }

  let rows: Row[] = [];
  let top3: Row[] = [];

  $: {
    mode;
    weights;
    scoreAQI;
    scoreAfford;
    scoreEmploy;
    scoreAQIState;
    scoreAffordState;
    scoreEmployState;
    optionsState;
    optionsCounty;
    extraScoreMaps;
    extraScoreMapsState;

    rows = buildRows();
    top3 = rows.slice(0, 3);
  }

  function onRowEnter(r: Row) {
    dispatch('hover', {
      id: r.id,
      label: r.label
    });
  }

  function onLeave() {
    dispatch('hover', { id: null });
  }

  function onRowClick(r: Row) {
    dispatch('lock', { id: r.id, label: r.label });
  }
</script>

<style>
  .ranking {
    box-sizing: border-box;
    border: 1px solid #a8a8a8ff;
    border-radius: 10px;
    background: #fff;
    padding: 10px;
    height: 160px;
    max-height: 300px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .title {
    font: 600 14px/1.2 system-ui;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .list {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .row {
    display: grid;
    grid-template-columns: 26px 1fr 60px;
    gap: 8px;
    align-items: center;
    padding: 6px 6px;
    border-radius: 8px;
    border: 1px solid transparent;
    cursor: pointer;
    font-size: 15px;
  }

  .row:hover {
    background: #f3f4f6;
    border-color: #a8a8a8ff;
  }

  .icon-slot {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon-slot svg {
    width: 18px;
    height: 18px;
    display: block;
  }

  .name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .score {
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
</style>

<div class="ranking" on:mouseleave={onLeave}>
  <div class="title">
    {mode === 'states'
      ? 'Most Recommended States'
      : 'Most Recommended Counties'}
  </div>

  <div class="list">
    {#if top3.length === 0}
      <div class="row" style="cursor: default;">
        <div class="icon-slot"></div>
        <div class="name">No data</div>
        <div class="score">—</div>
      </div>
    {:else}
      {#each top3 as r, i (r.id)}
        <div
          class="row"
          on:mouseenter={() => onRowEnter(r)}
          on:click={() => onRowClick(r)}
          title={r.label}
        >
          <div class="icon-slot">
            {#if i === 0}
              <!-- gold -->
              <svg
                t="1765312770350"
                class="icon"
                viewBox="0 0 1024 1024"
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                p-id="1618"
              >
                <path
                  d="M596.45 462.32c52.43 0 103.59-0.28 154.74 0.22 11.18 0.11 22.81 1.53 33.4 4.94 35.5 11.45 59.12 52.39 51.18 89.82-18.86 88.93-39.02 177.58-57.73 266.54-5.21 24.77-12.05 47.63-33.65 63.25-11.88 8.59-24.21 15.37-39.6 15.36-136-0.12-272.01-0.05-408.01-0.05-1.92 0-3.84-0.26-7.18-0.51-0.25-4.18-0.72-8.27-0.72-12.36 0.14-130.53 0.4-261.06 0.34-391.59 0-8.61 2.13-11.74 11.25-13.22 75.59-12.23 138.48-81.59 144.34-158.02 1.61-20.93 1.75-41.89 10.68-61.89 23.22-51.98 86.22-54.45 119.89-23.09 15.76 14.68 24.43 32.93 28.16 53.99 9.54 53.85 8.32 107.21-6.38 160.08-0.41 1.45-0.35 3.03-0.71 6.53z m-347.61 61.44c-0.07-22.16-11.89-34.99-33.48-35.43-28.5-0.58-57.04-0.63-85.54 0.04-20.49 0.49-32.6 13.15-32.64 33.69-0.2 115.63-0.21 231.26 0.01 346.89 0.04 21.15 12.76 33.26 33.87 33.42 26.56 0.2 53.13 0.1 79.69 0.05 26.8-0.05 38.13-11.56 38.15-38.81 0.04-56.25 0.01-112.5 0.01-168.76-0.01-57.02 0.1-114.06-0.07-171.09z m464.22-128.85c21.53-8.8 42.95-17.89 64.68-26.14 4.53-1.72 10.82-1.83 15.31-0.12 21.72 8.28 43.11 17.45 64.62 26.29 16.84 6.92 23.63 1.93 22.15-16.07-1.89-22.85-4.07-45.69-5.12-68.58-0.25-5.48 2.18-12.19 5.64-16.53 14.5-18.21 29.9-35.69 44.87-53.52 10.04-11.97 7.56-20.28-7.4-24.02-22.91-5.73-46-10.72-68.79-16.88-5.01-1.35-10.46-5.34-13.31-9.68-13.17-20.02-25.41-40.64-38.14-60.94-7.88-12.57-16.62-12.66-24.35-0.2-12.46 20.07-24.95 40.13-36.85 60.52-3.67 6.29-8.31 9.39-15.17 10.95-23.03 5.21-45.99 10.71-68.91 16.4-14.78 3.67-17.17 11.54-7.33 23.15 15.06 17.76 29.86 35.76 45.5 52.99 5.82 6.41 6.91 12.76 6.11 20.77-2.2 22.12-3.83 44.3-5.68 66.45-0.78 17.59 5.57 21.94 22.17 15.16z"
                  p-id="1619"
                  fill="#FFD700"
                ></path>
              </svg>
            {:else if i === 1}
              <!-- blue -->
              <svg
                t="1765312770350"
                class="icon"
                viewBox="0 0 1024 1024"
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                p-id="1618"
              >
                <path
                  d="M596.45 462.32c52.43 0 103.59-0.28 154.74 0.22 11.18 0.11 22.81 1.53 33.4 4.94 35.5 11.45 59.12 52.39 51.18 89.82-18.86 88.93-39.02 177.58-57.73 266.54-5.21 24.77-12.05 47.63-33.65 63.25-11.88 8.59-24.21 15.37-39.6 15.36-136-0.12-272.01-0.05-408.01-0.05-1.92 0-3.84-0.26-7.18-0.51-0.25-4.18-0.72-8.27-0.72-12.36 0.14-130.53 0.4-261.06 0.34-391.59 0-8.61 2.13-11.74 11.25-13.22 75.59-12.23 138.48-81.59 144.34-158.02 1.61-20.93 1.75-41.89 10.68-61.89 23.22-51.98 86.22-54.45 119.89-23.09 15.76 14.68 24.43 32.93 28.16 53.99 9.54 53.85 8.32 107.21-6.38 160.08-0.41 1.45-0.35 3.03-0.71 6.53z m-347.61 61.44c-0.07-22.16-11.89-34.99-33.48-35.43-28.5-0.58-57.04-0.63-85.54 0.04-20.49 0.49-32.6 13.15-32.64 33.69-0.2 115.63-0.21 231.26 0.01 346.89 0.04 21.15 12.76 33.26 33.87 33.42 26.56 0.2 53.13 0.1 79.69 0.05 26.8-0.05 38.13-11.56 38.15-38.81 0.04-56.25 0.01-112.5 0.01-168.76-0.01-57.02 0.1-114.06-0.07-171.09z m464.22-128.85c21.53-8.8 42.95-17.89 64.68-26.14 4.53-1.72 10.82-1.83 15.31-0.12 21.72 8.28 43.11 17.45 64.62 26.29 16.84 6.92 23.63 1.93 22.15-16.07-1.89-22.85-4.07-45.69-5.12-68.58-0.25-5.48 2.18-12.19 5.64-16.53 14.5-18.21 29.9-35.69 44.87-53.52 10.04-11.97 7.56-20.28-7.4-24.02-22.91-5.73-46-10.72-68.79-16.88-5.01-1.35-10.46-5.34-13.31-9.68-13.17-20.02-25.41-40.64-38.14-60.94-7.88-12.57-16.62-12.66-24.35-0.2-12.46 20.07-24.95 40.13-36.85 60.52-3.67 6.29-8.31 9.39-15.17 10.95-23.03 5.21-45.99 10.71-68.91 16.4-14.78 3.67-17.17 11.54-7.33 23.15 15.06 17.76 29.86 35.76 45.5 52.99 5.82 6.41 6.91 12.76 6.11 20.77-2.2 22.12-3.83 44.3-5.68 66.45-0.78 17.59 5.57 21.94 22.17 15.16z"
                  p-id="1619"
                  fill="#1296db"
                ></path>
              </svg>
            {:else}
              <!-- bronze -->
              <svg
                t="1765312770350"
                class="icon"
                viewBox="0 0 1024 1024"
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                p-id="1618"
              >
                <path
                  d="M596.45 462.32c52.43 0 103.59-0.28 154.74 0.22 11.18 0.11 22.81 1.53 33.4 4.94 35.5 11.45 59.12 52.39 51.18 89.82-18.86 88.93-39.02 177.58-57.73 266.54-5.21 24.77-12.05 47.63-33.65 63.25-11.88 8.59-24.21 15.37-39.6 15.36-136-0.12-272.01-0.05-408.01-0.05-1.92 0-3.84-0.26-7.18-0.51-0.25-4.18-0.72-8.27-0.72-12.36 0.14-130.53 0.4-261.06 0.34-391.59 0-8.61 2.13-11.74 11.25-13.22 75.59-12.23 138.48-81.59 144.34-158.02 1.61-20.93 1.75-41.89 10.68-61.89 23.22-51.98 86.22-54.45 119.89-23.09 15.76 14.68 24.43 32.93 28.16 53.99 9.54 53.85 8.32 107.21-6.38 160.08-0.41 1.45-0.35 3.03-0.71 6.53z m-347.61 61.44c-0.07-22.16-11.89-34.99-33.48-35.43-28.5-0.58-57.04-0.63-85.54 0.04-20.49 0.49-32.6 13.15-32.64 33.69-0.2 115.63-0.21 231.26 0.01 346.89 0.04 21.15 12.76 33.26 33.87 33.42 26.56 0.2 53.13 0.1 79.69 0.05 26.8-0.05 38.13-11.56 38.15-38.81 0.04-56.25 0.01-112.5 0.01-168.76-0.01-57.02 0.1-114.06-0.07-171.09z m464.22-128.85c21.53-8.8 42.95-17.89 64.68-26.14 4.53-1.72 10.82-1.83 15.31-0.12 21.72 8.28 43.11 17.45 64.62 26.29 16.84 6.92 23.63 1.93 22.15-16.07-1.89-22.85-4.07-45.69-5.12-68.58-0.25-5.48 2.18-12.19 5.64-16.53 14.5-18.21 29.9-35.69 44.87-53.52 10.04-11.97 7.56-20.28-7.4-24.02-22.91-5.73-46-10.72-68.79-16.88-5.01-1.35-10.46-5.34-13.31-9.68-13.17-20.02-25.41-40.64-38.14-60.94-7.88-12.57-16.62-12.66-24.35-0.2-12.46 20.07-24.95 40.13-36.85 60.52-3.67 6.29-8.31 9.39-15.17 10.95-23.03 5.21-45.99 10.71-68.91 16.4-14.78 3.67-17.17 11.54-7.33 23.15 15.06 17.76 29.86 35.76 45.5 52.99 5.82 6.41 6.91 12.76 6.11 20.77-2.2 22.12-3.83 44.3-5.68 66.45-0.78 17.59 5.57 21.94 22.17 15.16z"
                  p-id="1619"
                  fill="#b87333"
                ></path>
              </svg>
            {/if}
          </div>

          <div class="name">{r.label}</div>
          <div class="score">
            {r.total == null ? '—' : r.total.toFixed(1)}
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>
