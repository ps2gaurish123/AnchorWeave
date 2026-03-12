/**
 * OSM Service: fetches roads and railways from the Overpass API.
 * Uses a simple in-memory cache keyed by bbox + feature type.
 *
 * Attribution: © OpenStreetMap contributors (ODbL)
 * https://www.openstreetmap.org/copyright
 */

import type {
  BoundingBox,
  OSMFeature,
  OSMHighwayClass,
  OSMNode,
  OSMOverpassResponse,
  OSMRailwayClass,
  OSMWay,
} from '../types/osm';

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

// Simple in-memory cache: key = "type:west,south,east,north"
const featureCache = new Map<string, OSMFeature[]>();

/** Round bbox coord to ~1 km to improve cache hits */
function roundBbox(bbox: BoundingBox, precision = 2): BoundingBox {
  const r = (v: number) => parseFloat(v.toFixed(precision));
  return { west: r(bbox.west), south: r(bbox.south), east: r(bbox.east), north: r(bbox.north) };
}

function cacheKey(type: 'road' | 'railway', bbox: BoundingBox): string {
  return `${type}:${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
}

/** Build OverpassQL query for a given type and bbox */
function buildQuery(type: 'road' | 'railway', bbox: BoundingBox): string {
  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  if (type === 'road') {
    // Broad set of highway types
    return `[out:json][timeout:25];
(
  way["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified"](${bboxStr});
);
out body;>;out skel qt;`;
  } else {
    return `[out:json][timeout:25];
(
  way["railway"~"rail|subway|tram|light_rail|narrow_gauge|monorail"](${bboxStr});
);
out body;>;out skel qt;`;
  }
}

/** Parse Overpass response into OSMFeature array */
function parseOverpassResponse(
  data: OSMOverpassResponse,
  type: 'road' | 'railway',
): OSMFeature[] {
  // Build a node lookup table
  const nodeMap = new Map<number, OSMNode>();
  for (const el of data.elements) {
    if (!('tags' in el)) {
      // It's a bare node element (no tags)
      const n = el as OSMNode;
      nodeMap.set(n.id, n);
    } else if (!('nodes' in el)) {
      // It's a node with tags (unlikely in ways response but guard)
      const n = el as unknown as OSMNode;
      if (typeof n.lat === 'number') nodeMap.set(n.id, n);
    }
  }

  const features: OSMFeature[] = [];

  for (const el of data.elements) {
    if (!('nodes' in el)) continue; // skip nodes, process ways only
    const way = el as OSMWay;

    const coords: [number, number][] = [];
    for (const nodeId of way.nodes) {
      const n = nodeMap.get(nodeId);
      if (n) coords.push([n.lon, n.lat]);
    }
    if (coords.length < 2) continue;

    const feature: OSMFeature = {
      id: way.id,
      type,
      coordinates: coords,
      tags: way.tags ?? {},
    };

    if (type === 'road') {
      feature.highwayClass = (way.tags?.highway as OSMHighwayClass) ?? 'unclassified';
    } else {
      feature.railwayClass = (way.tags?.railway as OSMRailwayClass) ?? 'rail';
    }

    features.push(feature);
  }

  return features;
}

/**
 * Fetch OSM features (roads or railways) for a given bounding box.
 * Results are cached in memory.
 */
export async function fetchOSMFeatures(
  bbox: BoundingBox,
  type: 'road' | 'railway',
  signal?: AbortSignal,
): Promise<OSMFeature[]> {
  const roundedBbox = roundBbox(bbox);
  const key = cacheKey(type, roundedBbox);

  if (featureCache.has(key)) {
    return featureCache.get(key)!;
  }

  const query = buildQuery(type, roundedBbox);

  const response = await fetch(OVERPASS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal,
  });

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
  }

  const data: OSMOverpassResponse = await response.json();
  const features = parseOverpassResponse(data, type);

  featureCache.set(key, features);
  return features;
}

/** Clear the entire in-memory cache */
export function clearOSMCache(): void {
  featureCache.clear();
}

/** Get styling parameters for a road highway class */
export function getRoadStyle(highwayClass?: OSMHighwayClass): { width: number; color: string } {
  switch (highwayClass) {
    case 'motorway': return { width: 5.5, color: '#fc8d62' };
    case 'trunk':    return { width: 4.5, color: '#fd8d3c' };
    case 'primary':  return { width: 3.5, color: '#fecc5c' };
    case 'secondary':return { width: 2.5, color: '#ffffb2' };
    case 'tertiary': return { width: 2.0, color: '#ffffff' };
    default:         return { width: 1.5, color: '#cccccc' };
  }
}

/** Get styling parameters for a railway class */
export function getRailwayStyle(railwayClass?: OSMRailwayClass): { width: number; color: string; dashPattern?: boolean } {
  switch (railwayClass) {
    case 'subway':
    case 'light_rail':
    case 'tram':    return { width: 2.0, color: '#66c2a5', dashPattern: true };
    default:        return { width: 2.5, color: '#5e5e8a', dashPattern: false };
  }
}
