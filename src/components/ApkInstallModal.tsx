import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  Smartphone,
  Download,
  Check,
  X,
  Sparkles,
  QrCode,
  Copy,
  ExternalLink,
  ShieldCheck,
  Zap,
  Info,
  Layers,
  CheckCircle2
} from 'lucide-react';

interface ApkInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApkInstallModal: React.FC<ApkInstallModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isSamsungBrowser, install } = usePWAInstall();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'install' | 'qrcode' | 'package'>('install');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  useEffect(() => {
    if (isOpen && canvasRef.current && currentUrl) {
      QRCode.toCanvas(
        canvasRef.current,
        currentUrl,
        {
          width: 220,
          margin: 2,
          color: {
            dark: '#0c0a09',
            light: '#f5f5f4',
          },
        },
        (error) => {
          if (error) console.error('QR code generation error:', error);
        }
      );
    }
  }, [isOpen, activeTab, currentUrl]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handlePwaBuilderRedirect = () => {
    const builderUrl = `https://www.pwabuilder.com?url=${encodeURIComponent(currentUrl)}`;
    window.open(builderUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-[800] flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-stone-900 border border-stone-800 shadow-2xl text-stone-100 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800 bg-stone-950/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-950/50">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">Instalace APK & Aplikace</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Galaxy S10+
                </span>
              </div>
              <p className="text-xs text-stone-400">Instalace do telefonu Samsung Galaxy S10+ / Android</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition cursor-pointer"
            aria-label="Zavřít"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-stone-800 bg-stone-950/30 px-3 pt-2 gap-1.5 shrink-0 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('install')}
            className={`pb-2.5 px-3 font-semibold transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'install'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Nativní WebAPK</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('qrcode')}
            className={`pb-2.5 px-3 font-semibold transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'qrcode'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>QR kód do mobilu</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('package')}
            className={`pb-2.5 px-3 font-semibold transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'package'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Stáhnout balíček & APK</span>
          </button>
        </div>

        {/* Body content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {activeTab === 'install' && (
            <div className="space-y-4">
              {/* Status Banner */}
              {isInstalled ? (
                <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center gap-3 text-emerald-200">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  <div>
                    <h3 className="font-bold text-sm text-emerald-300">Aplikace je již v telefonu nainstalována!</h3>
                    <p className="text-[11px] text-emerald-200/80 mt-0.5">
                      Běží jako samostatná aplikace na celou obrazovku vašeho Galaxy S10+ s přímým přístupem k GPS.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950/40 to-stone-900 border border-emerald-500/30 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-emerald-400" />
                        Přímá instalace do Samsung Galaxy (WebAPK)
                      </h3>
                      <p className="text-[11px] text-stone-300 mt-1 leading-relaxed">
                        Systém Android na zařízeních Samsung (Chrome i Samsung Internet) využívá technologii <strong>WebAPK</strong> – při instalaci automaticky sestaví skutečný instalační balíček <strong>.apk</strong> přímo v telefonu.
                      </p>
                    </div>
                  </div>

                  {isInstallable ? (
                    <button
                      type="button"
                      onClick={install}
                      className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition cursor-pointer"
                    >
                      <Download className="w-4 h-4 stroke-[2.5]" />
                      Nainstalovat APK do Galaxy S10+
                    </button>
                  ) : (
                    <div className="p-3 rounded-lg bg-stone-950/80 border border-stone-800 text-[11px] text-stone-300 flex items-center gap-2">
                      <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>
                        Pokud jste na počítači, otevřete aplikaci v prohlížeči v telefonu (záložka <strong>QR kód</strong>) a klepněte na <strong>Instalovat</strong>.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Instructions per browser */}
              <div className="space-y-2.5">
                <h4 className="font-semibold text-white text-xs uppercase tracking-wider text-stone-400">
                  Jak nainstalovat v prohlížeči na Galaxy S10+:
                </h4>

                <div className="p-3.5 rounded-xl bg-stone-950/70 border border-stone-800/80 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-[11px]">
                      A
                    </span>
                    <strong className="text-white">V prohlížeči Google Chrome na Androidu:</strong>
                  </div>
                  <ol className="list-decimal list-inside pl-1 text-[11px] text-stone-300 space-y-1">
                    <li>Klepněte na nabídku se <strong>třemi tečkami (⋮)</strong> v pravém horním rohu.</li>
                    <li>Zvolte možnost <strong>„Nainstalovat aplikaci”</strong> (nebo „Přidat na plochu“).</li>
                    <li>Potvrďte tlačítkem <strong>Instalovat</strong> – Android vytvoří a nainstaluje APK balíček.</li>
                  </ol>
                </div>

                <div className="p-3.5 rounded-xl bg-stone-950/70 border border-stone-800/80 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[11px]">
                      B
                    </span>
                    <strong className="text-white">V prohlížeči Samsung Internet:</strong>
                  </div>
                  <ol className="list-decimal list-inside pl-1 text-[11px] text-stone-300 space-y-1">
                    <li>Klepněte na ikonu <strong>menu (≡)</strong> v pravém dolním rohu obrazovky.</li>
                    <li>Klepněte na <strong>„Přidat stránku do“</strong> ➔ <strong>„Domovská obrazovka“</strong> (nebo ikona stahování v adresním řádku).</li>
                    <li>Aplikace se přidá s vlastní ikonou a otevře se v režimu celé obrazovky bez lišt.</li>
                  </ol>
                </div>
              </div>

              {/* Samsung S10+ Hardware benefits */}
              <div className="p-3 rounded-xl bg-stone-950/50 border border-stone-800/70 text-[11px] text-stone-300 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block mb-0.5">Výhody na Samsung Galaxy S10+:</strong>
                  Nainstalovaná aplikace využívá celých 6,4" Dynamic AMOLED displeje, Pure Dark režim zhasíná pixely pro maximální úsporu baterie a funkce Wake Lock zabrání zhasnutí displeje na řídítkách kola.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'qrcode' && (
            <div className="space-y-4 text-center">
              <p className="text-stone-300 text-xs">
                Namiřte fotoaparát vašeho <strong>Samsung Galaxy S10+</strong> na tento QR kód a otevřete aplikaci přímo v mobilu:
              </p>

              <div className="inline-block p-4 rounded-2xl bg-stone-100 shadow-xl border border-stone-300 mx-auto">
                <canvas ref={canvasRef} className="mx-auto block" />
              </div>

              <div className="flex items-center gap-2 p-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-300 max-w-md mx-auto">
                <input
                  type="text"
                  readOnly
                  value={currentUrl}
                  className="bg-transparent border-none text-[11px] text-stone-400 px-2 py-1 flex-1 truncate focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-white font-medium text-[11px] flex items-center gap-1 transition cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      Zkopírováno
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Kopírovat
                    </>
                  )}
                </button>
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-[11px] text-left flex items-start gap-2">
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <span>
                  Po otevření na Galaxy S10+ se v horní části zobrazí tlačítko <strong>„Instalovat APK“</strong>, kterým aplikaci nainstalujete jedním kliknutím přímo na domovskou obrazovku.
                </span>
              </div>
            </div>
          )}

          {activeTab === 'package' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-stone-950/70 border border-stone-800 space-y-2">
                <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-emerald-400" />
                  Stažení instalačního balíčku (.ZIP s manifestem a ikonami)
                </h4>
                <p className="text-stone-300 text-[11px] leading-relaxed">
                  Stáhněte si kompletní balíček obsahující Web App Manifest, ikony v rozlišeních 192x192, 512x512 a maskable PNG pro Android a textový návod.
                </p>
                <a
                  href="/cykloasistent-android-package.zip"
                  download="cykloasistent-android-package.zip"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs shadow-md transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Stáhnout balíček pro Android (.zip)
                </a>
              </div>

              <div className="p-3.5 rounded-xl bg-stone-950/70 border border-stone-800 space-y-2.5">
                <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                  <ExternalLink className="w-4 h-4 text-cyan-400" />
                  Přímé vygenerování samostatného souboru .APK (PWABuilder)
                </h4>
                <p className="text-stone-300 text-[11px] leading-relaxed">
                  Pokud potřebujete samostatný soubor s příponou <code>.apk</code> pro přímou ruční instalaci (sideloading) nebo distribuci:
                </p>
                <ol className="list-decimal list-inside text-[11px] text-stone-300 space-y-1 pl-1">
                  <li>Klepněte na tlačítko níže pro otevření nástroje PWABuilder (vytvořeného pro balení Android aplikací).</li>
                  <li>URL této aplikace bude automaticky načtena a zkontrolována.</li>
                  <li>Klepněte na <strong>„Generate APK”</strong> a stáhněte si hotový soubor .apk přímo do počítače či mobilu.</li>
                </ol>
                <button
                  type="button"
                  onClick={handlePwaBuilderRedirect}
                  className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-semibold text-xs flex items-center justify-center gap-2 border border-stone-700 transition cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                  Otevřít PWABuilder a vygenerovat .APK
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-800 bg-stone-950/60 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-stone-400">
            Optimalizováno pro <strong>Samsung Galaxy S10+</strong> (Android)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-semibold text-xs transition cursor-pointer"
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
};
