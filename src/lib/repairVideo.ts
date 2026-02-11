/**
 * Advanced client-side video repair module.
 * 
 * Uses FFmpeg.wasm when available for real re-muxing/repair.
 * Falls back to binary header manipulation.
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoaded = false;
let ffmpegLoadFailed = false;

async function getFFmpeg(): Promise<FFmpeg | null> {
  if (ffmpegLoadFailed) return null;
  if (ffmpegLoaded && ffmpegInstance) return ffmpegInstance;
  
  try {
    const ffmpeg = new FFmpeg();
    
    // Load from CDN
    await ffmpeg.load({
      coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
      wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm',
    });
    
    ffmpegInstance = ffmpeg;
    ffmpegLoaded = true;
    return ffmpeg;
  } catch (e) {
    console.warn('FFmpeg.wasm failed to load, falling back to basic repair:', e);
    ffmpegLoadFailed = true;
    return null;
  }
}

async function repairWithFFmpeg(file: File, onProgress: (p: number) => void): Promise<Blob> {
  const ffmpeg = await getFFmpeg();
  if (!ffmpeg) throw new Error('FFmpeg not available');
  
  onProgress(30);
  
  const inputName = 'input' + getExtension(file.name);
  const outputName = 'output.mp4';
  
  // Write input file
  const fileData = await fetchFile(file);
  await ffmpeg.writeFile(inputName, fileData);
  onProgress(45);
  
  // Re-mux: copy streams into a fresh MP4 container
  // This fixes most container-level corruption (broken index, missing moov atom, etc.)
  try {
    await ffmpeg.exec([
      '-i', inputName,
      '-c', 'copy',         // Copy streams without re-encoding
      '-movflags', '+faststart', // Move moov atom to beginning
      '-y', outputName
    ]);
  } catch {
    // If copy fails, try with error recovery
    await ffmpeg.exec([
      '-err_detect', 'ignore_err',
      '-i', inputName,
      '-c', 'copy',
      '-movflags', '+faststart',
      '-y', outputName
    ]);
  }
  
  onProgress(80);
  
  const data = await ffmpeg.readFile(outputName);
  
  // Cleanup
  try {
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);
  } catch { /* ignore cleanup errors */ }
  
  onProgress(95);
  
  const blob = new Blob([(data as Uint8Array).buffer as ArrayBuffer], { type: 'video/mp4' });
  onProgress(100);
  return blob;
}

function getExtension(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || 'mp4';
  return '.' + ext;
}

/** Basic binary repair fallback */
function basicVideoRepair(data: Uint8Array, fileName: string): Uint8Array {
  // Check for ftyp box (MP4 signature)
  const hasFtyp = data.length > 8 && 
    data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70;
  
  if (!hasFtyp && fileName.toLowerCase().endsWith('.mp4')) {
    // Prepend a basic ftyp header
    const ftypHeader = new Uint8Array([
      0x00, 0x00, 0x00, 0x18, // size: 24 bytes
      0x66, 0x74, 0x79, 0x70, // "ftyp"
      0x69, 0x73, 0x6F, 0x6D, // "isom"
      0x00, 0x00, 0x02, 0x00, // minor version
      0x69, 0x73, 0x6F, 0x6D, // "isom"
      0x69, 0x73, 0x6F, 0x32, // "iso2"
    ]);
    const combined = new Uint8Array(ftypHeader.length + data.length);
    combined.set(ftypHeader);
    combined.set(data, ftypHeader.length);
    return combined;
  }
  
  // Look for moov atom - if missing at end, check if it's at beginning (already fine)
  const hasMoov = findBox(data, 'moov');
  if (!hasMoov) {
    // Can't create moov from scratch, but we did what we could
    console.warn('Video file missing moov atom - may still be unplayable');
  }
  
  return data;
}

function findBox(data: Uint8Array, boxName: string): boolean {
  const nameBytes = [boxName.charCodeAt(0), boxName.charCodeAt(1), boxName.charCodeAt(2), boxName.charCodeAt(3)];
  for (let i = 4; i < data.length - 4; i++) {
    if (data[i] === nameBytes[0] && data[i+1] === nameBytes[1] && 
        data[i+2] === nameBytes[2] && data[i+3] === nameBytes[3]) {
      return true;
    }
  }
  return false;
}

export async function repairVideo(file: File, onProgress: (p: number) => void): Promise<Blob> {
  onProgress(5);
  
  // Strategy 1: Try FFmpeg.wasm for real repair
  try {
    onProgress(10);
    const result = await repairWithFFmpeg(file, onProgress);
    return result;
  } catch (ffmpegError) {
    console.warn('FFmpeg repair failed, using basic repair:', ffmpegError);
  }
  
  // Strategy 2: Basic binary header repair
  onProgress(40);
  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  
  onProgress(60);
  const repairedData = basicVideoRepair(data, file.name);
  
  onProgress(90);
  const outputType = file.type || 'video/mp4';
  const blob = new Blob([repairedData.buffer as ArrayBuffer], { type: outputType });
  
  onProgress(100);
  return blob;
}
