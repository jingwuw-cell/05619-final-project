<script lang="ts"> 
  import { onMount, createEventDispatcher } from 'svelte';

  const STORAGE_KEY = 'livability.weights.v1';
  const dispatch = createEventDispatcher();

  type Sub = { key: string; label: string; value: number };
  type Cat = { id: string; title: string; open: boolean; subs: Sub[] };

  export let preset: Record<string, Record<string, number>> | null = null;

  let cats: Cat[] = [
    {
      id: 'environment',
      title: 'Environment',
      open: true,
      subs: [
        { key: 'greenery', label: 'Greenery (NDVI etc.)', value: 0 },
        { key: 'industry', label: 'Industrial proximity', value: 0 }
      ]
    },
    {
      id: 'health',
      title: 'Health & Wellness',
      open: true,
      subs: [
        { key: 'healthcare', label: 'Access to healthcare', value: 0 },
        { key: 'pollution', label: 'Air quality (AQI)', value: 0 }
      ]
    },
    {
      id: 'engagement',
      title: 'Engagement',
      open: true,
      subs: [{ key: 'events', label: 'Community events', value: 0 }]
    },
    {
      id: 'opportunities',
      title: 'Opportunities',
      open: true,
      subs: [
        { key: 'unemployment', label: 'Employment', value: 0 },
        { key: 'education', label: 'Education access', value: 0 }
      ]
    },
    {
      id: 'housing',
      title: 'Housing & Neighborhoods',
      open: true,
      subs: [
        { key: 'afford', label: 'Affordability (rent)', value: 0 },
        { key: 'safety', label: 'Safety / crime', value: 0 }
      ]
    },
    {
      id: 'transport',
      title: 'Transportation & Mobility',
      open: true,
      subs: [{ key: 'walk', label: 'Walkability', value: 0 }]
    }
  ];

  const bump = () => (cats = [...cats]);

  const toObject = () => {
    const obj: Record<string, Record<string, number>> = {};
    for (const c of cats) {
      obj[c.id] = {};
      for (const s of c.subs) obj[c.id][s.key] = Number(s.value) || 0;
    }
    return obj;
  };

  function fromObject(obj: any) {
    if (!obj) return;
    for (const c of cats) {
      if (!obj[c.id]) continue;
      for (const s of c.subs) {
        const v = Number(obj[c.id][s.key]);
        if (Number.isFinite(v)) s.value = Math.max(-1, Math.min(1, v));
      }
    }
    bump();
  }

  let savedHint = '';

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toObject()));
    savedHint = 'Saved ✓';
    dispatch('change', { weights: toObject() });
  }

  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      fromObject(JSON.parse(raw));
    } catch {}
  }

  function setAll(val: number) {
    for (const c of cats) for (const s of c.subs) s.value = val;
    bump();
    save();
  }

  function onSubChange() {
    savedHint = '';
    dispatch('change', { weights: toObject() });
  }

  onMount(() => {
    load();
    dispatch('change', { weights: toObject() });
  });

  let lastPreset: Record<string, Record<string, number>> | null = null;

  $: if (preset && preset !== lastPreset) {
    lastPreset = preset;
    fromObject(preset);
    savedHint = '';
    dispatch('change', { weights: toObject() });
  }
</script>

<style>
  .panel {
    --pad: 10px;
    box-sizing: border-box;
    padding: var(--pad);
    border: 1px solid #8d8d8dff;
    border-radius: 10px;
    background: #fff;
    max-height: calc(100vh - 32px);
    overflow: auto;
    font: 12px/1.25 system-ui;
  }

  h2 {
    margin: 0 0 6px;
    font: 600 15px/1.1 system-ui;
  }

  .section {
    border-bottom: 4px solid #e5e7eb;
    padding: 4px 0 6px;
  }

  .section-title {
    font: 600 12px/1.2 system-ui;
    margin: 2px 0 4px;
  }

  .sub {
    padding: 1px 0 2px;
  }

  .sub-title {
    font: 500 13px/1.2 system-ui;
    padding: 1px 0 2px;
  }

  .sub-ctrl {
    display: grid;
    grid-template-columns: 1fr auto;
    column-gap: 9px;
    align-items: center;
  }

  .slider {
    width: 100%;
    height: 4px;
    accent-color: #0366d6;
  }

  .num {
    width: 58px;
    justify-self: end;
    text-align: left;
    font: 12px/1.1 system-ui;
    padding: 3px 4px;
    border: 1px solid #a8a8a8ff;
    border-radius: 6px;
    background: #fff;
  }

  .footer {
    display: flex;
    gap: 4px;
    align-items: center;
    margin-top: 6px;
    flex-wrap: wrap;
  }

  .btn {
    padding: 4px 8px;
    border: 1px solid #8d8d8dff;
    border-radius: 8px;
    background: #f6f8fa;
    cursor: pointer;
    font: 12px/1.1 system-ui;
  }

  .btn.primary {
    background: #0366d6;
    color: #fff;
    border-color: #0366d6;
  }

  .hint {
    color: #16a34a;
    font: 11px/1.1 system-ui;
    margin-left: 6px;
  }
</style>

<div class="panel">
  <h2>Weight</h2>

  {#each cats as c (c.id)}
    <div class="section">
      <div class="section-title">{c.title}</div>
      {#each c.subs as s (s.key)}
        <div class="sub">
          <div class="sub-title">{s.label}</div>
          <div class="sub-ctrl">
            <input
              class="slider"
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={s.value}
              on:input={(e) => {
                s.value = +e.currentTarget.value;
                onSubChange();
              }}
            />
            <input
              class="num"
              type="number"
              step="0.01"
              min="-1"
              max="1"
              bind:value={s.value}
              on:input={onSubChange}
            />
          </div>
        </div>
      {/each}
    </div>
  {/each}

  <div class="footer">
    <button class="btn primary" on:click={save}>Save Weights</button>
    <button class="btn" on:click={() => setAll(0)}>Neutralize (all 0)</button>
    <button class="btn" on:click={() => setAll(1)}>Maximize (all 1)</button>
    {#if savedHint}<span class="hint">{savedHint}</span>{/if}
  </div>
</div>
