import React from 'react';
import { Play, Pause, Square, X, Compass, Mountain, Flame, Zap, Shield, Smartphone, Sliders } from 'lucide-react';
import { formatDuration } from '../utils/geoUtils';
import { RecorderStatus } from '../hooks/useRideRecorder';
import { PlannedRoute, DisplaySettings } from '../types';

interface HandlebarCockpitModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: RecorderStatus;
  distanceKm: number;
  durationSeconds: number;
  currentSpeedKmh: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  elevationGainM: number;
  currentElevationM?: number;
  caloriesBurned: number;
  plannedRoute?: PlannedRoute | null;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  isWakeLocked: boolean;
  onToggleWakeLock?: () => void;
  displaySettings: DisplaySettings;
  onOpenDisplaySettings?: () => void;
  onTriggerHaptic?: (pattern?: number | number[]) => void;
}

export const HandlebarCockpitModal: React.FC<HandlebarCockpitModalProps> = ({
  isOpen,
  onClose,
  status,
  distanceKm,
  durationSeconds,
  currentSpeedKmh,
  avgSpeedKmh,
  maxSpeedKmh,
  elevationGainM,
  currentElevationM,
  caloriesBurned,
  plannedRoute,
  onPause,
  onResume,
  onFinish,
  isWakeLocked,
  onToggleWakeLock,
  displaySettings,
  onOpenDisplaySettings,
  onTriggerHaptic,
}) => {
  if (!isOpen) return null;

  const remainingKm = plannedRoute ? Math.max(0, plannedRoute.distanceKm - distanceKm) : null;
  const progressPercent = plannedRoute ? Math.min(100, Math.round((distanceKm / plannedRoute.distanceKm) * 100)) : null;

  // Typography class helper
  const getTypoClass = () => {
    switch (displaySettings.typography) {
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
  };

  // Speed color class helper
  const getSpeedColorClass = () => {
    switch (displaySettings.metricColorTheme) {
      case 'cyan':
        return 'text-cyan-400 drop-shadow-[0_4px_24px_rgba(6,182,212,0.35)]';
      case 'amber':
        return 'text-amber-400 drop-shadow-[0_4px_24px_rgba(245,158,11,0.35)]';
      case 'white':
        return 'text-white drop-shadow-[0_4px_24px_rgba(255,255,255,0.4)]';
      case 'emerald':
      default:
        return 'text-emerald-400 drop-shadow-[0_4px_24px_rgba(16,185,129,0.35)]';
    }
  };

  // Container styling based on contrast mode
  const getModalBgClass = () => {
    switch (displaySettings.contrastMode) {
      case 'amoled-pure-black':
        return 'bg-black text-white';
      case 'high-contrast-sun':
        return 'bg-black text-white border-4 border-white/80';
      case 'oled-night':
        return 'bg-[#080201] text-amber-200';
      case 'slate-glass':
      default:
        return 'bg-stone-950 text-stone-100';
    }
  };

  // Button height class based on touch target size for gloves
  const getButtonClass = () => {
    switch (displaySettings.touchTargetSize) {
      case 'heavy-glove-60':
        return 'min-h-[64px] py-4 text-base sm:text-lg';
      case 'glove-50':
        return 'min-h-[52px] py-3.5 text-sm sm:text-base';
      case 'standard-44':
      default:
        return 'min-h-[44px] py-2.5 text-xs sm:text-sm';
    }
  };

  const tileBorderClass = displaySettings.highContrastBorders
    ? 'border-2 border-white/60 bg-stone-950'
    : 'border border-white/10 bg-stone-900/60';

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col justify-between p-4 sm:p-6 select-none overflow-hidden [padding-top:max(1rem,env(safe-area-inset-top))] [padding-bottom:max(1rem,env(safe-area-inset-bottom))] transition-colors duration-200 ${getModalBgClass()} ${
        displaySettings.typography === 'dot-matrix' ? 'dot-matrix-grid' : ''
      }`}
    >
      {/* Top Cockpit Header */}
      <div className="flex items-center justify-between border-b border-stone-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs sm:text-sm font-black flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
            <span>COCKPIT ŘÍDÍTEK</span>
          </div>
          {isWakeLocked && (
            <span className="text-xs sm:text-sm text-amber-400 font-bold flex items-center gap-1.5">
              <Zap className="w-4 h-4" />
              Displej svítí
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Display & AMOLED Customization Button */}
          {onOpenDisplaySettings && (
            <button
              type="button"
              onClick={() => {
                onTriggerHaptic?.(20);
                onOpenDisplaySettings();
              }}
              className="px-3 py-2 rounded-xl bg-stone-900/90 hover:bg-stone-800 text-xs sm:text-sm font-bold text-cyan-300 hover:text-white border border-cyan-500/40 flex items-center gap-1.5 transition cursor-pointer"
              title="Přizpůsobit kontrast, velikost písma a tlačítka pro rukavice"
            >
              <Sliders className="w-4 h-4" />
              <span className="hidden sm:inline">Displej & Text</span>
            </button>
          )}

          {onToggleWakeLock && (
            <button
              type="button"
              onClick={() => {
                onTriggerHaptic?.(20);
                onToggleWakeLock();
              }}
              className="px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-xs sm:text-sm font-bold text-stone-200 hover:text-white"
            >
              Wake Lock {isWakeLocked ? 'Zap' : 'Vyp'}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onTriggerHaptic?.(20);
              onClose();
            }}
            className="p-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-200 hover:text-white border border-stone-800 cursor-pointer"
            title="Ukončit režim řídítek"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Planned route guidance banner if active */}
      {plannedRoute && (
        <div className={`p-4 my-2 rounded-xl ${tileBorderClass}`}>
          <div className="flex items-center justify-between text-sm sm:text-base mb-1.5">
            <span className="font-extrabold text-cyan-300 truncate banner-route-title">{plannedRoute.routeName}</span>
            <span className={`font-mono text-stone-100 font-bold ${getTypoClass()}`}>{progressPercent}% hotovo</span>
          </div>
          <div className="h-2.5 w-full bg-stone-950/80 rounded-full overflow-hidden mb-2">
            <div className="h-full bg-cyan-400 rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className={`flex items-center justify-between text-xs sm:text-sm text-stone-200 font-semibold ${getTypoClass()}`}>
            <span>Ujeto: <strong>{distanceKm.toFixed(1)} km</strong></span>
            <span className="text-white font-black">Do cíle: {remainingKm?.toFixed(1)} km</span>
          </div>
        </div>
      )}

      {/* MAIN SPEEDOMETER HERO (Configurable typography & AMOLED contrast) */}
      <div className="flex-1 flex flex-col items-center justify-center text-center my-auto">
        <span className="text-sm sm:text-base uppercase tracking-widest text-stone-200 font-black mb-2 metric-label">
          Okamžitá rychlost
        </span>
        <div className="flex items-baseline justify-center">
          <span
            className={`font-black tracking-tighter leading-none ${getTypoClass()} ${getSpeedColorClass()} ${
              displaySettings.speedometerSize === 'giant'
                ? 'text-8xl sm:text-9xl md:text-[11rem]'
                : 'text-7xl sm:text-8xl md:text-9xl'
            }`}
          >
            {currentSpeedKmh.toFixed(1)}
          </span>
          <span className="text-2xl sm:text-3xl font-black font-sans text-stone-300 ml-3">km/h</span>
        </div>
      </div>

      {/* SECONDARY METRICS BENTO GRID (Glassmorphism / High Contrast tiles) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mb-4">
        {/* Distance */}
        <div className={`p-3.5 sm:p-5 text-center rounded-2xl ${tileBorderClass}`}>
          <span className="text-xs sm:text-sm text-stone-100 uppercase tracking-wider block font-black mb-1 metric-label">Vzdálenost</span>
          <div className={`text-3xl sm:text-4xl md:text-5xl font-black text-emerald-400 mt-0.5 ${getTypoClass()}`}>
            {distanceKm.toFixed(1)}
            <span className="text-sm sm:text-base font-bold text-emerald-300 ml-1">km</span>
          </div>
        </div>

        {/* Time */}
        <div className={`p-3.5 sm:p-5 text-center rounded-2xl ${tileBorderClass}`}>
          <span className="text-xs sm:text-sm text-stone-100 uppercase tracking-wider block font-black mb-1 metric-label">Čas jízdy</span>
          <div className={`text-3xl sm:text-4xl md:text-5xl font-black text-cyan-400 mt-0.5 ${getTypoClass()}`}>
            {formatDuration(durationSeconds)}
          </div>
        </div>

        {/* Avg Speed */}
        <div className={`p-3.5 sm:p-5 text-center rounded-2xl ${tileBorderClass}`}>
          <span className="text-xs sm:text-sm text-stone-100 uppercase tracking-wider block font-black mb-1 metric-label">Průměrná rychlost</span>
          <div className={`text-3xl sm:text-4xl md:text-5xl font-black text-white mt-0.5 ${getTypoClass()}`}>
            {avgSpeedKmh.toFixed(1)}
            <span className="text-sm sm:text-base font-bold text-stone-300 ml-1">km/h</span>
          </div>
        </div>

        {/* Elevation Climb */}
        <div className={`p-3.5 sm:p-5 text-center rounded-2xl ${tileBorderClass}`}>
          <span className="text-xs sm:text-sm text-stone-100 uppercase tracking-wider block font-black mb-1 metric-label">Nastoupáno</span>
          <div className={`text-3xl sm:text-4xl md:text-5xl font-black text-amber-400 mt-0.5 ${getTypoClass()}`}>
            +{elevationGainM}
            <span className="text-sm sm:text-base font-bold text-amber-300 ml-1">m</span>
          </div>
        </div>
      </div>

      {/* COCKPIT BOTTOM CONTROLS (Customized touch target size for gloves) */}
      <div className="flex items-center gap-3">
        {status === 'recording' ? (
          <button
            type="button"
            onClick={() => {
              onTriggerHaptic?.(50);
              onPause();
            }}
            className={`flex-1 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 active:scale-95 transition-all cursor-pointer ${getButtonClass()}`}
          >
            <Pause className="w-6 h-6 stroke-[2.5]" />
            <span>POZASTAVIT JÍZDU</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              onTriggerHaptic?.([30, 50]);
              onResume();
            }}
            className={`flex-1 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer ${getButtonClass()}`}
          >
            <Play className="w-6 h-6 stroke-[2.5]" />
            <span>POKRAČOVAT V JÍZDĚ</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            onTriggerHaptic?.(40);
            if (window.confirm('Opravdu chcete ukončit jízdu a přejít na vyhodnocení?')) {
              onClose();
              onFinish();
            }
          }}
          className={`px-6 rounded-2xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 font-bold flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer ${getButtonClass()}`}
        >
          <Square className="w-5 h-5 fill-current" />
          <span>UKONČIT</span>
        </button>
      </div>
    </div>
  );
};
