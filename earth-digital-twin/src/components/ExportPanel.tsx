/**
 * ExportPanel – UI to configure and trigger 3D export (GLB or OBJ).
 */
import { useState } from 'react';
import type { OSMFeature } from '../types/osm';
import type { PlacedModel } from '../types/model';
import { exportToGLB, exportToOBJ } from '../services/exportService';

interface ExportPanelProps {
  roads: OSMFeature[];
  railways: OSMFeature[];
  models: PlacedModel[];
}

export function ExportPanel({ roads, railways, models }: ExportPanelProps) {
  const [format, setFormat] = useState<'glb' | 'obj'>('glb');
  const [includeRoads, setIncludeRoads] = useState(true);
  const [includeRailways, setIncludeRailways] = useState(true);
  const [includeModels, setIncludeModels] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const hasContent =
    (includeRoads && roads.length > 0) ||
    (includeRailways && railways.length > 0) ||
    (includeModels && models.length > 0);

  const handleExport = async () => {
    if (!hasContent) {
      setError('Nothing to export. Load roads/railways/models first, then enable them above.');
      return;
    }
    setExporting(true);
    setStatus('Building scene…');
    setError('');
    try {
      const options = { format, includeRoads, includeRailways, includeModels, roads, railways, models };
      if (format === 'glb') {
        setStatus('Generating GLB file…');
        await exportToGLB(options);
      } else {
        setStatus('Generating OBJ file…');
        await exportToOBJ(options);
      }
      setStatus('✅ Download started!');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="panel export-panel">
      <h3 className="panel-title">📥 Export 3D</h3>

      <div className="export-notice">
        ⚠️ Exports vector geometry + placed models only. Terrain mesh is not included for performance reasons.
      </div>

      <div className="export-format">
        <label>
          <input type="radio" value="glb" checked={format === 'glb'} onChange={() => setFormat('glb')} />
          GLB (binary GLTF)
        </label>
        <label>
          <input type="radio" value="obj" checked={format === 'obj'} onChange={() => setFormat('obj')} />
          OBJ (text)
        </label>
      </div>

      <div className="export-scope">
        <strong>Include:</strong>
        <label>
          <input type="checkbox" checked={includeRoads} onChange={() => setIncludeRoads((v) => !v)} />
          Roads ({roads.length} segments)
        </label>
        <label>
          <input type="checkbox" checked={includeRailways} onChange={() => setIncludeRailways((v) => !v)} />
          Railways ({railways.length} segments)
        </label>
        <label>
          <input type="checkbox" checked={includeModels} onChange={() => setIncludeModels((v) => !v)} />
          Models ({models.filter((m) => m.visible).length} visible)
        </label>
      </div>

      {error && <p className="error-msg">⚠️ {error}</p>}
      {status && !error && <p className="status-msg">{status}</p>}

      <button
        className="btn-primary export-btn"
        onClick={handleExport}
        disabled={exporting}
      >
        {exporting ? 'Exporting…' : `⬇️ Export .${format.toUpperCase()}`}
      </button>
    </div>
  );
}
