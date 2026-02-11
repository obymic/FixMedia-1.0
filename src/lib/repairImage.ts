/**
 * Advanced client-side image repair module.
 * 
 * Strategies:
 * 1. Canvas re-encoding (works for partially corrupted images the browser can still render)
 * 2. JPEG header reconstruction (fixes missing/corrupted SOI marker)
 * 3. PNG header reconstruction (fixes missing/corrupted PNG signature)
 * 4. Raw blob re-wrap with correct MIME type
 */

const JPEG_SOI = new Uint8Array([0xFF, 0xD8]);
const JPEG_EOI = new Uint8Array([0xFF, 0xD9]);
const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

function detectActualFormat(data: Uint8Array): 'jpeg' | 'png' | 'gif' | 'webp' | 'bmp' | null {
  // Check for JPEG (even if header is slightly offset)
  for (let i = 0; i < Math.min(data.length, 64); i++) {
    if (data[i] === 0xFF && data[i + 1] === 0xD8) return 'jpeg';
  }
  // PNG
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) return 'png';
  // GIF
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) return 'gif';
  // WebP (RIFF....WEBP)
  if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
      data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) return 'webp';
  // BMP
  if (data[0] === 0x42 && data[1] === 0x4D) return 'bmp';
  return null;
}

function repairJpegHeader(data: Uint8Array): Uint8Array {
  // Find where JPEG data actually starts (look for FF D8 or FF E0/E1 markers)
  let startOffset = -1;
  for (let i = 0; i < Math.min(data.length, 512); i++) {
    if (data[i] === 0xFF && (data[i + 1] === 0xD8 || data[i + 1] === 0xE0 || data[i + 1] === 0xE1)) {
      startOffset = i;
      break;
    }
  }

  if (startOffset > 0) {
    // Strip garbage bytes before the actual JPEG start
    return data.slice(startOffset);
  }

  if (startOffset === -1) {
    // No SOI found at all - prepend one
    // Also look for APP0/APP1 marker in the data
    let hasApp = false;
    for (let i = 0; i < Math.min(data.length, 128); i++) {
      if (data[i] === 0xFF && (data[i + 1] === 0xE0 || data[i + 1] === 0xE1)) {
        hasApp = true;
        break;
      }
    }
    
    if (!hasApp) {
      // Prepend SOI + minimal APP0 (JFIF header)
      const jfifHeader = new Uint8Array([
        0xFF, 0xD8, // SOI
        0xFF, 0xE0, // APP0 marker
        0x00, 0x10, // Length
        0x4A, 0x46, 0x49, 0x46, 0x00, // "JFIF\0"
        0x01, 0x01, // Version 1.1
        0x00, // Aspect ratio units (0 = no units)
        0x00, 0x01, // X density
        0x00, 0x01, // Y density
        0x00, 0x00, // No thumbnail
      ]);
      const result = new Uint8Array(jfifHeader.length + data.length);
      result.set(jfifHeader);
      result.set(data, jfifHeader.length);
      return result;
    } else {
      // Just prepend SOI
      const result = new Uint8Array(2 + data.length);
      result.set(JPEG_SOI);
      result.set(data, 2);
      return result;
    }
  }

  // Check for missing EOI at end
  if (data[data.length - 2] !== 0xFF || data[data.length - 1] !== 0xD9) {
    const result = new Uint8Array(data.length + 2);
    result.set(data);
    result.set(JPEG_EOI, data.length);
    return result;
  }

  return data;
}

function repairPngHeader(data: Uint8Array): Uint8Array {
  // Check if PNG signature is corrupted but the rest is valid
  const hasIHDR = findSequence(data, new Uint8Array([0x49, 0x48, 0x44, 0x52])); // "IHDR"
  
  if (hasIHDR !== -1 && hasIHDR < 32) {
    // Has IHDR chunk, fix/prepend PNG signature
    const ihdrChunkStart = hasIHDR - 4; // 4 bytes for chunk length before "IHDR"
    const result = new Uint8Array(PNG_SIGNATURE.length + data.length - ihdrChunkStart);
    result.set(PNG_SIGNATURE);
    result.set(data.slice(ihdrChunkStart), PNG_SIGNATURE.length);
    return result;
  }
  
  return data;
}

function findSequence(data: Uint8Array, seq: Uint8Array): number {
  for (let i = 0; i <= data.length - seq.length; i++) {
    let found = true;
    for (let j = 0; j < seq.length; j++) {
      if (data[i + j] !== seq[j]) { found = false; break; }
    }
    if (found) return i;
  }
  return -1;
}

/** Attempt to load image via Canvas re-encoding */
function tryCanvasRepair(blob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 800;
        canvas.height = img.naturalHeight || img.height || 600;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('No canvas context')); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (result) => {
            URL.revokeObjectURL(url);
            result ? resolve(result) : reject(new Error('Canvas export failed'));
          },
          'image/png', 1.0
        );
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image could not be loaded'));
    };
    
    img.src = url;
  });
}

export async function repairImage(file: File, onProgress: (p: number) => void): Promise<Blob> {
  onProgress(5);
  
  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  onProgress(15);
  
  // Detect the actual format from binary signatures
  const detectedFormat = detectActualFormat(data);
  const mimeMap = { jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' };
  
  onProgress(20);
  
  // Strategy 1: Try direct canvas re-encoding first (fastest path for minor corruption)
  try {
    const originalBlob = new Blob([arrayBuffer], { type: file.type || (detectedFormat ? mimeMap[detectedFormat] : 'image/png') });
    onProgress(30);
    const result = await tryCanvasRepair(originalBlob);
    onProgress(100);
    return result;
  } catch {
    // Canvas failed, continue with header repair strategies
  }
  
  onProgress(40);
  
  // Strategy 2: Header repair based on detected/expected format
  let repairedData: Uint8Array = data;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const isJpeg = detectedFormat === 'jpeg' || ['jpg', 'jpeg'].includes(ext);
  const isPng = detectedFormat === 'png' || ext === 'png';
  
  if (isJpeg) {
    repairedData = repairJpegHeader(data);
    onProgress(55);
  } else if (isPng) {
    repairedData = repairPngHeader(data);
    onProgress(55);
  }
  
  // Strategy 3: Try canvas with repaired data
  if (repairedData !== data) {
    try {
      const repairedBlob = new Blob([repairedData.buffer as ArrayBuffer], { type: isJpeg ? 'image/jpeg' : 'image/png' });
      onProgress(65);
      const result = await tryCanvasRepair(repairedBlob);
      onProgress(100);
      return result;
    } catch {
      // Still failed
    }
  }
  
  onProgress(75);
  
  // Strategy 4: Try with different MIME types
  const mimeAttempts = ['image/png', 'image/jpeg', 'image/webp', 'image/bmp', 'image/gif'];
  for (const mime of mimeAttempts) {
    try {
      const blob = new Blob([repairedData.buffer as ArrayBuffer], { type: mime });
      const result = await tryCanvasRepair(blob);
      onProgress(100);
      return result;
    } catch {
      continue;
    }
  }
  
  onProgress(90);
  
  // Strategy 5: Last resort - return re-wrapped data with best-guess MIME
  const bestMime = detectedFormat ? mimeMap[detectedFormat] : (file.type || 'image/png');
  const fallback = new Blob([repairedData.buffer as ArrayBuffer], { type: bestMime });
  onProgress(100);
  return fallback;
}
