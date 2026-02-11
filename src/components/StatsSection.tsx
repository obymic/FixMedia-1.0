import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Image, Film, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Stats {
  totalVisitors: number;
  totalRepairs: number;
  imageRepairs: number;
  videoRepairs: number;
}

export function useAppStats() {
  const [stats, setStats] = useState<Stats>({
    totalVisitors: 0,
    totalRepairs: 0,
    imageRepairs: 0,
    videoRepairs: 0,
  });

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .from('app_stats')
        .select('stat_type, file_type');

      if (error) {
        console.warn('Failed to fetch stats:', error);
        return;
      }

      if (data) {
        setStats({
          totalVisitors: data.filter(d => d.stat_type === 'visit').length,
          totalRepairs: data.filter(d => d.stat_type === 'repair').length,
          imageRepairs: data.filter(d => d.stat_type === 'repair' && d.file_type === 'image').length,
          videoRepairs: data.filter(d => d.stat_type === 'repair' && d.file_type === 'video').length,
        });
      }
    } catch (e) {
      console.warn('Stats fetch error:', e);
    }
  };

  const trackVisit = async () => {
    try {
      await supabase.from('app_stats').insert({ stat_type: 'visit' });
    } catch { /* silent */ }
  };

  const trackRepair = async (fileType: 'image' | 'video') => {
    try {
      await supabase.from('app_stats').insert({ stat_type: 'repair', file_type: fileType });
    } catch { /* silent */ }
  };

  useEffect(() => {
    trackVisit();
    fetchStats();
  }, []);

  return { stats, trackRepair, refreshStats: fetchStats };
}

const StatCard = ({ icon: Icon, label, value, delay }: { icon: any; label: string; value: number; delay: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border"
  >
    <Icon className="w-5 h-5 text-primary" />
    <span className="text-2xl font-bold font-display text-foreground">{value.toLocaleString()}</span>
    <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{label}</span>
  </motion.div>
);

const StatsSection = ({ stats }: { stats: Stats }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
    >
      <h3 className="text-sm font-medium text-muted-foreground font-mono uppercase tracking-wider text-center mb-4">
        Statistici
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Vizitatori" value={stats.totalVisitors} delay={0.1} />
        <StatCard icon={TrendingUp} label="Reparări" value={stats.totalRepairs} delay={0.2} />
        <StatCard icon={Image} label="Fotografii" value={stats.imageRepairs} delay={0.3} />
        <StatCard icon={Film} label="Videoclipuri" value={stats.videoRepairs} delay={0.4} />
      </div>
    </motion.div>
  );
};

export default StatsSection;
