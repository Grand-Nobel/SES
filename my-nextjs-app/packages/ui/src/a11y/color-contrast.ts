import { PrivacyLogger } from '@/lib/logging';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

export function getRelativeLuminance(r: number, g: number, b: number): number {
  const sr = r / 255;
  const sg = g / 255;
  const sb = b / 255;
  const R = sr <= 0.03928 ? sr / 12.92 : Math.pow((sr + 0.055) / 1.055, 2.4);
  const G = sg <= 0.03928 ? sg / 12.92 : Math.pow((sg + 0.055) / 1.055, 2.4);
  const B = sb <= 0.03928 ? sb / 12.92 : Math.pow((sb + 0.055) / 1.055, 2.4);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function parseColor(color: string): [number, number, number] {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
      ];
    }
    if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      ];
    }
  }
  if (color.startsWith('rgb')) {
    const match = color.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)/i);
    if (match) return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
  }
  console.warn(`Failed to parse color: ${color}`);
  return [0, 0, 0];
}

export async function calculateContrastRatio(color1: string, color2: string): Promise<number> {
  const [r1, g1, b1] = parseColor(color1);
  const [r2, g2, b2] = parseColor(color2);
  const l1 = getRelativeLuminance(r1, g1, b1);
  const l2 = getRelativeLuminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const ratio = (lighter + 0.05) / (darker + 0.05);

  const maskedEvent = await PrivacyLogger().maskPersonalData({ color1, color2, ratio });
  await supabase.from('ui_events').insert({
    tenant_id: useAuthStore().getState().tenantId,
    event: 'contrast_check',
    payload: maskedEvent,
  });

  return ratio;
}

export async function meetsContrastRequirements(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AAA',
  isLargeText: boolean = false
): Promise<boolean> {
  const ratio = await calculateContrastRatio(foreground, background);
  if (level === 'AA') return isLargeText ? ratio >= 3 : ratio >= 4.5;
  return isLargeText ? ratio >= 4.5 : ratio >= 7;
}

export async function getContrastingColor(
  backgroundColor: string,
  level: 'AA' | 'AAA' = 'AAA',
  isLargeText: boolean = false
): Promise<string> {
  const black = '#000000';
  const white = '#FFFFFF';
  const blackRatio = await calculateContrastRatio(black, backgroundColor);
  const whiteRatio = await calculateContrastRatio(white, backgroundColor);
  const targetRatio = level === 'AAA' ? (isLargeText ? 4.5 : 7) : isLargeText ? 3 : 4.5;

  if (blackRatio >= targetRatio && whiteRatio >= targetRatio) return blackRatio > whiteRatio ? black : white;
  if (blackRatio >= targetRatio) return black;
  if (whiteRatio >= targetRatio) return white;
  return blackRatio > whiteRatio ? black : white;
}
