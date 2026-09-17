import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { GpsPoint, MapTileProvider, PlannedRoute } from '../types';
import { exportPlannedRouteToGpx, downloadFile, getCoordinateAtDistance, reversePlannedRoute } from '../utils/geoUtils';
import { RouteElevationProfile } from './RouteElevationProfile';
import {
  Layers,
  Locate,
  Maximize2,
  Navigation,
  Compass,
  MapPin,
  Sparkles,
  X,
  Mountain,
  Repeat,
  Download,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface CyclingMapProps {
  points: GpsPoint[];
  currentLocation?: GpsPoint | null;
  plannedRoute?: PlannedRoute | null;
  onClearPlannedRoute?: () => void;
  onReversePlannedRoute?: (route: PlannedRoute) => void;
  hoveredRouteDistanceKm?: number | null;
  isRecording?: boolean;
  followCyclist?: boolean;
  onToggleFollow?: () => void;
  className?: string;
  tileProvider?: MapTileProvider;
  onTileProviderChange?: (provider: MapTileProvider) => void;
}

const TILE_PROVIDERS: Record<MapTileProvider, { name: string; url: string; overlayUrl?: string; attribution: string; maxZoom: number; subtitle: string; iconLabel?: string }> = {
  cyclosm: {
    name: 'CyclOSM (Cyklo-mapa)',
    subtitle: 'Cyklotrasy, stezky, povrchy a převýšení',
    url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | Cyklo data &copy; <a href="https://www.cyclosm.org">CyclOSM</a>',
    maxZoom: 19,
    iconLabel: 'Cyklo',
  },
  satellite: {
    name: 'Satelitní (Letecká fotomapa)',
    subtitle: 'Detailní letecké a družicové snímky povrchu (Esri)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 19,
    iconLabel: 'Satelit',
  },
  satellite_hybrid: {
    name: 'Satelitní Hybrid (s popisy & silnicemi)',
    subtitle: 'Letecká mapa kombinovaná s popisy obcí a silniční sítí',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    overlayUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &copy; OpenStreetMap contributors',
    maxZoom: 19,
    iconLabel: 'Hybrid',
  },
  topo: {
    name: 'OpenTopoMap (Vrstevnice)',
    subtitle: 'Topografická mapa s vrstevnicemi a terénem',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; OSM contributors, SRTM | Map style: &copy; OpenTopoMap',
    maxZoom: 17,
    iconLabel: 'Topo',
  },
  voyager: {
    name: 'Carto Voyager (Svěží silniční)',
    subtitle: 'Čistý moderní kartografický styl',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 19,
    iconLabel: 'Silnice',
  },
  osm: {
    name: 'OpenStreetMap Standard',
    subtitle: 'Klasická veřejná celosvětová mapa',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    iconLabel: 'OSM',
  },
};

export const CyclingMap: React.FC<CyclingMapProps> = ({
  points,
  currentLocation,
  plannedRoute,
  onClearPlannedRoute,
  onReversePlannedRoute,
  hoveredRouteDistanceKm,
  isRecording = false,
  followCyclist = true,
  onToggleFollow,
  className = 'h-full w-full',
  tileProvider = 'cyclosm',
  onTileProviderChange,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayLayerRef = useRef<L.TileLayer | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const plannedPolylineRef = useRef<L.Polyline | null>(null);
  const plannedMarkersLayerRef = useRef<L.LayerGroup | null>(null);
  const currentMarkerRef = useRef<L.Marker | null>(null);
  const startMarkerRef = useRef<L.Marker | null>(null);
  const hoverPointMarkerRef = useRef<L.Marker | null>(null);

  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [showElevationDrawer, setShowElevationDrawer] = useState(false);
  const [internalHoverDistance, setInternalHoverDistance] = useState<number | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = currentLocation ? currentLocation.lat : points[0]?.lat || 49.9862;
    const initialLng = currentLocation ? currentLocation.lng : points[0]?.lng || 14.3642;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 14,
      zoomControl: false,
    });

    const providerConfig = TILE_PROVIDERS[tileProvider];
    const tileLayer = L.tileLayer(providerConfig.url, {
      attribution: providerConfig.attribution,
      maxZoom: providerConfig.maxZoom,
      subdomains: 'abc',
    }).addTo(map);
    tileLayerRef.current = tileLayer;

    if (providerConfig.overlayUrl) {
      const overlayLayer = L.tileLayer(providerConfig.overlayUrl, {
        attribution: '',
        maxZoom: providerConfig.maxZoom,
      }).addTo(map);
      overlayLayerRef.current = overlayLayer;
    }

    // Route Polyline (Recorded / Live track)
    const polyline = L.polyline([], {
      color: '#10b981', // Emerald primary
      weight: 5,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);
    polylineRef.current = polyline;

    // Planned Polyline (AI Planner route)
    const plannedPolyline = L.polyline([], {
      color: '#06b6d4', // Cyan
      weight: 5,
      dashArray: '8, 8',
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);
    plannedPolylineRef.current = plannedPolyline;

    // Planned Markers Group
    const plannedMarkersLayer = L.layerGroup().addTo(map);
    plannedMarkersLayerRef.current = plannedMarkersLayer;

    mapInstanceRef.current = map;

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update tile provider when prop changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const providerConfig = TILE_PROVIDERS[tileProvider];

    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }
    if (overlayLayerRef.current) {
      mapInstanceRef.current.removeLayer(overlayLayerRef.current);
      overlayLayerRef.current = null;
    }

    const newTileLayer = L.tileLayer(providerConfig.url, {
      attribution: providerConfig.attribution,
      maxZoom: providerConfig.maxZoom,
      subdomains: 'abc',
    }).addTo(mapInstanceRef.current);
    tileLayerRef.current = newTileLayer;

    if (providerConfig.overlayUrl) {
      const newOverlayLayer = L.tileLayer(providerConfig.overlayUrl, {
        attribution: '',
        maxZoom: providerConfig.maxZoom,
      }).addTo(mapInstanceRef.current);
      overlayLayerRef.current = newOverlayLayer;
    }
  }, [tileProvider]);

  // Update Polyline points
  useEffect(() => {
    if (!mapInstanceRef.current || !polylineRef.current) return;

    const latLngs: [number, number][] = points.map((p) => [p.lat, p.lng]);
    polylineRef.current.setLatLngs(latLngs);

    if (points.length > 0 && !startMarkerRef.current) {
      const startIcon = L.divIcon({
        className: 'custom-start-marker',
        html: `<div class="w-6 h-6 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-lg">START</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      startMarkerRef.current = L.marker([points[0].lat, points[0].lng], { icon: startIcon }).addTo(mapInstanceRef.current);
    } else if (points.length === 0 && startMarkerRef.current) {
      mapInstanceRef.current.removeLayer(startMarkerRef.current);
      startMarkerRef.current = null;
    }

    if (!isRecording && points.length > 1 && !plannedRoute) {
      const bounds = L.latLngBounds(latLngs);
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [points, isRecording, plannedRoute]);

  // Update Planned Route Polyline and Waypoint Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !plannedPolylineRef.current || !plannedMarkersLayerRef.current) return;

    plannedMarkersLayerRef.current.clearLayers();

    if (!plannedRoute || !plannedRoute.coordinates || plannedRoute.coordinates.length === 0) {
      plannedPolylineRef.current.setLatLngs([]);
      return;
    }

    const validCoords: [number, number][] = (plannedRoute.coordinates || []).filter(
      (c): c is [number, number] =>
        Array.isArray(c) &&
        c.length >= 2 &&
        typeof c[0] === 'number' &&
        typeof c[1] === 'number' &&
        !isNaN(c[0]) &&
        !isNaN(c[1]) &&
        isFinite(c[0]) &&
        isFinite(c[1])
    );

    if (validCoords.length === 0) {
      plannedPolylineRef.current.setLatLngs([]);
      return;
    }

    plannedPolylineRef.current.setLatLngs(validCoords);

    // Add Waypoint markers
    if (plannedRoute.waypoints && plannedRoute.waypoints.length > 0) {
      plannedRoute.waypoints.forEach((wp, idx) => {
        if (typeof wp.lat !== 'number' || typeof wp.lng !== 'number' || isNaN(wp.lat) || isNaN(wp.lng)) {
          return;
        }
        const isStart = idx === 0;
        const isEnd = idx === plannedRoute.waypoints!.length - 1;
        const label = isStart ? 'S' : isEnd ? 'C' : `${idx + 1}`;
        const colorClass = isStart ? 'bg-emerald-500' : isEnd ? 'bg-rose-500' : 'bg-cyan-600';

        const wpIcon = L.divIcon({
          className: 'custom-wp-marker',
          html: `<div class="w-7 h-7 ${colorClass} border-2 border-white rounded-full flex items-center justify-center text-white text-xs font-bold shadow-xl cursor-pointer" title="${wp.name}">${label}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([wp.lat, wp.lng], { icon: wpIcon });
        marker.bindPopup(`
          <div style="color: #1c1917; font-family: sans-serif; font-size: 13px;">
            <strong>${wp.name}</strong>
            ${wp.elevationM ? `<br/><span style="font-size: 11px; color: #0284c7;">${wp.elevationM} m n.m.</span>` : ''}
            ${wp.note ? `<br/><span style="font-size: 11px; color: #57534e;">${wp.note}</span>` : ''}
          </div>
        `);
        plannedMarkersLayerRef.current!.addLayer(marker);
      });
    }

    try {
      const bounds = L.latLngBounds(validCoords);
      if (bounds.isValid()) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    } catch (e) {
      console.warn('Map fitBounds failed:', e);
    }
  }, [plannedRoute]);

  // Update Current Cyclist Location Marker
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const targetPos = currentLocation || (points.length > 0 ? points[points.length - 1] : null);
    if (!targetPos) return;

    const latLng: [number, number] = [targetPos.lat, targetPos.lng];

    if (!currentMarkerRef.current) {
      const cyclistIcon = L.divIcon({
        className: 'cyclist-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-8 h-8 bg-emerald-500/30 rounded-full animate-ping"></div>
            <div class="w-6 h-6 bg-emerald-600 border-2 border-white rounded-full flex items-center justify-center text-white shadow-xl">
              <div class="w-2.5 h-2.5 bg-white rounded-full"></div>
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      currentMarkerRef.current = L.marker(latLng, { icon: cyclistIcon, zIndexOffset: 1000 }).addTo(mapInstanceRef.current);
    } else {
      currentMarkerRef.current.setLatLng(latLng);
    }

    if (followCyclist && mapInstanceRef.current) {
      mapInstanceRef.current.panTo(latLng, { animate: true, duration: 0.8 });
    }
  }, [currentLocation, points, followCyclist]);

  // Hover point marker along planned route (Elevation scrub synch)
  const activeHoverDist = hoveredRouteDistanceKm !== undefined ? hoveredRouteDistanceKm : internalHoverDistance;
  useEffect(() => {
    if (!mapInstanceRef.current || !plannedRoute) {
      if (hoverPointMarkerRef.current) {
        mapInstanceRef.current?.removeLayer(hoverPointMarkerRef.current);
        hoverPointMarkerRef.current = null;
      }
      return;
    }

    if (activeHoverDist === null || activeHoverDist === undefined) {
      if (hoverPointMarkerRef.current) {
        mapInstanceRef.current.removeLayer(hoverPointMarkerRef.current);
        hoverPointMarkerRef.current = null;
      }
      return;
    }

    const coord = getCoordinateAtDistance(plannedRoute, activeHoverDist);
    if (!coord) return;

    if (!hoverPointMarkerRef.current) {
      const icon = L.divIcon({
        className: 'hover-profile-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="w-5 h-5 bg-cyan-400 border-2 border-stone-950 rounded-full shadow-2xl animate-pulse"></div>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      hoverPointMarkerRef.current = L.marker(coord, { icon, zIndexOffset: 1500 }).addTo(mapInstanceRef.current);
    } else {
      hoverPointMarkerRef.current.setLatLng(coord);
    }
  }, [plannedRoute, activeHoverDist]);

  const handleFitRoute = () => {
    if (!mapInstanceRef.current || points.length === 0) return;
    const latLngs: [number, number][] = points.map((p) => [p.lat, p.lng]);
    const bounds = L.latLngBounds(latLngs);
    mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
  };

  const handleFitPlanned = () => {
    if (mapInstanceRef.current && plannedRoute && plannedRoute.coordinates.length > 0) {
      const bounds = L.latLngBounds(plannedRoute.coordinates);
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  const handleRecenter = () => {
    if (!mapInstanceRef.current) return;
    const target = currentLocation || (points.length > 0 ? points[points.length - 1] : null);
    if (target) {
      mapInstanceRef.current.setView([target.lat, target.lng], 16, { animate: true });
    }
    if (onToggleFollow && !followCyclist) {
      onToggleFollow();
    }
  };

  const handleReverse = () => {
    if (!plannedRoute) return;
    const reversed = reversePlannedRoute(plannedRoute);
    if (onReversePlannedRoute) {
      onReversePlannedRoute(reversed);
    }
  };

  const handleDownloadGpx = () => {
    if (!plannedRoute) return;
    const gpx = exportPlannedRouteToGpx(plannedRoute);
    const filename = `${plannedRoute.routeName.replace(/[^a-z0-9]/gi, '_')}.gpx`;
    downloadFile(gpx, filename, 'application/gpx+xml');
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Leaflet Map DOM Element */}
      <div id="cycling-leaflet-map" ref={mapContainerRef} className="w-full h-full z-0 bg-stone-900" />

      {/* Quick Map Tile Switcher (Glassmorphism bar) */}
      <div className="absolute top-4 left-4 z-[390] flex items-center gap-1 p-1 glass-card !rounded-xl max-w-[calc(100vw-5rem)] overflow-x-auto no-scrollbar shadow-xl">
        {[
          { id: 'cyclosm', label: 'Cyklo', icon: '🚴' },
          { id: 'satellite', label: 'Satelit', icon: '🛰️' },
          { id: 'satellite_hybrid', label: 'Hybrid', icon: '🌍' },
          { id: 'topo', label: 'Vrstevnice', icon: '⛰️' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onTileProviderChange && onTileProviderChange(item.id as MapTileProvider)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              tileProvider === item.id
                ? 'bg-emerald-500 text-stone-950 font-bold shadow-md'
                : 'text-stone-200 hover:text-white hover:bg-white/10'
            }`}
          >
            <span className="text-xs">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Planned Route Banner Top Left (if active) */}
      {plannedRoute && (
        <div className="absolute top-16 left-4 z-[400] max-w-sm glass-card !border-cyan-500/60 p-3 shadow-2xl animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Aktivní cyklotrasa</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowElevationDrawer(!showElevationDrawer)}
                title={showElevationDrawer ? 'Skrýt výškový profil' : 'Zobrazit výškový profil'}
                className={`p-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  showElevationDrawer ? 'bg-cyan-500/30 text-cyan-300' : 'hover:bg-stone-800 text-stone-300'
                }`}
              >
                <Mountain className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold">Profil</span>
              </button>

              {onClearPlannedRoute && (
                <button
                  type="button"
                  onClick={onClearPlannedRoute}
                  className="p-1 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-white transition-colors cursor-pointer"
                  title="Skrýt trasu"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="text-sm sm:text-base font-bold text-white truncate banner-route-title">{plannedRoute.routeName}</div>

          <div className="flex items-center justify-between text-xs text-stone-300 mt-1 font-mono">
            <div className="flex items-center gap-2.5">
              <span className="text-cyan-400 font-bold">{plannedRoute.distanceKm} km</span>
              <span className="text-emerald-400 font-bold">+{plannedRoute.elevationGainM} m</span>
              {plannedRoute.bikeType && <span className="text-stone-300 font-sans text-xs font-semibold">{plannedRoute.bikeType}</span>}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleReverse}
                title="Obrátit směr trasy"
                className="p-1 rounded hover:bg-stone-800 text-stone-400 hover:text-cyan-400 cursor-pointer"
              >
                <Repeat className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleDownloadGpx}
                title="Stáhnout GPX"
                className="p-1 rounded hover:bg-stone-800 text-stone-400 hover:text-cyan-400 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map Control Buttons Top Right */}
      <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2">
        {/* Layer switch button */}
        <div className="relative">
          <button
            id="btn-map-layers"
            type="button"
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            title="Přepnout vrstvu mapy (Satelitní, Cyklo, Topo)"
            className="p-2.5 glass-panel text-stone-100 shadow-xl transition-all flex items-center justify-center cursor-pointer hover:!border-emerald-400/50"
          >
            <Layers className="w-5 h-5 text-emerald-400" />
          </button>

          {showLayerMenu && (
            <div className="absolute right-0 mt-2 w-72 glass-modal p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95">
              <div className="px-3 py-2 border-b border-white/10">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-300">Veřejné mapové podklady</span>
              </div>
              <div className="flex flex-col gap-1 mt-1.5">
                {(Object.keys(TILE_PROVIDERS) as MapTileProvider[]).map((key) => {
                  const p = TILE_PROVIDERS[key];
                  const isSelected = tileProvider === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (onTileProviderChange) onTileProviderChange(key);
                        setShowLayerMenu(false);
                      }}
                      className={`text-left px-3 py-2.5 rounded-xl transition-all flex flex-col gap-0.5 cursor-pointer ${
                        isSelected ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300' : 'hover:bg-white/10 text-stone-300'
                      }`}
                    >
                      <span className="text-sm font-medium flex items-center justify-between">
                        {p.name}
                        {isSelected && <span className="w-2 h-2 rounded-full bg-emerald-400"></span>}
                      </span>
                      <span className="text-xs text-stone-400">{p.subtitle}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Fit recorded route button */}
        {points.length > 1 && (
          <button
            id="btn-fit-route"
            type="button"
            onClick={handleFitRoute}
            title="Zobrazit celou projetou trasu"
            className="p-2.5 glass-panel text-stone-100 shadow-xl transition-all flex items-center justify-center cursor-pointer hover:!border-white/30"
          >
            <Maximize2 className="w-5 h-5 text-stone-200" />
          </button>
        )}

        {/* Fit planned route button */}
        {plannedRoute && plannedRoute.coordinates.length > 0 && (
          <button
            id="btn-fit-planned-route"
            type="button"
            onClick={handleFitPlanned}
            title="Zobrazit celou naplánovanou trasu"
            className="p-2.5 glass-panel text-cyan-200 !border-cyan-500/50 shadow-xl transition-all flex items-center justify-center cursor-pointer hover:!border-cyan-400"
          >
            <Sparkles className="w-5 h-5 text-cyan-400" />
          </button>
        )}

        {/* Center / Follow Cyclist Button */}
        <button
          id="btn-center-cyclist"
          type="button"
          onClick={handleRecenter}
          title={followCyclist ? 'Cyklista je sledován' : 'Vycentrovat na cyklistu'}
          className={`p-2.5 rounded-xl border shadow-xl backdrop-blur-md transition-all flex items-center justify-center cursor-pointer ${
            followCyclist
              ? 'bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-400/40'
              : 'glass-panel text-stone-200 hover:!border-white/30'
          }`}
        >
          <Locate className={`w-5 h-5 ${followCyclist ? 'animate-pulse' : ''}`} />
        </button>
      </div>

      {/* Bottom Floating Elevation Profile Drawer */}
      {plannedRoute && showElevationDrawer && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-6 sm:right-6 z-[400] max-w-xl mx-auto glass-panel p-3 shadow-2xl animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
              <Mountain className="w-3.5 h-3.5" />
              Výškový profil – {plannedRoute.routeName}
            </span>
            <button
              type="button"
              onClick={() => setShowElevationDrawer(false)}
              className="p-1 rounded-lg hover:bg-stone-800/80 text-stone-300 hover:text-white cursor-pointer"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          <RouteElevationProfile
            route={plannedRoute}
            compact={true}
            onHoverDistance={(d) => setInternalHoverDistance(d)}
          />
        </div>
      )}

      {/* Bottom Map Badge showing active public map */}
      <div className="absolute bottom-3 left-3 z-[300] pointer-events-none">
        <div className="px-2.5 py-1 rounded-lg glass-tile !rounded-lg text-xs font-semibold text-stone-200 flex items-center gap-1.5 shadow-md">
          <Compass className="w-3.5 h-3.5 text-emerald-400" />
          <span>{TILE_PROVIDERS[tileProvider].name.split(' (')[0]}</span>
        </div>
      </div>
    </div>
  );
};
