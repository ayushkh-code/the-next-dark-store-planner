/** User-facing copy for PIN terminology. */
export const PIN_HELP = '(i.e., 6-digit India PIN code)';

export function pinLabel(suffix = ''): string {
  return suffix ? `PIN ${PIN_HELP} ${suffix}` : `PIN ${PIN_HELP}`;
}

/** Explainer shown on service-hour hover tooltips. */
export const SERVICE_HOURS_TOOLTIP =
  'Service hours estimate last-mile time from road kilometres. Road km ≈ great-circle distance between pincode centroids × 1.35. Hour buckets: ≤8 km → 1h, ≤16 km → 2h, ≤28 km → 3h, ≤45 km → 4h, else 5h.';

export const EMPTY_NODE_PROMPT =
  'Add a dark-store PIN above to map your coverage.';

/** Hover tooltip on Service speed superscript (1/2/3-hour km thresholds). */
export const SERVICE_SPEED_KM_TOOLTIP =
  '1h / 2h / 3h = 8 / 16 / 28 road km';

/** Short visible explainer for service-hour methodology (all tabs). */
export const SERVICE_HOURS_ONELINER =
  'Great-circle km between pincode centroids × 1.35 ≈ road km; ≤8 km → 1h, ≤16 km → 2h, ≤28 km → 3h.';
