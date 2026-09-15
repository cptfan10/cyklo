import { useEffect, useState, useCallback } from 'react';

// Screen Wake Lock API type definition
interface WakeLockSentinel extends EventTarget {
  released: boolean;
  type: 'screen';
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
  removeEventListener: (type: 'release', listener: () => void) => void;
}

export function useWakeLock(isActive: boolean = false) {
  const [isSupported, setIsSupported] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [sentinel, setSentinel] = useState<WakeLockSentinel | null>(null);

  useEffect(() => {
    setIsSupported('wakeLock' in navigator);
  }, []);

  const requestLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return false;
    try {
      const lock = await (navigator as unknown as { wakeLock: { request: (type: string) => Promise<WakeLockSentinel> } }).wakeLock.request('screen');
      setSentinel(lock);
      setIsLocked(true);

      lock.addEventListener('release', () => {
        setIsLocked(false);
        setSentinel(null);
      });
      return true;
    } catch (err) {
      console.warn('Wake Lock request failed:', err);
      setIsLocked(false);
      return false;
    }
  }, []);

  const releaseLock = useCallback(async () => {
    if (sentinel && !sentinel.released) {
      try {
        await sentinel.release();
      } catch (err) {
        console.warn('Wake Lock release failed:', err);
      }
    }
    setSentinel(null);
    setIsLocked(false);
  }, [sentinel]);

  // Handle active status changes
  useEffect(() => {
    if (isActive && isSupported && !isLocked) {
      requestLock();
    } else if (!isActive && isLocked) {
      releaseLock();
    }

    // Re-acquire lock if visibility changes (user switches back to browser tab/PWA)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isActive && !isLocked) {
        requestLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isActive, isSupported, isLocked, requestLock, releaseLock]);

  return {
    isSupported,
    isLocked,
    requestLock,
    releaseLock
  };
}
