import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { GpsPoint, MapTileProvider } from '../types';
import { Layers, Locate, Maximize2, Navigation, Compass } from 'lucide-react';

interface CyclingMapProps {
  points: GpsPoint[];
  currentLocation?: GpsPoint | null;
  isRecording?: boolean;
  followCyclist?: boolean;
  onToggleFollow?: () => void;
  className?: string;
  tileProvider?: MapTileProvider;
  onTileProviderChange?: (provider: MapTileProvider) => void;
}

const TILE_PROVIDERS: Record<MapTileProvider, { name: string; url: string; attribution: string; maxZoom: number; subtitle: string }> = {
  cyclosm: {
    name: 'CyclOSM (Cyklo-mapa)',
    subtitle: 'Cyklotrasy, stezky, povrchy a převýšení',
    url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | Cyklo data &copy; <a href="https://www.cyclosm.org">CyclOSM</a>',
    maxZoom: 19
  },
  osm: {
    name: 'OpenStreetMap Standard',
    subtitle: 'Klasická veřejná celosvětová mapa',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  },
  topo: {
    name: 'OpenTopoMap (Vrstevnice)',
    subtitle: 'Topografická mapa s vrstevnicemi a terénem',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; OSM contributors, SRTM | Map style: &copy; OpenTopoMap',
    maxZoom: 17
  },
  voyager: {
    name: 'Carto Voyager (Svěží silniční)',
    subtitle: 'Čistý moderní kartografický styl',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 19
  }
};

export const CyclingMap: React.FC<CyclingMapProps> = ({
  points,
  currentLocation,
  isRecording = false,
  followCyclist = true,
  onToggleFollow,
  className = 'h-full w-full',
  tileProvider = 'cyclosm',
  onTileProviderChange
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const currentMarkerRef = useRef<L.Marker | null>(null);
  const startMarkerRef = useRef<L.Marker | null>(null);
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center in Czech Republic (or default position)
    const initialLat = currentLocation ? currentLocation.lat : (points[0]?.lat || 49.9862);
    const initialLng = currentLocation ? currentLocation.lng : (points[0]?.lng || 14.3642);

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 14,
      zoomControl: false,
    });

    // Add Tile Layer
    const providerConfig = TILE_PROVIDERS[tileProvider];
    const tileLayer = L.tileLayer(providerConfig.url, {
      attribution: providerConfig.attribution,
      maxZoom: providerConfig.maxZoom,
      subdomains: 'abc'
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    // Route Polyline
    const polyline = L.polyline([], {
      color: '#10b981', // Emerald primary
      weight: 5,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);
    polylineRef.current = polyline;

    mapInstanceRef.current = map;

    // Invalidate size after layout settles
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
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const providerConfig = TILE_PROVIDERS[tileProvider];
    mapInstanceRef.current.removeLayer(tileLayerRef.current);

    const newTileLayer = L.tileLayer(providerConfig.url, {
      attribution: providerConfig.attribution,
      maxZoom: providerConfig.maxZoom,
      subdomains: 'abc'
    }).addTo(mapInstanceRef.current);

    tileLayerRef.current = newTileLayer;
  }, [tileProvider]);

  // Update Polyline points
  useEffect(() => {
    if (!mapInstanceRef.current || !polylineRef.current) return;

    const latLngs: [number, number][] = points.map((p) => [p.lat, p.lng]);
    polylineRef.current.setLatLngs(latLngs);

    // Start marker
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

    // Auto-fit if we just loaded historical track and not recording
    if (!isRecording && points.length > 1) {
      const bounds = L.latLngBounds(latLngs);
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [points, isRecording]);

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

    // Follow cyclist if enabled
    if (followCyclist && mapInstanceRef.current) {
      mapInstanceRef.current.panTo(latLng, { animate: true, duration: 0.8 });
    }
  }, [currentLocation, points, followCyclist]);

  const handleFitRoute = () => {
    if (!mapInstanceRef.current || points.length === 0) return;
    const latLngs: [number, number][] = points.map((p) => [p.lat, p.lng]);
    const bounds = L.latLngBounds(latLngs);
    mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
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

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Leaflet Map DOM Element */}
      <div id="cycling-leaflet-map" ref={mapContainerRef} className="w-full h-full z-0 bg-stone-900" />

      {/* Map Control Buttons Top Right */}
      <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2">
        {/* Layer switch button */}
        <div className="relative">
          <button
            id="btn-map-layers"
            type="button"
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            title="Přepnout vrstvu mapy"
            className="p-2.5 rounded-xl bg-stone-900/90 hover:bg-stone-800 text-stone-100 border border-stone-700 shadow-xl backdrop-blur-md transition-all flex items-center justify-center cursor-pointer"
          >
            <Layers className="w-5 h-5 text-emerald-400" />
          </button>

          {showLayerMenu && (
            <div className="absolute right-0 mt-2 w-72 bg-stone-900/95 border border-stone-700/80 rounded-2xl p-2 shadow-2xl backdrop-blur-md z-50 animate-in fade-in zoom-in-95">
              <div className="px-3 py-2 border-b border-stone-800">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Veřejné mapové podklady</span>
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
                        isSelected ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300' : 'hover:bg-stone-800/80 text-stone-300'
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

        {/* Fit route button */}
        {points.length > 1 && (
          <button
            id="btn-fit-route"
            type="button"
            onClick={handleFitRoute}
            title="Zobrazit celou trasu"
            className="p-2.5 rounded-xl bg-stone-900/90 hover:bg-stone-800 text-stone-100 border border-stone-700 shadow-xl backdrop-blur-md transition-all flex items-center justify-center cursor-pointer"
          >
            <Maximize2 className="w-5 h-5 text-stone-300" />
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
              : 'bg-stone-900/90 hover:bg-stone-800 text-stone-300 border-stone-700'
          }`}
        >
          <Locate className={`w-5 h-5 ${followCyclist ? 'animate-pulse' : ''}`} />
        </button>
      </div>

      {/* Bottom Map Badge showing active public map */}
      <div className="absolute bottom-3 left-3 z-[400] pointer-events-none">
        <div className="px-2.5 py-1 rounded-lg bg-stone-900/80 border border-stone-800 backdrop-blur-sm text-[11px] text-stone-400 flex items-center gap-1.5 shadow-md">
          <Compass className="w-3.5 h-3.5 text-emerald-400" />
          <span>{TILE_PROVIDERS[tileProvider].name.split(' (')[0]}</span>
        </div>
      </div>
    </div>
  );
};
