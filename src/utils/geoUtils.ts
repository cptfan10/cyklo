import { GpsPoint, RideData } from '../types';

/**
 * Calculates distance between two points in kilometers using the Haversine formula
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates estimated cycling calories burned
 * @param weightKg cyclist weight (default 75kg)
 * @param speedKmh average speed in km/h
 * @param durationSeconds duration in seconds
 * @param elevationGainM total elevation climbed
 */
export function estimateCalories(
  durationSeconds: number,
  speedKmh: number,
  elevationGainM: number = 0,
  weightKg: number = 75
): number {
  if (durationSeconds <= 0) return 0;
  // MET estimate based on cycling speed
  let met = 4.0;
  if (speedKmh > 30) met = 12.0;
  else if (speedKmh > 25) met = 10.0;
  else if (speedKmh > 20) met = 8.0;
  else if (speedKmh > 15) met = 6.0;
  else if (speedKmh > 10) met = 5.0;

  // Additional factor for climbing
  const hours = durationSeconds / 3600;
  const baseCalories = met * weightKg * hours;
  // Climbing bonus: ~0.15 kcal per meter climbed per kg
  const climbingCalories = (elevationGainM * 0.15 * (weightKg / 75));
  return Math.round(baseCalories + climbingCalories);
}

/**
 * Formats seconds into HH:MM:SS or MM:SS
 */
export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);

  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

/**
 * Exports a recorded ride as a standard GPX 1.1 file
 */
export function exportToGpx(ride: RideData): string {
  const gpxHeader = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="CyklistickyAsistent" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(ride.name)}</name>
    <time>${new Date(ride.date).toISOString()}</time>
  </metadata>
  <trk>
    <name>${escapeXml(ride.name)}</name>
    <type>cycling</type>
    <trkseg>`;

  const pointsXml = ride.points
    .map((pt) => {
      const ele = pt.altitude !== undefined ? `\n        <ele>${pt.altitude.toFixed(1)}</ele>` : '';
      const time = `\n        <time>${new Date(pt.timestamp).toISOString()}</time>`;
      return `      <trkpt lat="${pt.lat.toFixed(6)}" lon="${pt.lng.toFixed(6)}">${ele}${time}\n      </trkpt>`;
    })
    .join('\n');

  const gpxFooter = `
    </trkseg>
  </trk>
</gpx>`;

  return `${gpxHeader}\n${pointsXml}${gpxFooter}`;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * Downloads text as a file in browser
 */
export function downloadFile(content: string, fileName: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Sample scenic cycling track around Prague & Karlštejn for instant live demo or initial history
 */
export const SAMPLE_KARLSTEJN_TRACK: GpsPoint[] = [
  { lat: 49.9862, lng: 14.3642, timestamp: 1726400000000, altitude: 202, speed: 22.4 },
  { lat: 49.9845, lng: 14.3581, timestamp: 1726400060000, altitude: 204, speed: 24.1 },
  { lat: 49.9818, lng: 14.3490, timestamp: 1726400120000, altitude: 206, speed: 25.8 },
  { lat: 49.9782, lng: 14.3395, timestamp: 1726400180000, altitude: 211, speed: 23.5 },
  { lat: 49.9721, lng: 14.3284, timestamp: 1726400240000, altitude: 216, speed: 21.9 },
  { lat: 49.9678, lng: 14.3150, timestamp: 1726400300000, altitude: 220, speed: 26.2 },
  { lat: 49.9610, lng: 14.2985, timestamp: 1726400360000, altitude: 225, speed: 27.0 },
  { lat: 49.9540, lng: 14.2790, timestamp: 1726400420000, altitude: 234, speed: 23.4 },
  { lat: 49.9480, lng: 14.2560, timestamp: 1726400480000, altitude: 242, speed: 20.1 },
  { lat: 49.9420, lng: 14.2340, timestamp: 1726400540000, altitude: 258, speed: 17.5 },
  { lat: 49.9380, lng: 14.2050, timestamp: 1726400600000, altitude: 275, speed: 16.2 },
  { lat: 49.9395, lng: 14.1880, timestamp: 1726400660000, altitude: 290, speed: 14.8 },
  { lat: 49.9410, lng: 14.1750, timestamp: 1726400720000, altitude: 312, speed: 13.9 },
  { lat: 49.9440, lng: 14.1680, timestamp: 1726400780000, altitude: 319, speed: 18.3 },
  { lat: 49.9392, lng: 14.1820, timestamp: 1726400840000, altitude: 280, speed: 38.5 },
  { lat: 49.9360, lng: 14.1950, timestamp: 1726400900000, altitude: 245, speed: 34.2 },
  { lat: 49.9338, lng: 14.2120, timestamp: 1726400960000, altitude: 228, speed: 28.1 },
  { lat: 49.9345, lng: 14.2380, timestamp: 1726401020000, altitude: 221, speed: 26.5 },
  { lat: 49.9380, lng: 14.2620, timestamp: 1726401080000, altitude: 218, speed: 27.2 },
  { lat: 49.9490, lng: 14.2950, timestamp: 1726401140000, altitude: 215, speed: 25.0 },
  { lat: 49.9650, lng: 14.3320, timestamp: 1726401200000, altitude: 210, speed: 24.8 },
  { lat: 49.9862, lng: 14.3642, timestamp: 1726401260000, altitude: 202, speed: 22.0 }
];

export const INITIAL_PRESET_RIDES: RideData[] = [
  {
    id: 'ride-karlstejn-loop',
    name: 'Berounka & Hrad Karlštejn (Okruh)',
    date: new Date(Date.now() - 86400000 * 2).toISOString(),
    distanceKm: 34.8,
    durationSeconds: 5280, // ~1h 28m
    movingTimeSeconds: 5040,
    avgSpeedKmh: 24.9,
    maxSpeedKmh: 46.2,
    elevationGainM: 345,
    elevationLossM: 340,
    caloriesBurned: 780,
    bikeType: 'Gravel / Silniční',
    cyclistNotes: 'Příjemná jízda podél Berounky, stoupání na hrad prověřilo nohy, sjezd po hladkém asfaltu.',
    points: SAMPLE_KARLSTEJN_TRACK,
    aiAnalysis: `### 🚴‍♂️ AI Zhodnocení: Berounka & Hrad Karlštejn
**Index výkonu:** 8.4 / 10 (Výborná vytrvalost s dynamickým stoupáním)

**1. Analýza tempa a rychlostních zón:**
- Průměrná rychlost **24.9 km/h** je na členitý profil velmi solidní a značí skvělou vytrvalostní kondici.
- Maximální rychlost **46.2 km/h** dosažená při sjezdu ukazuje jistou techniku vedení kola.
- Jízda byla plynulá s minimem zbytečných zastavení (čistý pohyb 95 % celkového času).

**2. Terén a převýšení (345 m):**
- Klíčový segment stoupání na Karlštejn (cca 120 m nárůst) jste zvládli v tempu 14–16 km/h. To odpovídá udržitelné prahové zátěži (Sweet Spot).

**3. Regenerace a doporučení:**
- Doplňte přibližně 750 ml iontového nápoje a 60–80 g sacharidů (např. banán, rýžová kaše nebo lehký sendvič).
- Svaly nohou budou po 345 m stoupání potřebovat cca 24 hodin na plné zotavení.

**4. Tréninkový tip:**
- Při dalším výjezdu zkuste v nejprudší části stoupání udržovat vyšší kadenci (80–85 otáček za minutu na lehčí převod) namísto silového "lámání" těžkého převodu.`
  }
];
