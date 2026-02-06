import { useCallback, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileVideo, FileImage, AlertCircle } from 'lucide-react';

interface DropZoneProps {
  onFilesAdded: (files: File[]) => void;
  disabled?: boolean;
}

const DropZone = ({ onFilesAdded, disabled }: DropZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (disabled) return;

      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) {
        onFilesAdded(droppedFiles);
      }
    },
    [onFilesAdded, disabled]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      if (selectedFiles.length > 0) {
        onFilesAdded(selectedFiles);
      }
      if (inputRef.current) inputRef.current.value = '';
    },
    [onFilesAdded]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="w-full"
    >
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`
          relative group cursor-pointer rounded-2xl border-2 border-dashed p-12 md:p-16
          transition-all duration-300 overflow-hidden
          ${isDragging
            ? 'border-primary bg-primary/5 glow-primary-strong'
            : 'border-border hover:border-primary/50 hover:bg-card/50'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {/* Scan line effect */}
        <div className="absolute inset-0 scan-line opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(hsl(175 80% 48%) 1px, transparent 1px), linear-gradient(90deg, hsl(175 80% 48%) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }} />

        <div className="relative flex flex-col items-center gap-6 text-center">
          <AnimatePresence mode="wait">
            {isDragging ? (
              <motion.div
                key="dragging"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="p-5 rounded-2xl bg-primary/10 border border-primary/30"
              >
                <Upload className="w-10 h-10 text-primary" />
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="p-5 rounded-2xl bg-secondary border border-border group-hover:border-primary/30 transition-colors"
              >
                <Upload className="w-10 h-10 text-muted-foreground group-hover:text-primary transition-colors" />
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <h3 className="text-xl font-semibold mb-2">
              {isDragging ? 'Drop files to repair' : 'Drop damaged files here'}
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              or click to browse your files
            </p>
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary border border-border">
                <FileImage className="w-3.5 h-3.5 text-primary" />
                Images
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary border border-border">
                <FileVideo className="w-3.5 h-3.5 text-primary" />
                Videos
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground/60 flex items-center gap-1.5">
            <AlertCircle className="w-3 h-3" />
            JPG, PNG, WebP, BMP, GIF, MP4, AVI, MOV, MKV, WebM
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </motion.div>
  );
};

export default DropZone;
