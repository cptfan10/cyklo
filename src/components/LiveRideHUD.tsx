import React from 'react';
import { Play, Pause, Square, Radio, Mountain, Flame, Zap, Gauge, Compass, AlertTriangle, RotateCcw, Smartphone, Sliders } from 'lucide-react';
import { formatDuration } from '../utils/geoUtils';
import { RecorderStatus } from '../hooks/useRideRecorder';
import { WakeLockToggle } from './WakeLockToggle';
import { DisplaySettings } from '../types';

interface LiveRideHUDProps {
  status: RecorderStatus;
  distanceKm: number;
  durationSeconds: number;
  currentSpeedKmh: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  elevationGainM: number;
  currentElevationM?: number;
  caloriesBurned: number;
  isSimulated: boolean;
  gpsAccuracy: number | null;
  gpsError: string | null;
  isScreenLocked?: boolean;
  isWakeLockSupported?: boolean;
  onToggleScreenLock?: () => void;
  onOpenCockpit?: () => void;
  onOpenDisplaySettings?: () => void;
  displaySettings?: DisplaySettings;
  triggerHaptic?: (pattern?: number | number[]) => void;
  onStart: (simulate: boolean) => void;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  onReset: () => void;
}

// Fallback haptic vibration on Android
function defaultHaptic(pattern: number | number[] = 30) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration errors
    }
  }
}

export const LiveRideHUD: React.FC<LiveRideHUDProps> = ({
  status,
  distanceKm,
  durationSeconds,
  currentSpeedKmh,
  avgSpeedKmh,
  maxSpeedKmh,
  elevationGainM,
  currentElevationM,
  caloriesBurned,
  isSimulated,
  gpsAccuracy,
  gpsError,
  isScreenLocked = false,
  isWakeLockSupported = false,
  onToggleScreenLock,
  onOpenCockpit,
  onOpenDisplaySettings,
  displaySettings,
  triggerHaptic = defaultHaptic,
  onStart,
  onPause,
  onResume,
  onFinish,
  onReset
}) => {
  // Typography class helper
  const getTypoClass = () => {
    if (!displaySettings) return 'font-bernard-mt';
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

  // Button height class based on touch target size for gloves
  const getButtonClass = () => {
    if (!displaySettings) return 'min-h-[50px]';
    switch (displaySettings.touchTargetSize) {
      case 'heavy-glove-60':
        return 'min-h-[60px] py-4 text-base sm:text-lg';
      case 'glove-50':
        return 'min-h-[50px] py-3 text-sm sm:text-base';
      case 'standard-44':
      default:
        return 'min-h-[44px] py-2 text-xs sm:text-sm';
    }
  };

  // Container styling based on contrast mode
  const getPanelBgClass = () => {
    if (!displaySettings) return 'glass-panel';
    switch (displaySettings.contrastMode) {
      case 'amoled-pure-black':
        return '!bg-black !border-stone-800/80 shadow-2xl';
      case 'high-contrast-sun':
        return '!bg-black !border-2 !border-white/80 shadow-[0_0_25px_rgba(255,255,255,0.15)]';
      case 'oled-night':
        return '!bg-[#0a0302] !border-amber-950/60 text-amber-200';
      case 'slate-glass':
      default:
        return 'glass-panel';
    }
  };

  const tileClass = displaySettings?.highContrastBorders
    ? 'border-2 border-white/60 bg-stone-950/90 rounded-2xl'
    : 'glass-tile';

  return (
    <div className={`w-full px-3 sm:px-5 pt-3 pb-3 sm:pb-4 flex flex-col gap-3 sm:gap-4 z-30 [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))] !rounded-b-none !border-x-0 !border-b-0 transition-colors duration-200 ${getPanelBgClass()} ${
      displaySettings?.typography === 'dot-matrix' ? 'dot-matrix-grid' : ''
    }`}>
      {/* GPS Warning if error */}
      {gpsError && status !== 'idle' && !isSimulated && (
        <div className="glass-tile !bg-amber-950/60 !border-amber-500/30 p-2.5 sm:p-3 flex items-start gap-2.5 text-amber-200 text-xs sm:text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{gpsError}</span>
            <button
              type="button"
              onClick={() => {
                triggerHaptic(40);
                onReset();
                onStart(true);
              }}
              className="ml-2 underline font-semibold text-amber-300 hover:text-white cursor-pointer"
            >
              Spustit simulaci jízdy
            </button>
          </div>
        </div>
      )}

      {/* Top Status Bar: Live Indicator, GPS Info, Screen Wake Lock, Cockpit & Display Settings */}
      <div className="flex items-center justify-between text-xs sm:text-sm text-stone-200 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {status === 'recording' && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
              <span className="tracking-wide uppercase text-xs sm:text-sm">Živý záznam</span>
            </div>
          )}
          {status === 'paused' && (
            <div className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs sm:text-sm uppercase tracking-wide">
              Pozastaveno
            </div>
          )}
          {status === 'idle' && (
            <div className="px-3 py-1 rounded-full bg-stone-800/80 border border-stone-700/80 text-stone-200 text-xs sm:text-sm font-bold uppercase tracking-wide">
              Připraveno ke startu
            </div>
          )}
          {isSimulated && (
            <span className="px-2.5 py-0.5 rounded-md bg-cyan-950/70 border border-cyan-800/40 text-cyan-300 text-xs sm:text-sm font-bold">
              Demo
            </span>
          )}

          {/* Screen Wake Lock for bike handlebar mount */}
          {onToggleScreenLock && (
            <WakeLockToggle
              isLocked={isScreenLocked}
              isSupported={isWakeLockSupported}
              onToggle={() => {
                triggerHaptic(20);
                onToggleScreenLock();
              }}
            />
          )}

          {/* Fullscreen Handlebar Cockpit Mode */}
          {onOpenCockpit && (
            <button
              id="btn-open-cockpit"
              type="button"
              onClick={() => {
                triggerHaptic(30);
                onOpenCockpit();
              }}
              title="Otevřít celoobrazovkový režim na řídítka (Cockpit)"
              className="px-3 py-1.5 rounded-full bg-stone-800/80 hover:bg-stone-700 text-stone-100 hover:text-white border border-stone-700 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span>Cockpit</span>
            </button>
          )}

          {/* Display & AMOLED Customization Button */}
          {onOpenDisplaySettings && (
            <button
              id="btn-open-display-settings-hud"
              type="button"
              onClick={() => {
                triggerHaptic(20);
                onOpenDisplaySettings();
              }}
              title="Přizpůsobit kontrast, velikost tlačítek a fonty pro rukavice"
              className="px-3 py-1.5 rounded-full bg-stone-800/80 hover:bg-stone-700 text-cyan-300 hover:text-white border border-cyan-500/40 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Sliders className="w-4 h-4" />
              <span>Displej & Text</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {gpsAccuracy !== null && !isSimulated && (
            <span className="flex items-center gap-1 text-xs sm:text-sm font-semibold text-stone-200">
              <Radio className="w-4 h-4 text-emerald-400" />
              GPS: {Math.round(gpsAccuracy)} m
            </span>
          )}
          {currentElevationM !== undefined && (
            <span className="flex items-center gap-1 text-xs sm:text-sm font-semibold text-stone-200">
              <Compass className="w-4 h-4 text-cyan-400" />
              {currentElevationM} m n.m.
            </span>
          )}
        </div>
      </div>

      {/* Primary Metrics Grid - Configurable style with AMOLED high contrast */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {/* Speed Gauge / Big Readout */}
        <div className={`col-span-2 sm:col-span-1 p-3.5 sm:p-4 flex flex-col justify-between relative overflow-hidden group ${tileClass}`}>
          <div className="flex items-center justify-between text-stone-200 text-sm">
            <span className="font-bold uppercase tracking-wider text-xs sm:text-sm text-stone-200 metric-label">Aktuální rychlost</span>
            <Gauge className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
          </div>
          <div className="my-1.5 sm:my-2 flex items-baseline gap-1.5">
            <span className={`text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-none ${getTypoClass()}`}>
              {currentSpeedKmh.toFixed(1)}
            </span>
            <span className="text-sm sm:text-base font-bold text-emerald-400">km/h</span>
          </div>
          <div className="flex items-center justify-between text-xs sm:text-sm font-medium text-stone-200 pt-1 border-t border-white/10">
            <span>Max: <strong className="text-white font-bold">{maxSpeedKmh.toFixed(1)}</strong></span>
            <span>Průměr: <strong className="text-white font-bold">{avgSpeedKmh.toFixed(1)}</strong></span>
          </div>
        </div>

        {/* Distance Traveled */}
        <div className={`p-3.5 sm:p-4 flex flex-col justify-between ${tileClass}`}>
          <div className="flex items-center justify-between text-stone-200 text-sm">
            <span className="font-bold uppercase tracking-wider text-xs sm:text-sm text-stone-200 metric-label">Vzdálenost</span>
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
          </div>
          <div className="my-1 sm:my-2 flex items-baseline gap-1">
            <span className={`text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-none ${getTypoClass()}`}>
              {distanceKm.toFixed(2)}
            </span>
            <span className="text-sm sm:text-base font-bold text-amber-400">km</span>
          </div>
          <div className="text-xs sm:text-sm font-medium text-stone-200 truncate">
            Tempo: <span className="text-white font-bold">{avgSpeedKmh > 0 ? (60 / avgSpeedKmh).toFixed(1) : '0.0'} min/km</span>
          </div>
        </div>

        {/* Duration / Time */}
        <div className={`p-3.5 sm:p-4 flex flex-col justify-between ${tileClass}`}>
          <div className="flex items-center justify-between text-stone-200 text-sm">
            <span className="font-bold uppercase tracking-wider text-xs sm:text-sm text-stone-200 metric-label">Čas jízdy</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
          </div>
          <div className="my-1 sm:my-2">
            <span className={`text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-none ${getTypoClass()}`}>
              {formatDuration(durationSeconds)}
            </span>
          </div>
          <div className="text-xs sm:text-sm font-medium text-stone-200">
            Stopky trasy
          </div>
        </div>

        {/* Elevation & Calories */}
        <div className={`col-span-2 sm:col-span-1 p-3.5 sm:p-4 flex flex-col justify-between ${tileClass}`}>
          <div className="flex items-center justify-between text-stone-200 text-sm">
            <span className="font-bold uppercase tracking-wider text-xs sm:text-sm text-stone-200 metric-label">Výkon & Kopce</span>
            <Mountain className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
          </div>
          <div className="my-1 flex items-center justify-between">
            <div>
              <span className={`text-2xl sm:text-3xl font-bold text-white ${getTypoClass()}`}>+{elevationGainM}</span>
              <span className="text-sm sm:text-base text-cyan-400 ml-1 font-bold">m</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-orange-400" />
              <span className={`text-2xl sm:text-3xl font-bold text-white ${getTypoClass()}`}>{caloriesBurned}</span>
              <span className="text-sm sm:text-base text-orange-400 font-bold">kcal</span>
            </div>
          </div>
          <div className="text-xs sm:text-sm font-medium text-stone-200">
            Stoupání & Výdej energie
          </div>
        </div>
      </div>

      {/* Action Controls - Configured touch targets for bike glove compatibility */}
      <div className="flex items-center gap-2 sm:gap-3 pt-0.5">
        {status === 'idle' ? (
          <>
            <button
              id="btn-start-gps"
              type="button"
              onClick={() => {
                triggerHaptic([40, 60, 40]);
                onStart(false);
              }}
              className={`flex-1 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-stone-950 font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer select-none ${getButtonClass()}`}
            >
              <Play className="w-5 h-5 fill-stone-950" />
              <span>Start GPS jízdy</span>
            </button>

            <button
              id="btn-start-simulation"
              type="button"
              onClick={() => {
                triggerHaptic(30);
                onStart(true);
              }}
              className={`px-3.5 sm:px-5 rounded-2xl bg-stone-800 hover:bg-stone-700 active:scale-[0.98] text-stone-200 border border-stone-700 font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer select-none shrink-0 ${getButtonClass()}`}
              title="Spustí ukázkovou simulaci jízdy pro vyzkoušení funkcí"
            >
              <Radio className="w-4 h-4 text-cyan-400" />
              <span className="hidden xs:inline">Simulace</span>
            </button>
          </>
        ) : (
          <>
            {status === 'recording' ? (
              <button
                id="btn-pause-ride"
                type="button"
                onClick={() => {
                  triggerHaptic(50);
                  onPause();
                }}
                className={`flex-1 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-stone-950 font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer select-none ${getButtonClass()}`}
              >
                <Pause className="w-5 h-5 fill-stone-950" />
                <span>Pozastavit</span>
              </button>
            ) : (
              <button
                id="btn-resume-ride"
                type="button"
                onClick={() => {
                  triggerHaptic([30, 50]);
                  onResume();
                }}
                className={`flex-1 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-stone-950 font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer select-none ${getButtonClass()}`}
              >
                <Play className="w-5 h-5 fill-stone-950" />
                <span>Pokračovat</span>
              </button>
            )}

            <button
              id="btn-finish-ride"
              type="button"
              onClick={() => {
                triggerHaptic([60, 40, 80]);
                onFinish();
              }}
              className={`px-4 sm:px-6 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-rose-600/25 transition-all cursor-pointer select-none shrink-0 ${getButtonClass()}`}
            >
              <Square className="w-4 h-4 fill-white" />
              <span>Konec & AI</span>
            </button>

            <button
              id="btn-reset-ride"
              type="button"
              onClick={() => {
                triggerHaptic(30);
                onReset();
              }}
              title="Zrušit záznam"
              className={`w-12 rounded-2xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 border border-stone-700 flex items-center justify-center transition-all cursor-pointer select-none shrink-0 ${getButtonClass()}`}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

