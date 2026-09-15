import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, Check } from 'lucide-react';
import { ApkInstallModal } from './ApkInstallModal';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);

  const handleInstallClick = async () => {
    if (isInstallable) {
      const success = await install();
      if (!success) {
        setShowModal(true);
      }
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      {isInstalled ? (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium hover:bg-emerald-500/25 transition cursor-pointer"
          title="Aplikace nainstalována na Galaxy S10+"
        >
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden xs:inline">Nainstalováno</span>
        </button>
      ) : (
        <button
          id="btn-install-apk-pwa"
          type="button"
          onClick={handleInstallClick}
          className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer shrink-0 active:scale-95"
          title="Stáhnout / Nainstalovat APK pro Samsung Galaxy S10+"
        >
          <Download className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Instalovat APK</span>
        </button>
      )}

      <ApkInstallModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
};

