import React, { useState, useEffect } from 'react';
import { RoutePlannerAssistant } from './RoutePlannerAssistant';
import { PlannedRoute, GpsPoint } from '../types';
import { Sparkles, X, Maximize2, Minimize2, Map, Check, Navigation, ArrowRight } from 'lucide-react';

interface RoutePlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLocation?: GpsPoint | null;
  onSelectRouteOnMap: (route: PlannedRoute, shouldSwitchTab?: boolean) => void;
  onStartRideWithRoute?: (route: PlannedRoute) => void;
  activePlannedRoute?: PlannedRoute | null;
  activePlannedRouteId?: string | null;
  onHoverRouteDistance?: (distanceKm: number | null) => void;
}

export const RoutePlannerModal: React.FC<RoutePlannerModalProps> = ({
  isOpen,
  onClose,
  currentLocation,
  onSelectRouteOnMap,
  onStartRideWithRoute,
  activePlannedRoute,
  activePlannedRouteId,
  onHoverRouteDistance,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [lastSelectedRouteName, setLastSelectedRouteName] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleRouteSelection = (route: PlannedRoute, switchView = false) => {
    setLastSelectedRouteName(route.routeName);
    onSelectRouteOnMap(route, switchView);
  };

  return (
    <div className="fixed inset-0 z-[550] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`relative w-full bg-stone-900 border border-stone-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${
          isMaximized
            ? 'h-[98vh] max-w-[98vw] rounded-2xl'
            : 'h-[90vh] max-w-5xl rounded-3xl'
        }`}
      >
        {/* Window Header Bar */}
        <div className="h-14 px-4 sm:px-6 bg-stone-950/90 border-b border-stone-800 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-teal-400 flex items-center justify-center text-stone-950 shadow-md shadow-cyan-500/20 shrink-0">
              <Sparkles className="w-4 h-4 fill-stone-950" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 truncate">
                <span>AI Plánovač cyklotras</span>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-semibold border border-cyan-500/30">
                  Samostatné okno
                </span>
              </h2>
            </div>
          </div>

          {/* Quick Route Notification Bar if selected */}
          {lastSelectedRouteName && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-xs text-cyan-300 animate-in fade-in">
              <Check className="w-3.5 h-3.5 text-cyan-400" />
              <span className="truncate max-w-xs font-medium">Vybráno: {lastSelectedRouteName}</span>
              <button
                type="button"
                onClick={onClose}
                className="ml-1 text-[11px] font-bold text-cyan-200 hover:text-white underline cursor-pointer"
              >
                Přejít na mapu
              </button>
            </div>
          )}

          {/* Window Control Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Maximize / Restore Window Button */}
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              title={isMaximized ? 'Obnovit původní velikost' : 'Maximalizovat okno'}
              className="p-2 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white transition-all cursor-pointer hidden sm:flex items-center justify-center"
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close Window Button */}
            <button
              id="btn-close-planner-modal"
              type="button"
              onClick={onClose}
              title="Zavřít okno plánovače (Esc)"
              className="p-2 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-400 hover:text-white transition-all cursor-pointer flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Embeds RoutePlannerAssistant */}
        <div className="flex-1 min-h-0 bg-stone-950 overflow-hidden relative">
          <RoutePlannerAssistant
            currentLocation={currentLocation}
            onSelectRouteOnMap={handleRouteSelection}
            onStartRideWithRoute={(route) => {
              if (onStartRideWithRoute) {
                onStartRideWithRoute(route);
              }
              onClose();
            }}
            activePlannedRoute={activePlannedRoute}
            activePlannedRouteId={activePlannedRouteId}
            onHoverRouteDistance={onHoverRouteDistance}
          />
        </div>

        {/* Bottom Floating Bar when route is selected */}
        {activePlannedRoute && (
          <div className="p-3 bg-stone-950/95 border-t border-stone-800/90 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Map className="w-4 h-4 text-cyan-400 shrink-0" />
              <div className="min-w-0 text-xs text-stone-300">
                <span className="text-white font-semibold truncate block sm:inline mr-2">
                  {activePlannedRoute.routeName}
                </span>
                <span className="font-mono text-cyan-400">
                  {activePlannedRoute.distanceKm} km • +{activePlannedRoute.elevationGainM} m
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-stone-950 font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
              >
                <span>Zobrazit na mapě</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
