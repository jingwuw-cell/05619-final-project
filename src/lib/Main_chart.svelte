<script lang="ts">
  import * as d3 from 'd3';
  import * as topojson from 'topojson-client';
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { FIPS2STATE } from '$lib/data/aqi';

  /* props */
  export let dataUrl: string;
  export let topoObject: 'states' | 'counties' = 'states';
  export let aspect = 16 / 10;
  export let fill = '#0b1a36';
  export let stroke = '#ffffff';
  export let pad = 5;
  export let framePad = 5;

  export let scoreAQI: Map<string, number> | null = null; // counties: SSCCC
  export let scoreAfford: Map<string, number> | null = null;
  export let scoreEmploy: Map<string, number> | null = null;

  export let scoreAQIState: Map<string, number> | null = null; // states: SS
  export let scoreAffordState: Map<string, number> | null = null;
  export let scoreEmployState: Map<string, number> | null = null;

  export let weights: Record<string, Record<string, number>> | null = null;

  type ExtraScoreMaps = Record<string, Map<string, number>>;

  export let extraScoreMaps: ExtraScoreMaps | null = null;
  export let extraScoreMapsState: ExtraScoreMaps | null = null;

  const EXTRA_STATS = [
    { cat: 'environment', sub: 'greenery', col: 'score_greenery' },
    { cat: 'environment', sub: 'industry', col: 'score_industry' },
    { cat: 'health', sub: 'healthcare', col: 'score_healthcare' },
    { cat: 'housing', sub: 'safety', col: 'score_safety' },
    { cat: 'opportunities', sub: 'education', col: 'score_education' },
    { cat: 'engagement', sub: 'events', col: 'score_events' },
    { cat: 'transport', sub: 'walk', col: 'score_walk' }
  ];

  // old export
  export let lockedId: string | null = null; // "SS" or "SSCCC"
  export let previewId: string | null = null; // external hover sync

  // new export
  export type LockedSlot = { id: string; color: string; index: number };
  export let lockedSlots: LockedSlot[] = [];

  const dispatch = createEventDispatcher();

  /* locals */
  let container: HTMLDivElement;
  let svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  let g: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  let gMain: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  let gHover: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  let gLock: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  let resizeObs: ResizeObserver | null = null;
  let currentTransform: d3.ZoomTransform = d3.zoomIdentity;

  const zoom = d3
    .zoom<SVGSVGElement, unknown>()
    .filter((ev: any) => {
      if (ev.type === 'wheel' || ev.type === 'dblclick') return true;
      return currentTransform.k > 1;
    })
    .scaleExtent([1, 12])
    .on('zoom', ({ transform }) => {
      currentTransform = transform;
      g?.attr('transform', transform);
    });

  const color = d3.scaleSequential(d3.interpolateRdYlGn).domain([-100, 100]);

  // legend gradient
  let legendGradient = '';
  function buildLegendGradient() {
    const stops: string[] = [];
    const n = 8;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const v = -100 + 200 * t;
      stops.push(`${color(v)} ${Math.round(t * 100)}%`);
    }
    legendGradient = stops.join(', ');
  }
  buildLegendGradient();

  const cache = new Map<string, any>();
  async function loadGeo(url: string, obj: string) {
    const key = `${url}::${obj}`;
    if (cache.has(key)) return cache.get(key);
    const raw: any = await d3.json(url);
    const geo =
      raw?.type === 'Topology'
        ? topojson.feature(raw, raw.objects?.[obj])
        : raw;
    cache.set(key, geo);
    return geo;
  }

  let hudText = 'Hover to inspect…';
  const clamp01to100 = (v: number | null) =>
    v == null ? null : Math.max(0, Math.min(100, +v));
  const pad2 = (x: any) => String(x ?? '').padStart(2, '0');

  function scoreEmploymentFromUnemp(u01: number, cap = 0.2, k = 8): number {
    const u = Math.min(Math.max(u01, 0), cap);
    return 100 * (1 - Math.log1p(k * u) / Math.log1p(k * cap));
  }
  function normalizeEmployment(v: number | null): number | null {
    if (v == null || !isFinite(v)) return null;
    if (v >= 0 && v <= 1) return clamp01to100(scoreEmploymentFromUnemp(v));
    if (v > 1 && v <= 40)
      return clamp01to100(scoreEmploymentFromUnemp(v / 100));
    return clamp01to100(v);
  }

  function getWeights() {
    const wAQI = Number(weights?.health?.pollution ?? 0);
    const wAff = Number(weights?.housing?.afford ?? 0);
    const wEmploy = Number(weights?.opportunities?.unemployment ?? 0);
    return { wAQI, wAff, wEmploy };
  }

  function readScores(d: any) {
    if (topoObject === 'states') {
      const idRaw = String(d.id ?? '');
      const ss = idRaw.length >= 2 ? idRaw.slice(0, 2) : pad2(idRaw);
      const nameState =
        FIPS2STATE[ss] ??
        String(d.properties?.name ?? d.properties?.NAME ?? ss);
      const sEmpRaw = scoreEmployState?.get(ss) ?? null;
      return {
        level: 'state' as const,
        id: ss,
        nameState,
        sAQI: clamp01to100(scoreAQIState?.get(ss) ?? null),
        sAff: clamp01to100(scoreAffordState?.get(ss) ?? null),
        sEmp: normalizeEmployment(sEmpRaw)
      };
    } else {
      const fips5 = String(d.id ?? '');
      const ss = fips5.slice(0, 2);
      const nameState = FIPS2STATE[ss] ?? '';
      const nameCounty = String(
        d.properties?.name ?? d.properties?.NAME ?? ''
      );
      const sEmpRaw = scoreEmploy?.get(fips5) ?? null;
      return {
        level: 'county' as const,
        id: fips5,
        nameState,
        nameCounty,
        sAQI: clamp01to100(scoreAQI?.get(fips5) ?? null),
        sAff: clamp01to100(scoreAfford?.get(fips5) ?? null),
        sEmp: normalizeEmployment(sEmpRaw)
      };
    }
  }

  // total in [-100, 100], using base + extra metrics
  function totalScore(
    id: string,
    s: { sAQI: number | null; sAff: number | null; sEmp: number | null }
  ) {
    const { wAQI, wAff, wEmploy } = getWeights();
    let num = 0;
    let den = 0;

    const addTerm = (w: number, v: number | null) => {
      if (v == null || !isFinite(v) || w === 0) return;
      num += w * v;
      den += Math.abs(w);
    };

    // base 3 metrics
    addTerm(wAQI, s.sAQI);
    addTerm(wAff, s.sAff);
    addTerm(wEmploy, s.sEmp);

    // extra 7 metrics
    const maps = topoObject === 'states' ? extraScoreMapsState : extraScoreMaps;
    if (maps && weights) {
      const key = topoObject === 'states' ? id.slice(0, 2) : id;
      for (const spec of EXTRA_STATS) {
        const w = Number(weights[spec.cat]?.[spec.sub] ?? 0);
        if (!w) continue;
        const colMap = maps[spec.col];
        if (!colMap) continue;
        const v = colMap.get(key);
        if (v == null || !isFinite(v)) continue;
        addTerm(w, v);
      }
    }

    if (den === 0) return null;
    const raw = num / den;
    return Math.max(-100, Math.min(100, raw));
  }

  function buildInfo(d: any) {
    const s = readScores(d);
    const total = totalScore(s.id, s);
    const label =
      s.level === 'state'
        ? s.nameState
        : s.nameState
        ? `${s.nameState} — ${(s as any).nameCounty}`
        : (s as any).nameCounty;
    return {
      id: s.id,
      level: s.level,
      stateName: s.nameState,
      countyName: (s as any).nameCounty,
      parts: { aqi: s.sAQI, afford: s.sAff, employ: s.sEmp },
      total,
      label
    };
  }

  let lastGeo: any = null;
  let lastPath: d3.GeoPath<any, d3.GeoPermissibleObjects> | null = null;

  function getEffectiveSlots(): LockedSlot[] {
    if (lockedSlots && lockedSlots.length) return lockedSlots;
    if (lockedId) {
      return [{ id: lockedId, index: 0, color: '#ef4444' }];
    }
    return [];
  }

  const isLocked = (id: string) =>
    getEffectiveSlots().some((s) => s.id === id);

  function hasLocks() {
    return getEffectiveSlots().length > 0;
  }

  function hasMaxLocks() {
    return getEffectiveSlots().length >= 5;
  }

  function drawLockedOutline(
    path: d3.GeoPath<any, d3.GeoPermissibleObjects>
  ) {
    if (!gLock) return;
    gLock.selectAll('*').remove();
    if (!lastGeo) return;

    const eff = getEffectiveSlots();
    if (!eff.length) return;

    const feats = (lastGeo.features || []) as any[];

    const data = eff
      .map((slot) => {
        const feat = feats.find((f) => {
          const fid = String(f.id ?? '');
          if (topoObject === 'states') return pad2(fid) === slot.id;
          return fid === slot.id;
        });
        if (!feat) return null;
        return { slot, feat };
      })
      .filter(Boolean) as { slot: LockedSlot; feat: any }[];

    gLock
      .selectAll('path.lock-outline')
      .data(data, (d: any) => d.slot.id)
      .join('path')
      .attr('class', 'lock-outline')
      .attr('d', (d) => path(d.feat) || '')
      .attr('fill', 'none')
      .attr('stroke', (d) => d.slot.color)
      .attr('stroke-width', 2.2)
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round')
      .attr('vector-effect', 'non-scaling-stroke')
      .attr('pointer-events', 'none');

    (gLock as any).raise?.();
  }

  // external preview
  function previewFeatureById(id: string | null) {
    if (!gHover || !lastGeo || !lastPath) return;

    const eff = getEffectiveSlots();

    if (eff.length >= 5) return;

    if (!id || (eff.length > 0 && !isLocked(id))) {
      gHover.selectAll('*').remove();
      if (!eff.length) hudText = 'Hover to inspect…';
      return;
    }
    const feat = (lastGeo.features || []).find((f: any) => {
      const fid = String(f.id ?? '');
      return topoObject === 'states'
        ? fid.slice(0, 2).padStart(2, '0') === id
        : fid === id;
    });
    if (!feat) return;

    const info = buildInfo(feat);
    const sA = info.parts.aqi,
      sF = info.parts.afford,
      sE = info.parts.employ;
    hudText =
      info.total == null
        ? `${info.label} — Total score=N/A`
        : `${info.label} — Total score=${info.total.toFixed(1)}`;

    const shape = lastPath(feat) || '';
    gHover
      .selectAll('path.hl')
      .data([shape])
      .join('path')
      .attr('class', 'hl')
      .attr('d', (s: string) => s)
      .attr('fill', 'rgba(0,0,0,0.25)')
      .attr('stroke', 'none');
    (gHover as any).raise?.();

    dispatch('regionhover', {
      id: info.id,
      level: info.level,
      stateName: info.stateName,
      countyName: info.countyName,
      metrics: { total: info.total, aqi: sA, afford: sF, employ: sE },
      total: info.total
    });
  }

  async function render() {
    const W = container.clientWidth || 600;
    const H = Math.max(240, Math.round(W / aspect));

    if (!svg) {
      svg = d3
        .select(container)
        .append('svg')
        .attr('width', W)
        .attr('height', H);
      g = svg.append('g');
      gMain = g.append('g').attr('class', 'g-main');
      gHover = g.append('g').attr('class', 'g-hover').attr('pointer-events', 'none');
      gLock = g.append('g').attr('class', 'g-lock').attr('pointer-events', 'none');
      svg.call(zoom as any);
    }

    svg!.attr('width', W).attr('height', H);
    gMain!.selectAll('*').remove();
    gHover!.selectAll('*').remove();
    gLock!.selectAll('*').remove();

    const projection = d3.geoAlbersUsa();
    const path = d3.geoPath(projection);
    lastPath = path;

    const geo = await loadGeo(dataUrl, topoObject);
    lastGeo = geo;

    const padPct = 0.03;
    const left = framePad + W * padPct;
    const right = W - framePad - W * padPct;
    const top = framePad + H * padPct;
    const bottom = H - framePad - H * padPct;

    projection.fitExtent([[left, top], [right, bottom]], geo as any);

    svg!
      .selectAll('rect.bg')
      .data([null])
      .join('rect')
      .attr('class', 'bg')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', W)
      .attr('height', H)
      .attr('fill', '#79d5ffff')
      .lower();

    const features = gMain!
      .selectAll('path.feature')
      .data((geo as any).features)
      .join('path')
      .attr('class', 'feature')
      .attr('d', path as any)
      .attr('fill', (d: any) => {
        const t = buildInfo(d).total;
        if (t == null) return fill;
        return color(Math.max(-100, Math.min(100, t)));
      })
      .attr('stroke', stroke)
      .attr('stroke-width', 0.5);

    features
      .on('mousemove', (_evt: MouseEvent, d: any) => {
        const eff = getEffectiveSlots();
        if (eff.length >= 5) return;

        const info = buildInfo(d);
        if (eff.length > 0 && !isLocked(info.id)) return;

        const sA = info.parts.aqi,
          sF = info.parts.afford,
          sE = info.parts.employ;

        hudText =
          info.total == null
            ? `${info.label} — Total score=N/A`
            : `${info.label} — Total score=${info.total.toFixed(1)}`;

        const shape = path(d) || '';
        gHover!
          .selectAll('path.hl')
          .data([shape])
          .join('path')
          .attr('class', 'hl')
          .attr('d', (s: string) => s)
          .attr('fill', 'rgba(0,0,0,0.25)')
          .attr('stroke', 'none');
        (gHover as any).raise?.();

        dispatch('regionhover', {
          id: info.id,
          level: info.level,
          stateName: info.stateName,
          countyName: info.countyName,
          metrics: { total: info.total, aqi: sA, afford: sF, employ: sE },
          total: info.total
        });
      })
      .on('mouseleave', () => {
        if (hasLocks()) return;
        hudText = 'Hover to inspect…';
        gHover!.selectAll('*').remove();
        dispatch('regionhover', {
          id: null,
          level: topoObject,
          stateName: '',
          metrics: { total: null },
          total: null
        });
      })
      .on('click', (_evt: MouseEvent, d: any) => {
        const info = buildInfo(d);
        dispatch('regionclick', { id: info.id, label: info.label });
      });

    const [[x0, y0], [x1, y1]] = path.bounds(geo as any);
    zoom
      .extent([[0, 0], [W, H]])
      .translateExtent([[x0 - pad, y0 - pad], [x1 + pad, y1 + pad]]);
    svg!.call(zoom.transform as any, currentTransform);

    drawLockedOutline(path);
  }

  export function resetView() {
    currentTransform = d3.zoomIdentity;
    if (svg)
      svg
        .transition()
        .duration(300)
        .call(zoom.transform as any, d3.zoomIdentity);
  }

  onMount(async () => {
    await render();
    resizeObs = new ResizeObserver(() => render());
    resizeObs.observe(container);
  });

  $: {
    dataUrl;
    topoObject;
    aspect;
    fill;
    stroke;
    pad;
    framePad;
    scoreAQI;
    scoreAfford;
    scoreEmploy;
    scoreAQIState;
    scoreAffordState;
    scoreEmployState;
    weights;
    extraScoreMaps;
    extraScoreMapsState;
    lockedId;
    lockedSlots;
    if (svg) render();
  }

  // react to external preview
  $: if (svg && lastGeo && lastPath) {
    previewFeatureById(previewId);
  }

  onDestroy(() => {
    resizeObs?.disconnect();
    resizeObs = null;
    svg = null;
    g = null;
    gMain = null;
    gHover = null;
    gLock = null;
  });
</script>

<style>
  :global(svg) {
    display: block;
  }
  .container {
    position: relative;
    width: 100%;
  }
  .hud{
    position:absolute;
    left:8px;
    bottom:8px;
    padding:6px 8px;
    border-radius:6px;
    background:rgba(0,0,0,0.55);
    color:#fff;
    font:12px/1.2 system-ui;
    pointer-events:none;
  }
  .hl {
    mix-blend-mode: multiply;
    pointer-events: none;
  }

  .lock-outline {
    stroke-dasharray: 8 8;
    animation: ants var(--ants-speed, 1.1s) linear infinite;
    will-change: stroke-dashoffset;
  }
  @keyframes ants {
    to {
      stroke-dashoffset: -16;
    }
  }

  .legend {
    position: absolute;
    right: 8px;
    bottom: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.6);
    border: 1px solid #a8a8a8ff;
    font: 11px/1.2 system-ui;
    color: #111;
  }
  .legend-title {
    font-weight: 600;
    margin-bottom: 4px;
  }
  .legend-bar {
    width: 120px;
    height: 10px;
    border-radius: 999px;
    border: 1px solid #a8a8a8ff;
    margin-bottom: 2px;
  }
  .legend-scale {
    display: flex;
    justify-content: space-between;
    font-variant-numeric: tabular-nums;
    color: #555;
    font-size: 10px;
  }
</style>

<div class="container" bind:this={container}>
  <div class="hud">{hudText}</div>
  <div class="legend">
    <div class="legend-title">Total score</div>
    <div
      class="legend-bar"
      style={`background:linear-gradient(to right, ${legendGradient});`}
    ></div>
    <div class="legend-scale">
      <span>-100</span>
      <span>100</span>
    </div>
  </div>
</div>
