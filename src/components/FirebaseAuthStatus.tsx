import React, { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, loginWithGoogle, logoutUser } from '../firebase';
import { Cloud, CloudCheck, LogIn, LogOut, User as UserIcon, X, ShieldCheck } from 'lucide-react';

interface FirebaseAuthStatusProps {
  onUserChanged?: (user: User | null) => void;
}

export function FirebaseAuthStatus({ onUserChanged }: FirebaseAuthStatusProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (onUserChanged) {
        onUserChanged(currentUser);
      }
    });

    return () => unsubscribe();
  }, [onUserChanged]);

  const handleLogin = async () => {
    setAuthError(null);
    try {
      await loginWithGoogle();
      setIsModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Přihlášení se nezdařilo.';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError(msg);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      setIsModalOpen(false);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Odhlášení se nezdařilo.');
    }
  };

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-xl glass-tile flex items-center justify-center animate-pulse">
        <Cloud className="w-4 h-4 text-stone-400" />
      </div>
    );
  }

  return (
    <>
      {user ? (
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl glass-tile-interactive !rounded-xl !border-emerald-500/30 text-xs text-stone-200 cursor-pointer shadow-sm transition group"
          title={`Přihlášen jako ${user.displayName || user.email} (Firebase Cloud aktivní)`}
        >
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'Uživatel'}
              className="w-5 h-5 rounded-full border border-emerald-400 object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold">
              {user.displayName ? user.displayName.charAt(0).toUpperCase() : <UserIcon className="w-3 h-3" />}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="max-w-[80px] sm:max-w-[110px] truncate text-[11px] font-semibold text-white">
              {user.displayName ? user.displayName.split(' ')[0] : 'Účet'}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          </div>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl glass-tile-interactive !rounded-xl !border-cyan-500/30 text-xs font-semibold text-cyan-300 hover:text-white cursor-pointer shadow-sm transition shrink-0"
          title="Přihlásit se přes Google pro Firebase synchronizaci"
        >
          <Cloud className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Firebase Cloud</span>
          <span className="sm:hidden">Cloud</span>
        </button>
      )}

      {/* Cloud Account & Firebase Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md glass-modal p-5 shadow-2xl text-stone-100 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">Firebase Cloud Synchronizace</h3>
                  <p className="text-[11px] text-stone-300">Google Firestore & Zabezpečené ukládání tras</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800/80 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs">
                {authError}
              </div>
            )}

            {user ? (
              <div className="space-y-4">
                <div className="glass-tile p-4 flex items-center gap-3.5">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Profil'}
                      className="w-12 h-12 rounded-full border-2 border-emerald-400 object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg">
                      {user.displayName ? user.displayName.charAt(0).toUpperCase() : <UserIcon className="w-6 h-6" />}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-bold text-white truncate">{user.displayName || 'Cyklista'}</h4>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-[10px] text-emerald-400 font-bold">
                        Aktivní
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 truncate">{user.email}</p>
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-emerald-400">
                      <CloudCheck className="w-3.5 h-3.5" />
                      <span>Trasy se automaticky ukládají do Firestore</span>
                    </div>
                  </div>
                </div>

                <div className="glass-card p-3 space-y-2 text-xs text-stone-300">
                  <div className="flex items-center gap-2 text-stone-200">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Region databáze: <strong>europe-west1</strong></span>
                  </div>
                  <p className="text-[11px] text-stone-400">
                    Vaše dokončené jízdy, GPS souřadnice a analýzy AI asistenta jsou bezpečně šifrovány a synchronizovány v reálném čase. K trasám máte přístup jak na mobilu na kole, tak z jakéhokoliv prohlížeče.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex-1 py-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    Odhlásit se
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl bg-stone-800/90 hover:bg-stone-700 border border-white/10 text-white font-bold text-xs transition cursor-pointer"
                  >
                    Zavřít
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="glass-tile p-4 text-xs text-stone-300 space-y-2.5">
                  <div className="flex items-center gap-2 text-white font-bold">
                    <Cloud className="w-4 h-4 text-cyan-400" />
                    <span>Synchronizace tras do cloudu</span>
                  </div>
                  <p className="text-stone-300 leading-relaxed text-[11px]">
                    Přihlaste se přes Google účet a aktivujte automatické zálohování a synchronizaci:
                  </p>
                  <ul className="space-y-1.5 text-[11px] text-stone-300 list-disc list-inside">
                    <li>Trvalé uložení všech vašich najetých tras i AI analýz</li>
                    <li>Synchronizace mezi telefonem na řídítkách (Galaxy S10+) a počítačem</li>
                    <li>Bezpečné úložiště Firestore v evropském datacentru (europe-west1)</li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={handleLogin}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-stone-950 font-bold text-xs flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-500/20 transition cursor-pointer"
                >
                  <LogIn className="w-4 h-4 stroke-[2.5]" />
                  <span>Přihlásit se přes Google (Firebase)</span>
                </button>

                <p className="text-[10px] text-stone-400 text-center">
                  Využívá zabezpečené Google Firebase ověření přes popup okno.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
