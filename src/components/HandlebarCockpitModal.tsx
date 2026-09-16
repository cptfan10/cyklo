import React from 'react';
import { Play, Pause, Square, X, Compass, Mountain, Flame, Zap, Shield, Smartphone } from 'lucide-react';
import { formatDuration } from '../utils/geoUtils';
import { RecorderStatus } from '../hooks/useRideRecorder';
import { PlannedRoute } from '../types';

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
}) => {
  if (!isOpen) return null;

  const remainingKm = plannedRoute ? Math.max(0, plannedRoute.distanceKm - distanceKm) : null;
  const progressPercent = plannedRoute ? Math.min(100, Math.round((distanceKm / plannedRoute.distanceKm) * 100)) : null;

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col justify-between p-4 sm:p-6 select-none overflow-hidden [padding-top:max(1rem,env(safe-area-inset-top))] [padding-bottom:max(1rem,env(safe-area-inset-bottom))]">
      {/* Top Cockpit Header */}
      <div className="flex items-center justify-between border-b border-stone-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>COCKPIT ŘÍDÍTEK</span>
          </div>
          {isWakeLocked && (
            <span className="text-[11px] text-amber-400 font-mono flex items-center gap-1">
              <Zap className="w-3 h-3" />
              Displej trvale zapnut
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onToggleWakeLock && (
            <button
              type="button"
              onClick={onToggleWakeLock}
              className="px-2.5 py-1.5 rounded-xl bg-stone-900 border border-stone-800 text-xs font-semibold text-stone-300 hover:text-white"
            >
              Wake Lock {isWakeLocked ? 'Zap' : 'Vyp'}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-800 cursor-pointer"
            title="Ukončit režim řídítek"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Planned route guidance banner if active */}
      {plannedRoute && (
        <div className="bg-stone-900/80 border border-cyan-500/40 rounded-2xl p-3 my-2">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-bold text-cyan-400 truncate">{plannedRoute.routeName}</span>
            <span className="font-mono text-stone-300">{progressPercent}% hotovo</span>
          </div>
          <div className="h-2 w-full bg-stone-950 rounded-full overflow-hidden mb-2">
            <div className="h-full bg-cyan-400 rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs font-mono text-stone-400">
            <span>Ujeto: {distanceKm.toFixed(1)} km</span>
            <span className="text-white font-bold">Do cíle: {remainingKm?.toFixed(1)} km</span>
          </div>
        </div>
      )}

      {/* MAIN SPEEDOMETER HERO (Giant AMOLED numbers) */}
      <div className="flex-1 flex flex-col items-center justify-center text-center my-auto">
        <span className="text-xs sm:text-sm uppercase tracking-widest text-stone-500 font-bold mb-1">
          Okamžitá rychlost
        </span>
        <div className="flex items-baseline justify-center">
          <span className="text-8xl sm:text-9xl font-black font-mono tracking-tighter text-white drop-shadow-[0_4px_24px_rgba(16,185,129,0.25)]">
            {currentSpeedKmh.toFixed(1)}
          </span>
          <span className="text-xl sm:text-2xl font-bold font-sans text-stone-400 ml-2">km/h</span>
        </div>
      </div>

      {/* SECONDARY METRICS BENTO GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mb-4">
        {/* Distance */}
        <div className="p-3 sm:p-4 rounded-2xl bg-stone-950 border border-stone-800 text-center">
          <span className="text-[11px] text-stone-500 uppercase tracking-wider block font-bold">Vzdálenost</span>
          <div className="text-2xl sm:text-3xl font-mono font-black text-emerald-400 mt-0.5">
            {distanceKm.toFixed(1)}
            <span className="text-xs font-normal text-stone-500 ml-1">km</span>
          </div>
        </div>

        {/* Time */}
        <div className="p-3 sm:p-4 rounded-2xl bg-stone-950 border border-stone-800 text-center">
          <span className="text-[11px] text-stone-500 uppercase tracking-wider block font-bold">Čas jízdy</span>
          <div className="text-2xl sm:text-3xl font-mono font-black text-cyan-400 mt-0.5">
            {formatDuration(durationSeconds)}
          </div>
        </div>

        {/* Avg Speed */}
        <div className="p-3 sm:p-4 rounded-2xl bg-stone-950 border border-stone-800 text-center">
          <span className="text-[11px] text-stone-500 uppercase tracking-wider block font-bold">Průměrná rychlost</span>
          <div className="text-2xl sm:text-3xl font-mono font-black text-white mt-0.5">
            {avgSpeedKmh.toFixed(1)}
            <span className="text-xs font-normal text-stone-500 ml-1">km/h</span>
          </div>
        </div>

        {/* Elevation Climb */}
        <div className="p-3 sm:p-4 rounded-2xl bg-stone-950 border border-stone-800 text-center">
          <span className="text-[11px] text-stone-500 uppercase tracking-wider block font-bold">Nastoupáno</span>
          <div className="text-2xl sm:text-3xl font-mono font-black text-amber-400 mt-0.5">
            +{elevationGainM}
            <span className="text-xs font-normal text-stone-500 ml-1">m</span>
          </div>
        </div>
      </div>

      {/* COCKPIT BOTTOM CONTROLS (Extra-large touch targets for gloves / handlebar mount) */}
      <div className="flex items-center gap-3">
        {status === 'recording' ? (
          <button
            type="button"
            onClick={onPause}
            className="flex-1 py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-base font-extrabold flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Pause className="w-6 h-6 stroke-[2.5]" />
            <span>POZASTAVIT JÍZDU</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onResume}
            className="flex-1 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-base font-extrabold flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Play className="w-6 h-6 stroke-[2.5]" />
            <span>POKRAČOVAT V JÍZDĚ</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            if (window.confirm('Opravdu chcete ukončit jízdu a přejít na vyhodnocení?')) {
              onClose();
              onFinish();
            }
          }}
          className="px-6 py-4 rounded-2xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
        >
          <Square className="w-5 h-5 fill-current" />
          <span>UKONČIT</span>
        </button>
      </div>
    </div>
  );
};
