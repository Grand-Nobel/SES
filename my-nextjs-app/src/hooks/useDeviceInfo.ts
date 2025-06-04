import { useState, useEffect } from 'react';

export const useDeviceInfo = () => {
  const [cpuSpeed] = useState(2.0); // Placeholder for CPU speed, setCpuSpeed is unused

  useEffect(() => {
    // In a real application, you would try to detect actual device info.
    // For now, this is a placeholder.
    console.log('useDeviceInfo: Simulating device info detection.');
  }, []);

  return { cpuSpeed };
};
