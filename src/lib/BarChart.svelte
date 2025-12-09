<script lang="ts">
  import * as d3 from 'd3';
  import { onMount, onDestroy } from 'svelte';

  export type BarItem = { key: string; label: string; value: number | null };
  export type RegionBars = {
    id: string;
    label: string;
    color: string;
    values: BarItem[];
  };

  export let regions: RegionBars[] = [];
  export let height = 220;
  export let margin = { top: 16, right: 12, bottom: 90, left: 48 };
  export let frozen = false;

  // animation time
  const T = 30;

  // index order
  const METRIC_ORDER: { key: string; label: string }[] = [
    { key: 'aqi',        label: 'Air quality (AQI)' },
    { key: 'greenery',   label: 'Greenery (NDVI etc.)' },
    { key: 'industry',   label: 'Industrial proximity' },
    { key: 'healthcare', label: 'Access to healthcare' },
    { key: 'education',  label: 'Education access' },
    { key: 'events',     label: 'Community events' },
    { key: 'afford',     label: 'Affordability' },
    { key: 'safety',     label: 'Safety / crime' },
    { key: 'employ',     label: 'Employment' },
    { key: 'walk',       label: 'Walkability' },
    { key: 'tv',         label: 'Total Score' }       // last total
  ];

  let container: HTMLDivElement;
  let svg: SVGSVGElement | null = null;
  let resizeObs: ResizeObserver | null = null;

  let lastRegions: RegionBars[] = [];

  function render(useRegions: RegionBars[]) {
    if (!container) return;

    const W = container.clientWidth || 600;
    const H = Math.max(120, height);

    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      container.appendChild(svg);
    }

    svg.setAttribute('width', String(W));
    svg.setAttribute('height', String(H));

    const g = d3
      .select(svg)
      .selectAll<SVGGElement, unknown>('g.root')
      .data([null])
      .join('g')
      .attr('class', 'root')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;

    if (!useRegions.length) {
      g.selectAll('*').remove();
      lastRegions = useRegions;
      return;
    }

    // range
    const vals: number[] = [];
    useRegions.forEach(r => {
      r.values.forEach(v => {
        if (v.value != null) vals.push(v.value as number);
      });
    });

    const vmax = vals.length ? d3.max(vals)! : 1;
    const vmin = vals.length ? d3.min(vals)! : 0;
    const ymax = Math.max(0, vmax);
    const ymin = Math.min(0, vmin);

    // fixed x
    const x0 = d3
      .scaleBand<string>()
      .domain(METRIC_ORDER.map(m => m.key))
      .range([0, innerW])
      .padding(0.2);

    // different regions
    const x1 = d3
      .scaleBand<string>()
      .domain(useRegions.map(r => r.id))
      .range([0, x0.bandwidth()])
      .padding(0.15);

    const y = d3
      .scaleLinear()
      .domain([ymin, ymax])
      .nice()
      .range([innerH, 0]);

    // axis
    const xAxis = d3
      .axisBottom(x0)
      .tickFormat((key: any) => {
        const m = METRIC_ORDER.find(m => m.key === key);
        return m ? m.label : key;
      });

    g.selectAll<SVGGElement, unknown>('g.x')
      .data([null])
      .join('g')
      .attr('class', 'x')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis as any)
      .selectAll('text')
      .style('font', '10px system-ui')
      .attr('text-anchor', 'end')
      .attr('transform', 'rotate(-45)')
      .attr('dx', '-0.4em')
      .attr('dy', '0.7em');

    const yAxis = d3.axisLeft(y).ticks(5);

    g.selectAll<SVGGElement, unknown>('g.y')
      .data([null])
      .join('g')
      .attr('class', 'y')
      .call(yAxis as any)
      .selectAll('text')
      .style('font', '12px system-ui');

    // grid line
    const yTicks = y.ticks(5);
    g.selectAll<SVGLineElement, number>('line.grid')
      .data(yTicks)
      .join('line')
      .attr('class', 'grid')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', d => y(d))
      .attr('y2', d => y(d))
      .attr('stroke', '#606061ff')
      .attr('stroke-dasharray', '2,2');

    // y=0 line
    g.selectAll<SVGLineElement, number>('line.zero')
      .data([0])
      .join('line')
      .attr('class', 'zero')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', y(0))
      .attr('y2', y(0))
      .attr('stroke', '#888')
      .attr('stroke-dasharray', '3,3');

    //group
    const groups = g
      .selectAll<SVGGElement, { key: string; label: string }>('g.group')
      .data(METRIC_ORDER, (d: any) => d.key)
      .join('g')
      .attr('class', 'group')
      .attr('transform', d => `translate(${x0(d.key) ?? 0},0)`);

    // bar
    const bars = groups
      .selectAll<SVGRectElement, any>('rect.bar')
      .data(
        (metric: any) =>
          useRegions.map(r => {
            const found = r.values.find(v => v.key === metric.key);
            return { region: r, value: found?.value ?? null };
          }),
        (d: any) => d.region.id
      );

    // enter
    bars
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', (d: any) => x1(d.region.id) ?? 0)
      .attr('width', () => x1.bandwidth())
      .attr('y', y(0))
      .attr('height', 0)
      .attr('fill', (d: any) => d.region.color)
      .attr('opacity', 1)
      .transition()
      .duration(T)
      .attr('y', (d: any) =>
        d.value == null ? y(0) : Math.min(y(0), y(d.value as number))
      )
      .attr('height', (d: any) =>
        d.value == null ? 0 : Math.abs(y(d.value as number) - y(0))
      );

    // update
    bars
      .transition()
      .duration(T)
      .attr('x', (d: any) => x1(d.region.id) ?? 0)
      .attr('width', () => x1.bandwidth())
      .attr('y', (d: any) =>
        d.value == null ? y(0) : Math.min(y(0), y(d.value as number))
      )
      .attr('height', (d: any) =>
        d.value == null ? 0 : Math.abs(y(d.value as number) - y(0))
      )
      .attr('fill', (d: any) => d.region.color)
      .attr('opacity', 1);

    // exit
    bars.exit().transition().duration(T).attr('y', y(0)).attr('height', 0).remove();

    // value label
    const labels = groups
      .selectAll<SVGTextElement, any>('text.value')
      .data(
        (metric: any) =>
          useRegions.map(r => {
            const found = r.values.find(v => v.key === metric.key);
            return { region: r, value: found?.value ?? null };
          }),
        (d: any) => d.region.id
      );

    labels
      .enter()
      .append('text')
      .attr('class', 'value')
      .attr('text-anchor', 'middle')
      .style('font', '8px system-ui')
      .attr(
        'x',
        (d: any) => (x1(d.region.id) ?? 0) + x1.bandwidth() / 2
      )
      .attr('y', y(0) - 2)
      .text((d: any) =>
        d.value == null ? '' : (d.value as number).toFixed(1)
      )
      .transition()
      .duration(T)
      .attr('y', (d: any) => {
        if (d.value == null) return y(0) - 2;
        const v = d.value as number;
        const base = y(v);
        return v >= 0 ? base - 2 : base + 10;
      });

    labels
      .transition()
      .duration(T)
      .attr(
        'x',
        (d: any) => (x1(d.region.id) ?? 0) + x1.bandwidth() / 2
      )
      .attr('y', (d: any) => {
        if (d.value == null) return y(0) - 2;
        const v = d.value as number;
        const base = y(v);
        return v >= 0 ? base - 2 : base + 10;
      })
      .text((d: any) =>
        d.value == null ? '' : (d.value as number).toFixed(1)
      );

    labels
      .exit()
      .transition()
      .duration(T)
      .attr('y', y(0) - 2)
      .remove();

    lastRegions = useRegions;
  }

  onMount(() => {
    render(regions);
    resizeObs = new ResizeObserver(() =>
      render(frozen ? lastRegions : regions)
    );
    resizeObs.observe(container);
  });

  $: {
    if (container) {
      render(frozen ? lastRegions : regions);
    }
  }

  onDestroy(() => {
    resizeObs?.disconnect();
    resizeObs = null;
  });
</script>

<style>
  .panel {
    box-sizing: border-box;
    border: 1px solid #a8a8a8ff;
    border-radius: 10px;
    padding: 8px 10px 10px;
    background: #fff;
    font: 12px/1.25 system-ui;
  }

  .panel-title {
    margin: 0 0 6px;
    font: 600 14px/1.1 system-ui;
  }

  .chart {
    width: 100%;
  }

  :global(svg) {
    display: block;
  }
</style>

<div class="panel">
  <div class="panel-title">Scores</div>
  <div class="chart" bind:this={container}></div>
</div>
