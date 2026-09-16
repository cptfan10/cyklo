export interface GpsPoint {
  lat: number;
  lng: number;
  timestamp: number;
  altitude?: number; // meters above sea level
  speed?: number; // km/h
  accuracy?: number; // meters
}

export interface RideData {
  id: string;
  name: string;
  date: string;
  distanceKm: number;
  durationSeconds: number;
  movingTimeSeconds: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  currentSpeedKmh?: number;
  elevationGainM: number;
  elevationLossM: number;
  currentElevationM?: number;
  caloriesBurned: number;
  points: GpsPoint[];
  bikeType?: string; // 'Silniční' | 'Gravel' | 'Horský (MTB)' | 'Městské' | 'Elektrokolo'
  cyclistNotes?: string;
  aiAnalysis?: string;
  isSimulated?: boolean;
}

export type MapTileProvider = 'cyclosm' | 'osm' | 'topo' | 'voyager';

export interface RouteWaypoint {
  name: string;
  lat: number;
  lng: number;
  note?: string;
  elevationM?: number;
}

export interface ElevationPoint {
  distanceKm: number;
  altitudeM: number;
  lat?: number;
  lng?: number;
}

export interface SurfaceShare {
  surface: string;
  percentage: number;
  color: string;
}

export interface PlannedRoute {
  id: string;
  routeName: string;
  distanceKm: number;
  elevationGainM: number;
  elevationLossM?: number;
  bikeType?: string;
  difficulty?: 'Lehká' | 'Střední' | 'Náročná' | 'Horská výzva';
  region?: string;
  estimatedDurationMin?: number;
  trafficLevel?: 'Minimální (bez aut)' | 'Mírný' | 'Běžný provoz' | string;
  waypoints?: RouteWaypoint[];
  coordinates: [number, number][];
  description?: string;
  elevationProfile?: ElevationPoint[];
  surfaceBreakdown?: SurfaceShare[];
}

export interface MapLayerConfig {
  id: MapTileProvider;
  name: string;
  description: string;
  url: string;
  attribution: string;
  maxZoom: number;
}
