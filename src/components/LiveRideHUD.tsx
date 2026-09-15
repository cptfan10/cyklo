import React from 'react';
import { Play, Pause, Square, Radio, Mountain, Flame, Zap, Gauge, Compass, AlertTriangle, RotateCcw, Smartphone } from 'lucide-react';
import { formatDuration } from '../utils/geoUtils';
import { RecorderStatus } from '../hooks/useRideRecorder';
import { WakeLockToggle } from './WakeLockToggle';

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
  onStart: (simulate: boolean) => void;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  onReset: () => void;
}

// Trigger haptic vibration on Android/Galaxy S10+
function triggerHaptic(pattern: number | number[] = 30) {
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
  onStart,
  onPause,
  onResume,
  onFinish,
  onReset
}) => {
  return (
    <div className="w-full bg-stone-900/98 border-t border-stone-800 backdrop-blur-md px-3 sm:px-5 pt-3 pb-3 sm:pb-4 flex flex-col gap-3 sm:gap-4 shadow-2xl z-30 [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]">
      {/* GPS Warning if error */}
      {gpsError && status !== 'idle' && !isSimulated && (
        <div className="bg-amber-500/15 border border-amber-500/30 rounded-xl p-2.5 sm:p-3 flex items-start gap-2.5 text-amber-200 text-xs sm:text-sm">
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

      {/* Top Status Bar: Live Indicator, GPS Info, Screen Wake Lock */}
      <div className="flex items-center justify-between text-xs text-stone-400 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {status === 'recording' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-medium">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              <span className="tracking-wide uppercase text-[10px] sm:text-[11px] font-bold">Živý záznam</span>
            </div>
          )}
          {status === 'paused' && (
            <div className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-medium text-[10px] sm:text-[11px] uppercase tracking-wide">
              Pozastaveno
            </div>
          )}
          {status === 'idle' && (
            <div className="px-2.5 py-1 rounded-full bg-stone-800 border border-stone-700 text-stone-400 text-[10px] sm:text-[11px] uppercase tracking-wide">
              Připraveno ke startu
            </div>
          )}
          {isSimulated && (
            <span className="px-2 py-0.5 rounded-md bg-cyan-950/60 border border-cyan-800/40 text-cyan-300 text-[10px] sm:text-[11px]">
              Demo
            </span>
          )}

          {/* Screen Wake Lock for bike handlebar mount on Galaxy S10+ */}
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
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {gpsAccuracy !== null && !isSimulated && (
            <span className="flex items-center gap-1 text-[10px] sm:text-[11px] text-stone-400">
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              GPS: {Math.round(gpsAccuracy)} m
            </span>
          )}
          {currentElevationM !== undefined && (
            <span className="flex items-center gap-1 text-[10px] sm:text-[11px] text-stone-400">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              {currentElevationM} m n.m.
            </span>
          )}
        </div>
      </div>

      {/* Primary Metrics Grid - AMOLED High-Contrast optimized */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {/* Speed Gauge / Big Readout */}
        <div className="col-span-2 sm:col-span-1 bg-stone-950/90 border border-stone-800 rounded-2xl p-3 sm:p-4 flex flex-col justify-between relative overflow-hidden group shadow-inner">
          <div className="flex items-center justify-between text-stone-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Aktuální rychlost</span>
            <Gauge className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-1.5 sm:my-2 flex items-baseline gap-1.5">
            <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white font-mono leading-none">
              {currentSpeedKmh.toFixed(1)}
            </span>
            <span className="text-xs sm:text-sm font-bold text-emerald-400">km/h</span>
          </div>
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-stone-400 pt-1 border-t border-stone-800/80">
            <span>Max: <strong className="text-stone-200">{maxSpeedKmh.toFixed(1)}</strong></span>
            <span>Průměr: <strong className="text-stone-200">{avgSpeedKmh.toFixed(1)}</strong></span>
          </div>
        </div>

        {/* Distance Traveled */}
        <div className="bg-stone-950/90 border border-stone-800 rounded-2xl p-3 sm:p-4 flex flex-col justify-between shadow-inner">
          <div className="flex items-center justify-between text-stone-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Vzdálenost</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="my-1 sm:my-2 flex items-baseline gap-1">
            <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-mono leading-none">
              {distanceKm.toFixed(2)}
            </span>
            <span className="text-xs sm:text-sm font-bold text-amber-400">km</span>
          </div>
          <div className="text-[10px] sm:text-[11px] text-stone-400 truncate">
            Tempo: <span className="text-stone-200">{avgSpeedKmh > 0 ? (60 / avgSpeedKmh).toFixed(1) : '0.0'} min/km</span>
          </div>
        </div>

        {/* Duration / Time */}
        <div className="bg-stone-950/90 border border-stone-800 rounded-2xl p-3 sm:p-4 flex flex-col justify-between shadow-inner">
          <div className="flex items-center justify-between text-stone-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Čas jízdy</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          </div>
          <div className="my-1 sm:my-2">
            <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-mono leading-none">
              {formatDuration(durationSeconds)}
            </span>
          </div>
          <div className="text-[10px] sm:text-[11px] text-stone-400">
            Stopky trasy
          </div>
        </div>

        {/* Elevation & Calories */}
        <div className="col-span-2 sm:col-span-1 bg-stone-950/90 border border-stone-800 rounded-2xl p-3 sm:p-4 flex flex-col justify-between shadow-inner">
          <div className="flex items-center justify-between text-stone-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Výkon & Kopce</span>
            <Mountain className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="my-1 flex items-center justify-between">
            <div>
              <span className="text-2xl font-bold font-mono text-white">+{elevationGainM}</span>
              <span className="text-xs text-cyan-400 ml-1">m</span>
            </div>
            <div className="flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xl font-bold font-mono text-white">{caloriesBurned}</span>
              <span className="text-xs text-orange-400">kcal</span>
            </div>
          </div>
          <div className="text-[10px] sm:text-[11px] text-stone-400">
            Stoupání & Výdej energie
          </div>
        </div>
      </div>

      {/* Action Controls - Large 48px+ touch targets for bike glove compatibility */}
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
              className="flex-1 min-h-[50px] rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-stone-950 font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer select-none"
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
              className="px-3.5 sm:px-5 min-h-[50px] rounded-2xl bg-stone-800 hover:bg-stone-700 active:scale-[0.98] text-stone-200 border border-stone-700 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer select-none shrink-0"
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
                className="flex-1 min-h-[50px] rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-stone-950 font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer select-none"
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
                className="flex-1 min-h-[50px] rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-stone-950 font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer select-none"
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
              className="px-4 sm:px-6 min-h-[50px] rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-600/25 transition-all cursor-pointer select-none shrink-0"
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
              className="w-12 h-[50px] rounded-2xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 border border-stone-700 flex items-center justify-center transition-all cursor-pointer select-none shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

