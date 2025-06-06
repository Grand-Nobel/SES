import { motion, useReducedMotion } from 'framer-motion';
import { useDeviceInfo } from '@/hooks/useDeviceInfo';

const AnimatedModal = ({ children }: { children: React.ReactNode }) => {
  const shouldReduceMotion = useReducedMotion();
  const { cpuSpeed } = useDeviceInfo();

  const variants = cpuSpeed < 1.5 || shouldReduceMotion
    ? { open: { opacity: 1 }, closed: { opacity: 0 } }
    : { open: { opacity: 1, y: 0 }, closed: { opacity: 0, y: 100 } };

  return (
    <motion.div
      initial="closed"
      animate="open"
      exit="closed"
      variants={variants}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
};

export default AnimatedModal;
