import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildModuleUrl,
  Cartesian2,
  Cartesian3,
  Color,
  ColorMaterialProperty,
  createOsmBuildingsAsync,
  createWorldTerrainAsync,
  EllipsoidTerrainProvider,
  HeadingPitchRoll,
  ImageryLayer,
  Ion,
  LabelStyle,
  Math as CesiumMath,
  Model,
  ScreenSpaceEventType,
  TileMapServiceImageryProvider,
  Transforms,
  VerticalOrigin,
  Viewer,
  type Cesium3DTileset,
  type Entity,
  type ScreenSpaceEventHandler,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

import { searchLocation, reverseGeocode } from '../services/geocodeService';
import { fetchOSMFeatures, getRoadStyle, getRailwayStyle } from '../services/osmService';
import { revokeModelUrl } from '../services/modelImportService';

import type { GeocodeResult } from '../types/geocode';
import type { OSMFeature, BoundingBox } from '../types/osm';
import type { PlacedModel } from '../types/model';

import { LayerControls, type LayerState } from './LayerControls';
import { ModelManager } from './ModelManager';
import { ExportPanel } from './ExportPanel';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBboxFromViewer(viewer: Viewer): BoundingBox | null {
  const rect = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid);
  if (!rect) return null;
  return {
    west: CesiumMath.toDegrees(rect.west),
    south: CesiumMath.toDegrees(rect.south),
    east: CesiumMath.toDegrees(rect.east),
    north: CesiumMath.toDegrees(rect.north),
  };
}

function bboxAreaDeg(bbox: BoundingBox): number {
  return (bbox.east - bbox.west) * (bbox.north - bbox.south);
}

// ─── Component ────────────────────────────────────────────────────────────────

type SidePanel = 'layers' | 'models' | 'export' | null;

export function EarthViewer() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);
  const buildingRef = useRef<Cesium3DTileset | null>(null);

  // Per-model Cesium primitive refs (model id → primitive)
  const modelPrimitivesRef = useRef<Map<string, Model>>(new Map());
  // OSM entity ids currently added to viewer
  const osmEntityIdsRef = useRef<Set<string>>(new Set());

  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [coords, setCoords] = useState('Lon 0.0000°, Lat 0.0000°');
  const [scale, setScale] = useState('');
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [hasIonToken, setHasIonToken] = useState(false);
  const [activePanel, setActivePanel] = useState<SidePanel>('layers');

  const [layers, setLayers] = useState<LayerState>({
    terrain: true,
    buildings: true,
    roads: false,
    railways: false,
  });

  const [models, setModels] = useState<PlacedModel[]>([]);
  const [roads, setRoads] = useState<OSMFeature[]>([]);
  const [railways, setRailways] = useState<OSMFeature[]>([]);
  const [loadingRoads, setLoadingRoads] = useState(false);
  const [loadingRailways, setLoadingRailways] = useState(false);
  const [osmError, setOsmError] = useState('');

  // ─── Viewer Init ────────

  useEffect(() => {
    const init = async () => {
      if (!containerRef.current) return;

      const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN;
      const tokenAvailable = Boolean(ionToken && String(ionToken).trim());
      setHasIonToken(tokenAvailable);
      if (tokenAvailable) Ion.defaultAccessToken = ionToken;

      const baseLayer = ImageryLayer.fromProviderAsync(
        TileMapServiceImageryProvider.fromUrl(
          buildModuleUrl('Assets/Textures/NaturalEarthII')
        ),
        {}
      );

      const viewer = new Viewer(containerRef.current, {
        animation: false,
        timeline: false,
        geocoder: false,
        baseLayerPicker: false,
        navigationHelpButton: false,
        sceneModePicker: false,
        selectionIndicator: true,
        shouldAnimate: true,
        terrainProvider: new EllipsoidTerrainProvider(),
        baseLayer,
      });

      viewer.scene.globe.baseColor = Color.fromBytes(20, 40, 80, 255);

      // Nicer building titles when selected
      viewer.selectedEntityChanged.addEventListener((selectedEntity) => {
        if (selectedEntity && selectedEntity.properties) {
          const props = selectedEntity.properties.getValue(viewer.clock.currentTime);
          
          // Initial fast name setting
          let baseName = '';
          if (props && (props.building || props.elementId)) {
            baseName = props.name || props['addr:housename'] || `Building (ID: ${props.elementId || 'Unknown'})`;
            selectedEntity.name = baseName;
          }

          // Then try reverse geocoding if we have lat/lon properties to give it a real name
          if (props['cesium#latitude'] && props['cesium#longitude']) {
            const lat = Number(props['cesium#latitude']);
            const lon = Number(props['cesium#longitude']);
            
            selectedEntity.description = '<p><em>Looking up address...</em></p>';
            
            reverseGeocode(lat, lon).then((address) => {
              if (address && selectedEntity === viewer.selectedEntity) {
                // If it's just a generic "Building (ID...)", replace the whole name
                if (baseName.startsWith('Building (ID')) {
                   selectedEntity.name = address;
                }
                // Always add the real address to the description
                const existingDesc = selectedEntity.description || '';
                const newDesc = existingDesc.toString().replace('<p><em>Looking up address...</em></p>', '');
                
                selectedEntity.description = `
                  <div style="padding: 10px; font-family: sans-serif; line-height: 1.4;">
                    <strong style="color: #6ab6e8;">Real Address</strong><br/>
                    ${address}
                  </div>
                  <hr style="border:0; border-top: 1px solid #334; margin: 10px 0;" />
                  ${newDesc}
                `;
              } else if (selectedEntity === viewer.selectedEntity) {
                // Cleanup loading state if failed
                 const existingDesc = selectedEntity.description || '';
                 selectedEntity.description = existingDesc.toString().replace('<p><em>Looking up address...</em></p>', '<p><em>No exact address found.</em></p>');
              }
            });
          }
        }
      });
      viewer.scene.globe.enableLighting = true;
      if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
      viewer.scene.globe.depthTestAgainstTerrain = false;
      viewer.scene.globe.showGroundAtmosphere = true;

      if (tokenAvailable && layers.terrain) {
        viewer.terrainProvider = await createWorldTerrainAsync({
          requestVertexNormals: true,
          requestWaterMask: true,
        });
        viewer.scene.globe.depthTestAgainstTerrain = true;
      }

      if (tokenAvailable && layers.buildings) {
        buildingRef.current = await createOsmBuildingsAsync();
        viewer.scene.primitives.add(buildingRef.current);
      }

      const removeCameraMoveEnd = viewer.camera.moveEnd.addEventListener(() => {
        const h = viewer.camera.positionCartographic.height;
        setScale(h > 1000 ? `${Math.round(h / 1000)} km` : `${Math.round(h)} m`);
      });

      const handler = viewer.screenSpaceEventHandler;
      handlerRef.current = handler;

      handler.setInputAction(
        (movement: { endPosition: Cartesian2 }) => {
          const cartesian = viewer.camera.pickEllipsoid(movement.endPosition);
          if (!cartesian) return;
          const cg = viewer.scene.globe.ellipsoid.cartesianToCartographic(cartesian);
          const lat = (cg.latitude * 180) / Math.PI;
          const lon = (cg.longitude * 180) / Math.PI;
          setCoords(`Lon ${lon.toFixed(4)}°, Lat ${lat.toFixed(4)}°`);
        },
        ScreenSpaceEventType.MOUSE_MOVE
      );

      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(-74.006, 40.7128, 2_500_000),
        duration: 2.8,
      });

      viewerRef.current = viewer;
      setReady(true);

      return () => {
        removeCameraMoveEnd();
      };
    };

    const cleanupPromise = init();

    return () => {
      cleanupPromise.then((cleanup) => cleanup?.());
      handlerRef.current = null;
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Terrain/Buildings Toggle ────────

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !hasIonToken) return;

    const updateScene = async () => {
      if (layers.terrain) {
        viewer.terrainProvider = await createWorldTerrainAsync({
          requestVertexNormals: true,
          requestWaterMask: true,
        });
        viewer.scene.globe.depthTestAgainstTerrain = true;
      } else {
        viewer.terrainProvider = new EllipsoidTerrainProvider();
        viewer.scene.globe.depthTestAgainstTerrain = false;
      }

      if (layers.buildings) {
        if (!buildingRef.current) {
          buildingRef.current = await createOsmBuildingsAsync();
          viewer.scene.primitives.add(buildingRef.current);
        }
        buildingRef.current.show = true;
      } else if (buildingRef.current) {
        buildingRef.current.show = false;
      }
    };

    void updateScene();
  }, [layers.terrain, layers.buildings, hasIonToken]);

  // ─── OSM: Remove all entities helper ────────

  const clearOSMEntities = useCallback((type: 'road' | 'railway') => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const prefix = `osm-${type}-`;
    const toRemove: Entity[] = [];
    viewer.entities.values.forEach((entity) => {
      if (entity.id.startsWith(prefix)) toRemove.push(entity);
    });
    toRemove.forEach((e) => viewer.entities.remove(e));
    toRemove.forEach((e) => osmEntityIdsRef.current.delete(e.id));
  }, []);

  // ─── OSM: Render features ────────

  const renderOSMFeatures = useCallback((features: OSMFeature[]) => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    console.log(`[EarthViewer] Rendering ${features.length} OSM features`);
    let addedCount = 0;

    for (const feature of features) {
      const entityId = `osm-${feature.type}-${feature.id}`;
      if (osmEntityIdsRef.current.has(entityId)) continue; // already rendered

      const positions = feature.coordinates.map(([lon, lat]) =>
        Cartesian3.fromDegrees(lon, lat) // no height: placed directly on WGS84 ellipsoid
      );
      if (positions.length < 2) continue;

      let width: number;
      let color: Color;

      if (feature.type === 'road') {
        const s = getRoadStyle(feature.highwayClass);
        width = s.width;
        color = Color.fromCssColorString(s.color);
      } else {
        const s = getRailwayStyle(feature.railwayClass);
        width = s.width;
        color = Color.fromCssColorString(s.color);
      }

      const displayName = feature.tags.name || `${feature.type === 'road' ? 'Road' : 'Railway'} (${feature.id})`;
      const descHtml = `
        <table class="cesium-infoBox-defaultTable">
          <tbody>
            ${Object.entries(feature.tags)
              .map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`)
              .join('')}
          </tbody>
        </table>
      `;

      viewer.entities.add({
        id: entityId,
        name: displayName,
        description: descHtml, // Add description for the Infobox
        polyline: {
          positions,
          width,
          material: new ColorMaterialProperty(color),
          clampToGround: true, // Re-enabled for proper terrain wrapping
        },
      });
      osmEntityIdsRef.current.add(entityId);
      addedCount++;
    }
    console.log(`[EarthViewer] Successfully added ${addedCount} new polyline entities to Cesium`);
  }, []);

  // ─── OSM: Fetch + render on layer toggle ────────

  const fetchAndRenderOSM = useCallback(
    async (type: 'road' | 'railway', bbox: BoundingBox) => {
      const isTooLarge = bboxAreaDeg(bbox) > 5; // > 5 sq-degrees warn + skip
      if (isTooLarge) {
        setOsmError(`Zoom in more to load ${type}s (current extent is too large).`);
        return;
      }
      setOsmError('');

      if (type === 'road') setLoadingRoads(true);
      else setLoadingRailways(true);

      try {
        const features = await fetchOSMFeatures(bbox, type);
        if (type === 'road') setRoads((prev) => [...prev, ...features.filter((f) => !prev.find((p) => p.id === f.id))]);
        else setRailways((prev) => [...prev, ...features.filter((f) => !prev.find((p) => p.id === f.id))]);
        renderOSMFeatures(features);
      } catch (err: unknown) {
        setOsmError(`Failed to load ${type}s: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        if (type === 'road') setLoadingRoads(false);
        else setLoadingRailways(false);
      }
    },
    [renderOSMFeatures]
  );

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (layers.roads) {
      const bbox = getBboxFromViewer(viewer);
      if (bbox) void fetchAndRenderOSM('road', bbox);
    } else {
      clearOSMEntities('road');
    }
  }, [layers.roads]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (layers.railways) {
      const bbox = getBboxFromViewer(viewer);
      if (bbox) void fetchAndRenderOSM('railway', bbox);
    } else {
      clearOSMEntities('railway');
    }
  }, [layers.railways]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── OSM: Visibility on existing entities ────────

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.entities.values.forEach((entity) => {
      if (entity.id.startsWith('osm-road-') && entity.polyline) {
        entity.show = layers.roads;
      }
    });
  }, [layers.roads]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.entities.values.forEach((entity) => {
      if (entity.id.startsWith('osm-railway-') && entity.polyline) {
        entity.show = layers.railways;
      }
    });
  }, [layers.railways]);

  // ─── Models: Sync to Cesium scene ────────

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const primitivesRef = modelPrimitivesRef.current;

    // Remove primitives for deleted models
    const modelIds = new Set(models.map((m) => m.id));
    for (const [id, prim] of primitivesRef) {
      if (!modelIds.has(id)) {
        if (viewer.scene.primitives.contains(prim)) {
          viewer.scene.primitives.remove(prim);
        }
        primitivesRef.delete(id);
      }
    }

    // Add / update models
    for (const model of models) {
      const { longitude, latitude, height, heading, pitch, roll, scale: modelScale } = model.transform;

      if (model.fileType === 'obj') {
        // OBJ not natively supported by CesiumJS – just skip rendering here,
        // user can still see it in export
        continue;
      }

      const position = Cartesian3.fromDegrees(longitude, latitude, height);
      const hpr = new HeadingPitchRoll(
        CesiumMath.toRadians(heading),
        CesiumMath.toRadians(pitch),
        CesiumMath.toRadians(roll)
      );
      const modelMatrix = Transforms.headingPitchRollToFixedFrame(position, hpr);

      const existing = primitivesRef.get(model.id);

      if (existing) {
        // Update transform + visibility
        existing.modelMatrix = modelMatrix;
        existing.scale = modelScale;
        existing.show = model.visible;
      } else {
        // Create new Cesium Model
        try {
          const prim = viewer.scene.primitives.add(
            Model.fromGltfAsync({
              url: model.url,
              modelMatrix,
              scale: modelScale,
              show: model.visible,
            })
          ) as unknown as Model;
          primitivesRef.set(model.id, prim);
        } catch (err) {
          console.warn('[EarthViewer] Failed to add model to Cesium:', err);
        }
      }
    }
  }, [models]);

  // ─── Cleanup model URLs on unmount ────────

  useEffect(() => {
    return () => {
      models.forEach(revokeModelUrl);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Search ────────

  const runSearch = async () => {
    if (!query.trim()) return;
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
    if (!viewer) return;
    viewer.entities.removeById('search-pin');
    viewer.entities.add({
      id: 'search-pin',
      position: Cartesian3.fromDegrees(result.lon, result.lat, 0),
      point: { pixelSize: 12, color: Color.ORANGE, outlineColor: Color.WHITE, outlineWidth: 2 },
      label: {
        text: result.displayName,
        font: '13px sans-serif',
        style: LabelStyle.FILL_AND_OUTLINE,
        fillColor: Color.WHITE,
        outlineWidth: 2,
        verticalOrigin: VerticalOrigin.BOTTOM,
        pixelOffset: new Cartesian2(0, -25),
      },
    });
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(result.lon, result.lat, 3500),
      duration: 2.5,
      orientation: { heading: 0.0, pitch: -Math.PI / 4, roll: 0.0 },
    });
  };

  // ─── Reload OSM for current view ────────

  const reloadOSM = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const bbox = getBboxFromViewer(viewer);
    if (!bbox) return;
    if (layers.roads) void fetchAndRenderOSM('road', bbox);
    if (layers.railways) void fetchAndRenderOSM('railway', bbox);
  };

  // ─── Render ────────

  const panelBtn = (id: SidePanel, icon: string, label: string) => (
    <button
      key={id}
      className={`nav-btn ${activePanel === id ? 'active' : ''}`}
      onClick={() => setActivePanel(activePanel === id ? null : id)}
      title={label}
    >
      {icon}
    </button>
  );

  return (
    <div className="app-shell">
      {!ready && <div className="loading-overlay">Loading Earth scene…</div>}
      <div ref={containerRef} className="earth-canvas" />

      {/* Top toolbar */}
      <div className="toolbar">
        <h1>Earth Digital Twin</h1>

        <div className="search-row">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder="Search city, country, or coordinates"
          />
          <button onClick={runSearch} disabled={loadingSearch}>
            {loadingSearch ? 'Searching…' : 'Search'}
          </button>
        </div>

        {results.length > 0 && (
          <ul className="result-list">
            {results.map((r) => (
              <li
                key={`${r.lat}-${r.lon}`}
                className="result-item"
                onPointerDown={(e) => {
                  // Prevent default to stop input from losing focus immediately
                  e.preventDefault();
                  console.log('Search result clicked:', r.displayName);
                  setResults([]);
                  // Let React tick to clear the DOM overlay, then fly
                  setTimeout(() => flyToResult(r), 20);
                }}
              >
                {r.displayName}
              </li>
            ))}
          </ul>
        )}

        <div className="status-row">
          <span>{coords}</span>
          <span>Camera alt: {scale || '…'}</span>
        </div>
      </div>

      {/* Side nav */}
      <nav className="side-nav">
        {panelBtn('layers', '🗺️', 'Layers')}
        {panelBtn('models', '📦', '3D Models')}
        {panelBtn('export', '📥', 'Export')}
        {(layers.roads || layers.railways) && (
          <button className="nav-btn" onClick={reloadOSM} title="Reload OSM for current view">
            🔄
          </button>
        )}
      </nav>

      {/* Side panels */}
      {activePanel === 'layers' && (
        <aside className="side-panel">
          <LayerControls
            layers={layers}
            hasIonToken={hasIonToken}
            loadingRoads={loadingRoads}
            loadingRailways={loadingRailways}
            onChange={setLayers}
          />
          {osmError && <p className="error-msg" style={{ margin: '8px 0 0' }}>⚠️ {osmError}</p>}
          {!hasIonToken && (
            <p className="hint-text">Add a Cesium Ion token in .env to enable terrain and buildings.</p>
          )}
        </aside>
      )}

      {activePanel === 'models' && (
        <aside className="side-panel">
          <ModelManager models={models} onChange={setModels} />
        </aside>
      )}

      {activePanel === 'export' && (
        <aside className="side-panel">
          <ExportPanel roads={roads} railways={railways} models={models} />
        </aside>
      )}

      <div className="attribution-panel">
        Data: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a> (ODbL) •
        Cesium Natural Earth II, Cesium World Terrain, OSM Buildings
      </div>
    </div>
  );
}