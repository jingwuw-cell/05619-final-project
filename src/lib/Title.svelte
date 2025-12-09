<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  type PresetWeights = {
    environment: { greenery: number; industry: number };
    health: { healthcare: number; pollution: number };
    housing: { afford: number; safety: number };
    engagement: { events: number };
    opportunities: { employment: number; education: number };
    transport: { walk: number };
  };

  type Preset = {
    id: string;
    label: string;
    weights: PresetWeights;
  };

  const dispatch = createEventDispatcher();

  const presets: Preset[] = [
    {
      id: 'green-escape',
      label: 'Green Escape – nature-forward & quiet',
      weights: {
        environment: { greenery: 1.0, industry: -0.8 },
        health: { healthcare: 0.3, pollution: 0.9 },
        housing: { afford: 0.3, safety: 0.8 },
        engagement: { events: -0.4 },
        opportunities: { employment: 0.1, education: 0.2 },
        transport: { walk: 0.7 }
      }
    },
    {
      id: 'urban-lifestyle',
      label: 'Urban Lifestyle – vibrant city living',
      weights: {
        environment: { greenery: 0.2, industry: 0.3 },
        health: { healthcare: 0.4, pollution: 0.3 },
        housing: { afford: 0.1, safety: 0.2 },
        engagement: { events: 0.9 },
        opportunities: { employment: 0.9, education: 0.4 },
        transport: { walk: 1.0 }
      }
    },
    {
      id: 'study-fun',
      label: 'Study & Fun – youth & campus life',
      weights: {
        environment: { greenery: 0.3, industry: 0.0 },
        health: { healthcare: 0.3, pollution: 0.4 },
        housing: { afford: 0.5, safety: 0.4 },
        engagement: { events: 1.0 },
        opportunities: { employment: 0.2, education: 1.0 },
        transport: { walk: 0.6 }
      }
    },
    {
      id: 'healthy-convenient',
      label: 'Healthy & Convenient – senior friendly',
      weights: {
        environment: { greenery: 0.4, industry: -0.6 },
        health: { healthcare: 1.0, pollution: 0.8 },
        housing: { afford: 0.6, safety: 1.0 },
        engagement: { events: 0.2 },
        opportunities: { employment: -0.3, education: 0.1 },
        transport: { walk: 0.7 }
      }
    },
    {
      id: 'family-friendly',
      label: 'Family Friendly – safe & nurturing',
      weights: {
        environment: { greenery: 0.6, industry: -0.5 },
        health: { healthcare: 0.7, pollution: 0.7 },
        housing: { afford: 0.8, safety: 1.0 },
        engagement: { events: 0.4 },
        opportunities: { employment: 0.5, education: 0.8 },
        transport: { walk: 0.5 }
      }
    },
    {
      id: 'opportunity-first',
      label: 'Opportunity First – jobs & budget',
      weights: {
        environment: { greenery: 0.0, industry: 0.3 },
        health: { healthcare: 0.2, pollution: 0.2 },
        housing: { afford: 1.0, safety: 0.3 },
        engagement: { events: 0.0 },
        opportunities: { employment: 1.0, education: 0.6 },
        transport: { walk: 0.2 }
      }
    }
  ];
</script>

<style>
  .hero {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;

    height: 200px;
    box-sizing: border-box;
    position: relative;

    background-size: cover;
    background-position: center 40.5%;
    background-repeat: no-repeat;

    display: flex;
    justify-content: space-between;
    align-items: flex-start;

    padding: 20px;
  }

  .left {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .title-img {
    height: 80px;
    width: auto;
    display: block;
  }

  .authors {
    margin-left: 15px;
    margin-top: 15px;
    font-size: 25px;
    line-height: 1.5;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
      sans-serif;
    color: #ffffff;
    text-shadow: 0 2px 2px rgba(0, 0, 0, 0.6);
  }

  .tips{
    margin-top: 12px;
    font-size: 12px;
    color: rgba(255, 255, 255, 1);
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
      sans-serif;
    text-shadow: 0 2px 2px rgba(0, 0, 0, 0.6);
  }
  .number{
    font-size: 15px;
  }

  .right-box {
    margin-left: auto;
    height: 100%;
    display: flex;
    align-items: flex-start;
  }

  .right-inner {
    margin-top: 0;
    margin-bottom: 0;
    margin-right: 0;
    padding: 8px 12px;
    border-radius: 10px;
    background: rgba(214, 209, 209, 0.49);
    border: 1px solid rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(3px);

    display: flex;
    flex-direction: column;
    align-items: flex-start;
    max-width: 340px;

    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
      sans-serif;
    color: #060913ff;
  }

  .right-title {
    font-size: 15px;
    font-weight: 600;
    line-height: 20px;
    margin-bottom: 6px;
  }

  .preset-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .preset-item {
    font-size: 13px;
    line-height: 15px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-decoration: underline;
    text-underline-offset: 2px;

    cursor: pointer;
    padding: 2px 2px;
    border-radius: 4px;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .preset-item:hover {
    background: rgba(255, 255, 255, 0.25);
    color: #000000;
  }

  @media (max-width: 768px) {
    .hero {
      flex-direction: column;
      align-items: flex-start;
    }

    .right-box {
      width: 100%;
      margin-left: 0;
      margin-top: 8px;
    }

    .right-inner {
      max-width: 100%;
    }

    .preset-item {
      white-space: normal;
    }
  }
</style>

<div class="hero" style={`background-image:url('${base}/image/back.jpg')`}>
  <div class="left">
    <img src="${base}/image/title.png" alt="Livability Analysis" class="title-img" />
    <div class="authors">Andrew Wang &amp; Jingwu Wen</div>
    <div class="tips"> Supports simultaneous comparison of up to <a class="number">5</a> regions. </div>
  </div>

  <div class="right-box">
    <div class="right-inner">
      <div class="right-title">What life do you want:</div>
      <div class="preset-list">
        {#each presets as p}
          <div
            class="preset-item"
            on:click={() => dispatch('preset', { id: p.id, weights: p.weights })}
          >
            {p.label}
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>
