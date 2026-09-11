import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { buildPinIndex, type PinZone } from './data';
import { serviceHours } from './geo';
import {
  computeNetworkCoverage,
  computeNetworkHourSummaries,
  recommendNextSiteAlternatives,
} from './networkCoverage';

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

describe('Bengaluru coverage', () => {
  const zones = loadZones();
  const index = buildPinIndex(zones);
  const sample = ['560034', '560066', '560100']
    .map((p) => index.get(p))
    .filter((z): z is PinZone => z !== undefined);
  const totalPop = zones.reduce((s, z) => s + (z.population ?? 0), 0);
  const totalDemand = zones.reduce((s, z) => s + (z.demand_index ?? 0), 0);

  it('includes the sample-network pincodes', () => {
    expect(sample).toHaveLength(3);
  });

  it('covers more population as the hour threshold opens', () => {
    const summaries = computeNetworkHourSummaries(
      sample,
      zones,
      totalPop,
      totalDemand,
    );
    const one = summaries.find((s) => s.hourThreshold === 1)!;
    const two = summaries.find((s) => s.hourThreshold === 2)!;
    const three = summaries.find((s) => s.hourThreshold === 3)!;
    expect(one.totalPopulation).toBeLessThan(two.totalPopulation);
    expect(two.totalPopulation).toBeLessThan(three.totalPopulation);
    expect(two.populationPct).toBeGreaterThan(50);
  });

  it('never recommends an already-selected or blacklisted pincode', () => {
    const recs = recommendNextSiteAlternatives(
      sample,
      zones,
      5,
      2,
      'demand_index',
      totalPop,
      totalDemand,
      ['560102'],
    );
    const blocked = new Set(['560034', '560066', '560100', '560102']);
    expect(recs.every((r) => !blocked.has(r.zone.pincode))).toBe(true);
  });

  it('prints service-hour buckets for the sample network', () => {
    const coverage = computeNetworkCoverage(sample, zones);
    const buckets = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of coverage) {
      const h = Math.min(5, row.min_service_hours) as 1 | 2 | 3 | 4 | 5;
      buckets[h] += 1;
    }
    console.table(buckets);
    expect(Object.values(buckets).reduce((a, b) => a + b, 0)).toBe(zones.length);
  });

  it('maps 8 / 16 / 28 km to 1 / 2 / 3 hours', () => {
    expect(serviceHours(8)).toBe(1);
    expect(serviceHours(16)).toBe(2);
    expect(serviceHours(28)).toBe(3);
    expect(serviceHours(46)).toBe(5);
  });
});
