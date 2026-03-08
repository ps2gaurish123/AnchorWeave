# Earth Digital Twin (Browser, Open Data)

A first working version of a browser-based 3D Earth digital twin built with **React + TypeScript + Vite + CesiumJS**.

It supports:
- realistic globe rendering with atmosphere and day/night lighting,
- real terrain elevation (when a free Cesium Ion token is provided),
- smooth zoom/rotate/pan/tilt from orbit down to local scale,
- search + fly-to + pin drop,
- layer toggles for imagery, labels, and 3D buildings,
- loading state, attribution panel, and responsive overlay UI.

## Quick start

```bash
cd earth-digital-twin
npm install
cp .env.example .env
# add your free token from https://ion.cesium.com
npm run dev
```

Open: http://localhost:5173

## One-command bootstrap (recommended)

Use the helper script to prepare a fresh machine:

```bash
cd earth-digital-twin
./scripts/bootstrap.sh
npm run dev
```

This script:
- checks `node` and `npm`,
- sets npm registry to `https://registry.npmjs.org/`,
- installs dependencies,
- creates `.env` from `.env.example` if missing,
- runs `npm run build` to validate installation.

## Configuration

- `VITE_CESIUM_ION_TOKEN` (optional but recommended)
  - Enables Cesium World Terrain DEM and OSM Buildings tileset.
  - Without it, the app still runs using ellipsoid terrain with open imagery.

## Troubleshooting installs

If `npm install` fails (registry/proxy errors):

```bash
npm config get registry
npm config get proxy
npm config get https-proxy

npm config set registry https://registry.npmjs.org/
npm config delete proxy
npm config delete https-proxy
npm cache clean --force
```

Then retry:

```bash
npm install
npm run build
npm run dev
```

## Architecture summary

- `src/components/EarthViewer.tsx`
  - Cesium Viewer lifecycle
  - terrain/layer initialization
  - camera/coordinate status updates
  - search + fly-to + marker
  - UI overlay and controls
- `src/services/geocodeService.ts`
  - Nominatim geocoder integration
- `src/styles/app.css`
  - lightweight UI styling

## Free/public data sources used

1. **Terrain / Elevation**
   - Cesium World Terrain (global DEM), free for evaluation/non-commercial tiers via Cesium Ion token.
2. **Imagery**
   - Esri World Imagery tiles.
   - OpenStreetMap raster tiles (labels/base fallback).
3. **Cloud visual overlay**
   - NASA GIBS VIIRS true color WMTS tiles.
4. **Search**
   - OpenStreetMap Nominatim geocoding.
5. **3D buildings**
   - Cesium OSM Buildings (where available), served via Cesium Ion.

## Limitations and graceful degradation

- True global street-level photorealistic 3D coverage is not fully available from free/open sources.
- 3D buildings coverage is region-dependent and denser in mapped urban areas.
- Terrain/building fidelity depends on source data availability and selected zoom level.
- If Ion token is missing, the app degrades gracefully:
  - no DEM terrain drape,
  - no OSM Buildings tileset,
  - full interaction still works (zoom/rotate/pan/tilt/search/layers).

## Performance notes

- Cesium streams terrain + imagery by viewport and zoom level (tile LOD).
- UI is lightweight and runs outside render loop.
- Only essential layers are enabled by default; toggles allow disabling optional layers.
