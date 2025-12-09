<script lang="ts">
  import * as d3 from 'd3';
  import * as topojson from 'topojson-client';
  import Main_chart from '$lib/Main_chart.svelte';
  import Weight from '$lib/Weight.svelte';
  import BarChart from '$lib/BarChart.svelte';
  import Ranking from '$lib/Ranking.svelte';
  import { base } from '$app/paths';
  import { onMount, onDestroy } from 'svelte';
  import { loadScoreMaps } from '$lib/data/scores';
  import { FIPS2STATE } from '$lib/data/aqi';
  import { loadExtraScoreMaps, type ExtraScoreMaps } from '$lib/data/scores_extra';
  import ScoringInfo from '$lib/ScoringInfo.svelte';
  import Title from '$lib/Title.svelte';

  type BarItem = { key: string; label: string; value: number | null };
  type Option = { id: string; label: string };

  type Slot = { id: string; label: string; color: string };

  type SearchModule = {
    query: string;
    suggestions: Option[];
    pending: Option | null;
  };

  type RegionBars = {
    id: string;
    label: string;
    color: string;
    values: BarItem[];
  };

  type LockedSlot = { id: string; color: string; index: number };

  const statesUrl = `${base}/data/states-10m.json`;
  const countiesUrl = `${base}/data/counties-10m.json`;
  const scoresCsvUrl = `${base}/data/attribute/scores.csv`;
  const scoresExtraCsvUrl = `${base}/data/attribute/scores_scaled.csv`;

  let mode: 'states' | 'counties' = 'states';
  $: currentUrl = mode === 'states' ? statesUrl : countiesUrl;
  $: currentObject = mode;

  const SLOT_COLORS = ['#2563eb', '#f97316', '#0ea5e9', '#ec4899', '#a855f7'];

  const aspect = 16 / 10;
  let leftCol: HTMLDivElement;
  let mapH = 300;
  let leftHeight = 0;
  let resizeObs: ResizeObserver | null = null;

  let scoreAQI: Map<string, number> | null = null;
  let scoreAfford: Map<string, number> | null = null;
  let scoreEmploy: Map<string, number> | null = null;

  let scoreAQIState: Map<string, number> | null = null;
  let scoreAffordState: Map<string, number> | null = null;
  let scoreEmployState: Map<string, number> | null = null;

  let weights: Record<string, Record<string, number>> | null = null;

  // preset passed down to Weight
  let presetWeights: Record<string, Record<string, number>> | null = null;

  let stateOptions: Option[] = [];
  let countyOptions: Option[] = [];

  let slots: Slot[] = [];

  let lockedSlots: LockedSlot[] = [];
  $: lockedSlots = slots.map((s, i) => ({
    id: s.id,
    color: s.color,
    index: i
  }));

  let lockedId: string | null = null;
  $: lockedId = slots.length ? slots[0].id : null;

  let barSeries: RegionBars[] = [];

  let searchModules: SearchModule[] = [
    { query: '', suggestions: [], pending: null }
  ];

  $: placeholder =
    mode === 'states' ? 'Find your state' : 'Find your county';

  let mapRef: any;
  let previewId: string | null = null;

  let extraScoreMaps: ExtraScoreMaps | null = null;
  let extraScoreMapsState: ExtraScoreMaps | null = null;

  const EXTRA_STATS = [
    { cat: 'environment', sub: 'greenery',    col: 'score_greenery',  label: 'Greenery (NDVI etc.)' },
    { cat: 'environment', sub: 'industry',    col: 'score_industry',  label: 'Industrial proximity' },
    { cat: 'health',      sub: 'healthcare',  col: 'score_healthcare', label: 'Access to healthcare' },
    { cat: 'housing',     sub: 'safety',      col: 'score_safety',    label: 'Safety / crime' },
    { cat: 'opportunities', sub: 'education', col: 'score_education', label: 'Education access' },
    { cat: 'engagement',  sub: 'events',      col: 'score_events',    label: 'Community events' },
    { cat: 'transport',   sub: 'walk',        col: 'score_walk',      label: 'Walkability' }
  ];

  function buildStateOptions() {
    stateOptions = Object.entries(FIPS2STATE).map(([ss, name]) => ({
      id: ss,
      label: name
    }));
  }

  async function buildCountyOptions() {
    const raw: any = await d3.json(countiesUrl);
    const geo: any =
      raw?.type === 'Topology'
        ? topojson.feature(raw, raw.objects?.counties)
        : raw;
    countyOptions = (geo.features || []).map((f: any) => {
      const fips5 = String(f.id ?? '');
      const ss = fips5.slice(0, 2);
      const stateName = FIPS2STATE[ss] ?? ss;
      const countyName = String(
        f.properties?.name ?? f.properties?.NAME ?? ''
      );
      return { id: fips5, label: `${stateName} — ${countyName}` };
    });
  }

  function pool() {
    return mode === 'states' ? stateOptions : countyOptions;
  }

  function getWeights() {
    const wAQI = Number(weights?.health?.pollution ?? 0);
    const wAff = Number(weights?.housing?.afford ?? 0);
    const wEmploy = Number(weights?.opportunities?.unemployment ?? 0);
    return { wAQI, wAff, wEmploy };
  }

  function computeMetricsById(id: string) {
    const { wAQI, wAff, wEmploy } = getWeights();
    let aqi: number | null;
    let aff: number | null;
    let emp: number | null;

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

    const total =
      den === 0 ? null : Math.max(-100, Math.min(100, num / den));

    return { total, aqi, afford: aff, employ: emp };
  }

  function extraBarItems(id: string): BarItem[] {
    if (!weights) return [];
    const items: BarItem[] = [];

    const maps =
      mode === 'states' ? extraScoreMapsState : extraScoreMaps;
    if (!maps) return items;

    const key = mode === 'states' ? id.slice(0, 2) : id;

    for (const spec of EXTRA_STATS) {
      const w = Number(weights[spec.cat]?.[spec.sub] ?? 0);
      if (!w) continue;
      const map = maps[spec.col];
      if (!map) continue;
      const v = map.get(key);
      if (v == null || !isFinite(v)) continue;
      items.push({
        key: spec.sub,
        label: spec.label,
        value: w * v
      });
    }
    return items;
  }

  function buildAllBarItems(id: string, m: {
    total: number | null;
    aqi: number | null;
    afford: number | null;
    employ: number | null;
  }): BarItem[] {
    const { wAQI, wAff, wEmploy } = getWeights();
    const cAQI = m.aqi == null || wAQI === 0 ? null : wAQI * m.aqi;
    const cAff = m.afford == null || wAff === 0 ? null : wAff * m.afford;
    const cEmp =
      m.employ == null || wEmploy === 0 ? null : wEmploy * m.employ;

    const parts: BarItem[] = [
      { key: 'aqi', label: 'Air quality (AQI)', value: cAQI },
      { key: 'afford', label: 'Affordability', value: cAff },
      { key: 'employ', label: 'Employment', value: cEmp }
    ];

    const extra = extraBarItems(id);
    parts.push(...extra);

    parts.push({
      key: 'tv',
      label: 'Total Score',
      value: m.total
    });

    return parts;
  }

  function recomputeBarSeries() {
    if (!slots.length) {
      return;
    }
    const updated: RegionBars[] = [];
    for (const s of slots) {
      const m = computeMetricsById(s.id);
      const values = buildAllBarItems(s.id, m);
      updated.push({
        id: s.id,
        label: s.label,
        color: s.color,
        values
      });
    }
    barSeries = updated;
  }

  function ensureModuleCount() {
    const lockedCount = slots.length;
    const need = lockedCount >= 5 ? 5 : lockedCount + 1;

    if (searchModules.length < need) {
      while (searchModules.length < need) {
        searchModules.push({
          query: '',
          suggestions: [],
          pending: null
        });
      }
    } else if (searchModules.length > need) {
      searchModules = searchModules.slice(0, need);
    }

    for (let i = 0; i < lockedCount; i++) {
      const slot = slots[i];
      searchModules[i] = {
        query: slot.label,
        suggestions: [],
        pending: null
      };
    }
  }

  $: ensureModuleCount();

  function updateModule(idx: number, fn: (m: SearchModule) => void) {
    const copy = [...searchModules];
    fn(copy[idx]);
    searchModules = copy;
  }

  function doSuggest(idx: number) {
    if (idx < slots.length) return;
    const all = pool();
    const m = searchModules[idx];
    const q = m.query.trim().toUpperCase();
    const suggestions = (q
      ? all.filter((o) => o.label.toUpperCase().includes(q))
      : all
    ).slice(0, 12);
    const exact = all.find((o) => o.label.toUpperCase() === q) || null;
    updateModule(idx, (mm) => {
      mm.suggestions = suggestions;
      mm.pending = exact;
    });
  }

  function choose(idx: number, opt: Option) {
    if (idx < slots.length) return;
    updateModule(idx, (m) => {
      m.query = opt.label;
      m.pending = opt;
      m.suggestions = [];
    });
  }

  function onEnter(idx: number) {
    if (idx < slots.length) return;
    const m = searchModules[idx];
    const all = pool();
    const q = m.query.trim().toUpperCase();
    const hit =
      m.pending ||
      (m.suggestions[0] ?? null) ||
      all.find((o) => o.label.toUpperCase() === q) ||
      null;
    if (hit) {
      lockRegion(hit.id, hit.label);
    }
  }

  function lockRegion(id: string, label: string) {
    const idx = slots.findIndex((s) => s.id === id);
    if (idx !== -1) {
      unlockRegion(id);
      return;
    }
    if (slots.length >= 5) {
      return;
    }
    const color = SLOT_COLORS[slots.length];
    slots = [...slots, { id, label, color }];
    recomputeBarSeries();

    ensureModuleCount();
    const lastIndex = slots.length;
    if (lastIndex < searchModules.length) {
      updateModule(lastIndex, (m) => {
        m.query = '';
        m.suggestions = [];
        m.pending = null;
      });
    }
  }

  function unlockRegion(id: string) {
    slots = slots.filter((s) => s.id !== id);
    slots = slots.map((s, i) => ({
      ...s,
      color: SLOT_COLORS[i]
    }));
    recomputeBarSeries();
    ensureModuleCount();

    const lockedCount = slots.length;
    const emptyIndex =
      lockedCount < 5 ? lockedCount : searchModules.length - 1;
    if (emptyIndex >= 0 && emptyIndex < searchModules.length) {
      updateModule(emptyIndex, (m) => {
        m.query = '';
        m.suggestions = [];
        m.pending = null;
      });
    }
  }

  function onLockClick(idx: number) {
    if (idx < slots.length) {
      const slot = slots[idx];
      unlockRegion(slot.id);
    } else {
      onEnter(idx);
    }
  }

  function onRegionHover(e: CustomEvent) {
    if (slots.length > 0) return;
    const detail = e.detail as {
      id: string | null;
      level: 'state' | 'county';
      stateName: string;
      countyName?: string;
    };
    const { id, level, stateName, countyName } = detail;
    if (!id) {
      barSeries = [];
      return;
    }
    const label =
      level === 'state'
        ? stateName
        : stateName
        ? `${stateName} — ${countyName ?? ''}`
        : countyName ?? '';
    const m = computeMetricsById(id);
    const values = buildAllBarItems(id, m);
    barSeries = [
      {
        id,
        label,
        color: '#6b7280',
        values
      }
    ];
  }

  function onRegionClick(e: CustomEvent) {
    const { id, label } = e.detail as { id: string; label: string };
    lockRegion(id, label);
  }

  function onRankHover(e: CustomEvent) {
    if (slots.length > 0) return;
    const { id, label } = e.detail as {
      id: string | null;
      label?: string;
    };
    previewId = id;
    if (!id) {
      barSeries = [];
      return;
    }
    const m = computeMetricsById(id);
    const values = buildAllBarItems(id, m);
    barSeries = [
      {
        id,
        label: label ?? '',
        color: '#6b7280',
        values
      }
    ];
  }

  function onRankLock(e: CustomEvent) {
    const { id, label } = e.detail as {
      id: string | null;
      label: string;
    };
    if (!id) return;
    lockRegion(id, label);
  }

  function onWeightsChange(e: CustomEvent) {
    weights = e.detail.weights;
    recomputeBarSeries();
  }

  function resetView() {
    mapRef?.resetView?.();
  }

  function groupCountyToStateMean(
    map: Map<string, number> | null
  ): Map<string, number> {
    const out = new Map<string, number>();
    if (!map) return out;
    const acc = new Map<string, number[]>();
    for (const [fips5, v] of map) {
      const ss = fips5.slice(0, 2);
      if (!acc.has(ss)) acc.set(ss, []);
      if (v != null && isFinite(v)) acc.get(ss)!.push(+v);
    }
    for (const [ss, arr] of acc)
      if (arr.length)
        out.set(
          ss,
          arr.reduce((a, b) => a + b, 0) / arr.length
        );
    return out;
  }

  function buildExtraStateMaps(src: ExtraScoreMaps | null): ExtraScoreMaps {
    const out: ExtraScoreMaps = {};
    if (!src) return out;
    for (const [col, mp] of Object.entries(src)) {
      const acc = new Map<string, number[]>();
      for (const [fips5, v] of mp) {
        if (v == null || !isFinite(v)) continue;
        const ss = fips5.slice(0, 2);
        if (!acc.has(ss)) acc.set(ss, []);
        acc.get(ss)!.push(v);
      }
      const agg = new Map<string, number>();
      for (const [ss, arr] of acc) {
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        agg.set(ss, mean);
      }
      out[col] = agg;
    }
    return out;
  }

  function onPresetSelect(e: CustomEvent) {
    presetWeights = e.detail.weights;
  }

  onMount(async () => {
    buildStateOptions();
    await buildCountyOptions();
    const { scoreAQIByFips, scoreAffordByFips, scoreEmployByFips } =
      await loadScoreMaps(scoresCsvUrl);
    scoreAQI = scoreAQIByFips;
    scoreAfford = scoreAffordByFips;
    scoreEmploy = scoreEmployByFips;
    scoreAQIState = groupCountyToStateMean(scoreAQI);
    scoreAffordState = groupCountyToStateMean(scoreAfford);
    scoreEmployState = groupCountyToStateMean(scoreEmploy);

    extraScoreMaps = await loadExtraScoreMaps(scoresExtraCsvUrl);
    extraScoreMapsState = buildExtraStateMaps(extraScoreMaps);
    recomputeBarSeries();

    resizeObs = new ResizeObserver(() => {
      const W = leftCol?.clientWidth ?? 800;
      mapH = Math.max(240, Math.round(W / aspect));
      leftHeight = leftCol?.offsetHeight ?? 0;
    });
    resizeObs?.observe(leftCol);
    leftHeight = leftCol?.offsetHeight ?? 0;
  });

  onDestroy(() => {
    resizeObs?.disconnect();
  });

  $: if (mode) {
    slots = [];
    barSeries = [];
    searchModules = [{ query: '', suggestions: [], pending: null }];
    previewId = null;
  }
</script>

<Title on:preset={onPresetSelect} />

<section class="wrap">
  <div class="grid">
    <div class="left" bind:this={leftCol}>
      <div class="toolbar">
        <div class="group">
          <button
            class="btn {mode === 'states' ? 'active' : ''}"
            on:click={() => (mode = 'states')}
          >
            States
          </button>
          <button
            class="btn {mode === 'counties' ? 'active' : ''}"
            on:click={() => (mode = 'counties')}
          >
            Counties
          </button>
        </div>
        <button class="btn" on:click={resetView}>Reset view</button>
      </div>

      {#each searchModules as m, i}
        <div class="searchmodule">
          <div
            class="slot-index"
            style={`border-color:${SLOT_COLORS[i]}; color:${SLOT_COLORS[i]};`}
          >
            {i + 1}
          </div>

          <div class="searchwrap">
            <input
              class="search"
              type="text"
              bind:value={m.query}
              placeholder={placeholder}
              disabled={i < slots.length}
              on:input={() => doSuggest(i)}
              on:focus={() => doSuggest(i)}
              on:keydown={(e) => {
                if (e.key === 'Enter') onEnter(i);
              }}
            />
            <div class="lockbox {i < slots.length ? 'is-locked' : ''}">
              <button
                class="btn lock {i < slots.length ? 'locked' : ''}"
                on:click={() => onLockClick(i)}
              >
                {i < slots.length ? 'Locked' : 'Lock'}
              </button>
            </div>

            {#if i === slots.length && m.suggestions.length > 0 && slots.length < 5}
              <div class="dropdown">
                {#each m.suggestions as s}
                  <div class="item" on:click={() => choose(i, s)}>
                    {s.label}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {/each}

      <Main_chart
        bind:this={mapRef}
        dataUrl={currentUrl}
        topoObject={currentObject}
        aspect={aspect}
        fill="#0b1a36"
        stroke="#ffffff"
        pad={40}
        {weights}
        {scoreAQI}
        {scoreAfford}
        {scoreEmploy}
        {scoreAQIState}
        {scoreAffordState}
        {scoreEmployState}
        lockedId={lockedId}
        lockedSlots={lockedSlots}
        previewId={previewId}
        on:regionhover={onRegionHover}
        on:regionclick={onRegionClick}
        extraScoreMaps={extraScoreMaps}
        extraScoreMapsState={extraScoreMapsState}
      />

      <BarChart regions={barSeries} height={Math.round(mapH / 2)} />
      <ScoringInfo />
    </div>

    <div
      class="right"
      style={`height:${leftHeight ? leftHeight : 0}px`}
    >
      <Ranking
        mode={mode}
        lockedId={lockedId}
        lockedSlots={lockedSlots}
        maxHeight={300}
        {weights}
        {scoreAQI}
        {scoreAfford}
        {scoreEmploy}
        {scoreAQIState}
        {scoreAffordState}
        {scoreEmployState}
        optionsState={stateOptions}
        optionsCounty={countyOptions}
        on:hover={onRankHover}
        on:lock={onRankLock}
        
        extraScoreMaps={extraScoreMaps}
        extraScoreMapsState={extraScoreMapsState}
      />

      <div class="weight-panel">
        <Weight on:change={onWeightsChange} preset={presetWeights} />
      </div>
    </div>
  </div>
</section>

<style>
  :root {
    --border: #a8a8a8ff;
  }

  .wrap {
    max-width: 1200px;
    margin: 0 auto;
    padding: 12px;
  }

  .grid {
    display: grid;
    grid-template-columns: 3fr 1fr;
    gap: 12px;
    align-items: stretch;
  }

  .left {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .right {
    position: sticky;
    top: 12px;
    height: 700px;
  }

  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 0;
  }

  .group {
    display: flex;
    gap: 8px;
  }

  .btn {
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: #f6f8fa;
    cursor: pointer;
    font: 13px/1.2 system-ui;
  }

  .btn.active {
    background: #0366d6;
    color: #fff;
    border-color: #0366d6;
  }

  .searchmodule {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0 0 4px;
    padding: 0;
  }

  .slot-index {
    flex: 0 0 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    border: 1.5px solid var(--border);
    font: 13px/1 system-ui;
  }

  .searchwrap {
    position: relative;
    flex: 1;
    display: flex;
    gap: 8px;
    align-items: center;
    margin: 0;
    padding: 0;
  }

  .search {
    flex: 1;
    font: 14px system-ui;
    padding: 6px 8px;
    border: 1px solid var(--border);
    border-radius: 8px;
  }

  .search:disabled {
    background: #f3f4f6;
    color: #9ca3af;
  }

  .lockbox {
    display: flex;
    align-items: center;
    border: 1.5px solid transparent;
    border-radius: 10px;
    padding: 2px;
  }

  .lockbox.is-locked {
    border-color: #ef4444;
  }

  .btn.lock {
    min-width: 84px;
    text-align: center;
  }

  .btn.lock.locked {
    border-color: transparent;
    color: #7f1d1d;
  }

  .dropdown {
    position: absolute;
    left: 0;
    right: 120px;
    top: 40px;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
    z-index: 20;
    max-height: 240px;
    overflow: auto;
  }

  .dropdown .item {
    padding: 8px 10px;
    cursor: pointer;
  }

  .dropdown .item:hover {
    background: #f3f4f6;
  }

  .weight-panel {
    margin-top: 6px;
    padding: 4px 6px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: #ffffff;
    flex: 1 1 auto;
    display: flex;
    align-items: stretch;
  }

  .weight-panel :global(*) {
    margin-top: 0;
    margin-bottom: 0;
  }
</style>
