/**
 * Zone-level population density tiers for the choropleth map.
 * Population is summed from pincodes; land area from zone hull geometries.
 */
import { geoArea } from 'd3-geo';
import type { Feature, Geometry } from 'geojson';
import type { PinZone } from './data';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  rewindFeatureForD3,
  zoneSvgPath,
  zoneLabelPoint,
  zonesCollection,
} from './map';

const EARTH_RADIUS_M = 6378137;
const SQ_KM_PER_SQ_M = 1 / 1_000_000;

/** Three-tier density palette (low → high). */
export const DENSITY_TIER_COLORS = ['#dbeafe', '#3b82f6', '#1e3a8a'] as const;
export const DENSITY_TIER_LABELS = ['Low', 'Medium', 'High'] as const;
const NO_DATA_COLOR = '#e8ecf1';

export type DensityTier = 0 | 1 | 2;

export interface ZoneDensity {
  name: string;
  abbr: string;
  population: number;
  areaSqKm: number;
  density: number;
  tier: DensityTier | null;
  path: string | null;
  labelX: number | null;
  labelY: number | null;
}

/** Land area of a GeoJSON feature in square kilometres. */
function featureAreaSqKm(feature: Feature<Geometry>): number {
  const sqM =
    geoArea(rewindFeatureForD3(feature)) * EARTH_RADIUS_M * EARTH_RADIUS_M;
  return sqM * SQ_KM_PER_SQ_M;
}

/** Sum pincode population by zone_or_taluk. */
export function aggregatePopulationByZone(
  zones: PinZone[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const zone of zones) {
    const st = zone.zone_or_taluk;
    if (!st) continue;
    totals.set(st, (totals.get(st) ?? 0) + (zone.population ?? 0));
  }
  return totals;
}

/** Assign tertile tier (0=low, 1=med, 2=high) by population density. */
function assignTiers(
  states: Omit<ZoneDensity, 'tier'>[],
): ZoneDensity[] {
  const withDensity = states
    .filter((s) => s.population > 0 && s.areaSqKm > 0)
    .sort((a, b) => a.density - b.density);

  const n = withDensity.length;
  if (n === 0) return states.map((s) => ({ ...s, tier: null }));

  const tierByName = new Map<string, DensityTier>();
  const t1 = Math.floor(n / 3);
  const t2 = Math.floor((2 * n) / 3);
  withDensity.forEach((s, i) => {
    let tier: DensityTier = 2;
    if (i < t1) tier = 0;
    else if (i < t2) tier = 1;
    tierByName.set(s.name, tier);
  });

  return states.map((s) => ({
    ...s,
    tier:
      s.population > 0 && s.areaSqKm > 0
        ? (tierByName.get(s.name) ?? null)
        : null,
  }));
}

/** Tertile density breakpoints for legend (min density per tier). */
export function densityTierRanges(
  states: ZoneDensity[],
): { tier: DensityTier; label: string; min: number; max: number }[] {
  const tiers = [0, 1, 2] as const;
  return tiers.map((tier) => {
    const inTier = states.filter((s) => s.tier === tier);
    const densities = inTier.map((s) => s.density);
    const min = densities.length ? Math.min(...densities) : 0;
    const max = densities.length ? Math.max(...densities) : 0;
    return {
      tier,
      label: DENSITY_TIER_LABELS[tier],
      min,
      max,
    };
  });
}

/** Build zone density records with SVG paths for choropleth rendering. */
export function computeZoneDensities(zones: PinZone[]): ZoneDensity[] {
  const popByZone = aggregatePopulationByZone(zones);

  const base = zonesCollection.features.map((f) => {
    const name =
      typeof f.properties?.name === 'string' ? f.properties.name : '';
    const abbr =
      typeof f.properties?.abbr === 'string' ? f.properties.abbr : name;
    const population = popByZone.get(name) ?? 0;
    const areaSqKm = featureAreaSqKm(f as Feature<Geometry>);
    const density = areaSqKm > 0 ? population / areaSqKm : 0;
    const centroid = zoneLabelPoint(f as Feature<Geometry>);

    return {
      name,
      abbr,
      population,
      areaSqKm,
      density,
      path: zoneSvgPath(f as Feature<Geometry>),
      labelX: centroid ? centroid[0] : null,
      labelY: centroid ? centroid[1] : null,
    };
  });

  return assignTiers(base);
}

export function densityFillColor(tier: DensityTier | null): string {
  if (tier === null) return NO_DATA_COLOR;
  return DENSITY_TIER_COLORS[tier];
}

/** Label text color for contrast on each density tier. */
export function densityLabelColor(tier: DensityTier | null): string {
  if (tier === 1 || tier === 2) return '#ffffff';
  return '#1e3a8a';
}

export { MAP_WIDTH, MAP_HEIGHT };
