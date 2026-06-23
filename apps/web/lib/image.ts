// Client-side image downscaling + base64 JPEG encoding for AI Snap.
//
// Phones produce 4–12 MP photos that are far too large to POST as base64. We draw
// the image onto a canvas capped at ~1280px on its longest edge and re-encode as
// JPEG. The result is returned as a *raw* base64 string (no data: prefix) plus the
// mime type, matching the AnalyzeFoodRequest contract.

const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.82;

export interface EncodedImage {
  /** Raw base64 (no `data:` prefix). */
  imageBase64: string;
  /** Always 'image/jpeg' after re-encoding. */
  mimeType: 'image/jpeg';
  /** A `data:` URL suitable for an <img> preview. */
  previewUrl: string;
}

/**
 * Load a File/Blob, downscale to a max edge of ~1280px, and encode as JPEG base64.
 * Throws if the input is not a readable image.
 */
export async function downscaleToJpegBase64(file: Blob): Promise<EncodedImage> {
  const bitmap = await loadBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_EDGE);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is unavailable in this browser.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  const comma = dataUrl.indexOf(',');
  const imageBase64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;

  return { imageBase64, mimeType: 'image/jpeg', previewUrl: dataUrl };
}

function fitWithin(w: number, h: number, maxEdge: number) {
  if (w <= maxEdge && h <= maxEdge) return { width: w, height: h };
  const scale = maxEdge / Math.max(w, h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  // Prefer createImageBitmap (fast, off-main-thread decode). Fall back to <img>.
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through to <img> */
    }
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image.'));
    };
    img.src = url;
  });
}
