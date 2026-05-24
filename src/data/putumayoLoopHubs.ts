// ─────────────────────────────────────────────────────────────────────
// Putumayo Loop hubs — one entry per organized run location.
//
// Edit this file to add, remove, or update hubs for an edition. Each
// hub needs:
//   - id        unique kebab-case key (used in subscriber.hubId, URLs)
//   - name      short display name (e.g. "Den Haag")
//   - city      city name shown under the title
//   - country   country name shown under the title
//   - coords    [latitude, longitude] of the hub's location on the map
//   - captain   optional name of the hub captain
//
// Tip for getting coords: search the city on https://www.openstreetmap.org
// and copy the lat / lon from the URL after a single click on the map.
// ─────────────────────────────────────────────────────────────────────

import type { Hub } from "./putumayoLoop";

export const hubs2026: Hub[] = [
  {
    id: "putumayo",
    name: "Putumayo",
    city: "Puerto el Carmen",
    country: "Ecuador",
    coords: [0.118, -75.91],
    captain: "Jacob van der Ende",
  },
  {
    id: "den-haag",
    name: "Den Haag",
    city: "Den Haag",
    country: "Nederland",
    coords: [52.0705, 4.3007],
    captain: "Sarah Blaszyk",
  },
  {
    id: "hulst",
    name: "Hulst",
    city: "Hulst",
    country: "Nederland",
    coords: [51.2802, 4.0521],
    captain: "Cindy Martens",
  },
];
