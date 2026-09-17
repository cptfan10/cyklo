import { useState, useEffect, useCallback } from 'react';
import {
  DisplaySettings,
  DisplayContrastMode,
  DisplayTypography,
  TouchTargetSize,
  MetricColorTheme,
  SpeedometerSize,
  DisplayPresetId
} from '../types';

export const DISPLAY_PRESETS: Record<
  Exclude<DisplayPresetId, 'custom'>,
  {
    name: string;
    description: string;
    icon: string;
    settings: Omit<DisplaySettings, 'activePreset'>;
  }
> = {
  'bernard-classic': {
    name: 'Bernard MT Klasik (Stylový)',
    description: 'Výrazná typografie Bernard MT Condensed, velké čitelné texty a 50px dotyková tlačítka.',
    icon: 'Type',
    settings: {
      contrastMode: 'amoled-pure-black',
      typography: 'bernard-mt',
      uiFontTheme: 'bernard-mt',
      textScale: 'large',
      touchTargetSize: 'glove-50',
      metricColorTheme: 'emerald',
      speedometerSize: 'giant',
      hapticFeedback: true,
      highContrastBorders: false,
    },
  },
  'galaxy-s10': {
    name: 'Samsung Galaxy S10+ (AMOLED)',
    description: 'Čistě černá #000000, extra velké čitelné texty na řídítkách a 50px dotyková tlačítka.',
    icon: 'Smartphone',
    settings: {
      contrastMode: 'amoled-pure-black',
      typography: 'sports-mono',
      uiFontTheme: 'bernard-mt',
      textScale: 'extra-large',
      touchTargetSize: 'glove-50',
      metricColorTheme: 'emerald',
      speedometerSize: 'giant',
      hapticFeedback: true,
      highContrastBorders: false,
    },
  },
  'outdoor-sun': {
    name: 'Přímé slunce & Max kontrast',
    description: 'Extrémní kontrast pro ostré letní slunce – masivní bílá čísla, extra velká slova a obrysy.',
    icon: 'Sun',
    settings: {
      contrastMode: 'high-contrast-sun',
      typography: 'bold-sans',
      uiFontTheme: 'default',
      textScale: 'extra-large',
      touchTargetSize: 'glove-50',
      metricColorTheme: 'white',
      speedometerSize: 'giant',
      hapticFeedback: true,
      highContrastBorders: true,
    },
  },
  'gloves-winter': {
    name: 'Cyklo rukavice & Terén (60px)',
    description: 'Extra zvětšené 60px ovládací zóny, extra velké čitelné texty a obří rychlost pro jízdu v rukavicích.',
    icon: 'ShieldCheck',
    settings: {
      contrastMode: 'amoled-pure-black',
      typography: 'sports-mono',
      uiFontTheme: 'bernard-mt',
      textScale: 'extra-large',
      touchTargetSize: 'heavy-glove-60',
      metricColorTheme: 'amber',
      speedometerSize: 'giant',
      hapticFeedback: true,
      highContrastBorders: true,
    },
  },
  'digital-led': {
    name: 'Digitální LED (Dot-Matrix)',
    description: 'Retro cyklopočítačový styl s tečkovaným LED písmem, azurovým podsvícením a velkými čísly.',
    icon: 'Gauge',
    settings: {
      contrastMode: 'amoled-pure-black',
      typography: 'dot-matrix',
      uiFontTheme: 'default',
      textScale: 'large',
      touchTargetSize: 'glove-50',
      metricColorTheme: 'cyan',
      speedometerSize: 'giant',
      hapticFeedback: true,
      highContrastBorders: false,
    },
  },
  'night-ride': {
    name: 'Noční OLED jízda (Šetrná)',
    description: 'Tlumené jantarovo-červené tóny chránící noční vidění, minimální oslnění na nočních silnicích.',
    icon: 'Moon',
    settings: {
      contrastMode: 'oled-night',
      typography: 'sports-mono',
      uiFontTheme: 'default',
      textScale: 'large',
      touchTargetSize: 'glove-50',
      metricColorTheme: 'amber',
      speedometerSize: 'standard',
      hapticFeedback: true,
      highContrastBorders: false,
    },
  },
  'slate-glass': {
    name: 'Břidlicové matné sklo',
    description: 'Jemný prémiový styl s matným sklem, standardní velikostí písma pro běžný telefon či počítač.',
    icon: 'Sparkles',
    settings: {
      contrastMode: 'slate-glass',
      typography: 'bold-sans',
      uiFontTheme: 'default',
      textScale: 'standard',
      touchTargetSize: 'standard-44',
      metricColorTheme: 'emerald',
      speedometerSize: 'standard',
      hapticFeedback: true,
      highContrastBorders: false,
    },
  },
};

const STORAGE_KEY = 'cyklo_display_settings_v4';

const DEFAULT_SETTINGS: DisplaySettings = {
  ...DISPLAY_PRESETS['bernard-classic'].settings,
  textScale: 'large',
  activePreset: 'bernard-classic',
};

export function useDisplaySettings() {
  const [settings, setSettings] = useState<DisplaySettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  });

  // Save to localStorage when settings change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  // Apply preset
  const applyPreset = useCallback((presetId: Exclude<DisplayPresetId, 'custom'>) => {
    const preset = DISPLAY_PRESETS[presetId];
    if (preset) {
      setSettings({
        ...preset.settings,
        activePreset: presetId,
      });
    }
  }, []);

  // Update specific individual setting
  const updateSettings = useCallback((partial: Partial<Omit<DisplaySettings, 'activePreset'>>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      // Check if matches any preset exactly
      let matchingPreset: DisplayPresetId = 'custom';
      for (const [key, preset] of Object.entries(DISPLAY_PRESETS)) {
        const s = preset.settings;
        if (
          s.contrastMode === next.contrastMode &&
          s.typography === next.typography &&
          s.uiFontTheme === next.uiFontTheme &&
          s.textScale === next.textScale &&
          s.touchTargetSize === next.touchTargetSize &&
          s.metricColorTheme === next.metricColorTheme &&
          s.speedometerSize === next.speedometerSize &&
          s.hapticFeedback === next.hapticFeedback &&
          s.highContrastBorders === next.highContrastBorders
        ) {
          matchingPreset = key as DisplayPresetId;
          break;
        }
      }
      return { ...next, activePreset: matchingPreset };
    });
  }, []);

  // Trigger haptic vibration respecting settings
  const triggerHaptic = useCallback(
    (pattern: number | number[] = 30) => {
      if (!settings.hapticFeedback) return;
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(pattern);
        } catch {
          // Ignore
        }
      }
    },
    [settings.hapticFeedback]
  );

  // CSS class helpers
  const getTextScaleClass = useCallback((): string => {
    switch (settings.textScale) {
      case 'extra-large':
        return 'text-scale-extra-large';
      case 'large':
        return 'text-scale-large';
      case 'standard':
      default:
        return '';
    }
  }, [settings.textScale]);

  const getTypographyClass = useCallback((): string => {
    switch (settings.typography) {
      case 'bernard-mt':
        return 'font-bernard-mt';
      case 'dot-matrix':
        return 'font-dot-matrix';
      case 'bold-sans':
        return 'font-bold-sans';
      case 'sports-mono':
      default:
        return 'font-sports-mono';
    }
  }, [settings.typography]);

  const getMetricColorClass = useCallback(
    (type: 'text' | 'border' | 'fill' = 'text'): string => {
      switch (settings.metricColorTheme) {
        case 'cyan':
          return type === 'text' ? 'text-cyan-400' : type === 'border' ? 'border-cyan-400' : 'fill-cyan-400';
        case 'amber':
          return type === 'text' ? 'text-amber-400' : type === 'border' ? 'border-amber-400' : 'fill-amber-400';
        case 'white':
          return type === 'text' ? 'text-white' : type === 'border' ? 'border-white' : 'fill-white';
        case 'emerald':
        default:
          return type === 'text' ? 'text-emerald-400' : type === 'border' ? 'border-emerald-400' : 'fill-emerald-400';
      }
    },
    [settings.metricColorTheme]
  );

  const getTouchTargetButtonClass = useCallback((): string => {
    switch (settings.touchTargetSize) {
      case 'heavy-glove-60':
        return 'min-h-[60px] py-4 text-base sm:text-lg';
      case 'glove-50':
        return 'min-h-[50px] py-3.5 text-sm sm:text-base';
      case 'standard-44':
      default:
        return 'min-h-[44px] py-2.5 text-xs sm:text-sm';
    }
  }, [settings.touchTargetSize]);

  const getContainerBgClass = useCallback((): string => {
    switch (settings.contrastMode) {
      case 'amoled-pure-black':
        return 'bg-black border-stone-800/80';
      case 'high-contrast-sun':
        return 'bg-black border-white/40 shadow-2xl';
      case 'oled-night':
        return 'bg-[#0a0403] border-amber-950/60';
      case 'slate-glass':
      default:
        return 'glass-panel';
    }
  }, [settings.contrastMode]);

  return {
    settings,
    updateSettings,
    applyPreset,
    triggerHaptic,
    getTypographyClass,
    getTextScaleClass,
    getMetricColorClass,
    getTouchTargetButtonClass,
    getContainerBgClass,
    presets: DISPLAY_PRESETS,
  };
}
