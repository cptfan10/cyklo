import { useState, useRef, useEffect, useCallback } from 'react';
import { GpsPoint, RideData } from '../types';
import { calculateDistanceKm, estimateCalories, SAMPLE_KARLSTEJN_TRACK } from '../utils/geoUtils';

export type RecorderStatus = 'idle' | 'recording' | 'paused' | 'finished';

export function useRideRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [distanceKm, setDistanceKm] = useState<number>(0);
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [movingTimeSeconds, setMovingTimeSeconds] = useState<number>(0);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState<number>(0);
  const [avgSpeedKmh, setAvgSpeedKmh] = useState<number>(0);
  const [maxSpeedKmh, setMaxSpeedKmh] = useState<number>(0);
  const [elevationGainM, setElevationGainM] = useState<number>(0);
  const [elevationLossM, setElevationLossM] = useState<number>(0);
  const [currentElevationM, setCurrentElevationM] = useState<number | undefined>(undefined);
  const [caloriesBurned, setCaloriesBurned] = useState<number>(0);
  const [points, setPoints] = useState<GpsPoint[]>([]);
  const [isSimulated, setIsSimulated] = useState<boolean>(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Refs for timer and geolocation watching
  const timerIntervalRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);
  const simulationTimerRef = useRef<any>(null);
  const simIndexRef = useRef<number>(0);

  // Mutable refs to avoid stale closure issues during high-frequency GPS updates
  const pointsRef = useRef<GpsPoint[]>([]);
  const distanceRef = useRef<number>(0);
  const maxSpeedRef = useRef<number>(0);
  const elevationGainRef = useRef<number>(0);
  const elevationLossRef = useRef<number>(0);
  const lastAltitudeRef = useRef<number | null>(null);
  const movingTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);

  // Sync state with refs
  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  // Main timer for duration & moving time
  useEffect(() => {
    if (status === 'recording') {
      timerIntervalRef.current = setInterval(() => {
        durationRef.current += 1;
        setDurationSeconds(durationRef.current);

        // Update calories
        const currentAvg = durationRef.current > 0 ? (distanceRef.current / (durationRef.current / 3600)) : 0;
        const cal = estimateCalories(durationRef.current, currentAvg, elevationGainRef.current);
        setCaloriesBurned(cal);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [status]);

  // Handle incoming GPS Point
  const handleNewPoint = useCallback((newPoint: GpsPoint) => {
    const currentPoints = pointsRef.current;
    let deltaDist = 0;
    let calculatedSpeed = newPoint.speed !== undefined ? newPoint.speed : 0;

    if (currentPoints.length > 0) {
      const lastPoint = currentPoints[currentPoints.length - 1];
      const dist = calculateDistanceKm(lastPoint.lat, lastPoint.lng, newPoint.lat, newPoint.lng);

      // Noise filter: ignore jitter smaller than 2 meters if not moving fast
      if (dist < 0.002 && calculatedSpeed < 1.5) {
        return;
      }

      deltaDist = dist;
      distanceRef.current += deltaDist;
      setDistanceKm(Number(distanceRef.current.toFixed(2)));

      // If speed was not provided by hardware GPS, compute from distance and time
      if (newPoint.speed === undefined || newPoint.speed === null || isNaN(newPoint.speed)) {
        const timeDiffSec = (newPoint.timestamp - lastPoint.timestamp) / 1000;
        if (timeDiffSec > 0) {
          calculatedSpeed = (dist / (timeDiffSec / 3600));
        }
      }

      // Elevation tracking
      if (newPoint.altitude !== undefined && lastAltitudeRef.current !== null) {
        const altDiff = newPoint.altitude - lastAltitudeRef.current;
        // Apply threshold to reduce GPS barometric noise
        if (altDiff > 0.8) {
          elevationGainRef.current += altDiff;
          setElevationGainM(Math.round(elevationGainRef.current));
        } else if (altDiff < -0.8) {
          elevationLossRef.current += Math.abs(altDiff);
          setElevationLossM(Math.round(elevationLossRef.current));
        }
      }
    }

    if (newPoint.altitude !== undefined) {
      lastAltitudeRef.current = newPoint.altitude;
      setCurrentElevationM(Math.round(newPoint.altitude));
    }

    // Clamp unrealistic speed spikes (e.g. > 110 km/h for bike)
    const validSpeed = Math.min(Math.max(calculatedSpeed, 0), 105);
    setCurrentSpeedKmh(Number(validSpeed.toFixed(1)));

    if (validSpeed > maxSpeedRef.current) {
      maxSpeedRef.current = validSpeed;
      setMaxSpeedKmh(Number(validSpeed.toFixed(1)));
    }

    // Count as active moving time if speed > 2.5 km/h
    if (validSpeed > 2.5) {
      movingTimeRef.current += 1;
      setMovingTimeSeconds(movingTimeRef.current);
    }

    // Update average speed
    if (durationRef.current > 2) {
      const avg = distanceRef.current / (durationRef.current / 3600);
      setAvgSpeedKmh(Number(avg.toFixed(1)));
    }

    const updatedPoint = { ...newPoint, speed: validSpeed };
    setPoints((prev) => [...prev, updatedPoint]);
  }, []);

  // Real Geolocation Watcher
  const startRealGps = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGpsError('Geolokace není v tomto prohlížeči podporována.');
      return;
    }

    setGpsError(null);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const coords = position.coords;
        setGpsAccuracy(coords.accuracy);

        // coords.speed is in meters per second; convert to km/h
        const speedKmh = coords.speed !== null && coords.speed !== undefined ? coords.speed * 3.6 : undefined;

        handleNewPoint({
          lat: coords.latitude,
          lng: coords.longitude,
          timestamp: position.timestamp,
          altitude: coords.altitude || undefined,
          speed: speedKmh,
          accuracy: coords.accuracy,
        });
      },
      (error) => {
        console.warn('Geolocation watch error:', error);
        if (error.code === error.PERMISSION_DENIED) {
          setGpsError('Přístup k poloze GPS byl zamítnut. Povolte polohu v prohlížeči, nebo použijte režim simulace jízdy.');
        } else {
          setGpsError(`Chyba signálu GPS (${error.message}). Zkouším znovu...`);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 1000,
      }
    );
  }, [handleNewPoint]);

  // Start Simulation
  const startSimulation = useCallback(() => {
    setIsSimulated(true);
    simIndexRef.current = 0;
    const demoTrack = SAMPLE_KARLSTEJN_TRACK;

    // Push initial point immediately
    const firstPoint = {
      ...demoTrack[0],
      timestamp: Date.now(),
    };
    handleNewPoint(firstPoint);
    simIndexRef.current = 1;

    // Advance point every 1.8 seconds with realistic variation
    simulationTimerRef.current = setInterval(() => {
      const idx = simIndexRef.current;
      if (idx >= demoTrack.length) {
        // Loop or keep riding with slight offset
        simIndexRef.current = 0;
      }

      const basePoint = demoTrack[simIndexRef.current % demoTrack.length];
      // Add tiny natural jitter for realism
      const jitterLat = (Math.random() - 0.5) * 0.0001;
      const jitterLng = (Math.random() - 0.5) * 0.0001;
      const speedVariation = (Math.random() - 0.5) * 4;

      const simPoint: GpsPoint = {
        lat: basePoint.lat + jitterLat,
        lng: basePoint.lng + jitterLng,
        timestamp: Date.now(),
        altitude: basePoint.altitude ? basePoint.altitude + Math.round((Math.random() - 0.5) * 2) : 220,
        speed: Math.max(12, (basePoint.speed || 22) + speedVariation),
        accuracy: 4,
      };

      handleNewPoint(simPoint);
      simIndexRef.current += 1;
    }, 1800);
  }, [handleNewPoint]);

  const startRide = useCallback((simulate: boolean = false) => {
    setStatus('recording');
    setIsSimulated(simulate);

    if (simulate) {
      startSimulation();
    } else {
      startRealGps();
    }
  }, [startSimulation, startRealGps]);

  const pauseRide = useCallback(() => {
    setStatus('paused');
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (simulationTimerRef.current) {
      clearInterval(simulationTimerRef.current);
      simulationTimerRef.current = null;
    }
    setCurrentSpeedKmh(0);
  }, []);

  const resumeRide = useCallback(() => {
    setStatus('recording');
    if (isSimulated) {
      startSimulation();
    } else {
      startRealGps();
    }
  }, [isSimulated, startSimulation, startRealGps]);

  const finishRide = useCallback((name?: string, bikeType?: string, notes?: string): RideData => {
    pauseRide();
    setStatus('finished');

    const finalRide: RideData = {
      id: `ride-${Date.now()}`,
      name: name || `Cyklojízda ${new Date().toLocaleDateString('cs-CZ')}`,
      date: new Date().toISOString(),
      distanceKm: Number(distanceRef.current.toFixed(2)),
      durationSeconds: durationRef.current,
      movingTimeSeconds: movingTimeRef.current || durationRef.current,
      avgSpeedKmh: Number(avgSpeedKmh.toFixed(1)),
      maxSpeedKmh: Number(maxSpeedRef.current.toFixed(1)),
      elevationGainM: Math.round(elevationGainRef.current),
      elevationLossM: Math.round(elevationLossRef.current),
      caloriesBurned: caloriesBurned,
      points: [...pointsRef.current],
      bikeType: bikeType || 'Silniční / Gravel',
      cyclistNotes: notes || '',
      isSimulated,
    };

    return finalRide;
  }, [pauseRide, avgSpeedKmh, caloriesBurned, isSimulated]);

  const resetRide = useCallback(() => {
    pauseRide();
    setStatus('idle');
    setDistanceKm(0);
    setDurationSeconds(0);
    setMovingTimeSeconds(0);
    setCurrentSpeedKmh(0);
    setAvgSpeedKmh(0);
    setMaxSpeedKmh(0);
    setElevationGainM(0);
    setElevationLossM(0);
    setCurrentElevationM(undefined);
    setCaloriesBurned(0);
    setPoints([]);
    setIsSimulated(false);
    setGpsError(null);

    distanceRef.current = 0;
    durationRef.current = 0;
    movingTimeRef.current = 0;
    maxSpeedRef.current = 0;
    elevationGainRef.current = 0;
    elevationLossRef.current = 0;
    lastAltitudeRef.current = null;
    pointsRef.current = [];
  }, [pauseRide]);

  return {
    status,
    distanceKm,
    durationSeconds,
    movingTimeSeconds,
    currentSpeedKmh,
    avgSpeedKmh,
    maxSpeedKmh,
    elevationGainM,
    elevationLossM,
    currentElevationM,
    caloriesBurned,
    points,
    isSimulated,
    gpsAccuracy,
    gpsError,
    startRide,
    pauseRide,
    resumeRide,
    finishRide,
    resetRide,
  };
}
