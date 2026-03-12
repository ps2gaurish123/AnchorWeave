/**
 * Export Service
 * Exports scene content (roads, railways, placed models) into downloadable
 * OBJ or GLB files.
 *
 * Strategy:
 *  - Placed GLB/GLTF models are packaged directly via Three.js GLTFExporter.
 *  - Road/railway polylines are converted to thin 3D tube geometry then exported.
 *  - OBJ export uses Three.js OBJExporter.
 *  - Full terrain mesh export is not included (too heavy); only vector geometry
 *    and placed models are exported. A notice is shown to the user.
 *
 * Attribution: Three.js by mrdoob et al (MIT)
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import type { OSMFeature } from '../types/osm';
import type { PlacedModel } from '../types/model';

export type ExportFormat = 'glb' | 'obj';

export interface ExportOptions {
  format: ExportFormat;
  includeRoads: boolean;
  includeRailways: boolean;
  includeModels: boolean;
  roads: OSMFeature[];
  railways: OSMFeature[];
  models: PlacedModel[];
}

// ─── Geometry builders ────────────────────────────────────────────────────────

const DEG2RAD = Math.PI / 180;
const EARTH_RADIUS = 6_371_000; // metres

/** Convert lon/lat to approximate XZ metres (flat-earth for export extent) */
function lonLatToXZ(lon: number, lat: number, originLon: number, originLat: number): [number, number] {
  const x = (lon - originLon) * DEG2RAD * EARTH_RADIUS * Math.cos(originLat * DEG2RAD);
  const z = (lat - originLat) * DEG2RAD * EARTH_RADIUS;
  return [x, -z]; // negate z so North is up in canvas coords
}

/** Build a flat ribbon geometry for a polyline */
function buildPolylineGeometry(
  coords: [number, number][],
  width: number,
  originLon: number,
  originLat: number,
  yLevel = 0,
): THREE.BufferGeometry {
  const points = coords.map(([lon, lat]) => {
    const [x, z] = lonLatToXZ(lon, lat, originLon, originLat);
    return new THREE.Vector3(x, yLevel, z);
  });

  const curve = new THREE.CatmullRomCurve3(points);
  const tube = new THREE.TubeGeometry(curve, Math.max(points.length * 2, 8), width / 2, 4, false);
  return tube;
}

/** Compute bbox centroid from a list of features */
function computeOrigin(
  roads: OSMFeature[],
  railways: OSMFeature[],
): { lon: number; lat: number } {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  const allFeatures = [...roads, ...railways];
  for (const f of allFeatures) {
    for (const [lon, lat] of f.coordinates) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return {
    lon: (minLon + maxLon) / 2,
    lat: (minLat + maxLat) / 2,
  };
}

// ─── Scene builder ────────────────────────────────────────────────────────────

async function buildExportScene(options: ExportOptions): Promise<THREE.Group> {
  const scene = new THREE.Group();

  const origin = computeOrigin(
    options.includeRoads ? options.roads : [],
    options.includeRailways ? options.railways : [],
  );

  // Roads
  if (options.includeRoads) {
    const roadGroup = new THREE.Group();
    roadGroup.name = 'Roads';
    for (const feature of options.roads) {
      if (feature.type !== 'road' || feature.coordinates.length < 2) continue;
      const geo = buildPolylineGeometry(feature.coordinates, 8, origin.lon, origin.lat, 0.5);
      const mat = new THREE.MeshBasicMaterial({ color: 0xfecc5c });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = `road_${feature.id}`;
      roadGroup.add(mesh);
    }
    scene.add(roadGroup);
  }

  // Railways
  if (options.includeRailways) {
    const railGroup = new THREE.Group();
    railGroup.name = 'Railways';
    for (const feature of options.railways) {
      if (feature.type !== 'railway' || feature.coordinates.length < 2) continue;
      const geo = buildPolylineGeometry(feature.coordinates, 4, origin.lon, origin.lat, 0.5);
      const mat = new THREE.MeshBasicMaterial({ color: 0x5e5e8a });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = `railway_${feature.id}`;
      railGroup.add(mesh);
    }
    scene.add(railGroup);
  }

  // Placed Models
  if (options.includeModels && options.models.length > 0) {
    const loader = new GLTFLoader();
    for (const model of options.models) {
      if (!model.visible) continue;
      if (model.fileType !== 'glb' && model.fileType !== 'gltf') {
        // OBJ models are skipped in GLB export – would need OBJ loader + MTL
        console.warn(`[exportService] OBJ models skipped in 3D export: ${model.name}`);
        continue;
      }
      try {
        const gltf = await new Promise<THREE.Group>((resolve, reject) => {
          loader.load(model.url, (g) => resolve(g.scene), undefined, reject);
        });

        // Position in export-local coords
        const { longitude: lon, latitude: lat, height, scale } = model.transform;
        const [x, z] = lonLatToXZ(lon, lat, origin.lon, origin.lat);
        gltf.position.set(x, height, z);
        gltf.scale.setScalar(scale);
        gltf.name = model.name;
        scene.add(gltf);
      } catch (err) {
        console.warn(`[exportService] Failed to load model ${model.name}:`, err);
      }
    }
  }

  return scene;
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Export scene to GLB and trigger browser download */
export async function exportToGLB(options: ExportOptions): Promise<void> {
  const scene = await buildExportScene(options);
  const exporter = new GLTFExporter();

  const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => {
        if (result instanceof ArrayBuffer) resolve(result);
        else reject(new Error('Expected binary GLB output'));
      },
      (err) => reject(err),
      { binary: true },
    );
  });

  const blob = new Blob([arrayBuffer], { type: 'model/gltf-binary' });
  triggerDownload(blob, 'earth-digital-twin-export.glb');
}

/** Export scene to OBJ and trigger browser download */
export async function exportToOBJ(options: ExportOptions): Promise<void> {
  const scene = await buildExportScene(options);
  const exporter = new OBJExporter();
  const text = exporter.parse(scene);
  const blob = new Blob([text], { type: 'text/plain' });
  triggerDownload(blob, 'earth-digital-twin-export.obj');
}
