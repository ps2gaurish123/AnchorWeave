/**
 * LayerControls – toggles for Roads, Railways, Terrain, and Buildings.
 */


export interface LayerState {
  terrain: boolean;
  buildings: boolean;
  roads: boolean;
  railways: boolean;
}

interface LayerControlsProps {
  layers: LayerState;
  hasIonToken: boolean;
  loadingRoads: boolean;
  loadingRailways: boolean;
  onChange: (layers: LayerState) => void;
}

export function LayerControls({
  layers,
  hasIonToken,
  loadingRoads,
  loadingRailways,
  onChange,
}: LayerControlsProps) {
  const toggle = (key: keyof LayerState) => {
    onChange({ ...layers, [key]: !layers[key] });
  };

  return (
    <div className="panel layer-controls">
      <h3 className="panel-title">🗺️ Layers</h3>
      <div className="layer-grid">
        <label className={!hasIonToken ? 'disabled' : ''}>
          <input
            type="checkbox"
            checked={layers.terrain}
            onChange={() => toggle('terrain')}
            disabled={!hasIonToken}
          />
          Terrain elevation
          {!hasIonToken && <span className="hint"> (needs Ion token)</span>}
        </label>

        <label className={!hasIonToken ? 'disabled' : ''}>
          <input
            type="checkbox"
            checked={layers.buildings}
            onChange={() => toggle('buildings')}
            disabled={!hasIonToken}
          />
          3D buildings
          {!hasIonToken && <span className="hint"> (needs Ion token)</span>}
        </label>

        <label>
          <input
            type="checkbox"
            checked={layers.roads}
            onChange={() => toggle('roads')}
          />
          Roads {loadingRoads && <span className="loading-badge">fetching…</span>}
        </label>

        <label>
          <input
            type="checkbox"
            checked={layers.railways}
            onChange={() => toggle('railways')}
          />
          Railways {loadingRailways && <span className="loading-badge">fetching…</span>}
        </label>
      </div>
    </div>
  );
}
