import { useState, useCallback } from 'react';
import { repairImage } from '@/lib/repairImage';
import { repairVideo } from '@/lib/repairVideo';

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

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tiff', 'tif'];
const VIDEO_EXTENSIONS = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv', 'wmv', 'm4v', '3gp'];

function getFileType(file: File): 'image' | 'video' | 'unknown' {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  return 'unknown';
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
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

  const repairSingleFile = useCallback(async (rf: RepairFile) => {
    updateFile(rf.id, { status: 'analyzing', progress: 5 });
    await new Promise((r) => setTimeout(r, 300));
    updateFile(rf.id, { status: 'repairing', progress: 10 });

    try {
      let repairedBlob: Blob;
      
      if (rf.type === 'image') {
        repairedBlob = await repairImage(rf.file, (p) => updateFile(rf.id, { progress: p }));
      } else if (rf.type === 'video') {
        repairedBlob = await repairVideo(rf.file, (p) => updateFile(rf.id, { progress: p }));
      } else {
        throw new Error('Unsupported file type');
      }
      
      const repairedUrl = URL.createObjectURL(repairedBlob);
      updateFile(rf.id, { status: 'completed', progress: 100, repairedBlob, repairedUrl });
    } catch (err) {
      updateFile(rf.id, {
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
      await repairSingleFile(file);
    }
    setIsProcessing(false);
  }, [files, repairSingleFile]);

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

  return { files, isProcessing, addFiles, removeFile, repairAll, clearAll, downloadFile };
}
