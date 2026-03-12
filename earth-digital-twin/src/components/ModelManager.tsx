/**
 * ModelManager – UI to upload/URL-load, list, position, and remove 3D models.
 */
import { useRef, useState } from 'react';
import type { PlacedModel, ModelTransform } from '../types/model';
import { importModelFromFile, importModelFromUrl, revokeModelUrl } from '../services/modelImportService';

interface ModelManagerProps {
  models: PlacedModel[];
  onChange: (models: PlacedModel[]) => void;
}



function TransformEditor({
  transform,
  onChange,
}: {
  transform: ModelTransform;
  onChange: (t: ModelTransform) => void;
}) {
  const field = (label: string, key: keyof ModelTransform, step = 0.001) => (
    <label className="transform-field" key={key}>
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={transform[key]}
        onChange={(e) => onChange({ ...transform, [key]: parseFloat(e.target.value) || 0 })}
      />
    </label>
  );

  return (
    <div className="transform-editor">
      {field('Lon°', 'longitude')}
      {field('Lat°', 'latitude')}
      {field('Height m', 'height', 1)}
      {field('Heading°', 'heading', 1)}
      {field('Pitch°', 'pitch', 1)}
      {field('Roll°', 'roll', 1)}
      {field('Scale', 'scale', 0.1)}
    </div>
  );
}

export function ModelManager({ models, onChange }: ModelManagerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState('');
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const addModel = (model: PlacedModel) => {
    setError('');
    onChange([...models, model]);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      addModel(importModelFromFile(file));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
    e.target.value = '';
  };

  const handleUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    try {
      addModel(importModelFromUrl(trimmed));
      setUrlInput('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const removeModel = (id: string) => {
    const model = models.find((m) => m.id === id);
    if (model) revokeModelUrl(model);
    onChange(models.filter((m) => m.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const toggleVisible = (id: string) => {
    onChange(models.map((m) => (m.id === id ? { ...m, visible: !m.visible } : m)));
  };

  const updateTransform = (id: string, transform: ModelTransform) => {
    onChange(models.map((m) => (m.id === id ? { ...m, transform } : m)));
  };

  return (
    <div className="panel model-manager">
      <h3 className="panel-title">📦 3D Models</h3>

      <div className="model-add-row">
        <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
          📂 Upload file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".glb,.gltf,.obj"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
      </div>

      <div className="model-url-row">
        <input
          type="text"
          placeholder="Paste GLB/GLTF/OBJ URL…"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleUrl()}
        />
        <button className="btn-primary" onClick={handleUrl}>Load URL</button>
      </div>

      {error && <p className="error-msg">⚠️ {error}</p>}

      {models.length === 0 && (
        <p className="empty-msg">No models loaded. Upload a file or paste a URL above.</p>
      )}

      <ul className="model-list">
        {models.map((model) => (
          <li key={model.id} className={`model-item ${model.visible ? '' : 'hidden-model'}`}>
            <div className="model-item-header">
              <button
                className="btn-icon"
                title="Toggle visibility"
                onClick={() => toggleVisible(model.id)}
              >
                {model.visible ? '👁' : '🙈'}
              </button>
              <span className="model-name" title={model.url}>
                {model.name}
                <em className="model-badge">.{model.fileType}</em>
              </span>
              <button
                className="btn-icon"
                title="Edit transform"
                onClick={() => setExpandedId(expandedId === model.id ? null : model.id)}
              >
                ✏️
              </button>
              <button
                className="btn-icon danger"
                title="Remove"
                onClick={() => removeModel(model.id)}
              >
                🗑
              </button>
            </div>
            {expandedId === model.id && (
              <TransformEditor
                transform={model.transform}
                onChange={(t) => updateTransform(model.id, t)}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
