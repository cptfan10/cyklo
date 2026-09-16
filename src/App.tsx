import React, { useState, useEffect } from 'react';
import { CyclingMap } from './components/CyclingMap';
import { LiveRideHUD } from './components/LiveRideHUD';
import { RideAnalysisModal } from './components/RideAnalysisModal';
import { AiCoachDrawer } from './components/AiCoachDrawer';
import { RideHistory } from './components/RideHistory';
import { RoutePlannerAssistant } from './components/RoutePlannerAssistant';
import { HandlebarCockpitModal } from './components/HandlebarCockpitModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { GalaxyS10HelperModal } from './components/GalaxyS10HelperModal';
import { useRideRecorder } from './hooks/useRideRecorder';
import { useWakeLock } from './hooks/useWakeLock';
import { RideData, MapTileProvider, GpsPoint, PlannedRoute } from './types';
import { INITIAL_PRESET_RIDES } from './utils/geoUtils';
import { Bike, Sparkles, History, Compass, Layers, Info, Map as MapIcon, Route, Smartphone } from 'lucide-react';

const STORAGE_KEY_RIDES = 'cyklo_asistent_rides_v1';

export default function App() {
  const recorder = useRideRecorder();

  // Saved rides in local storage with preset sample
  const [rides, setRides] = useState<RideData[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RIDES);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load rides from localStorage:', e);
    }
    return INITIAL_PRESET_RIDES;
  });

  // Active view: 'live' | 'planner' | 'history'
  const [activeTab, setActiveTab] = useState<'live' | 'planner' | 'history'>('live');

  // Selected historical ride to inspect on map
  const [selectedRide, setSelectedRide] = useState<RideData | null>(null);

  // Screen Wake Lock (prevents screen from sleeping while mounted on bike handlebar)
  const [keepScreenOn, setKeepScreenOn] = useState<boolean>(false);
  const wakeLock = useWakeLock(recorder.status === 'recording' || keepScreenOn);

  // Planned route from AI Assistant / Curated routes
  const [plannedRoute, setPlannedRoute] = useState<PlannedRoute | null>(null);

  // Hover distance along route for elevation scrub synchronization with map
  const [hoveredRouteDistance, setHoveredRouteDistance] = useState<number | null>(null);

  // Modals & Drawers
  const [analysisModalRide, setAnalysisModalRide] = useState<RideData | null>(null);
  const [isCoachDrawerOpen, setIsCoachDrawerOpen] = useState<boolean>(false);
  const [isCockpitOpen, setIsCockpitOpen] = useState<boolean>(false);

  // Map settings
  const [tileProvider, setTileProvider] = useState<MapTileProvider>('cyclosm');
  const [followCyclist, setFollowCyclist] = useState<boolean>(true);

  // Save rides to localStorage whenever updated
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_RIDES, JSON.stringify(rides));
    } catch (e) {
      console.warn('Failed to persist rides:', e);
    }
  }, [rides]);

  // When live recording is started, switch back to 'live' tab
  const handleStartRide = (simulate: boolean) => {
    setSelectedRide(null);
    setActiveTab('live');
    recorder.startRide(simulate);
  };

  // Start ride along a planned route
  const handleStartRideWithRoute = (route: PlannedRoute) => {
    setPlannedRoute(route);
    setSelectedRide(null);
    setActiveTab('live');
    recorder.startRide(true); // Start in active simulation/gps mode
  };

  // When ride finishes, open analysis modal
  const handleFinishRide = () => {
    const finishedRide = recorder.finishRide();
    setAnalysisModalRide(finishedRide);
  };

  // Save ride from modal
  const handleSaveRide = (savedRide: RideData) => {
    setRides((prev) => [savedRide, ...prev.filter((r) => r.id !== savedRide.id)]);
    setSelectedRide(savedRide);
    recorder.resetRide();
  };

  const handleDeleteRide = (rideId: string) => {
    setRides((prev) => prev.filter((r) => r.id !== rideId));
    if (selectedRide?.id === rideId) {
      setSelectedRide(null);
    }
  };

  // When user selects a route from the Route Planner chat or catalog
  const handleSelectRouteFromPlanner = (route: PlannedRoute, switchView = false) => {
    setPlannedRoute(route);
    // Only switch to map view on mobile if user explicitly clicked "Zobrazit na mapě"
    if (switchView && window.innerWidth < 768) {
      setActiveTab('live');
    }
  };

  // Active points to show on the map
  const displayPoints: GpsPoint[] =
    recorder.status !== 'idle'
      ? recorder.points
      : selectedRide
      ? selectedRide.points
      : rides[0]?.points || [];

  const currentActiveLocation =
    recorder.status !== 'idle' && recorder.points.length > 0
      ? recorder.points[recorder.points.length - 1]
      : selectedRide && selectedRide.points.length > 0
      ? selectedRide.points[0]
      : null;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-stone-950 text-stone-100 font-sans">
      {/* Top Navigation Bar with Galaxy S10+ notch / safe-area padding */}
      <header className="h-16 px-3 sm:px-6 bg-stone-900/95 border-b border-stone-800/80 backdrop-blur-md flex items-center justify-between z-40 shrink-0 [padding-top:max(0.25rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-stone-950 shadow-lg shadow-emerald-500/20 shrink-0">
            <Bike className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-lg font-bold tracking-tight text-white flex items-center gap-1.5 sm:gap-2 truncate">
              <span>Cyklo Asistent</span>
              {recorder.status === 'recording' && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1 animate-ping"></span>
                  LIVE
                </span>
              )}
            </h1>
            <p className="text-[11px] text-stone-400 hidden lg:block truncate">
              Záznam trasy na veřejných mapách, AI plánování na míru a sportovní analýza
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2">
          <div className="bg-stone-950/80 p-1 rounded-xl border border-stone-800 flex items-center">
            {/* Live Map Tab */}
            <button
              id="tab-live-map"
              type="button"
              onClick={() => setActiveTab('live')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'live'
                  ? 'bg-emerald-500 text-stone-950 shadow-sm font-bold'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Živá mapa</span>
            </button>

            {/* AI Route Planner Tab */}
            <button
              id="tab-route-planner"
              type="button"
              onClick={() => setActiveTab('planner')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'planner'
                  ? 'bg-cyan-500 text-stone-950 shadow-sm font-bold'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Route className="w-3.5 h-3.5" />
              <span>Plánovač tras</span>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            </button>

            {/* History Tab */}
            <button
              id="tab-history"
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-emerald-500 text-stone-950 shadow-sm font-bold'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Historie ({rides.length})</span>
            </button>
          </div>

          {/* AI Coach Assistant Button */}
          <button
            id="btn-open-coach"
            type="button"
            onClick={() => setIsCoachDrawerOpen(true)}
            className="px-2.5 sm:px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-500/40 text-emerald-300 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all shadow-md cursor-pointer shrink-0"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">AI Trenér</span>
          </button>

          {/* Samsung Galaxy S10+ & PWA Install Controls */}
          <GalaxyS10HelperModal />
          <PWAInstallButton />
        </div>
      </header>

      {/* Main App Workspace */}
      <main className="flex-1 relative flex flex-col md:flex-row overflow-hidden">
        {/* Interactive Public Map */}
        <div
          className={`relative h-full transition-all duration-200 ${
            activeTab === 'live'
              ? 'w-full'
              : activeTab === 'planner'
              ? 'hidden md:block md:w-1/2 lg:w-3/5'
              : 'hidden md:block md:w-1/2'
          }`}
        >
          <CyclingMap
            points={displayPoints}
            currentLocation={currentActiveLocation}
            plannedRoute={plannedRoute}
            onClearPlannedRoute={() => setPlannedRoute(null)}
            onReversePlannedRoute={(reversed) => setPlannedRoute(reversed)}
            hoveredRouteDistanceKm={hoveredRouteDistance}
            isRecording={recorder.status === 'recording'}
            followCyclist={followCyclist}
            onToggleFollow={() => setFollowCyclist(!followCyclist)}
            tileProvider={tileProvider}
            onTileProviderChange={setTileProvider}
            className="w-full h-full"
          />

          {/* If viewing historical track badge on map */}
          {selectedRide && recorder.status === 'idle' && (
            <div className="absolute top-4 left-4 z-[400] max-w-xs bg-stone-900/90 border border-stone-700/80 rounded-2xl p-3 shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-emerald-400">Prohlížení trasy</span>
                <button
                  type="button"
                  onClick={() => setAnalysisModalRide(selectedRide)}
                  className="text-[11px] underline text-stone-300 hover:text-white cursor-pointer"
                >
                  Detail & AI
                </button>
              </div>
              <div className="text-sm font-semibold text-white truncate">{selectedRide.name}</div>
              <div className="text-xs text-stone-400 mt-0.5">
                {selectedRide.distanceKm} km • +{selectedRide.elevationGainM} m • {selectedRide.avgSpeedKmh} km/h
              </div>
            </div>
          )}
        </div>

        {/* View: AI Route Planner Assistant */}
        {activeTab === 'planner' && (
          <div className="w-full md:w-1/2 lg:w-2/5 h-full bg-stone-950 border-l border-stone-800 z-20 flex flex-col relative">
            <RoutePlannerAssistant
              currentLocation={currentActiveLocation}
              onSelectRouteOnMap={handleSelectRouteFromPlanner}
              onStartRideWithRoute={handleStartRideWithRoute}
              activePlannedRoute={plannedRoute}
              activePlannedRouteId={plannedRoute?.id}
              onHoverRouteDistance={setHoveredRouteDistance}
            />

            {/* Mobile quick switch button to see the map if a route is selected */}
            {plannedRoute && (
              <div className="md:hidden absolute bottom-24 right-4 z-30">
                <button
                  type="button"
                  onClick={() => setActiveTab('live')}
                  className="px-3.5 py-2.5 rounded-2xl bg-cyan-500 text-stone-950 font-bold text-xs shadow-2xl flex items-center gap-2 border border-cyan-300 animate-bounce"
                >
                  <MapIcon className="w-4 h-4" />
                  <span>Zobrazit trasu na mapě</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* View: History List */}
        {activeTab === 'history' && (
          <div className="w-full md:w-1/2 h-full bg-stone-950/95 border-l border-stone-800 p-4 sm:p-6 overflow-y-auto z-20">
            <RideHistory
              rides={rides}
              selectedRideId={selectedRide?.id}
              onSelectRide={(r) => {
                setSelectedRide(r);
                if (window.innerWidth < 768) {
                  setActiveTab('live');
                }
              }}
              onOpenAnalysis={(r) => setAnalysisModalRide(r)}
              onDeleteRide={handleDeleteRide}
            />
          </div>
        )}
      </main>

      {/* Bottom Live Ride HUD (Cycling Computer) */}
      <footer className="shrink-0 z-30">
        <LiveRideHUD
          status={recorder.status}
          distanceKm={recorder.distanceKm}
          durationSeconds={recorder.durationSeconds}
          currentSpeedKmh={recorder.currentSpeedKmh}
          avgSpeedKmh={recorder.avgSpeedKmh}
          maxSpeedKmh={recorder.maxSpeedKmh}
          elevationGainM={recorder.elevationGainM}
          currentElevationM={recorder.currentElevationM}
          caloriesBurned={recorder.caloriesBurned}
          isSimulated={recorder.isSimulated}
          gpsAccuracy={recorder.gpsAccuracy}
          gpsError={recorder.gpsError}
          isScreenLocked={wakeLock.isLocked}
          isWakeLockSupported={wakeLock.isSupported}
          onToggleScreenLock={() => {
            if (wakeLock.isLocked) {
              setKeepScreenOn(false);
              wakeLock.releaseLock();
            } else {
              setKeepScreenOn(true);
              wakeLock.requestLock();
            }
          }}
          onOpenCockpit={() => setIsCockpitOpen(true)}
          onStart={handleStartRide}
          onPause={recorder.pauseRide}
          onResume={recorder.resumeRide}
          onFinish={handleFinishRide}
          onReset={recorder.resetRide}
        />
      </footer>

      {/* Fullscreen AMOLED Handlebar Cockpit Modal */}
      <HandlebarCockpitModal
        isOpen={isCockpitOpen}
        onClose={() => setIsCockpitOpen(false)}
        status={recorder.status}
        distanceKm={recorder.distanceKm}
        durationSeconds={recorder.durationSeconds}
        currentSpeedKmh={recorder.currentSpeedKmh}
        avgSpeedKmh={recorder.avgSpeedKmh}
        maxSpeedKmh={recorder.maxSpeedKmh}
        elevationGainM={recorder.elevationGainM}
        currentElevationM={recorder.currentElevationM}
        caloriesBurned={recorder.caloriesBurned}
        plannedRoute={plannedRoute}
        onPause={recorder.pauseRide}
        onResume={recorder.resumeRide}
        onFinish={handleFinishRide}
        isWakeLocked={wakeLock.isLocked}
        onToggleWakeLock={() => {
          if (wakeLock.isLocked) {
            setKeepScreenOn(false);
            wakeLock.releaseLock();
          } else {
            setKeepScreenOn(true);
            wakeLock.requestLock();
          }
        }}
      />

      {/* Modals and Drawers */}
      {analysisModalRide && (
        <RideAnalysisModal
          ride={analysisModalRide}
          isOpen={true}
          onClose={() => setAnalysisModalRide(null)}
          onSaveRide={handleSaveRide}
        />
      )}

      <AiCoachDrawer
        isOpen={isCoachDrawerOpen}
        onClose={() => setIsCoachDrawerOpen(false)}
        currentRideContext={
          recorder.status !== 'idle'
            ? {
                distanceKm: recorder.distanceKm,
                durationSeconds: recorder.durationSeconds,
                avgSpeedKmh: recorder.avgSpeedKmh,
                elevationGainM: recorder.elevationGainM,
              }
            : selectedRide || undefined
        }
      />
    </div>
  );
}
