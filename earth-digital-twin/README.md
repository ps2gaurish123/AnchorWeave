# Earth Digital Twin (Browser, Open Data)

A browser-based 3D Earth digital twin built with **React + TypeScript + Vite + CesiumJS**.

Features:
- Realistic globe with atmosphere, terrain, and day/night lighting
- Real terrain elevation (free Cesium Ion token required)
- Smooth zoom/rotate/pan/tilt from orbit to street level
- Live **roads and railway tracks** from OpenStreetMap (Overpass API)
- **3D model placement** — load GLB, GLTF, or OBJ files (file upload or URL)
- **Export scene** to downloadable `.glb` or `.obj`
- Location search + fly-to + pin drop

## Quick start

```bash
cd earth-digital-twin
npm install
cp .env.example .env
# add your free token from https://ion.cesium.com  (optional but recommended)
npm run dev
```

Open: http://localhost:5173

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `VITE_CESIUM_ION_TOKEN` | Optional | Enables Cesium World Terrain & OSM Buildings |

Without a token the app uses ellipsoid terrain and Natural Earth II imagery — full feature set still works.

## Demo flow

### Toggle roads / railways
1. Open the **🗺️ Layers** side panel (right side of screen).
2. Search for a city (e.g. "Berlin") and fly there.
3. Enable **Roads** → roads appear clamped to terrain.
4. Enable **Railways** → rail lines appear in purple/blue.
5. Click **🔄** to reload OSM data for the current camera view.

> **Note**: Zoom into a city-scale view before enabling. Areas > ~5 sq-degrees are rejected to protect Overpass API.

### Load a 3D model
1. Open the **📦 Models** side panel.
2. Click **📂 Upload file** and choose a `.glb`, `.gltf`, or `.obj` file.
   - Or paste a public URL and click **Load URL**.
3. Click **✏️** next to the model to open the transform editor.
4. Set Longitude, Latitude, Height, Heading, Pitch, Roll, Scale.
5. Toggle visibility with 👁 or remove with 🗑.

> OBJ files are accepted for upload but rendered as an OBJ entity in export only (CesiumJS natively supports GLB/GLTF).

### Export GLB / OBJ
1. Open the **📥 Export** side panel.
2. Choose format: **GLB** or **OBJ**.
3. Select what to include: Roads / Railways / Models.
4. Click **Export** → browser downloads the file.

> ⚠️ Terrain mesh is **not** included in exports. Only vector geometry (roads/railways as tube meshes) and placed GLB/GLTF models are exported. Coordinates use a flat-earth local frame centered on the scene centroid.

## Architecture

```
src/
  components/
    EarthViewer.tsx       – Main viewer; integrates all panels & Cesium state
    LayerControls.tsx     – Terrain, buildings, roads, railways toggles
    ModelManager.tsx      – 3D model upload/URL/list/transform editor
    ExportPanel.tsx       – Format picker + export trigger
  services/
    geocodeService.ts     – Nominatim geocoding
    osmService.ts         – Overpass API fetch, in-memory cache, styling helpers
    modelImportService.ts – File/URL model import, Object URL lifecycle
    exportService.ts      – Three.js GLTFExporter/OBJExporter + download
  types/
    geocode.ts            – GeocodeResult
    osm.ts                – OSMFeature, BoundingBox, highway/railway classes
    model.ts              – PlacedModel, ModelTransform
  styles/
    app.css               – Full UI theme
```

## Free/public data sources and attribution

| Source | Usage | License |
|---|---|---|
| **OpenStreetMap** (Overpass API) | Roads & railways | © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright) |
| **Cesium World Terrain** | Terrain DEM | Cesium Ion free tier |
| **Cesium OSM Buildings** | 3D buildings | Cesium Ion + ODbL |
| **Natural Earth II** | Fallback globe imagery | Public Domain |
| **Nominatim** | Location search | ODbL |
| **Three.js** | 3D export | MIT |

Attribution is also shown in the in-app footer.

## Known limitations

- **Overpass API rate limits**: repeated large-area queries may be throttled. The in-memory cache helps avoid duplicate requests.
- **OBJ render**: OBJ files are not rendered in the Cesium viewer (no native OBJ loader). They are supported in OBJ exports only.
- **Terrain in exports**: terrain mesh is excluded for performance reasons.
- **Large OSM areas**: queries spanning > ~5 sq-degrees are rejected client-side.
- **Chunk size**: Cesium + Three.js produce a large bundle (~4.5 MB); code-splitting is a future enhancement.

## Setup troubleshooting

If `npm install` fails (registry/proxy errors):

```bash
npm config set registry https://registry.npmjs.org/
npm cache clean --force
npm install
```
