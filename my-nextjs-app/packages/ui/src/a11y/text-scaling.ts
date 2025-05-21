// import { PrivacyLogger } from '@/lib/logging'; // Commented out for now
// import { supabase } from '@/lib/supabase'; // Commented out for now
// import { useAuthStore } from '@/stores/authStore'; // Commented out for now

export function fluidTypography(
  minSize: number,
  maxSize: number,
  minViewport: number = 320,
  maxViewport: number = 1200
): string {
  // Ensure maxSize is greater than minSize to avoid division by zero or negative results
  if (maxSize <= minSize) {
    console.warn('fluidTypography: maxSize should be greater than minSize. Returning minSize.');
    return `${minSize}px`;
  }
  // Ensure maxViewport is greater than minViewport
  if (maxViewport <= minViewport) {
    console.warn('fluidTypography: maxViewport should be greater than minViewport. Using default viewport range or returning minSize.');
    // Fallback to a safe default or just minSize if viewports are invalid
    return `${minSize}px`; 
  }

  const sizeDiff = maxSize - minSize;
  const viewportDiff = maxViewport - minViewport;
  
  const fluidTerm = `(${sizeDiff} * (100vw - ${minViewport}px) / ${viewportDiff})`;
  return `clamp(${minSize}px, ${minSize}px + ${fluidTerm}, ${maxSize}px)`;
}

export function generateFluidTypographyCSS(): string {
  return `
    :root {
      --text-display: ${fluidTypography(36, 48)};
      --text-h1: ${fluidTypography(32, 40)};
      /* Add more as needed, e.g., h2, h3, body-large etc. */
      --text-h2: ${fluidTypography(28, 36)};
      --text-h3: ${fluidTypography(24, 32)};
      --text-body-large: ${fluidTypography(18, 20)};
      --text-body: ${fluidTypography(16, 18)};
      --text-small: ${fluidTypography(14, 16)};
      --text-caption: ${fluidTypography(12, 14)};

      --line-height-heading: 1.2;
      --line-height-body: 1.5;
    }
    body { font-size: var(--text-body); line-height: var(--line-height-body); }
    h1, .text-h1 { font-size: var(--text-h1); line-height: var(--line-height-heading); }
    h2, .text-h2 { font-size: var(--text-h2); line-height: var(--line-height-heading); }
    h3, .text-h3 { font-size: var(--text-h3); line-height: var(--line-height-heading); }
    /* Add classes for other text sizes if needed */
    .text-display { font-size: var(--text-display); line-height: var(--line-height-heading); }
    .text-body-large { font-size: var(--text-body-large); line-height: var(--line-height-body); }
    .text-small { font-size: var(--text-small); line-height: var(--line-height-body); }
    .text-caption { font-size: var(--text-caption); line-height: var(--line-height-body); }
  `;
}
