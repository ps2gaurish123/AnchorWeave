/**
 * Model Import Service
 * Handles uploading or URL-loading of 3D models (GLB, GLTF, OBJ)
 * and building the PlacedModel metadata consumed by EarthViewer.
 */

import type { ModelFileType, PlacedModel, ModelTransform } from '../types/model';
import { defaultTransform } from '../types/model';

/** Detect file type from filename extension */
function detectFileType(name: string): ModelFileType | null {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'glb') return 'glb';
  if (ext === 'gltf') return 'gltf';
  if (ext === 'obj') return 'obj';
  return null;
}

/** Generate a simple unique id (no external uuid dep) */
function generateId(): string {
  return `model-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Import a model from a File object.
 * Creates an Object URL which must be revoked when the model is removed.
 */
export function importModelFromFile(
  file: File,
  transform: Partial<ModelTransform> = {},
): PlacedModel {
  const fileType = detectFileType(file.name);
  if (!fileType) {
    throw new Error(`Unsupported file type: ${file.name}. Supported: .glb, .gltf, .obj`);
  }

  const url = URL.createObjectURL(file);

  return {
    id: generateId(),
    name: file.name,
    fileType,
    sourceType: 'file',
    url,
    transform: { ...defaultTransform, ...transform },
    visible: true,
  };
}

/**
 * Import a model from a remote URL.
 * The URL itself is used directly, no blob involved.
 */
export function importModelFromUrl(
  url: string,
  name?: string,
  transform: Partial<ModelTransform> = {},
): PlacedModel {
  const inferredName = name ?? url.split('/').pop() ?? 'model';
  const fileType = detectFileType(inferredName);
  if (!fileType) {
    throw new Error(`Cannot determine file type from URL: ${url}`);
  }

  return {
    id: generateId(),
    name: inferredName,
    fileType,
    sourceType: 'url',
    url,
    transform: { ...defaultTransform, ...transform },
    visible: true,
  };
}

/**
 * Revoke an Object URL created for a file-sourced model.
 * Call this when removing a model to avoid memory leaks.
 */
export function revokeModelUrl(model: PlacedModel): void {
  if (model.sourceType === 'file') {
    URL.revokeObjectURL(model.url);
  }
}
