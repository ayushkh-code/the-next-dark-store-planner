import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import { geoArea } from 'd3-geo';
import { describe, expect, it } from 'vitest';
import type { PinZone } from './data';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  projectPoint,
  rewindFeatureForD3,
  zonePaths,
  zonesCollection,
} from './map';
import { computeZoneDensities } from './zoneDensity';

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

  it('rewinds zone hulls so d3-geo sees Bengaluru, not the globe', () => {
    const world = 4 * Math.PI;
    for (const feature of zonesCollection.features) {
      const area = geoArea(rewindFeatureForD3(feature));
      expect(area).toBeGreaterThan(0);
      expect(area).toBeLessThan(world * 0.001);
    }
  });

  it('draws zone outlines as local paths, not a full-frame fill', () => {
    expect(zonePaths.length).toBeGreaterThan(5);
    for (const zone of zonePaths) {
      expect(zone.d).toBeTruthy();
      expect(zone.d!.length).toBeGreaterThan(20);
      expect(zone.d!.length).toBeLessThan(2000);
    }
  });

  it('gives density hulls a metro-scale area', () => {
    const densities = computeZoneDensities(zones);
    expect(densities.length).toBeGreaterThan(5);
    for (const zone of densities) {
      expect(zone.areaSqKm).toBeGreaterThan(1);
      expect(zone.areaSqKm).toBeLessThan(2_000);
      expect(zone.path).toBeTruthy();
    }
  });
});
