import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import { geoArea } from 'd3-geo';
import { describe, expect, it } from 'vitest';
import type { PinZone } from './data';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  lakePaths,
  projectPoint,
  rewindFeatureForD3,
  talukPaths,
  wardPaths,
  wardsCollection,
} from './map';
import { computeZoneDensities } from './zoneDensity';
import { computeNetworkCoverage } from './networkCoverage';
import { computeRegionCoverage } from './regionCoverage';
import { HOUR_COLORS, OUT_OF_RANGE_COLOR } from './map';

function loadZones(): PinZone[] {
  const csvPath = path.resolve('public/blr_pincode_demand_reference.csv');
  const text = fs.readFileSync(csvPath, 'utf8');
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  return parsed.data.map((row) => ({
    pincode: String(row.pincode).padStart(6, '0'),
    zone_or_taluk: row.zone_or_taluk,
    locality: row.locality,
    centroid_lat: Number(row.centroid_lat),
    centroid_lng: Number(row.centroid_lng),
    population: row.population ? Number(row.population) : null,
    households: row.households ? Number(row.households) : null,
    median_hh_income: row.median_hh_income_inr
      ? Number(row.median_hh_income_inr)
      : null,
    demand_index: row.demand_index ? Number(row.demand_index) : null,
  }));
}

describe('Bengaluru map projection', () => {
  const zones = loadZones();
  const samplePins = ['560034', '560066', '560100'];
  const sample = samplePins
    .map((pin) => zones.find((z) => z.pincode === pin))
    .filter((z): z is PinZone => z !== undefined);

  it('spreads sample dark stores across the SVG instead of one pixel', () => {
    expect(sample).toHaveLength(3);
    const pts = sample.map((z) => {
      const p = projectPoint(z.centroid_lat, z.centroid_lng);
      expect(p).not.toBeNull();
      return p!;
    });
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(80);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(80);
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThan(20);
      expect(x).toBeLessThan(MAP_WIDTH - 20);
      expect(y).toBeGreaterThan(20);
      expect(y).toBeLessThan(MAP_HEIGHT - 20);
    }
  });

  it('rewinds ward polygons so d3-geo sees Bengaluru, not the globe', () => {
    const world = 4 * Math.PI;
    expect(wardsCollection.features.length).toBeGreaterThan(150);
    for (const feature of wardsCollection.features) {
      const area = geoArea(rewindFeatureForD3(feature));
      expect(area).toBeGreaterThan(0);
      expect(area).toBeLessThan(world * 0.001);
    }
  });

  it('draws a dense ward fabric plus taluks and lakes', () => {
    expect(wardPaths.length).toBeGreaterThan(150);
    expect(talukPaths.length).toBe(4);
    expect(lakePaths.length).toBeGreaterThan(4);
    for (const zone of [...wardPaths, ...talukPaths, ...lakePaths]) {
      expect(zone.d).toBeTruthy();
      expect(zone.d!.length).toBeGreaterThan(20);
      expect(zone.d!.length).toBeLessThan(30_000);
    }
  });

  it('gives density polygons a metro-scale area', () => {
    const densities = computeZoneDensities(zones);
    expect(densities.length).toBeGreaterThan(150);
    const wardAreas = densities.filter((z) => z.id.startsWith('ward-'));
    expect(wardAreas.length).toBeGreaterThan(150);
    for (const zone of wardAreas) {
      expect(zone.areaSqKm).toBeGreaterThan(0.2);
      expect(zone.areaSqKm).toBeLessThan(80);
      expect(zone.path).toBeTruthy();
    }
  });

  it('uses distinct 1h / 2h / 3h fill colours', () => {
    expect(new Set([HOUR_COLORS[1], HOUR_COLORS[2], HOUR_COLORS[3], OUT_OF_RANGE_COLOR]).size).toBe(4);
  });

  it('shades wards by service hours instead of collapsing all bands', () => {
    const served = computeNetworkCoverage(sample, zones);
    const one = computeRegionCoverage(served, new Set(samplePins), 1);
    const three = computeRegionCoverage(served, new Set(samplePins), 3);
    const fillsAt = (regions: typeof one, hour: 1 | 2 | 3) =>
      [...regions.wards, ...regions.taluks].filter((r) => r.fill === HOUR_COLORS[hour]).length;

    expect(one.wards.length).toBeGreaterThan(150);
    expect(fillsAt(one, 1)).toBeGreaterThan(5);
    expect(fillsAt(one, 2)).toBe(0);
    expect(fillsAt(three, 1)).toBe(fillsAt(one, 1));
    expect(fillsAt(three, 2) + fillsAt(three, 3)).toBeGreaterThan(fillsAt(one, 1));
  });
});
