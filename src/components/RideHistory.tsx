import React from 'react';
import { RideData } from '../types';
import { formatDuration, exportToGpx, downloadFile } from '../utils/geoUtils';
import { Sparkles, Download, Trash2, MapPin, Gauge, Clock, Mountain, ChevronRight, Award } from 'lucide-react';

interface RideHistoryProps {
  rides: RideData[];
  selectedRideId?: string;
  onSelectRide: (ride: RideData) => void;
  onOpenAnalysis: (ride: RideData) => void;
  onDeleteRide: (rideId: string) => void;
  onClearAll?: () => void;
}

export const RideHistory: React.FC<RideHistoryProps> = ({
  rides,
  selectedRideId,
  onSelectRide,
  onOpenAnalysis,
  onDeleteRide,
  onClearAll,
}) => {
  const totalKm = rides.reduce((acc, r) => acc + (r.distanceKm || 0), 0);
  const totalClimb = rides.reduce((acc, r) => acc + (r.elevationGainM || 0), 0);
  const totalSeconds = rides.reduce((acc, r) => acc + (r.durationSeconds || 0), 0);
  const totalCalories = rides.reduce((acc, r) => acc + (r.caloriesBurned || 0), 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Cumulative Lifetime Stats Banner */}
      <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <Award className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-stone-200 uppercase tracking-wider">
            Celková statistika najetých kilometrů
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div className="bg-stone-950/60 p-2.5 rounded-xl border border-stone-800/60">
            <span className="text-[11px] text-stone-400 block">Celkem ujeto</span>
            <span className="text-xl font-extrabold font-mono text-emerald-400">{totalKm.toFixed(1)}</span>
            <span className="text-xs text-stone-400 ml-1">km</span>
          </div>
          <div className="bg-stone-950/60 p-2.5 rounded-xl border border-stone-800/60">
            <span className="text-[11px] text-stone-400 block">Celkový čas</span>
            <span className="text-lg font-bold font-mono text-stone-100">{formatDuration(totalSeconds)}</span>
          </div>
          <div className="bg-stone-950/60 p-2.5 rounded-xl border border-stone-800/60">
            <span className="text-[11px] text-stone-400 block">Nastoupáno</span>
            <span className="text-xl font-extrabold font-mono text-cyan-400">+{totalClimb}</span>
            <span className="text-xs text-stone-400 ml-1">m</span>
          </div>
          <div className="bg-stone-950/60 p-2.5 rounded-xl border border-stone-800/60">
            <span className="text-[11px] text-stone-400 block">Energie</span>
            <span className="text-xl font-extrabold font-mono text-orange-400">{totalCalories}</span>
            <span className="text-xs text-stone-400 ml-1">kcal</span>
          </div>
        </div>
      </div>

      {/* Rides List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs text-stone-400 px-1">
          <span className="font-semibold uppercase tracking-wider">Zaznamenané trasy ({rides.length})</span>
          <div className="flex items-center gap-2">
            {rides.length > 0 && onClearAll && (
              <button
                type="button"
                onClick={onClearAll}
                className="text-stone-400 hover:text-rose-400 text-[11px] underline cursor-pointer"
              >
                Vymazat historii
              </button>
            )}
            <span>Klikněte na trasu pro zobrazení na mapě</span>
          </div>
        </div>

        {rides.length === 0 ? (
          <div className="p-8 bg-stone-900/60 border border-stone-800 rounded-2xl text-center text-stone-400 text-sm">
            Zatím nemáte žádné uložené trasy. Spusťte živý záznam nebo vyzkoušejte simulaci.
          </div>
        ) : (
          rides.map((ride) => {
            const isSelected = selectedRideId === ride.id;
            return (
              <div
                key={ride.id}
                onClick={() => onSelectRide(ride)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-stone-900 border-emerald-500/80 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/40'
                    : 'bg-stone-900/70 hover:bg-stone-900 border-stone-800'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm sm:text-base font-bold text-stone-100 truncate">{ride.name}</span>
                    {ride.aiAnalysis && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-semibold flex items-center gap-1 shrink-0">
                        <Sparkles className="w-3 h-3 text-emerald-400" />
                        AI Analýza
                      </span>
                    )}
                    {ride.isSimulated && (
                      <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 text-[10px] border border-cyan-800/40">
                        Demo
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-stone-400">
                    <span className="flex items-center gap-1 font-mono font-bold text-emerald-400">
                      <Gauge className="w-3.5 h-3.5" />
                      {ride.distanceKm.toFixed(1)} km
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      {formatDuration(ride.durationSeconds)}
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <Mountain className="w-3.5 h-3.5 text-cyan-400" />
                      +{ride.elevationGainM} m
                    </span>
                    <span className="text-stone-500">
                      Průměr: {ride.avgSpeedKmh.toFixed(1)} km/h
                    </span>
                    <span className="text-stone-500">
                      {new Date(ride.date).toLocaleDateString('cs-CZ')}
                    </span>
                  </div>
                </div>

                {/* Right Action buttons */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    title="Zobrazit AI analýzu trasy"
                    onClick={() => onOpenAnalysis(ride)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Analýza</span>
                  </button>

                  <button
                    type="button"
                    title="Exportovat do GPX pro navigace"
                    onClick={() => {
                      const gpx = exportToGpx(ride);
                      downloadFile(gpx, `${ride.name.replace(/[^a-z0-9]/gi, '_')}.gpx`, 'application/gpx+xml');
                    }}
                    className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    title="Smazat jízdu z historie"
                    onClick={() => onDeleteRide(ride.id)}
                    className="p-2 rounded-xl bg-stone-800 hover:bg-rose-950 text-stone-400 hover:text-rose-300 border border-stone-700 hover:border-rose-800 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-emerald-400 rotate-90 sm:rotate-0' : 'text-stone-600'}`} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
