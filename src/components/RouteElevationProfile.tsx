import React, { useState } from 'react';
import { ElevationPoint, PlannedRoute, SurfaceShare } from '../types';
import { Mountain, Clock, TrendingUp, TrendingDown, Layers, Bike } from 'lucide-react';

interface RouteElevationProfileProps {
  route: PlannedRoute;
  onHoverDistance?: (distanceKm: number | null) => void;
  compact?: boolean;
}

export const RouteElevationProfile: React.FC<RouteElevationProfileProps> = ({
  route,
  onHoverDistance,
  compact = false,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Generate synthetic points if not present in the route
  const elevationPoints: ElevationPoint[] = React.useMemo(() => {
    if (route.elevationProfile && route.elevationProfile.length > 1) {
      return route.elevationProfile;
    }

    // Fallback profile based on waypoints or coordinates
    const totalKm = route.distanceKm || 30;
    const gain = route.elevationGainM || 200;
    const baseAlt = 200;
    const samples = 20;
    const points: ElevationPoint[] = [];

    for (let i = 0; i <= samples; i++) {
      const fraction = i / samples;
      const km = Number((fraction * totalKm).toFixed(1));
      // Organic undulating curve
      const wave = Math.sin(fraction * Math.PI * 2) * 0.4 + Math.sin(fraction * Math.PI * 4) * 0.2;
      const alt = Math.round(baseAlt + wave * (gain * 0.7) + (fraction * 0.2 * gain));
      points.push({ distanceKm: km, altitudeM: Math.max(120, alt) });
    }
    return points;
  }, [route]);

  // Calculations
  const altitudes = elevationPoints.map((p) => p.altitudeM);
  const minAlt = Math.min(...altitudes);
  const maxAlt = Math.max(...altitudes);
  const altSpan = Math.max(20, maxAlt - minAlt);
  const maxDist = elevationPoints[elevationPoints.length - 1]?.distanceKm || route.distanceKm || 1;

  // SVG dimensions
  const svgWidth = 600;
  const svgHeight = compact ? 80 : 120;
  const paddingBottom = 20;
  const paddingTop = 12;
  const usableHeight = svgHeight - paddingBottom - paddingTop;

  // Generate SVG path
  const pathD = React.useMemo(() => {
    if (elevationPoints.length < 2) return '';

    const coords = elevationPoints.map((pt) => {
      const x = (pt.distanceKm / maxDist) * svgWidth;
      const y = paddingTop + usableHeight - ((pt.altitudeM - minAlt) / altSpan) * usableHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const firstPoint = coords[0];
    const lastPoint = coords[coords.length - 1];
    const lastX = (elevationPoints[elevationPoints.length - 1].distanceKm / maxDist) * svgWidth;
    const firstX = 0;

    const linePath = `M ${coords.join(' L ')}`;
    const areaPath = `${linePath} L ${lastX},${svgHeight - paddingBottom} L ${firstX},${svgHeight - paddingBottom} Z`;

    return { linePath, areaPath };
  }, [elevationPoints, maxDist, minAlt, altSpan, svgHeight, usableHeight, paddingBottom, paddingTop]);

  const activePoint = hoverIndex !== null && elevationPoints[hoverIndex] ? elevationPoints[hoverIndex] : null;

  // Speed and time estimates by bike type
  const estimatedSpeedKmh = React.useMemo(() => {
    const type = (route.bikeType || '').toLowerCase();
    if (type.includes('silni')) return 25;
    if (type.includes('mtb') || type.includes('horsk')) return 16;
    if (type.includes('e-bike') || type.includes('elektro')) return 23;
    return 20; // default gravel/treking
  }, [route.bikeType]);

  const calculatedTimeMin = Math.round((route.distanceKm / estimatedSpeedKmh) * 60);

  return (
    <div className="w-full glass-card p-3 sm:p-4 text-stone-100">
      {/* Header bar with stats */}
      <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
            <Mountain className="w-4 h-4" />
          </div>
          <div>
            <h5 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
              Výškový profil trasy
              {route.difficulty && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  route.difficulty === 'Lehká'
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50'
                    : route.difficulty === 'Střední'
                    ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/50'
                    : 'bg-amber-950/80 text-amber-300 border border-amber-800/50'
                }`}>
                  {route.difficulty}
                </span>
              )}
            </h5>
            <span className="text-[11px] text-stone-300">
              Min {minAlt} m • Max {maxAlt} m n.m.
            </span>
          </div>
        </div>

        {/* Quick ride metrics */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="px-2 py-1 rounded-lg glass-tile !p-1.5 !rounded-lg text-stone-200 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            <span className="font-bold text-white">+{route.elevationGainM} m</span>
          </div>
          <div className="px-2 py-1 rounded-lg glass-tile !p-1.5 !rounded-lg text-stone-200 flex items-center gap-1">
            <Clock className="w-3 h-3 text-cyan-400" />
            <span className="font-bold text-white">{Math.floor(calculatedTimeMin / 60)}h {calculatedTimeMin % 60}m</span>
          </div>
        </div>
      </div>

      {/* Interactive SVG Chart */}
      <div className="relative w-full overflow-hidden select-none bg-stone-950/60 rounded-xl p-1 border border-white/10">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto cursor-crosshair block"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
            const fraction = relX / rect.width;
            const idx = Math.min(
              elevationPoints.length - 1,
              Math.max(0, Math.round(fraction * (elevationPoints.length - 1)))
            );
            setHoverIndex(idx);
            if (onHoverDistance && elevationPoints[idx]) {
              onHoverDistance(elevationPoints[idx].distanceKm);
            }
          }}
          onMouseLeave={() => {
            setHoverIndex(null);
            if (onHoverDistance) onHoverDistance(null);
          }}
          onTouchMove={(e) => {
            if (e.touches.length > 0) {
              const rect = e.currentTarget.getBoundingClientRect();
              const touch = e.touches[0];
              const relX = Math.max(0, Math.min(rect.width, touch.clientX - rect.left));
              const fraction = relX / rect.width;
              const idx = Math.min(
                elevationPoints.length - 1,
                Math.max(0, Math.round(fraction * (elevationPoints.length - 1)))
              );
              setHoverIndex(idx);
              if (onHoverDistance && elevationPoints[idx]) {
                onHoverDistance(elevationPoints[idx].distanceKm);
              }
            }
          }}
          onTouchEnd={() => {
            setHoverIndex(null);
            if (onHoverDistance) onHoverDistance(null);
          }}
        >
          <defs>
            <linearGradient id="elevationGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line
            x1="0"
            y1={paddingTop}
            x2={svgWidth}
            y2={paddingTop}
            stroke="#292524"
            strokeDasharray="4,4"
          />
          <line
            x1="0"
            y1={paddingTop + usableHeight / 2}
            x2={svgWidth}
            y2={paddingTop + usableHeight / 2}
            stroke="#292524"
            strokeDasharray="4,4"
          />
          <line
            x1="0"
            y1={svgHeight - paddingBottom}
            x2={svgWidth}
            y2={svgHeight - paddingBottom}
            stroke="#3b3a36"
          />

          {/* Area fill */}
          {pathD && <path d={pathD.areaPath} fill="url(#elevationGrad)" />}

          {/* Profile stroke line */}
          {pathD && (
            <path
              d={pathD.linePath}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Distance markers on bottom axis */}
          <text x="5" y={svgHeight - 4} fill="#78716c" fontSize="10" fontFamily="monospace">
            0 km
          </text>
          <text x={svgWidth / 2} y={svgHeight - 4} fill="#78716c" fontSize="10" fontFamily="monospace" textAnchor="middle">
            {(maxDist / 2).toFixed(1)} km
          </text>
          <text x={svgWidth - 5} y={svgHeight - 4} fill="#78716c" fontSize="10" fontFamily="monospace" textAnchor="end">
            {maxDist.toFixed(1)} km
          </text>

          {/* Active hover crosshair line and circle */}
          {activePoint && hoverIndex !== null && (
            <>
              {(() => {
                const x = (activePoint.distanceKm / maxDist) * svgWidth;
                const y = paddingTop + usableHeight - ((activePoint.altitudeM - minAlt) / altSpan) * usableHeight;
                return (
                  <g>
                    <line
                      x1={x}
                      y1={paddingTop}
                      x2={x}
                      y2={svgHeight - paddingBottom}
                      stroke="#38bdf8"
                      strokeWidth="1.5"
                      strokeDasharray="3,3"
                    />
                    <circle cx={x} cy={y} r="5" fill="#38bdf8" stroke="#0f172a" strokeWidth="2" />
                  </g>
                );
              })()}
            </>
          )}
        </svg>

        {/* Hover info badge floating on chart */}
        {activePoint && (
          <div className="absolute top-2 right-2 glass-tile !rounded-lg px-2.5 py-1 text-xs font-mono !border-cyan-500/40 flex items-center gap-3">
            <div>
              <span className="text-stone-400 text-[10px] block">Pozice</span>
              <span className="font-bold text-white">{activePoint.distanceKm} km</span>
            </div>
            <div>
              <span className="text-stone-400 text-[10px] block">Nadmořská výška</span>
              <span className="font-bold text-cyan-400">{activePoint.altitudeM} m</span>
            </div>
          </div>
        )}
      </div>

      {/* Surface Breakdown Bar */}
      {route.surfaceBreakdown && route.surfaceBreakdown.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-stone-400 mb-1">
            <span className="flex items-center gap-1 font-semibold uppercase tracking-wider text-[10px]">
              <Layers className="w-3 h-3 text-cyan-400" />
              Skladba povrchů
            </span>
            <span>{route.trafficLevel || 'Bezpečné cyklotrasy'}</span>
          </div>

          <div className="h-2 w-full rounded-full overflow-hidden flex bg-stone-950">
            {route.surfaceBreakdown.map((s, idx) => (
              <div
                key={idx}
                style={{ width: `${s.percentage}%`, backgroundColor: s.color || '#06b6d4' }}
                title={`${s.surface}: ${s.percentage}%`}
                className="h-full first:rounded-l-full last:rounded-r-full transition-all"
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 mt-1.5 text-[11px] text-stone-300">
            {route.surfaceBreakdown.map((s, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color || '#06b6d4' }} />
                <span>{s.surface}</span>
                <span className="font-mono text-stone-400">({s.percentage}%)</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
