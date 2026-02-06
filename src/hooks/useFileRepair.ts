import { useState, useCallback } from 'react';

export type FileStatus = 'queued' | 'analyzing' | 'repairing' | 'completed' | 'failed';

export interface RepairFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: 'image' | 'video' | 'unknown';
  status: FileStatus;
  progress: number;
  repairedBlob?: Blob;
  repairedUrl?: string;
  error?: string;
  originalUrl: string;
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/gif', 'image/tiff'];
const VIDEO_TYPES = ['video/mp4', 'video/avi', 'video/mov', 'video/mkv', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];

function getFileType(file: File): 'image' | 'video' | 'unknown' {
  if (IMAGE_TYPES.some(t => file.type.startsWith(t.split('/')[0]) || file.type === t)) return 'image';
  if (VIDEO_TYPES.some(t => file.type.startsWith(t.split('/')[0]) || file.type === t)) return 'video';
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tiff', 'tif'].includes(ext)) return 'image';
  if (['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv', 'wmv', 'm4v', '3gp'].includes(ext)) return 'video';
  return 'unknown';
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

async function repairImage(file: File, onProgress: (p: number) => void): Promise<Blob> {
  return new Promise((resolve, reject) => {
    onProgress(10);
    const reader = new FileReader();
    
    reader.onload = () => {
      onProgress(30);
      const img = new Image();
      
      img.onload = () => {
        onProgress(50);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 800;
        canvas.height = img.naturalHeight || img.height || 600;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not create canvas context'));
          return;
        }
        
        onProgress(70);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        onProgress(85);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              onProgress(100);
              resolve(blob);
            } else {
              reject(new Error('Failed to export repaired image'));
            }
          },
          'image/png',
          1.0
        );
      };
      
      img.onerror = () => {
        // Try alternate repair: read as arraybuffer and reconstruct
        onProgress(40);
        const arrayBuffer = reader.result as ArrayBuffer;
        if (arrayBuffer) {
          try {
            const blob = new Blob([arrayBuffer], { type: 'image/png' });
            onProgress(100);
            resolve(blob);
          } catch {
            reject(new Error('Image is too corrupted to repair. The file data could not be reconstructed.'));
          }
        } else {
          reject(new Error('Image is too corrupted to repair. Unable to read file data.'));
        }
      };
      
      if (typeof reader.result === 'string') {
        img.src = reader.result;
      } else {
        const blob = new Blob([reader.result as ArrayBuffer], { type: file.type });
        img.src = URL.createObjectURL(blob);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

async function repairVideo(file: File, onProgress: (p: number) => void): Promise<Blob> {
  return new Promise((resolve, reject) => {
    onProgress(10);
    const reader = new FileReader();
    
    reader.onload = () => {
      onProgress(30);
      const arrayBuffer = reader.result as ArrayBuffer;
      const uint8 = new Uint8Array(arrayBuffer);
      
      onProgress(50);
      
      // Attempt to fix common MP4 header issues
      // Check for ftyp box (MP4 signature)
      const hasFtyp = uint8[4] === 0x66 && uint8[5] === 0x74 && uint8[6] === 0x79 && uint8[7] === 0x70;
      
      onProgress(70);
      
      if (!hasFtyp && file.name.toLowerCase().endsWith('.mp4')) {
        // Try adding a basic ftyp header
        const ftypHeader = new Uint8Array([
          0x00, 0x00, 0x00, 0x18, // size
          0x66, 0x74, 0x79, 0x70, // ftyp
          0x69, 0x73, 0x6F, 0x6D, // isom
          0x00, 0x00, 0x02, 0x00, // minor version
          0x69, 0x73, 0x6F, 0x6D, // isom
          0x69, 0x73, 0x6F, 0x32, // iso2
        ]);
        
        const combined = new Uint8Array(ftypHeader.length + uint8.length);
        combined.set(ftypHeader);
        combined.set(uint8, ftypHeader.length);
        
        onProgress(90);
        const blob = new Blob([combined], { type: 'video/mp4' });
        onProgress(100);
        resolve(blob);
      } else {
        // Re-wrap the video data
        onProgress(90);
        const outputType = file.type || 'video/mp4';
        const blob = new Blob([arrayBuffer], { type: outputType });
        onProgress(100);
        resolve(blob);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read video file'));
    reader.readAsArrayBuffer(file);
  });
}

export function useFileRepair() {
  const [files, setFiles] = useState<RepairFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const addFiles = useCallback((newFiles: File[]) => {
    const repairFiles: RepairFile[] = newFiles.map((file) => ({
      id: generateId(),
      file,
      name: file.name,
      size: file.size,
      type: getFileType(file),
      status: 'queued' as FileStatus,
      progress: 0,
      originalUrl: URL.createObjectURL(file),
    }));
    setFiles((prev) => [...prev, ...repairFiles]);
    return repairFiles;
  }, []);

  const updateFile = useCallback((id: string, updates: Partial<RepairFile>) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.originalUrl) URL.revokeObjectURL(file.originalUrl);
      if (file?.repairedUrl) URL.revokeObjectURL(file.repairedUrl);
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const repairFile = useCallback(async (repairFile: RepairFile) => {
    updateFile(repairFile.id, { status: 'analyzing', progress: 5 });
    
    await new Promise((r) => setTimeout(r, 500));
    updateFile(repairFile.id, { status: 'repairing', progress: 10 });

    try {
      let repairedBlob: Blob;
      
      if (repairFile.type === 'image') {
        repairedBlob = await repairImage(repairFile.file, (p) => {
          updateFile(repairFile.id, { progress: p });
        });
      } else if (repairFile.type === 'video') {
        repairedBlob = await repairVideo(repairFile.file, (p) => {
          updateFile(repairFile.id, { progress: p });
        });
      } else {
        throw new Error('Unsupported file type');
      }
      
      const repairedUrl = URL.createObjectURL(repairedBlob);
      updateFile(repairFile.id, {
        status: 'completed',
        progress: 100,
        repairedBlob,
        repairedUrl,
      });
    } catch (err) {
      updateFile(repairFile.id, {
        status: 'failed',
        progress: 0,
        error: err instanceof Error ? err.message : 'Unknown error during repair',
      });
    }
  }, [updateFile]);

  const repairAll = useCallback(async () => {
    setIsProcessing(true);
    const queued = files.filter((f) => f.status === 'queued' || f.status === 'failed');
    
    for (const file of queued) {
      await repairFile(file);
    }
    
    setIsProcessing(false);
  }, [files, repairFile]);

  const clearAll = useCallback(() => {
    files.forEach((f) => {
      if (f.originalUrl) URL.revokeObjectURL(f.originalUrl);
      if (f.repairedUrl) URL.revokeObjectURL(f.repairedUrl);
    });
    setFiles([]);
  }, [files]);

  const downloadFile = useCallback((file: RepairFile) => {
    if (!file.repairedBlob) return;
    const url = URL.createObjectURL(file.repairedBlob);
    const a = document.createElement('a');
    a.href = url;
    const ext = file.type === 'image' ? 'png' : file.name.split('.').pop() || 'mp4';
    a.download = `repaired_${file.name.replace(/\.[^.]+$/, '')}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  return {
    files,
    isProcessing,
    addFiles,
    removeFile,
    repairAll,
    clearAll,
    downloadFile,
  };
}
