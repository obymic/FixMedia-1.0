/**
 * AI-powered image restoration module.
 * Sends images to the Lovable AI gateway for intelligent restoration
 * of damaged, aged, or corrupted images.
 * Falls back to client-side canvas repair if AI is unavailable.
 */

import { supabase } from '@/integrations/supabase/client';

/** Convert a File to a base64 data URL */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Convert a base64 data URL to a Blob */
function base64ToBlob(base64: string): Blob {
  const parts = base64.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
  const raw = atob(parts[1]);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return new Blob([arr], { type: mime });
}

/** Attempt AI-powered restoration via edge function */
async function restoreWithAI(file: File, onProgress: (p: number) => void): Promise<Blob> {
  onProgress(10);
  const imageBase64 = await fileToBase64(file);
  onProgress(25);

  const { data, error } = await supabase.functions.invoke('restore-image', {
    body: { imageBase64 },
  });

  onProgress(80);

  if (error) {
    throw new Error(error.message || 'AI restoration failed');
  }

  if (!data?.restoredImage) {
    throw new Error('No restored image returned');
  }

  onProgress(90);
  const blob = base64ToBlob(data.restoredImage);
  onProgress(100);
  return blob;
}

/** Fallback: canvas re-encoding for minor corruption */
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

  // Strategy 1: AI-powered restoration (primary)
  try {
    const result = await restoreWithAI(file, onProgress);
    return result;
  } catch (aiError) {
    console.warn('AI restoration failed, falling back to canvas repair:', aiError);
  }

  // Strategy 2: Canvas re-encoding fallback
  onProgress(50);
  try {
    const blob = new Blob([await file.arrayBuffer()], { type: file.type || 'image/png' });
    const result = await tryCanvasRepair(blob);
    onProgress(100);
    return result;
  } catch {
    // Last resort: return original file as blob
    onProgress(100);
    return new Blob([await file.arrayBuffer()], { type: file.type || 'image/png' });
  }
}
