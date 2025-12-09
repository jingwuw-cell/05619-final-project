<section class="panel">
  <h2 class="panel-title">How each attribute is scored</h2>

  <div class="item">
    <h3 class="item-title">Air quality (AQI)</h3>
    <p>
      County-level air quality is measured using long-term PM2.5 concentration.
      We transform PM2.5 using a log scale and map counties between the 1st and
      99th percentiles to a 0–100 score. Cleaner air (lower PM2.5) receives higher
      scores, while highly polluted counties are pushed toward 0.
    </p>
  </div>

  <div class="item">
    <h3 class="item-title">Affordability</h3>
    <p>
      Housing affordability is derived from rent or cost-of-living indicators.
      Counties around the 1st percentile of housing cost relative to income are
      mapped near 100 points, and those near the 99th percentile are mapped near
      0 points, using a percentile-based linear scale. More affordable counties
      score higher.
    </p>
  </div>

  <div class="item">
    <h3 class="item-title">Employment</h3>
    <p>
      Employment conditions are summarized using county-level unemployment rates.
      After a log transformation, counties with very low unemployment (around the
      1st percentile) receive scores close to 100, and counties with very high
      unemployment (around the 99th percentile) receive scores close to 0.
    </p>
  </div>

  <div class="item">
    <h3 class="item-title">Greenery</h3>
    <p>
      Tree and forest coverage is measured by the percentage of land covered by
      forest or tree canopy. Because the distribution is relatively balanced, we
      score it directly in the original scale: counties at the 1st percentile of
      coverage or below score near 0, and those at the 99th percentile or above
      score near 100, with linear interpolation in between.
    </p>
  </div>

  <div class="item">
    <h3 class="item-title">Industrial proximity</h3>
    <p>
      <code>IndustrialPerCap</code> measures the per-capita intensity or footprint
      of industrial land use. The raw values are highly right-skewed, so we apply
      a log1p transformation to compress extreme values. After transformation,
      counties at the 1st percentile of industrial intensity receive scores near
      100, while those at the 99th percentile receive scores near 0, reflecting
      that less industrial exposure is better.
    </p>
  </div>

  <div class="item">
    <h3 class="item-title">Access to healthcare</h3>
    <p>
      <code>ProviderPerCap</code> approximates the number of healthcare providers
      per resident. We apply a log1p transformation and then compute a
      percentile-based score: counties with low provider density (around the
      1st percentile) receive scores near 0, and counties with very high provider
      density (around the 99th percentile) receive scores near 100.
    </p>
  </div>

  <div class="item">
    <h3 class="item-title">Safety / crime</h3>
    <p>
      <code>CrimeRate</code> captures crime incidents relative to population.
      We transform CrimeRate with log1p to reduce the impact of extreme high-crime
      counties. After transformation, safer counties at the 1st percentile of
      crime rate receive scores close to 100, while counties at the 99th percentile
      receive scores close to 0.
    </p>
  </div>

  <div class="item">
    <h3 class="item-title">Education access</h3>
    <p>
      <code>BachelorPerCap</code> represents the share of residents with at least
      a bachelor’s degree. We use a log1p transformation to account for the
      right-skewed distribution and then map the 1st to 99th percentiles to
      0–100 points. Counties with higher educational attainment score higher.
    </p>
  </div>

  <div class="item">
    <h3 class="item-title">Community events</h3>
    <p>
      <code>PublicPerCap</code> approximates the density of public amenities and
      venues (such as libraries, community centers, or cultural facilities) per
      resident. Because the distribution is extremely right-skewed, we apply
      log1p, then assign scores from 0 to 100 based on the 1st and 99th percentiles,
      where counties with more amenities per capita receive higher scores.
    </p>
  </div>

  <div class="item">
    <h3 class="item-title">Walkability</h3>
    <p>
      <code>WalkPerCap</code> measures walk-friendly infrastructure or opportunities
      per resident. We log-transform the values using log1p and compute a
      percentile-based 0–100 score. Counties with more walkable infrastructure
      (higher WalkPerCap) are mapped toward the top of the scale, while
      car-dependent counties receive lower scores.
    </p>
  </div>
</section>

<style>
  .panel {
    border: 1px solid #a8a8a8ff;
    border-radius: 10px;
    background: #ffffff;
    padding: 8px 10px;
    font-size: 12px;
    line-height: 1.4;
    box-sizing: border-box;
  }

  .panel-title {
    margin: 0 0 6px;
    font-size: 13px;
    font-weight: 600;
  }

  .item {
    margin-top: 6px;
  }

  .item-title {
    margin: 0 0 2px;
    font-size: 12px;
    font-weight: 600;
  }

  .item p {
    margin: 0;
  }

  .item code {
    font-size: 11px;
  }
</style>
