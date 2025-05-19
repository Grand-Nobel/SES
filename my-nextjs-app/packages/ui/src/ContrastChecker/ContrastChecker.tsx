'use client';
import React, { useState } from 'react';
import { useColorContrast } from '../a11y/useColorContrast'; // Adjusted path
import { PrivacyLogger } from '@/lib/logging';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore'; // Added import
import './ContrastChecker.module.css';

interface ContrastCheckerProps {
  foreground?: string;
  background?: string;
  text?: string;
  className?: string;
  'data-testid'?: string;
}

export const ContrastChecker: React.FC<ContrastCheckerProps> = ({ // Changed to ContrastCheckerProps
  foreground: initialForeground = '#000000',
  background: initialBackground = '#FFFFFF',
  text = 'Sample Text',
  className = '',
  'data-testid': dataTestId = 'contrast-checker',
}) => {
  const [foreground, setForeground] = useState(initialForeground);
  const [background, setBackground] = useState(initialBackground);
  const contrast = useColorContrast(foreground, background);

  const logContrastCheck = async () => {
    const maskedEvent = await PrivacyLogger().maskPersonalData({ foreground, background, contrastRatio: contrast.contrastRatio });
    // @ts-ignore
    await supabase.from('ui_events').insert({
      tenant_id: useAuthStore().getState().tenantId,
      event: 'contrast_checker_used',
      payload: maskedEvent,
    });
  };

  const getContrastLevel = () => {
    if (contrast.meetsAAA) return 'AAA';
    if (contrast.meetsAA) return 'AA';
    if (contrast.meetsAALarge) return 'AA (Large Text)';
    return 'Fails WCAG';
  };

  return (
    <div className={`contrast-checker ${className}`} data-testid={dataTestId}>
      <div className="contrast-checker__inputs">
        <div className="contrast-checker__input-group">
          <label htmlFor={`${dataTestId}-foreground-color`}>Foreground Color</label>
          <input
            type="color"
            id={`${dataTestId}-foreground-color`}
            value={foreground}
            onChange={(e) => setForeground(e.target.value)}
            onBlur={logContrastCheck}
            data-testid={`${dataTestId}-foreground-color`}
          />
          <input
            type="text"
            value={foreground}
            onChange={(e) => setForeground(e.target.value)}
            aria-label="Foreground color text input"
            data-testid={`${dataTestId}-foreground-text`}
          />
        </div>
        <div className="contrast-checker__input-group">
          <label htmlFor={`${dataTestId}-background-color`}>Background Color</label>
          <input
            type="color"
            id={`${dataTestId}-background-color`}
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            onBlur={logContrastCheck}
            data-testid={`${dataTestId}-background-color`}
          />
          <input
            type="text"
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            aria-label="Background color text input"
            data-testid={`${dataTestId}-background-text`}
          />
        </div>
      </div>
      <div className="contrast-checker__preview">
        <div
          className="contrast-checker__preview-text"
          style={{ color: foreground, background: background }}
          data-testid={`${dataTestId}-preview-normal`}
        >
          {text}
        </div>
        {!contrast.meetsAAA && (
          <div
            className="contrast-checker__preview-recommended"
            style={{ color: contrast.recommendedColor, background: background }}
            data-testid={`${dataTestId}-preview-recommended`}
          >
            {text} (Recommended)
          </div>
        )}
      </div>
      <div className="contrast-checker__results">
        <p>Contrast Ratio: {contrast.contrastRatio}:1</p>
        <p>WCAG Status: {getContrastLevel()}</p>
        <div className="contrast-checker__requirements">
          <p>WCAG Requirements:</p>
          <ul>
            <li>
              {contrast.meetsAALarge ? '✓' : '✗'} AA (Large Text): 3:1
            </li>
            <li>
              {contrast.meetsAA ? '✓' : '✗'} AA (Normal Text): 4.5:1
            </li>
            <li>
              {contrast.meetsAAALarge ? '✓' : '✗'} AAA (Large Text): 4.5:1
            </li>
            <li>
              {contrast.meetsAAA ? '✓' : '✗'} AAA (Normal Text): 7:1
            </li>
          </ul>
        </div>
        {!contrast.meetsAAA && (
          <div className="contrast-checker__recommendation">
            <p>
              Recommended color: {contrast.recommendedColor}
            </p>
            <button
              onClick={() => setForeground(contrast.recommendedColor)}
              data-testid={`${dataTestId}-apply-recommended`}
            >
              Apply Recommended Color
            </button>
          </div>
        )}
      </div>
    </div>
  );
};