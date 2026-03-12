// 3D Model metadata types

export type ModelSourceType = 'file' | 'url';

export type ModelFileType = 'glb' | 'gltf' | 'obj';

export interface ModelTransform {
  longitude: number; // degrees
  latitude: number;  // degrees
  height: number;    // meters above ellipsoid
  heading: number;   // degrees (0 = North, 90 = East)
  pitch: number;     // degrees (0 = level, -90 = face down)
  roll: number;      // degrees
  scale: number;     // uniform scale factor
}

export interface PlacedModel {
  id: string;
  name: string;
  fileType: ModelFileType;
  sourceType: ModelSourceType;
  /** Object URL (for file) or remote URL */
  url: string;
  transform: ModelTransform;
  visible: boolean;
}

export const defaultTransform: ModelTransform = {
  longitude: 0,
  latitude: 0,
  height: 0,
  heading: 0,
  pitch: 0,
  roll: 0,
  scale: 1
};
