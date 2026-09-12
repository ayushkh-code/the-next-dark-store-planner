import { SERVICE_HOURS_ONELINER } from './labels';

/** Methodology FAQ entries for the Methodology tab. */
export interface MethodologyFaqItem {
  question: string;
  paragraphs: string[];
  bullets?: string[];
}

export const METHODOLOGY_FAQ: MethodologyFaqItem[] = [
  {
    question: 'How is 1/2/3-hour reach calculated?',
    paragraphs: [SERVICE_HOURS_ONELINER],
  },
  {
    question: 'Where does the demographic data come from?',
    paragraphs: [
      'Population is modeled from BBMP 2011 ward totals (198 wards), grown to a current-year metro estimate and apportioned to the nearest pincode centroid. Households use urban Karnataka average household size (3.4). A small number of peri-urban PINs outside the BBMP boundary receive a residual metro allocation so the dataset tracks the 13–14 million Bengaluru metro figure. This is official public ward geography plus a documented growth and allocation model, not a household census microdata extract.',
    ],
  },
  {
    question: 'What is a PIN and why use it?',
    paragraphs: [
      'A PIN is the 6-digit India Post index (for example, "560034" is Koramangala). Inside Bengaluru metro this is the geographic unit last-mile and dark-store planners commonly use: coarse enough to model the whole city quickly, yet fine enough to distinguish neighbourhood demand centres.',
      'The app loads Bengaluru Urban / metro PINs (560xxx plus adjacent catchment codes such as Sarjapur, Electronic City fringe, Hoskote, Devanahalli, and Nelamangala). Each row has a locality centroid. PINs are always stored as text so leading zeros would be preserved if present.',
    ],
  },
  {
    question: 'What is the demand index?',
    paragraphs: [
      'Demand index is a pre-computed, unitless relative score shipped in the reference dataset. The app does not calculate it. It is a modeled proxy for dark-store demand potential, not measured order volume, sales, or a carrier rate quote.',
      'The score combines two signals at the pincode level:',
    ],
    bullets: [
      'Population scale: larger catchments score higher, reflecting more households to serve.',
      'Spending capacity: localities with higher modeled median household income receive additional weight. Income is a locality-type proxy (IT corridor, established residential, industrial, peri-urban), not a surveyed microdatum.',
    ],
  },
  {
    question: 'How should I interpret demand index totals and percentages?',
    paragraphs: [
      'Values are comparable across pincodes and can be summed for reachable coverage totals. On Reach & Expand, demand served % is the sum of demand index for served PINs divided by total Bengaluru metro demand index in the dataset.',
      'Demand index is not normalized to forecast order counts and should not be read as predicted shipments.',
    ],
  },
  {
    question: 'How are service hours and service bands calculated?',
    paragraphs: [
      'Service hours and bands are computed client-side from pincode centroids using last-mile heuristics tuned for Bengaluru roads:',
    ],
    bullets: [
      'Great-circle km: haversine formula (Earth radius 6,371 km).',
      'Road km: great-circle × 1.35 (urban circuity; higher than the US highway factor of 1.17).',
      'Service hours: road km mapped to hour buckets: ≤8 km → 1h, ≤16 km → 2h, ≤28 km → 3h, ≤45 km → 4h, else 5h.',
      'Service band: road km mapped to bands 2–6 for the served-pincode table.',
    ],
  },
  {
    question: 'How does Reach & Expand work?',
    paragraphs: [
      'Add one or more current node PINs. Each demand pincode is assigned to the nearest node by service hours. A pincode counts as served if any node can reach it within the selected service standard (1, 2, or 3 hours).',
      'Demand served % is the sum of demand index for served PINs divided by total metro demand index; population % uses the same union logic. The expansion planner ranks alternative next sites by incremental demand, population, or pincode count. The UI shows the top pick, with more independent alternatives on request. Excluding a site removes it from the candidate set.',
      'The coverage map shades BBMP wards and peri-urban taluks by last-mile service hours from the nearest node (1h rust, 2h orange, 3h peach). Hours beyond the selected threshold stay beige. Navy markers are existing nodes; green markers with a pulse are recommended next sites.',
    ],
  },
  {
    question: 'What limitations should I keep in mind?',
    paragraphs: [
      'This tool is for exploratory dark-store and micro-fulfillment siting, not carrier quoting or financial forecasting. Distances use straight-line approximations, not actual road networks or live traffic. Hour buckets are modeled heuristics, not promised SLA.',
      'Demand index, service hours, and income are estimates from public geography plus a documented model, not measured demand or quoted rates.',
      'Population is apportioned from 2011 BBMP wards with a growth factor, not a 2024 census of each PIN. Ward outlines on the maps are simplified from the official BBMP 2011 ward file. Peri-urban taluk outlines and named lakes (Bellandur, Varthur, Halasuru, Hebbal, Sankey, Agara, Madiwala) are from OpenStreetMap and are clipped to the metro frame.',
    ],
  },
];
