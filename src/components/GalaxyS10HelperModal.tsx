import React, { useState } from 'react';
import { Smartphone, HelpCircle, X, BatteryCharging, Sun, ShieldCheck, Download } from 'lucide-react';

export const GalaxyS10HelperModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        id="btn-samsung-helper"
        type="button"
        onClick={() => setIsOpen(true)}
        className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-stone-800/90 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700 text-xs flex items-center gap-1.5 transition-all cursor-pointer"
        title="Optimalizace pro Samsung Galaxy S10+"
      >
        <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
        <span className="hidden md:inline font-medium">Galaxy S10+</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-stone-900 border border-stone-800 p-5 shadow-2xl text-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">Samsung Galaxy S10+ Režim</h3>
                  <p className="text-[11px] text-stone-400">Nastavení pro jízdu na kole na řídítkách</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 space-y-3 text-xs text-stone-300 max-h-[60vh] overflow-y-auto pr-1">
              <div className="bg-stone-950/70 p-3 rounded-xl border border-stone-800 flex items-start gap-2.5">
                <Sun className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block mb-0.5">Trvalé rozsvícení displeje (Wake Lock):</strong>
                  Při zapnutí funkce <em>„Stále svítit“</em> v dolní liště displej vašeho Galaxy S10+ nezhasne ani po minutách jízdy. Vždy vidíte tachometr a mapu.
                </div>
              </div>

              <div className="bg-stone-950/70 p-3 rounded-xl border border-stone-800 flex items-start gap-2.5">
                <BatteryCharging className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block mb-0.5">AMOLED Pure Dark šetří baterii:</strong>
                  Rozhraní aplikace je navrženo ve tmavém tónu (Stone 950 / Black), což na Dynamic AMOLED displeji S10+ vypíná jednotlivé pixely a výrazně prodlužuje výdrž baterie na dlouhých vyjížďkách.
                </div>
              </div>

              <div className="bg-stone-950/70 p-3 rounded-xl border border-stone-800 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block mb-0.5">Ovládání i v cyklistických rukavicích:</strong>
                  Všechna tlačítka mají zvětšenou dotykovou plochu (50 px) a haptickou odezvu při stisknutí.
                </div>
              </div>

              <div className="bg-stone-950/70 p-3 rounded-xl border border-stone-800 flex items-start gap-2.5">
                <Download className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block mb-0.5">Jak nainstalovat jako nativní aplikaci:</strong>
                  Klepněte na tlačítko <em>„Instalovat”</em> v horní liště nebo v menu Samsung Internet / Chrome zvolte <em>„Přidat na plochu”</em>. Aplikace se spustí bez adresního řádku přes celých 6,4" obrazovky.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs transition cursor-pointer"
            >
              Rozumím a zpět do jízdy
            </button>
          </div>
        </div>
      )}
    </>
  );
};
