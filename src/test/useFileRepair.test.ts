import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFileRepair } from '@/hooks/useFileRepair';

// Mock URL.createObjectURL / revokeObjectURL
const mockUrls = new Map<number, string>();
let urlCounter = 0;
beforeEach(() => {
  urlCounter = 0;
  mockUrls.clear();
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn((blob: Blob) => {
      const url = `blob:test-${urlCounter++}`;
      return url;
    }),
    revokeObjectURL: vi.fn(),
  });
});

function createTestFile(name: string, type: string, size = 1024): File {
  const buffer = new ArrayBuffer(size);
  const view = new Uint8Array(buffer);
  // Fill with some data
  for (let i = 0; i < size; i++) {
    view[i] = i % 256;
  }
  return new File([buffer], name, { type });
}

function createValidImageFile(): File {
  // Create a minimal valid PNG (1x1 pixel)
  const pngData = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, // IDAT chunk
    0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc,
    0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, // IEND chunk
    0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  return new File([pngData], 'test-image.png', { type: 'image/png' });
}

describe('useFileRepair', () => {
  describe('addFiles', () => {
    it('should add image files to the queue', () => {
      const { result } = renderHook(() => useFileRepair());

      act(() => {
        result.current.addFiles([createTestFile('photo.jpg', 'image/jpeg')]);
      });

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0].name).toBe('photo.jpg');
      expect(result.current.files[0].type).toBe('image');
      expect(result.current.files[0].status).toBe('queued');
      expect(result.current.files[0].progress).toBe(0);
    });

    it('should add video files to the queue', () => {
      const { result } = renderHook(() => useFileRepair());

      act(() => {
        result.current.addFiles([createTestFile('video.mp4', 'video/mp4')]);
      });

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0].type).toBe('video');
    });

    it('should detect file type by extension when mime is unknown', () => {
      const { result } = renderHook(() => useFileRepair());

      act(() => {
        result.current.addFiles([createTestFile('photo.png', '', 512)]);
      });

      expect(result.current.files[0].type).toBe('image');
    });

    it('should add multiple files at once', () => {
      const { result } = renderHook(() => useFileRepair());

      act(() => {
        result.current.addFiles([
          createTestFile('a.jpg', 'image/jpeg'),
          createTestFile('b.mp4', 'video/mp4'),
          createTestFile('c.png', 'image/png'),
        ]);
      });

      expect(result.current.files).toHaveLength(3);
    });
  });

  describe('removeFile', () => {
    it('should remove a file from the queue', () => {
      const { result } = renderHook(() => useFileRepair());

      act(() => {
        result.current.addFiles([createTestFile('photo.jpg', 'image/jpeg')]);
      });

      const fileId = result.current.files[0].id;

      act(() => {
        result.current.removeFile(fileId);
      });

      expect(result.current.files).toHaveLength(0);
    });

    it('should revoke object URLs when removing', () => {
      const { result } = renderHook(() => useFileRepair());

      act(() => {
        result.current.addFiles([createTestFile('photo.jpg', 'image/jpeg')]);
      });

      const fileId = result.current.files[0].id;

      act(() => {
        result.current.removeFile(fileId);
      });

      expect(URL.revokeObjectURL).toHaveBeenCalled();
    });
  });

  describe('clearAll', () => {
    it('should clear all files from the queue', () => {
      const { result } = renderHook(() => useFileRepair());

      act(() => {
        result.current.addFiles([
          createTestFile('a.jpg', 'image/jpeg'),
          createTestFile('b.mp4', 'video/mp4'),
        ]);
      });

      expect(result.current.files).toHaveLength(2);

      act(() => {
        result.current.clearAll();
      });

      expect(result.current.files).toHaveLength(0);
    });
  });

  describe('repairAll', () => {
    it('should repair image files and set status to completed', async () => {
      // Mock canvas and Image for jsdom
      const mockToBlob = vi.fn((cb: BlobCallback) => {
        cb(new Blob(['repaired'], { type: 'image/png' }));
      });
      const mockGetContext = vi.fn(() => ({
        drawImage: vi.fn(),
      }));
      vi.stubGlobal('HTMLCanvasElement', class {
        width = 0;
        height = 0;
        getContext = mockGetContext;
        toBlob = mockToBlob;
      });
      
      // Override document.createElement for canvas
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') {
          return {
            width: 0,
            height: 0,
            getContext: mockGetContext,
            toBlob: mockToBlob,
          } as any;
        }
        return originalCreateElement(tag);
      });

      // Mock Image constructor
      const mockImage = {
        onload: null as any,
        onerror: null as any,
        src: '',
        naturalWidth: 100,
        naturalHeight: 100,
        width: 100,
        height: 100,
      };
      vi.stubGlobal('Image', vi.fn(() => {
        // Trigger onload asynchronously
        setTimeout(() => mockImage.onload?.(), 10);
        return mockImage;
      }));

      const { result } = renderHook(() => useFileRepair());

      act(() => {
        result.current.addFiles([createValidImageFile()]);
      });

      expect(result.current.files[0].status).toBe('queued');

      await act(async () => {
        await result.current.repairAll();
      });

      expect(result.current.files[0].status).toBe('completed');
      expect(result.current.files[0].progress).toBe(100);
      expect(result.current.files[0].repairedBlob).toBeDefined();
      expect(result.current.isProcessing).toBe(false);
    });

    it('should repair video files by re-wrapping', async () => {
      const { result } = renderHook(() => useFileRepair());

      act(() => {
        result.current.addFiles([createTestFile('video.mp4', 'video/mp4', 2048)]);
      });

      await act(async () => {
        await result.current.repairAll();
      });

      expect(result.current.files[0].status).toBe('completed');
      expect(result.current.files[0].repairedBlob).toBeDefined();
      expect(result.current.files[0].repairedBlob?.type).toBe('video/mp4');
    });

    it('should handle unknown file types as failed', async () => {
      const { result } = renderHook(() => useFileRepair());

      const unknownFile = new File(['data'], 'file.xyz', { type: 'application/octet-stream' });
      act(() => {
        result.current.addFiles([unknownFile]);
      });

      await act(async () => {
        await result.current.repairAll();
      });

      expect(result.current.files[0].status).toBe('failed');
      expect(result.current.files[0].error).toContain('Unsupported file type');
    });
  });

  describe('downloadFile', () => {
    it('should create a download link for repaired files', () => {
      const { result } = renderHook(() => useFileRepair());

      const mockClick = vi.fn();
      const mockAnchor = {
        href: '',
        download: '',
        click: mockClick,
      };
      vi.spyOn(document, 'createElement').mockReturnValueOnce(mockAnchor as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
      vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

      const fakeFile = {
        id: 'test',
        file: createTestFile('photo.jpg', 'image/jpeg'),
        name: 'photo.jpg',
        size: 1024,
        type: 'image' as const,
        status: 'completed' as const,
        progress: 100,
        repairedBlob: new Blob(['repaired'], { type: 'image/png' }),
        originalUrl: 'blob:original',
      };

      act(() => {
        result.current.downloadFile(fakeFile);
      });

      expect(mockClick).toHaveBeenCalled();
      expect(mockAnchor.download).toContain('repaired_photo');
    });

    it('should not download if no repaired blob', () => {
      const { result } = renderHook(() => useFileRepair());

      const fakeFile = {
        id: 'test',
        file: createTestFile('photo.jpg', 'image/jpeg'),
        name: 'photo.jpg',
        size: 1024,
        type: 'image' as const,
        status: 'queued' as const,
        progress: 0,
        originalUrl: 'blob:original',
      };

      const spy = vi.spyOn(document, 'createElement');

      act(() => {
        result.current.downloadFile(fakeFile);
      });

      // Should not create an anchor element
      expect(spy).not.toHaveBeenCalledWith('a');
    });
  });
});
