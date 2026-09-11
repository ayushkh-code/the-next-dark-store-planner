/**
 * Multi-node network coverage: aggregate reach across existing dark stores.
 * A pincode is served if the nearest node can reach it within the hour threshold.
 */
import type { PinZone } from './data';
import { distanceMetrics } from './geo';

export interface ServedZone {
  zone: PinZone;
  /** Shortest service hours from any node in the network. */
  min_service_hours: number;
  road_km: number;
  service_band: number;
  /** PIN of the closest node serving this zone. */
  nearest_node_pincode: string;
}

export interface NetworkHourSummary {
  hourThreshold: number;
  nodeCount: number;
  pincodesServed: number;
  totalPopulation: number;
  populationPct: number;
  totalDemandIndex: number;
  demandIndexPct: number;
}

/** Best (minimum) service metrics from any node to a destination pincode. */
function bestMetricsFromNetwork(
  nodes: PinZone[],
  zone: PinZone,
): ServedZone {
  let best = {
    min_service_hours: Infinity,
    road_km: 0,
    service_band: 0,
    nearest_node_pincode: nodes[0]?.pincode ?? '',
  };

  for (const node of nodes) {
    const { roadKilometres, hours, band } = distanceMetrics(
      node.centroid_lat,
      node.centroid_lng,
      zone.centroid_lat,
      zone.centroid_lng,
    );
    if (hours < best.min_service_hours) {
      best = {
        min_service_hours: hours,
        road_km: roadKilometres,
        service_band: band,
        nearest_node_pincode: node.pincode,
      };
    }
  }

  return {
    zone,
    min_service_hours: best.min_service_hours,
    road_km: best.road_km,
    service_band: best.service_band,
    nearest_node_pincode: best.nearest_node_pincode,
  };
}

/** Compute served-zone metrics for every pincode from a node network. */
export function computeNetworkCoverage(
  nodes: PinZone[],
  allZones: PinZone[],
): ServedZone[] {
  if (nodes.length === 0) return [];
  return allZones.map((zone) => bestMetricsFromNetwork(nodes, zone));
}

/** Summaries at 1-, 2-, and 3-hour thresholds for the node network. */
export function computeNetworkHourSummaries(
  nodes: PinZone[],
  allZones: PinZone[],
  metroTotalPopulation: number,
  metroTotalDemandIndex: number,
): NetworkHourSummary[] {
  if (nodes.length === 0) return [];

  const coverage = computeNetworkCoverage(nodes, allZones);

  return [1, 2, 3].map((hourThreshold) => {
    const served = coverage.filter((z) => z.min_service_hours <= hourThreshold);
    const totalPopulation = served.reduce(
      (sum, z) => sum + (z.zone.population ?? 0),
      0,
    );
    const totalDemandIndex = served.reduce(
      (sum, z) => sum + (z.zone.demand_index ?? 0),
      0,
    );
    return {
      hourThreshold,
      nodeCount: nodes.length,
      pincodesServed: served.length,
      totalPopulation,
      populationPct:
        metroTotalPopulation > 0
          ? (totalPopulation / metroTotalPopulation) * 100
          : 0,
      totalDemandIndex,
      demandIndexPct:
        metroTotalDemandIndex > 0
          ? (totalDemandIndex / metroTotalDemandIndex) * 100
          : 0,
    };
  });
}

export type MaximizeObjective = 'demand_index' | 'population' | 'zones';

/** Ranked backup alternatives shown in the expansion planner. */
export const RECOMMENDATION_ALTERNATIVE_COUNT = 5;

export interface NodeRecommendation {
  rank: number;
  zone: PinZone;
  /** Additional objective units captured by this node (given prior picks). */
  incrementalGain: number;
  demandIndexPct: number;
  populationPct: number;
  pincodesServed: number;
}

function incrementalObjectiveGain(
  coverage: ServedZone[],
  candidate: PinZone,
  hourThreshold: number,
  objective: MaximizeObjective,
): number {
  let gain = 0;
  for (const row of coverage) {
    const { hours } = distanceMetrics(
      candidate.centroid_lat,
      candidate.centroid_lng,
      row.zone.centroid_lat,
      row.zone.centroid_lng,
    );
    const wasServed = row.min_service_hours <= hourThreshold;
    const nowServed = Math.min(row.min_service_hours, hours) <= hourThreshold;
    if (!wasServed && nowServed) {
      if (objective === 'demand_index') {
        gain += row.zone.demand_index ?? 0;
      } else if (objective === 'population') {
        gain += row.zone.population ?? 0;
      } else {
        gain += 1;
      }
    }
  }
  return gain;
}

function mergeNodeIntoCoverage(
  coverage: ServedZone[],
  node: PinZone,
): ServedZone[] {
  return coverage.map((row) => {
    const { roadKilometres, hours, band } = distanceMetrics(
      node.centroid_lat,
      node.centroid_lng,
      row.zone.centroid_lat,
      row.zone.centroid_lng,
    );
    if (hours < row.min_service_hours) {
      return {
        ...row,
        min_service_hours: hours,
        road_km: roadKilometres,
        service_band: band,
        nearest_node_pincode: node.pincode,
      };
    }
    return row;
  });
}

function summaryAtThreshold(
  coverage: ServedZone[],
  hourThreshold: number,
  metroTotalPopulation: number,
  metroTotalDemandIndex: number,
): Pick<NodeRecommendation, 'demandIndexPct' | 'populationPct' | 'pincodesServed'> {
  const served = coverage.filter((z) => z.min_service_hours <= hourThreshold);
  const totalPopulation = served.reduce(
    (sum, z) => sum + (z.zone.population ?? 0),
    0,
  );
  const totalDemandIndex = served.reduce(
    (sum, z) => sum + (z.zone.demand_index ?? 0),
    0,
  );
  return {
    pincodesServed: served.length,
    populationPct:
      metroTotalPopulation > 0
        ? (totalPopulation / metroTotalPopulation) * 100
        : 0,
    demandIndexPct:
      metroTotalDemandIndex > 0
        ? (totalDemandIndex / metroTotalDemandIndex) * 100
        : 0,
  };
}

function buildExcludedPinSet(
  existingNodes: PinZone[],
  excludedPins: Iterable<string> = [],
): Set<string> {
  const excluded = new Set(existingNodes.map((w) => w.pincode));
  for (const pin of excludedPins) {
    excluded.add(pin);
  }
  return excluded;
}

/**
 * Top N site alternatives ranked by incremental gain from the current network.
 * Each option is evaluated independently (pick one), not as a build-all sequence.
 */
export function recommendNextSiteAlternatives(
  existingNodes: PinZone[],
  allZones: PinZone[],
  alternativeCount: number,
  hourThreshold: number,
  objective: MaximizeObjective,
  metroTotalPopulation: number,
  metroTotalDemandIndex: number,
  excludedPins: Iterable<string> = [],
): NodeRecommendation[] {
  if (existingNodes.length === 0 || alternativeCount < 1) return [];

  const excluded = buildExcludedPinSet(existingNodes, excludedPins);
  const coverage = computeNetworkCoverage(existingNodes, allZones);

  const ranked = allZones
    .filter((zone) => !excluded.has(zone.pincode))
    .map((zone) => ({
      zone,
      gain: incrementalObjectiveGain(
        coverage,
        zone,
        hourThreshold,
        objective,
      ),
    }))
    .filter((row) => row.gain > 0)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, alternativeCount);

  return ranked.map((row, index) => {
    const projectedCoverage = mergeNodeIntoCoverage(coverage, row.zone);
    const projected = summaryAtThreshold(
      projectedCoverage,
      hourThreshold,
      metroTotalPopulation,
      metroTotalDemandIndex,
    );
    return {
      rank: index + 1,
      zone: row.zone,
      incrementalGain: row.gain,
      ...projected,
    };
  });
}

export type NetworkSortKey = 'population' | 'demand_index';

/** Sort served pincodes for table display. */
export function sortServedZones(
  zones: ServedZone[],
  sortKey: NetworkSortKey,
): ServedZone[] {
  return [...zones].sort((a, b) => {
    const aVal =
      sortKey === 'population'
        ? (a.zone.population ?? 0)
        : (a.zone.demand_index ?? 0);
    const bVal =
      sortKey === 'population'
        ? (b.zone.population ?? 0)
        : (b.zone.demand_index ?? 0);
    return bVal - aVal;
  });
}

export interface ZoneServedGroup {
  zoneName: string;
  zones: ServedZone[];
}

/** Group served pincodes by zone_or_taluk (A→Z), PIN within each group (A→Z). */
export function groupServedZonesByTaluk(rows: ServedZone[]): ZoneServedGroup[] {
  const byZone = new Map<string, ServedZone[]>();
  for (const row of rows) {
    const st = row.zone.zone_or_taluk;
    if (!st) continue;
    const list = byZone.get(st) ?? [];
    list.push(row);
    byZone.set(st, list);
  }
  return [...byZone.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([zoneName, zones]) => ({
      zoneName,
      zones: [...zones].sort((a, b) =>
        a.zone.pincode.localeCompare(b.zone.pincode),
      ),
    }));
}
