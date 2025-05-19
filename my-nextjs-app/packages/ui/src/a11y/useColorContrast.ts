'use client';
import { useState, useEffect } from 'react';
import { calculateContrastRatio, meetsContrastRequirements, getContrastingColor } from './color-contrast';

interface ColorContrastResult {
  contrastRatio: number;
  meetsAA: boolean;
  meetsAAA: boolean;
  meetsAALarge: boolean;
  meetsAAALarge: boolean;
  recommendedColor: string;
}

export function useColorContrast(foreground: string, background: string): ColorContrastResult {
  const [result, setResult] = useState<ColorContrastResult>({
    contrastRatio: 1,
    meetsAA: false,
    meetsAAA: false,
    meetsAALarge: false,
    meetsAAALarge: false,
    recommendedColor: foreground,
  });

  useEffect(() => {
    async function updateContrast() {
      const ratio = await calculateContrastRatio(foreground, background);
      const meetsAA = await meetsContrastRequirements(foreground, background, 'AA', false);
      const meetsAAA = await meetsContrastRequirements(foreground, background, 'AAA', false);
      const meetsAALarge = await meetsContrastRequirements(foreground, background, 'AA', true);
      const meetsAAALarge = await meetsContrastRequirements(foreground, background, 'AAA', true);
      const recommendedColor = meetsAAA ? foreground : await getContrastingColor(background, 'AAA');

      setResult({
        contrastRatio: parseFloat(ratio.toFixed(2)),
        meetsAA,
        meetsAAA,
        meetsAALarge,
        meetsAAALarge,
        recommendedColor,
      });
    }
    updateContrast();
  }, [foreground, background]);

  return result;
}