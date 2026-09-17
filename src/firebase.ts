import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { RideData, PlannedRoute } from './types';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// CRITICAL: The app will break without specifying firestoreDatabaseId
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Error Handling Requirements from Skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate Connection to Firestore on boot (Mandatory Constraint from Skill)
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// Authentication Helpers
export async function loginWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    if (user) {
      // Sync user profile document
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(
        userDocRef,
        {
          id: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'Cyklista',
          photoURL: user.photoURL || '',
          createdAt: new Date().toISOString()
        },
        { merge: true }
      );
    }
    return user;
  } catch (error) {
    console.error('Google Sign-In failed:', error);
    throw error;
  }
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

// Firestore Realtime Sync for Rides
export function subscribeToUserRides(
  userId: string,
  onRidesUpdated: (rides: RideData[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const ridesCollectionPath = `users/${userId}/rides`;
  const ridesRef = collection(db, 'users', userId, 'rides');

  return onSnapshot(
    ridesRef,
    (snapshot) => {
      const rides: RideData[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        rides.push({
          id: docSnap.id,
          name: data.name || 'Jízda',
          date: data.date || new Date().toISOString(),
          distanceKm: Number(data.distanceKm) || 0,
          durationSeconds: Number(data.durationSeconds) || 0,
          movingTimeSeconds: Number(data.movingTimeSeconds) || 0,
          avgSpeedKmh: Number(data.avgSpeedKmh) || 0,
          maxSpeedKmh: Number(data.maxSpeedKmh) || 0,
          elevationGainM: Number(data.elevationGainM) || 0,
          elevationLossM: Number(data.elevationLossM) || 0,
          caloriesBurned: Number(data.caloriesBurned) || 0,
          bikeType: data.bikeType || 'Silniční / Gravel',
          cyclistNotes: data.cyclistNotes || '',
          aiAnalysis: data.aiAnalysis || '',
          isSimulated: Boolean(data.isSimulated),
          points: Array.isArray(data.points) ? data.points : []
        });
      });
      // Sort newest first
      rides.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      onRidesUpdated(rides);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, ridesCollectionPath);
      if (onError) onError(error);
    }
  );
}

export async function saveRideToCloud(userId: string, ride: RideData): Promise<void> {
  const ridePath = `users/${userId}/rides/${ride.id}`;
  try {
    const docRef = doc(db, 'users', userId, 'rides', ride.id);
    const sanitizedPoints = (ride.points || []).slice(-2000).map(p => ({
      lat: Number(p.lat),
      lng: Number(p.lng),
      timestamp: Number(p.timestamp) || Date.now(),
      altitude: p.altitude !== undefined ? Number(p.altitude) : null,
      speed: p.speed !== undefined ? Number(p.speed) : null
    }));

    await setDoc(docRef, {
      id: ride.id,
      userId,
      name: (ride.name || 'Cyklo jízda').slice(0, 120),
      date: ride.date || new Date().toISOString(),
      distanceKm: Math.max(0, Number(ride.distanceKm) || 0),
      durationSeconds: Math.max(0, Math.round(Number(ride.durationSeconds) || 0)),
      movingTimeSeconds: Math.max(0, Math.round(Number(ride.movingTimeSeconds) || 0)),
      avgSpeedKmh: Math.max(0, Number(ride.avgSpeedKmh) || 0),
      maxSpeedKmh: Math.max(0, Number(ride.maxSpeedKmh) || 0),
      elevationGainM: Math.max(0, Math.round(Number(ride.elevationGainM) || 0)),
      elevationLossM: Math.max(0, Math.round(Number(ride.elevationLossM) || 0)),
      caloriesBurned: Math.max(0, Math.round(Number(ride.caloriesBurned) || 0)),
      bikeType: (ride.bikeType || 'Silniční / Gravel').slice(0, 60),
      cyclistNotes: (ride.cyclistNotes || '').slice(0, 1000),
      aiAnalysis: (ride.aiAnalysis || '').slice(0, 5000),
      isSimulated: Boolean(ride.isSimulated),
      points: sanitizedPoints
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, ridePath);
  }
}

export async function deleteRideFromCloud(userId: string, rideId: string): Promise<void> {
  const ridePath = `users/${userId}/rides/${rideId}`;
  try {
    const docRef = doc(db, 'users', userId, 'rides', rideId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, ridePath);
  }
}
