import { motion, AnimatePresence } from 'framer-motion';
import { FileImage, FileVideo, Check, X, Download, Trash2, Loader2, AlertTriangle, HelpCircle, Eye } from 'lucide-react';
import type { RepairFile } from '@/hooks/useFileRepair';

interface RepairQueueProps {
  files: RepairFile[];
  onRemove: (id: string) => void;
  onDownload: (file: RepairFile) => void;
  onCompare?: (file: RepairFile) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getStatusIcon(status: RepairFile['status']) {
  switch (status) {
    case 'queued':
      return <div className="w-2 h-2 rounded-full bg-muted-foreground" />;
    case 'analyzing':
      return <Loader2 className="w-4 h-4 text-warning animate-spin" />;
    case 'repairing':
      return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
    case 'completed':
      return <Check className="w-4 h-4 text-success" />;
    case 'failed':
      return <X className="w-4 h-4 text-destructive" />;
  }
}

function getStatusText(status: RepairFile['status']) {
  switch (status) {
    case 'queued': return 'Queued';
    case 'analyzing': return 'Analyzing...';
    case 'repairing': return 'Repairing...';
    case 'completed': return 'Repaired';
    case 'failed': return 'Failed';
  }
}

function getFileIcon(type: RepairFile['type']) {
  switch (type) {
    case 'image': return <FileImage className="w-5 h-5 text-primary" />;
    case 'video': return <FileVideo className="w-5 h-5 text-primary" />;
    default: return <HelpCircle className="w-5 h-5 text-muted-foreground" />;
  }
}

const RepairQueue = ({ files, onRemove, onDownload, onCompare }: RepairQueueProps) => {
  if (files.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full space-y-3"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-muted-foreground font-mono uppercase tracking-wider">
          Repair Queue
        </h3>
        <span className="text-xs text-muted-foreground font-mono">
          {files.filter(f => f.status === 'completed').length}/{files.length} completed
        </span>
      </div>

      <AnimatePresence mode="popLayout">
        {files.map((file, index) => (
          <motion.div
            key={file.id}
            layout
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className={`
              relative rounded-xl border overflow-hidden transition-colors
              ${file.status === 'completed'
                ? 'border-success/30 bg-success/5'
                : file.status === 'failed'
                  ? 'border-destructive/30 bg-destructive/5'
                  : 'border-border bg-card'
              }
            `}
          >
            {/* Progress bar */}
            {(file.status === 'analyzing' || file.status === 'repairing') && (
              <motion.div
                className="absolute bottom-0 left-0 h-0.5 gradient-primary"
                initial={{ width: '0%' }}
                animate={{ width: `${file.progress}%` }}
                transition={{ duration: 0.3 }}
              />
            )}

            <div className="flex items-center gap-4 p-4">
              {/* File icon */}
              <div className="flex-shrink-0 p-2.5 rounded-lg bg-secondary border border-border">
                {getFileIcon(file.type)}
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-muted-foreground font-mono">
                    {formatSize(file.size)}
                  </span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {file.type}
                  </span>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2">
                {getStatusIcon(file.status)}
                <span className={`text-xs font-mono ${
                  file.status === 'completed' ? 'text-success' :
                  file.status === 'failed' ? 'text-destructive' :
                  'text-muted-foreground'
                }`}>
                  {getStatusText(file.status)}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                {file.status === 'completed' && file.type === 'image' && onCompare && (
                  <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    onClick={() => onCompare(file)}
                    className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    title="Compare before/after"
                  >
                    <Eye className="w-4 h-4" />
                  </motion.button>
                )}
                {file.status === 'completed' && (
                  <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    onClick={() => onDownload(file)}
                    className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    title="Download repaired file"
                  >
                    <Download className="w-4 h-4" />
                  </motion.button>
                )}
                {file.status === 'failed' && file.error && (
                  <div className="p-2 text-destructive" title={file.error}>
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                )}
                {(file.status === 'queued' || file.status === 'completed' || file.status === 'failed') && (
                  <button
                    onClick={() => onRemove(file.id)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Remove file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
};

export default RepairQueue;
