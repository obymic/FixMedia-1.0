import { motion } from 'framer-motion';
import { Shield, Zap, FileCheck, Monitor } from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: 'Instant Repair',
    description: 'Browser-based processing — no uploads to external servers',
  },
  {
    icon: Shield,
    title: 'Private & Secure',
    description: 'Files never leave your device. 100% client-side processing',
  },
  {
    icon: FileCheck,
    title: 'Multi-Format',
    description: 'Supports JPG, PNG, WebP, BMP, GIF, MP4, AVI, MOV & more',
  },
  {
    icon: Monitor,
    title: 'Preview & Download',
    description: 'Preview repaired files instantly and download with one click',
  },
];

const FeatureCards = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {features.map((feature, index) => (
        <motion.div
          key={feature.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 + index * 0.1 }}
          className="group relative rounded-xl border border-border bg-card p-6 hover:border-primary/30 transition-all duration-300"
        >
          <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: 'radial-gradient(circle at 50% 0%, hsl(175 80% 48% / 0.05), transparent 70%)' }}
          />
          <div className="relative">
            <div className="p-2.5 rounded-lg bg-secondary border border-border w-fit mb-4 group-hover:border-primary/30 transition-colors">
              <feature.icon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-sm font-semibold mb-1.5">{feature.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default FeatureCards;
