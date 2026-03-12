// OSM / Overpass API types

export type OSMHighwayClass =
  | 'motorway'     // dual carriageway, highest class
  | 'trunk'
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'residential'
  | 'service'
  | 'unclassified'
  | 'path'
  | 'footway'
  | 'cycleway';

export type OSMRailwayClass = 'rail' | 'subway' | 'tram' | 'light_rail' | 'narrow_gauge' | 'monorail';

export interface OSMNode {
  id: number;
  lat: number;
  lon: number;
}

export interface OSMWay {
  id: number;
  nodes: number[];
  tags: Record<string, string>;
}

export interface OSMOverpassResponse {
  elements: (OSMNode | OSMWay)[];
}

export interface OSMFeature {
  id: number;
  type: 'road' | 'railway';
  coordinates: [number, number][]; // [lon, lat] pairs
  tags: Record<string, string>;
  highwayClass?: OSMHighwayClass;
  railwayClass?: OSMRailwayClass;
}

export type BoundingBox = {
  west: number;
  south: number;
  east: number;
  north: number;
};
