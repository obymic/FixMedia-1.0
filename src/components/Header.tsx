import { motion } from 'framer-motion';
import { Wrench } from 'lucide-react';

const Header = () => {
  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50"
    >
      <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg gradient-primary">
            <Wrench className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">
            FixMedia
          </span>
          <span className="hidden sm:inline text-xs font-mono text-muted-foreground px-2 py-0.5 rounded-full border border-border bg-secondary">
            v1.0
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          All processing local
        </div>
      </div>
    </motion.header>
  );
};

export default Header;
