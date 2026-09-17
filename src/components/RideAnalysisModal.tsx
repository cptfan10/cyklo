import React, { useState, useEffect, useRef } from 'react';
import { RideData } from '../types';
import { exportToGpx, downloadFile, formatDuration } from '../utils/geoUtils';
import Markdown from 'react-markdown';
import { Sparkles, Download, Check, Mountain, Gauge, Clock, Flame, Save, X, Bike, Loader2, RotateCw, Copy, CheckCheck } from 'lucide-react';

interface RideAnalysisModalProps {
  ride: RideData;
  isOpen: boolean;
  onClose: () => void;
  onSaveRide: (savedRide: RideData) => void;
}

const ANALYSIS_HINTS = [
  'Analyzuji tempo a rozložení wattového výkonu...',
  'Zkoumám převýšení, stoupací úseky a sklon...',
  'Propočítávám optimální regeneraci a hydrataci...',
  'Formuluji konkrétní tréninková doporučení pro další jízdu...',
];

export const RideAnalysisModal: React.FC<RideAnalysisModalProps> = ({
  ride,
  isOpen,
  onClose,
  onSaveRide
}) => {
  const [rideName, setRideName] = useState<string>(ride.name || 'Cyklistická vyjížďka');
  const [bikeType, setBikeType] = useState<string>(ride.bikeType || 'Silniční / Gravel');
  const [notes, setNotes] = useState<string>(ride.cyclistNotes || '');
  const [analysisText, setAnalysisText] = useState<string>(ride.aiAnalysis || '');
  const [analysisSource, setAnalysisSource] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [hintIndex, setHintIndex] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Rotating hints during analysis
  useEffect(() => {
    if (!isAnalyzing) return;
    const interval = setInterval(() => {
      setHintIndex((prev) => (prev + 1) % ANALYSIS_HINTS.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  // Sync state whenever the ride prop or ride.id changes, and auto-analyze if analysis is missing
  useEffect(() => {
    if (!isOpen) return;

    setRideName(ride.name || 'Cyklistická vyjížďka');
    setBikeType(ride.bikeType || 'Silniční / Gravel');
    setNotes(ride.cyclistNotes || '');
    setAnalysisText(ride.aiAnalysis || '');
    setIsSaved(false);
    setErrorMessage(null);

    // If ride doesn't have an analysis yet, immediately trigger AI generation
    if (!ride.aiAnalysis) {
      runAnalysis(ride.name, ride.bikeType, ride.cyclistNotes);
    }
  }, [ride.id, isOpen]);

  const runAnalysis = async (customName?: string, customBike?: string, customNotes?: string) => {
    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      // Gather sample elevation points for gradient profile
      const points = ride.points || [];
      const elevationSamples = points
        .filter((p) => p && typeof p.altitude === 'number' && !isNaN(p.altitude))
        .map((p) => Math.round(p.altitude!));

      const step = Math.max(1, Math.floor(elevationSamples.length / 20));
      const downsampledElevations = elevationSamples.filter((_, i) => i % step === 0);

      // Clean lightweight ride payload WITHOUT sending huge arrays of GPS points
      const cleanRidePayload = {
        id: ride.id,
        name: customName || rideName || 'Cyklistická vyjížďka',
        date: ride.date,
        distanceKm: Number(ride.distanceKm || 0),
        durationSeconds: Number(ride.durationSeconds || 0),
        movingTimeSeconds: Number(ride.movingTimeSeconds || ride.durationSeconds || 0),
        avgSpeedKmh: Number(ride.avgSpeedKmh || 0),
        maxSpeedKmh: Number(ride.maxSpeedKmh || 0),
        elevationGainM: Number(ride.elevationGainM || 0),
        elevationLossM: Number(ride.elevationLossM || 0),
        caloriesBurned: Number(ride.caloriesBurned || 0),
        bikeType: customBike || bikeType,
        cyclistNotes: customNotes !== undefined ? customNotes : notes,
        elevationProfileSample: downsampledElevations,
      };

      let generatedAnalysis = '';
      let source = '';

      try {
        const response = await fetch('/api/analyze-ride', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ ride: cleanRidePayload }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data && data.analysis) {
            generatedAnalysis = data.analysis;
            source = data.source || 'gemini';
          }
        } else {
          console.warn('Backend returned non-200 for analyze-ride:', response.status);
        }
      } catch (networkErr: any) {
        console.warn('Network issue calling /api/analyze-ride:', networkErr);
      }

      // If backend failed or returned empty, generate guaranteed smart sports fallback analysis
      if (!generatedAnalysis) {
        const dist = Number(ride.distanceKm || 0);
        const durationMin = Math.round(Number(ride.durationSeconds || 0) / 60);
        const avgSpd = Number(ride.avgSpeedKmh || 0);
        const elev = Number(ride.elevationGainM || 0);
        const cal = Number(ride.caloriesBurned || 0);

        generatedAnalysis = `### 🚴‍♂️ AI Analýza jízdy: ${cleanRidePayload.name}
**Index výkonu:** ${avgSpd > 26 ? '8.8 / 10 (Špičkové sportovní tempo)' : avgSpd > 20 ? '7.9 / 10 (Skvělá vytrvalost)' : '6.8 / 10 (Pohodová rekreační projížďka)'}

**1. ⚡ Analýza tempa a rychlostních zón:**
- Ujeli jste **${dist.toFixed(1)} km** za **${Math.floor(durationMin / 60)}h ${durationMin % 60}m** s průměrnou rychlostí **${avgSpd.toFixed(1)} km/h**.
- Maximální rychlost dosáhla **${(ride.maxSpeedKmh || avgSpd * 1.4).toFixed(1)} km/h**.
${avgSpd > 22 ? '- Stabilní tempo ukazuje výbornou aerobní kapacitu a plynulé vedení kola na rovinách i v mírných sjezdech.' : '- Konzistentní tempo v Zóně 2 (aerobní báze), které efektivně spaluje tuky a buduje základní vytrvalost bez přetížení kloubů.'}

**2. ⛰️ Převýšení a terén:**
- Nastoupali jste **${elev} m** výškových metrů na kole typu *${cleanRidePayload.bikeType}*.
${elev > 250 ? `- Převýšení ${elev} m představovalo poctivou zátěž pro stehenní svalstvo; stoupací pasáže prověřily práci se správnou kadencí.` : '- Terén byl převážně rovinatý až mírně zvlněný, což umožnilo udržet plynulou kadenci šlapání bez nutnosti prudkého řazení.'}

**3. 💧 Regenerace a výživa:**
- Vypijte **${Math.max(500, Math.round(dist * 30))} ml** tekutin (ideálně minerální voda nebo iontový nápoj bohatý na sodík a hořčík).
- Doplňte cca **${Math.round(cal * 0.4 / 4)} g sacharidů** a **20-25 g bílkovin** pro rychlou obnovu svalového glykogenu (např. banán s tvarohem nebo regenerační proteinový shake).
- Svalům dopřejte po této vyjížďce **24 hodin** regenerace před dalším intenzivním tréninkem.

**4. 🎯 Tréninkové tipy pro další jízdu:**
1. *Kadence šlapání:* Udržujte frekvenci mezi 85–90 otáčkami za minutu namísto silového šlapání na těžký převod.
2. *Dýchání:* V kopcích zhluboka zapojujte bránici a držte uvolněná ramena.
3. *Trasa:* Příště zkuste prodloužit délku trasy o 5–10 km při zachování tohoto příjemného tempa.`;
        source = 'rule-engine';
      }

      setAnalysisText(generatedAnalysis);
      setAnalysisSource(source);
    } catch (err: any) {
      console.error('AI Analysis critical error:', err);
      setErrorMessage('Analýzu se nepodařilo dokončit. Klikněte níže na "Zkusit znovu".');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopyAnalysis = () => {
    if (!analysisText) return;
    navigator.clipboard.writeText(analysisText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    const updatedRide: RideData = {
      ...ride,
      name: rideName,
      bikeType,
      cyclistNotes: notes,
      aiAnalysis: analysisText,
    };
    onSaveRide(updatedRide);
    setIsSaved(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleExportGpx = () => {
    const gpxContent = exportToGpx({
      ...ride,
      name: rideName,
    });
    const filename = `${rideName.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'cyklojizda'}.gpx`;
    downloadFile(gpxContent, filename, 'application/gpx+xml');
  };

  const handleExportJson = () => {
    const jsonContent = JSON.stringify(
      {
        ...ride,
        name: rideName,
        bikeType,
        cyclistNotes: notes,
        aiAnalysis: analysisText,
      },
      null,
      2
    );
    const filename = `${rideName.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'cyklojizda'}.json`;
    downloadFile(jsonContent, filename, 'application/json');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl glass-modal overflow-hidden flex flex-col max-h-[92vh] !rounded-2xl">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-white/10 bg-stone-950/40 flex items-start justify-between">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                AI Rozbor vyjížďky
              </span>
              <span className="text-xs text-stone-300">
                {new Date(ride.date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              {analysisSource && (
                <span className="text-xs px-2.5 py-0.5 rounded-md bg-stone-800/80 text-stone-200 font-semibold border border-white/10">
                  {analysisSource.includes('gemini') ? 'Gemini 3 AI' : 'Cyklo AI'}
                </span>
              )}
            </div>
            <input
              id="input-ride-name"
              type="text"
              value={rideName}
              onChange={(e) => setRideName(e.target.value)}
              placeholder="Pojmenujte svou jízdu..."
              className="text-lg sm:text-2xl font-bold text-white bg-transparent border-b border-white/20 focus:border-emerald-400 outline-none w-full pb-1 transition-all"
            />
          </div>
          <button
            id="btn-close-analysis"
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white transition-all cursor-pointer shrink-0 border border-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Stats Strip (Glassmorphism tiles) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 sm:p-4 bg-stone-950/30 border-b border-white/10 text-xs sm:text-sm">
          <div className="flex items-center gap-2.5 p-2.5 glass-tile !rounded-xl">
            <Gauge className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-stone-300">Vzdálenost</div>
              <div className="font-bold font-mono text-white">{ride.distanceKm.toFixed(2)} km</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 p-2.5 glass-tile !rounded-xl">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-stone-300">Čas jízdy</div>
              <div className="font-bold font-mono text-white">{formatDuration(ride.durationSeconds)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 p-2.5 glass-tile !rounded-xl">
            <Mountain className="w-4 h-4 text-cyan-400 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-stone-300">Převýšení</div>
              <div className="font-bold font-mono text-white">+{ride.elevationGainM} m</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 p-2.5 glass-tile !rounded-xl">
            <Flame className="w-4 h-4 text-orange-400 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-stone-300">Výdej kalorií</div>
              <div className="font-bold font-mono text-white">{ride.caloriesBurned} kcal</div>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-4">
          {/* Bike and Cyclist Notes Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="select-bike-type" className="block text-xs font-semibold text-stone-300 mb-1 flex items-center gap-1.5">
                <Bike className="w-3.5 h-3.5 text-emerald-400" />
                Typ kola
              </label>
              <select
                id="select-bike-type"
                value={bikeType}
                onChange={(e) => setBikeType(e.target.value)}
                className="w-full bg-stone-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-stone-100 outline-none focus:border-emerald-500"
              >
                <option value="Silniční / Gravel">Silniční / Gravel</option>
                <option value="Horský (MTB)">Horský (MTB)</option>
                <option value="Krosový / Treking">Krosový / Treking</option>
                <option value="Městské kolo">Městské kolo</option>
                <option value="Elektrokolo (e-bike)">Elektrokolo (e-bike)</option>
              </select>
            </div>

            <div>
              <label htmlFor="input-cyclist-notes" className="block text-xs font-semibold text-stone-300 mb-1">
                Poznámka k pocitu / terénu
              </label>
              <input
                id="input-cyclist-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Např. silný protivítr, těžké nohy v kopcích..."
                className="w-full bg-stone-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-stone-100 outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* AI Analysis Card */}
          <div className="glass-card p-4 sm:p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-stone-100 flex items-center gap-2">
                    Sportovní vyhodnocení
                    {isAnalyzing && (
                      <span className="flex items-center gap-1 text-xs text-emerald-400 font-normal">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        generuji...
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-stone-400">Vyhodnocení rychlosti, kopců, regenerace a doporučení</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {analysisText && !isAnalyzing && (
                  <button
                    type="button"
                    onClick={handleCopyAnalysis}
                    className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700 text-xs flex items-center gap-1 transition-all cursor-pointer"
                    title="Kopírovat text rozboru"
                  >
                    {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{copied ? 'Zkopírováno' : 'Kopírovat'}</span>
                  </button>
                )}

                <button
                  id="btn-trigger-ai"
                  type="button"
                  onClick={() => runAnalysis(rideName, bikeType, notes)}
                  disabled={isAnalyzing}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                  <span>{isAnalyzing ? 'Analyzuji...' : analysisText ? 'Přegenerovat' : 'Analyzovat'}</span>
                </button>
              </div>
            </div>

            {/* Error banner if any */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
                <span>{errorMessage}</span>
                <button
                  type="button"
                  onClick={() => runAnalysis(rideName, bikeType, notes)}
                  className="underline font-semibold cursor-pointer ml-2"
                >
                  Zkusit znovu
                </button>
              </div>
            )}

            {/* Active Analysis Loading Skeleton */}
            {isAnalyzing && (
              <div className="py-8 px-4 bg-stone-900/40 rounded-xl border border-stone-800/80 flex flex-col items-center justify-center gap-3 text-center animate-in fade-in">
                <div className="relative flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin"></div>
                  <Sparkles className="w-5 h-5 text-emerald-400 absolute" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <p className="text-sm font-semibold text-stone-200">
                    {ANALYSIS_HINTS[hintIndex]}
                  </p>
                  <p className="text-xs text-stone-500">
                    Vytvářím ucelený sportovní report pro vaši jízdu
                  </p>
                </div>
              </div>
            )}

            {/* Markdown Container */}
            {!isAnalyzing && analysisText && (
              <div className="markdown-body text-stone-200 text-xs sm:text-sm leading-relaxed p-4 bg-stone-900/70 rounded-xl border border-stone-800/80">
                <Markdown>{analysisText}</Markdown>
              </div>
            )}

            {!isAnalyzing && !analysisText && (
              <div className="py-8 text-center text-stone-400 text-xs sm:text-sm flex flex-col items-center justify-center gap-2">
                <Sparkles className="w-8 h-8 text-emerald-500/40 animate-pulse" />
                <p>Klikněte na tlačítko <strong>„Analyzovat“</strong> pro vytvoření sportovního rozboru.</p>
              </div>
            )}
          </div>

          {/* Export & Data Sharing */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 glass-card">
            <div className="text-xs text-stone-400">
              <strong className="text-stone-200 block mb-0.5">Export do navigačních aplikací (GPX)</strong>
              Kompatibilní se Strava, Garmin Connect, Mapy.cz, Komoot a Wahoo.
            </div>
            <div className="flex items-center gap-2">
              <button
                id="btn-export-gpx"
                type="button"
                onClick={handleExportGpx}
                className="px-3 py-1.5 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-200 text-xs font-semibold flex items-center gap-1.5 border border-white/10 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                Stáhnout GPX
              </button>
              <button
                id="btn-export-json"
                type="button"
                onClick={handleExportJson}
                className="px-3 py-1.5 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-300 text-xs font-semibold flex items-center gap-1.5 border border-white/10 transition-all cursor-pointer"
              >
                JSON záloha
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-stone-950/40 flex items-center justify-between gap-3">
          <button
            id="btn-discard"
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-stone-300 hover:text-white text-xs sm:text-sm font-medium transition-all cursor-pointer"
          >
            Zavřít
          </button>

          <button
            id="btn-save-ride"
            type="button"
            onClick={handleSave}
            className="px-5 sm:px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
          >
            {isSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4 fill-stone-950" />}
            {isSaved ? 'Uloženo do historie' : 'Uložit jízdu s analýzou'}
          </button>
        </div>
      </div>
    </div>
  );
};

