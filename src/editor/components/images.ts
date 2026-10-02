/** Shared image library for the editor, kept in sync with the project's assets. */
import { ImageLibrary } from '../../render/images';
import { useEditor } from '../store/store';

const lib = new ImageLibrary([]);
let lastAssets: unknown = null;

export function getImages(): ImageLibrary {
  const assets = useEditor.getState().project?.assets ?? [];
  if (assets !== lastAssets) {
    lastAssets = assets;
    lib.setAssets(assets);
  }
  return lib;
}

/** Re-render callback when async images finish decoding. */
export function onImagesLoaded(fn: () => void): void {
  lib.onLoad = fn;
}
