import React from 'react';
import { Sun, SunDim } from 'lucide-react';

interface WakeLockToggleProps {
  isLocked: boolean;
  isSupported: boolean;
  onToggle: () => void;
}

export const WakeLockToggle: React.FC<WakeLockToggleProps> = ({ isLocked, isSupported, onToggle }) => {
  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      title={isLocked ? 'Displej zůstává stále zapnutý (ideální na řídítka)' : 'Displej se může uspat'}
      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
        isLocked
          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
          : 'bg-stone-800 text-stone-400 border-stone-700 hover:text-stone-300'
      }`}
    >
      {isLocked ? (
        <>
          <Sun className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
          <span>Stále svítit</span>
        </>
      ) : (
        <>
          <SunDim className="w-3.5 h-3.5" />
          <span>Auto-uspání</span>
        </>
      )}
    </button>
  );
};
