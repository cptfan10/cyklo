import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, Check, X, Sparkles } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isSamsungBrowser, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // If already running as an installed standalone app, hide
  if (isInstalled) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium">
        <Check className="w-3.5 h-3.5 text-emerald-400" />
        <span>Galaxy S10+ App</span>
      </div>
    );
  }

  // Native Android/Chrome install prompt flow
  if (isInstallable) {
    return (
      <button
        id="btn-install-pwa"
        type="button"
        onClick={install}
        className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer shrink-0"
        title="Nainstalovat na plochu telefonu"
      >
        <Download className="w-3.5 h-3.5 stroke-[2.5]" />
        <span className="hidden xs:inline">Instalovat</span>
      </button>
    );
  }

  // Fallback banner for Samsung Internet / Chrome if prompt not fired yet or manual
  return (
    <>
      <button
        id="btn-install-guide"
        type="button"
        onClick={() => setShowGuide(true)}
        className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
        title="Instalace na Samsung Galaxy"
      >
        <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
        <span className="hidden xs:inline">Do mobilu</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-stone-900 border border-stone-800 p-5 shadow-2xl text-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Instalace na Galaxy S10+</h3>
                  <p className="text-[11px] text-stone-400">Přidat ikonu na domovskou obrazovku</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 space-y-3 text-xs text-stone-300">
              <div className="bg-stone-950/60 p-3 rounded-xl border border-stone-800/80 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">1</span>
                <div>
                  <strong className="text-white block mb-0.5">V prohlížeči (Chrome / Samsung Internet):</strong>
                  Klepněte na nabídku se <strong>třemi tečkami (⋮)</strong> vpravo nahoře nebo na ikonu nabídky dole.
                </div>
              </div>

              <div className="bg-stone-950/60 p-3 rounded-xl border border-stone-800/80 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">2</span>
                <div>
                  <strong className="text-white block mb-0.5">Zvolte instalaci:</strong>
                  Vyberte <strong>„Přidat na plochu”</strong> nebo <strong>„Nainstalovat aplikaci”</strong>.
                </div>
              </div>

              <div className="bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-500/30 text-[11px] text-emerald-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>Aplikace poběží přes celou AMOLED obrazovku Galaxy S10+ bez lišt prohlížeče!</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs transition cursor-pointer"
            >
              Rozumím
            </button>
          </div>
        </div>
      )}
    </>
  );
};
