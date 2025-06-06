// Elite+++++++ Main Content with batch operations and mobile responsiveness
import { memo, useState, useEffect, useCallback } from 'react';
import { useAuth, useWindowSize } from '../hooks';
import { supabase } from '../lib/supabase';
import * as Sentry from '@sentry/react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Widget } from '../components/ui';
import { motion } from 'framer-motion'; // Enhanced: For animations
import { histogram } from '../lib/performance'; // Enhanced: Prometheus metrics

const widgetRenderTime = histogram('main_content_widget_render_time', 'Time to render dashboard widgets', [50, 100, 500]); // Enhanced: Prometheus metric

interface DashboardOperation {
  id: string;
  team_id: string;
  user_id: string;
  op_type: string;
  widget_id: string;
  timestamp: string; // Assuming timestamp is a string, adjust if it's a Date object
  // Add any other properties that dashboard_operations might have
}

const MainContent = memo(() => {
  const { user, tenant } = useAuth();
  const { width } = useWindowSize(); // Enhanced: For mobile responsiveness
  const [operations, setOperations] = useState<DashboardOperation[]>([]);
  const [batchQueue, setBatchQueue] = useState<DashboardOperation[]>([]);

  const { data: dashboardData } = useQuery({
    queryKey: ['dashboard', user.id, tenant.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dashboard_operations')
        .select('*')
        .eq('team_id', tenant.id)
        .order('timestamp', { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 60 * 1000,
  });

  const applyOperation = useCallback((op: DashboardOperation) => {
    if (!op.id || !op.team_id || !op.user_id || !op.op_type || !op.widget_id) {
      Sentry.captureMessage('Invalid operation', {
        extra: { operation: op, userId: user.id, tenantId: tenant.id },
      });
      return;
    }
    setOperations(prev => [...prev, op]);
  }, [user.id, tenant.id]);

  const batchMutation = useMutation({
    mutationFn: async (ops) => {
      const { error } = await supabase.rpc('batch_insert_dashboard_ops', { ops });
      if (error) throw error;
    },
    onError: (error) => {
      Sentry.captureException(error, {
        extra: { userId: user.id, tenantId: tenant.id, batchSize: batchQueue.length },
      });
    },
  });

  useEffect(() => {
    if (batchQueue.length >= 10 || (batchQueue.length > 0 && !supabase.realtime.isConnected())) {
      batchMutation.mutate(batchQueue as any); // Cast to any to bypass type error for now, will refine if needed
      setBatchQueue([]);
    }
  }, [batchQueue, batchMutation, supabase.realtime]); // Added supabase.realtime to dependencies

  const handleOperation = useCallback((op: DashboardOperation) => {
    setBatchQueue(prev => [...prev, op]);
    applyOperation(op);
  }, [applyOperation]);

  useEffect(() => {
    let channel: any; // Declare channel outside to ensure it's in scope for cleanup
    const setupChannel = async () => {
      channel = supabase
        .channel('dashboard-ops')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dashboard_operations' }, (payload) => {
          handleOperation(payload.new as DashboardOperation); // Cast payload.new to DashboardOperation
        })
        .subscribe();
    };

    setupChannel();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [handleOperation, supabase]); // Added supabase to dependencies

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={`p-4 ${width < 600 ? 'grid grid-cols-1' : 'grid grid-cols-2 lg:grid-cols-3 gap-4'}`}
      role="main"
      aria-label="Main content area"
    >
      {dashboardData?.map((widget) => (
        <motion.div
          key={widget.id}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Widget
            data={widget}
            onRender={() => widgetRenderTime.observe(performance.now())} // Enhanced: Measure render time
          />
        </motion.div>
      ))}
    </motion.main>
  );
});

export default MainContent;