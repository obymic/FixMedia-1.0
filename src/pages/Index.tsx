import { motion, AnimatePresence } from 'framer-motion';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import Header from '@/components/Header';
import DropZone from '@/components/DropZone';
import RepairQueue from '@/components/RepairQueue';
import FeatureCards from '@/components/FeatureCards';
import BeforeAfter from '@/components/BeforeAfter';
import StatsSection, { useAppStats } from '@/components/StatsSection';
import { useFileRepair, type RepairFile } from '@/hooks/useFileRepair';
import { Button } from '@/components/ui/button';
import { Play, Download, Trash2, Wrench } from 'lucide-react';

const Index = () => {
  const { files, isProcessing, addFiles, removeFile, repairAll, clearAll, downloadFile } = useFileRepair();
  const { stats, trackRepair, refreshStats } = useAppStats();
  const [hasStarted, setHasStarted] = useState(false);
  const [compareFile, setCompareFile] = useState<RepairFile | null>(null);

  const handleFilesAdded = useCallback(
    (newFiles: File[]) => {
      const added = addFiles(newFiles);
      toast.success(`${added.length} file${added.length > 1 ? 's' : ''} added to repair queue`);
    },
    [addFiles]
  );

  const handleRepairAll = useCallback(async () => {
    setHasStarted(true);
    toast.info('Starting repair process...');
    await repairAll();
    
    // Track repairs in stats
    const completed = files.filter(f => f.status === 'queued' || f.status === 'failed');
    for (const f of completed) {
      if (f.type === 'image' || f.type === 'video') {
        await trackRepair(f.type);
      }
    }
    refreshStats();
    
    const completedCount = files.filter(f => f.status === 'completed').length;
    const failedCount = files.filter(f => f.status === 'failed').length;
    if (failedCount > 0) {
      toast.warning(`Repair complete: ${completedCount} succeeded, ${failedCount} failed`);
    } else {
      toast.success('All files repaired successfully!');
    }
  }, [repairAll, files, trackRepair, refreshStats]);

  const handleDownloadAll = useCallback(() => {
    const completed = files.filter(f => f.status === 'completed');
    completed.forEach(f => downloadFile(f));
    toast.success(`Downloading ${completed.length} repaired file${completed.length > 1 ? 's' : ''}`);
  }, [files, downloadFile]);

  const handleClearAll = useCallback(() => {
    clearAll();
    setHasStarted(false);
    toast.info('Queue cleared');
  }, [clearAll]);

  const completedCount = files.filter(f => f.status === 'completed').length;
  const queuedOrFailedCount = files.filter(f => f.status === 'queued' || f.status === 'failed').length;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero glow */}
      <div className="fixed inset-0 gradient-hero pointer-events-none" />

      <Header />

      <main className="relative container mx-auto px-4 md:px-6 py-12 md:py-20 max-w-4xl">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-mono mb-6"
          >
            <Wrench className="w-3.5 h-3.5" />
            Client-side file repair engine
          </motion.div>

          <h1 className="text-4xl md:text-6xl font-display font-bold tracking-tight mb-4">
            Repair Damaged
            <br />
            <span className="text-gradient">Videos & Photos</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Fix corrupted media files instantly in your browser. No uploads, no accounts, 
            no server processing — your files stay private.
          </p>
        </motion.div>

        {/* Upload area */}
        <div className="mb-8">
          <DropZone onFilesAdded={handleFilesAdded} disabled={isProcessing} />
        </div>

        {/* Action buttons */}
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-wrap items-center justify-center gap-3 mb-8"
          >
            {queuedOrFailedCount > 0 && (
              <Button
                variant="hero"
                size="lg"
                onClick={handleRepairAll}
                disabled={isProcessing}
              >
                <Play className="w-4 h-4" />
                {isProcessing ? 'Repairing...' : `Repair ${queuedOrFailedCount} File${queuedOrFailedCount > 1 ? 's' : ''}`}
              </Button>
            )}
            {completedCount > 0 && (
              <Button
                variant="success"
                size="lg"
                onClick={handleDownloadAll}
                disabled={isProcessing}
              >
                <Download className="w-4 h-4" />
                Download All ({completedCount})
              </Button>
            )}
            <Button
              variant="outline"
              size="lg"
              onClick={handleClearAll}
              disabled={isProcessing}
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </Button>
          </motion.div>
        )}

        {/* Repair queue */}
        <div className="mb-16">
          <RepairQueue
            files={files}
            onRemove={removeFile}
            onDownload={downloadFile}
            onCompare={(file) => setCompareFile(file)}
          />
        </div>

        {/* Stats */}
        <div className="mb-16">
          <StatsSection stats={stats} />
        </div>

        {/* Features */}
        {files.length === 0 && (
          <div className="mb-16">
            <FeatureCards />
          </div>
        )}

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center py-8 border-t border-border"
        >
          <p className="text-xs text-muted-foreground font-mono">
            FixMedia — 100% browser-based file repair. No data leaves your device.
          </p>
        </motion.footer>
      </main>

      {/* Before/After Modal */}
      <AnimatePresence>
        {compareFile && (
          <BeforeAfter file={compareFile} onClose={() => setCompareFile(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;
