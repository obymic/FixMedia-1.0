import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn } from 'lucide-react';
import type { RepairFile } from '@/hooks/useFileRepair';

interface BeforeAfterProps {
  file: RepairFile;
  onClose: () => void;
}

const BeforeAfter = ({ file, onClose }: BeforeAfterProps) => {
  const [sliderPos, setSliderPos] = useState(50);
  const isImage = file.type === 'image';

  if (!isImage || !file.repairedUrl) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-3xl bg-card rounded-2xl border border-border overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-sm font-mono font-medium text-foreground">
            Before / After — {file.name}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Comparison area */}
        <div className="relative aspect-video overflow-hidden select-none">
          {/* After (full width, behind) */}
          <img
            src={file.repairedUrl}
            alt="Repaired"
            className="absolute inset-0 w-full h-full object-contain bg-secondary"
            draggable={false}
          />

          {/* Before (clipped) */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ width: `${sliderPos}%` }}
          >
            <img
              src={file.originalUrl}
              alt="Original"
              className="absolute inset-0 w-full h-full object-contain bg-secondary"
              style={{ width: `${100 / (sliderPos / 100)}%`, maxWidth: 'none' }}
              draggable={false}
            />
          </div>

          {/* Divider line */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-primary shadow-lg shadow-primary/50 z-10"
            style={{ left: `${sliderPos}%` }}
          >
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg">
              <span className="text-primary-foreground text-xs font-bold">⟷</span>
            </div>
          </div>

          {/* Slider input */}
          <input
            type="range"
            min={0}
            max={100}
            value={sliderPos}
            onChange={(e) => setSliderPos(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
          />

          {/* Labels */}
          <div className="absolute top-3 left-3 px-2 py-1 rounded bg-destructive/80 text-destructive-foreground text-xs font-mono z-10">
            ORIGINAL
          </div>
          <div className="absolute top-3 right-3 px-2 py-1 rounded bg-success/80 text-white text-xs font-mono z-10">
            REPAIRED
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default BeforeAfter;
