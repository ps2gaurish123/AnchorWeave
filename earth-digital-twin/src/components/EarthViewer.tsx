import { useEffect, useRef, useState } from 'react';
import {
  Cartesian2,
  Cartesian3,
  Color,
  createOsmBuildingsAsync,
  createWorldTerrainAsync,
  EllipsoidTerrainProvider,
  ImageryLayer,
  Ion,
  LabelStyle,
  OpenStreetMapImageryProvider,
  UrlTemplateImageryProvider,
  VerticalOrigin,
  Viewer,
  type Cesium3DTileset,
  type ScreenSpaceEventHandler
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { searchLocation } from '../services/geocodeService';
import type { GeocodeResult } from '../types/geocode';

const SATELLITE_PROVIDER = new UrlTemplateImageryProvider({
  url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  credit: 'Esri, Maxar, Earthstar Geographics, and the GIS User Community'
});

type LayerState = {
  satellite: boolean;
  labels: boolean;
  buildings: boolean;
};

export function EarthViewer() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);
  const buildingRef = useRef<Cesium3DTileset | null>(null);

  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [coords, setCoords] = useState('Lon 0.0000°, Lat 0.0000°');
  const [scale, setScale] = useState('');
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [layers, setLayers] = useState<LayerState>({
    satellite: true,
    labels: true,
    buildings: true
  });

  useEffect(() => {
    const init = async () => {
      if (!containerRef.current) {
        return;
      }

      const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN;
      if (ionToken) {
        Ion.defaultAccessToken = ionToken;
      }

      const viewer = new Viewer(containerRef.current, {
        animation: false,
        timeline: false,
        geocoder: false,
        baseLayerPicker: false,
        navigationHelpButton: false,
        sceneModePicker: false,
        selectionIndicator: false,
        shouldAnimate: true,
        terrainProvider: new EllipsoidTerrainProvider(),
        imageryProvider: new OpenStreetMapImageryProvider({
          url: 'https://tile.openstreetmap.org/'
        })
      });

      viewer.scene.globe.enableLighting = true;
      viewer.scene.skyAtmosphere.show = true;
      viewer.scene.globe.depthTestAgainstTerrain = true;
      viewer.scene.globe.showGroundAtmosphere = true;

      /*
      const cloudLayer = viewer.imageryLayers.addImageryProvider(
        new UrlTemplateImageryProvider({
          url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/2024-01-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
          credit: 'NASA GIBS',
          minimumLevel: 0,
          maximumLevel: 8
        })
      );
      cloudLayer.alpha = 0.22;
      */

      if (ionToken) {
        viewer.terrainProvider = await createWorldTerrainAsync({
          requestVertexNormals: true,
          requestWaterMask: true
        });
      }

      const cameraMoveEnd = viewer.camera.moveEnd.addEventListener(() => {
        const cameraHeight = viewer.camera.positionCartographic.height;
        setScale(cameraHeight > 1000 ? `${Math.round(cameraHeight / 1000)} km` : `${Math.round(cameraHeight)} m`);
      });

      const handler = viewer.screenSpaceEventHandler;
      handlerRef.current = handler;

      handler.setInputAction((movement: { endPosition: { x: number; y: number } }) => {
        const cartesian = viewer.camera.pickEllipsoid(movement.endPosition);
        if (!cartesian) {
          return;
        }
        const cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(cartesian);
        const lat = (cartographic.latitude * 180) / Math.PI;
        const lon = (cartographic.longitude * 180) / Math.PI;
        setCoords(`Lon ${lon.toFixed(4)}°, Lat ${lat.toFixed(4)}°`);
      });

      if (ionToken) {
        buildingRef.current = await createOsmBuildingsAsync();
        viewer.scene.primitives.add(buildingRef.current);
      }

      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(-74.006, 40.7128, 2_500_000),
        duration: 2.8
      });

      viewerRef.current = viewer;
      setReady(true);

      return () => {
        cameraMoveEnd();
      };
    };

    const cleanupPromise = init();
    return () => {
      cleanupPromise.then((cleanup) => cleanup?.());
      viewerRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) {
      return;
    }

    viewer.imageryLayers.removeAll();

    if (layers.satellite) {
      viewer.imageryLayers.addImageryProvider(SATELLITE_PROVIDER);
    } else {
      viewer.imageryLayers.addImageryProvider(
        new OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/' })
      );
    }

    if (layers.labels) {
      const labelsLayer = new UrlTemplateImageryProvider({
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        credit: 'OpenStreetMap contributors'
      });
      viewer.imageryLayers.addImageryProvider(labelsLayer);
    }

    if (layers.buildings && buildingRef.current && !viewer.scene.primitives.contains(buildingRef.current)) {
      viewer.scene.primitives.add(buildingRef.current);
    }

    if (!layers.buildings && buildingRef.current && viewer.scene.primitives.contains(buildingRef.current)) {
      viewer.scene.primitives.remove(buildingRef.current);
    }
  }, [layers]);

  const runSearch = async () => {
    if (!query.trim()) {
      return;
    }

    setLoadingSearch(true);
    try {
      const response = await searchLocation(query.trim());
      setResults(response);
    } finally {
      setLoadingSearch(false);
    }
  };

  const flyToResult = (result: GeocodeResult) => {
    const viewer = viewerRef.current;
    if (!viewer) {
      return;
    }

    viewer.entities.removeById('search-pin');
    viewer.entities.add({
      id: 'search-pin',
      position: Cartesian3.fromDegrees(result.lon, result.lat, 0),
      point: {
        pixelSize: 12,
        color: Color.ORANGE,
        outlineColor: Color.WHITE,
        outlineWidth: 2
      },
      label: {
        text: result.displayName,
        font: '13px sans-serif',
        style: LabelStyle.FILL_AND_OUTLINE,
        fillColor: Color.WHITE,
        outlineWidth: 2,
        verticalOrigin: VerticalOrigin.BOTTOM,
        pixelOffset: new Cartesian2(0, -25)
      }
    });

    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(result.lon, result.lat, 3500),
      duration: 2.5
    });
  };

  return (
    <div className="app-shell">
      {!ready && <div className="loading-overlay">Loading Earth scene…</div>}
      <div ref={containerRef} className="earth-canvas" />

      <div className="toolbar">
        <h1>Earth Digital Twin</h1>
        <p>Zoom, rotate, pan, tilt and fly using real terrain + open geodata.</p>

        <div className="search-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search city, country, or coordinates"
          />
          <button onClick={runSearch} disabled={loadingSearch}>
            {loadingSearch ? 'Searching…' : 'Search'}
          </button>
        </div>

        {results.length > 0 && (
          <ul className="result-list">
            {results.map((result) => (
              <li key={`${result.lat}-${result.lon}`}>
                <button onClick={() => flyToResult(result)}>{result.displayName}</button>
              </li>
            ))}
          </ul>
        )}

        <div className="layer-grid">
          <label>
            <input
              type="checkbox"
              checked={layers.satellite}
              onChange={(event) => setLayers((prev) => ({ ...prev, satellite: event.target.checked }))}
            />
            Satellite imagery
          </label>
          <label>
            <input
              type="checkbox"
              checked={layers.labels}
              onChange={(event) => setLayers((prev) => ({ ...prev, labels: event.target.checked }))}
            />
            Labels overlay
          </label>
          <label>
            <input
              type="checkbox"
              checked={layers.buildings}
              onChange={(event) => setLayers((prev) => ({ ...prev, buildings: event.target.checked }))}
            />
            3D buildings (where available)
          </label>
        </div>

        <div className="status-row">
          <span>{coords}</span>
          <span>Camera alt: {scale || '—'}</span>
        </div>
      </div>

      <div className="attribution-panel">
        Data: OpenStreetMap, Esri World Imagery, NASA GIBS clouds, Cesium World Terrain + OSM Buildings
        (optional with free Cesium Ion token).
      </div>
    </div>
  );
}
