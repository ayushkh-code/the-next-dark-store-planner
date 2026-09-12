# The next Dark store planner

Find where to place your next dark store in Bengaluru. Map what your current last-mile / micro-fulfillment network reaches today, then get data-backed recommendations for where to expand.

This is a product twin of [Footprint](https://network-siting-explorer.vercel.app) (US ZIP-3 network siting), rescoped to the Bangalore / Bengaluru metro.

## What it does

- **Reach & Expand** — add current node PINs, view coverage by 1/2/3-hour service speed, and ranked siting alternatives
- **Population Density** — choropleth of population density by Bengaluru zone / taluk
- **Pincode Lookup** — demographics and demand index per PIN
- **Methodology** — FAQ on data sources and calculations

## Stack

React 19, TypeScript, Vite, d3-geo, PapaParse. Static deploy on Vercel with a serverless `/api/visitors` counter.

### Visitor count

The hero shows a live visitor tally from `/api/visitors`. By default it uses [counterapi.dev](https://counterapi.dev) (no env setup). For a first-party counter, add **Upstash Redis** from the [Vercel Marketplace](https://vercel.com/marketplace?category=storage&search=redis) — the API auto-switches when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are present. Redis key: `dark-store-planner:visitor-count`.

## Data

`public/blr_pincode_demand_reference.csv` — Bengaluru metro 6-digit PINs with modeled demographics and a pre-computed demand index.

Regenerate with:

```bash
npm run data
```

The generator is `scripts/build_pincode_data.mjs`. It:

1. Loads locality centroids from `scripts/raw/gist-map.csv` (India Post / community pincode list), plus curated metro extras (Electronic City, HSR, Bellandur, Hoskote, Devanahalli, Sarjapur, and others) and coordinate overrides for known-wrong gist points.
2. Apportions BBMP 2011 ward population (`scripts/raw/bbmp_wards_population.geojson`, 198 wards, 8.44M) grown by 1.56, then applies IT-corridor / peri-urban floors and rescales to a 13.4M metro total (~0.7% under a 13.5M midpoint).
3. Sets households = population / 3.4.
4. Assigns `median_hh_income_inr` by locality type (IT corridor, established residential, industrial, peri-urban).
5. Precomputes `demand_index` (0–100) as 65% log-population + 35% income. The UI does not recalculate it.

Service hours are computed client-side: haversine km × 1.35 road circuity; ≤8 km → 1h, ≤16 km → 2h, ≤28 km → 3h.

Coverage and density maps draw simplified BBMP 2011 ward polygons, peri-urban taluk outlines, and named lakes (OpenStreetMap). `npm run map` rebuilds `src/blr-basemap.json` from `scripts/raw/`.

## Local development

```bash
npm install
npm run data
npm run dev
```

```bash
npm run test
npm run build
npm run preview
```

## Deploy

```bash
npx vercel deploy --prod --yes
```

No env vars are required. Optional Upstash Redis: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
