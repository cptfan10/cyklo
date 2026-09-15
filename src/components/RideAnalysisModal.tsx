import React, { useState } from 'react';
import { RideData } from '../types';
import { exportToGpx, downloadFile, formatDuration } from '../utils/geoUtils';
import Markdown from 'react-markdown';
import { Sparkles, Download, Check, Mountain, Gauge, Clock, Flame, Save, X, Share2, Bike } from 'lucide-react';

interface RideAnalysisModalProps {
  ride: RideData;
  isOpen: boolean;
  onClose: () => void;
  onSaveRide: (savedRide: RideData) => void;
}

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
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'analysis' | 'stats'>('analysis');

  if (!isOpen) return null;

  const handleGenerateAiAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      // Gather sample elevation points for the AI to analyze gradient profile
      const elevationSamples = ride.points
        .filter((p) => p.altitude !== undefined)
        .map((p) => Math.round(p.altitude!));

      const step = Math.max(1, Math.floor(elevationSamples.length / 20));
      const downsampledElevations = elevationSamples.filter((_, i) => i % step === 0);

      let generatedAnalysis = '';

      try {
        const response = await fetch('/api/analyze-ride', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            ride: {
              ...ride,
              name: rideName,
              bikeType,
              cyclistNotes: notes,
              elevationProfileSample: downsampledElevations,
            }
          }),
        });

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await response.json();
          if (data && data.analysis) {
            generatedAnalysis = data.analysis;
          }
        }
      } catch (err: any) {
        console.warn('Network issue during ride analysis:', err);
      }

      if (!generatedAnalysis) {
        const dist = Number(ride.distanceKm || 0);
        const durationMin = Math.round(Number(ride.durationSeconds || 0) / 60);
        const avgSpd = Number(ride.avgSpeedKmh || 0);
        const elev = Number(ride.elevationGainM || 0);
        const cal = Number(ride.caloriesBurned || 0);

        generatedAnalysis = `### 🚴‍♂️ Analýza jízdy: ${rideName || "Cyklistická trasa"}
**Základní přehled:**
- **Vzdálenost:** ${dist.toFixed(1)} km
- **Čas jízdy:** ${Math.floor(durationMin / 60)}h ${durationMin % 60}m
- **Průměrná rychlost:** ${avgSpd.toFixed(1)} km/h
- **Nastoupané metry:** ${elev} m
- **Spálené kalorie:** cca ${cal} kcal

**Zhodnocení tempa a výkonu:**
${avgSpd > 25 ? "Velmi svižné sportovní tempo! Váš výkon odpovídá pokročilému tréninkovému zatížení." : avgSpd > 18 ? "Příjemné vytrvalostní tempo v aerobním pásmu, ideální pro budování kardio kondice a spalování tuků." : "Pohodová rekreační projížďka s důrazem na regeneraci a techniku šlapání."}

**Terén a převýšení:**
${elev > 300 ? `Významné převýšení (${elev} m) prověřilo sílu nohou a hospodaření se silami ve stoupáních.` : "Plynulý rovinatější profil umožňoval udržet stabilní kadenci šlapání."}

**Doporučení pro regeneraci:**
1. Doplňte cca ${Math.round(dist * 25)} ml tekutin s elektrolyty a lehké sacharidy s proteiny do 45 minut.
2. Dopřejte nohám lehké protažení kvadricepsů a lýtek.
3. Pro další trénink doporučujeme ${elev > 300 ? "lehkou regenerační vyjížďku po rovině" : "postupné navýšení délky trasy o 10-15 %"}.`;
      }

      setAnalysisText(generatedAnalysis);
    } catch (err: any) {
      console.error('AI Analysis failed:', err);
      setAnalysisText('Analýzu se nepodařilo dokončit. Zkontrolujte připojení.');
    } finally {
      setIsAnalyzing(false);
    }
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
    }, 800);
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

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-stone-800 bg-stone-950/60 flex items-start justify-between">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
                Dokončená trasa
              </span>
              <span className="text-xs text-stone-400">
                {new Date(ride.date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
            <input
              id="input-ride-name"
              type="text"
              value={rideName}
              onChange={(e) => setRideName(e.target.value)}
              placeholder="Pojmenujte svou jízdu..."
              className="text-xl sm:text-2xl font-bold text-white bg-transparent border-b border-stone-700/60 focus:border-emerald-500 outline-none w-full pb-1 transition-all"
            />
          </div>
          <button
            id="btn-close-analysis"
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 bg-stone-950/30 border-b border-stone-800/80 text-xs sm:text-sm">
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-stone-800/40">
            <Gauge className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <div className="text-[11px] text-stone-400">Vzdálenost</div>
              <div className="font-bold text-stone-100">{ride.distanceKm.toFixed(2)} km</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-stone-800/40">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <div className="text-[11px] text-stone-400">Čas jízdy</div>
              <div className="font-bold text-stone-100">{formatDuration(ride.durationSeconds)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-stone-800/40">
            <Mountain className="w-4 h-4 text-cyan-400 shrink-0" />
            <div>
              <div className="text-[11px] text-stone-400">Převýšení</div>
              <div className="font-bold text-stone-100">+{ride.elevationGainM} m</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-stone-800/40">
            <Flame className="w-4 h-4 text-orange-400 shrink-0" />
            <div>
              <div className="text-[11px] text-stone-400">Výdej kalorií</div>
              <div className="font-bold text-stone-100">{ride.caloriesBurned} kcal</div>
            </div>
          </div>
        </div>

        {/* Content Body with Tabs */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 flex flex-col gap-5">
          {/* Bike and Cyclist Notes Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="select-bike-type" className="block text-xs font-semibold text-stone-400 mb-1 flex items-center gap-1.5">
                <Bike className="w-3.5 h-3.5 text-emerald-400" />
                Typ kola
              </label>
              <select
                id="select-bike-type"
                value={bikeType}
                onChange={(e) => setBikeType(e.target.value)}
                className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-sm text-stone-200 outline-none focus:border-emerald-500"
              >
                <option value="Silniční / Gravel">Silniční / Gravel</option>
                <option value="Horský (MTB)">Horský (MTB)</option>
                <option value="Krosový / Treking">Krosový / Treking</option>
                <option value="Městské kolo">Městské kolo</option>
                <option value="Elektrokolo (e-bike)">Elektrokolo (e-bike)</option>
              </select>
            </div>

            <div>
              <label htmlFor="input-cyclist-notes" className="block text-xs font-semibold text-stone-400 mb-1">
                Poznámka k pocitu / terénu
              </label>
              <input
                id="input-cyclist-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Např. silný protivítr, těžké nohy..."
                className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-sm text-stone-200 outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* AI Analysis Section */}
          <div className="bg-stone-950/70 border border-stone-800 rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-stone-100">AI Cyklistická Analýza</h3>
                  <p className="text-xs text-stone-400">Vyhodnocení tempa, stoupání, regenerace a tréninková doporučení</p>
                </div>
              </div>

              <button
                id="btn-trigger-ai"
                type="button"
                onClick={handleGenerateAiAnalysis}
                disabled={isAnalyzing}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-stone-950 font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 fill-stone-950" />
                {isAnalyzing ? 'Analyzuji trasu...' : analysisText ? 'Přegenerovat analýzu' : 'Analyzovat jízdu'}
              </button>
            </div>

            {/* Markdown Container */}
            {analysisText ? (
              <div className="markdown-body text-stone-200 text-sm leading-relaxed p-4 bg-stone-900/60 rounded-xl border border-stone-800/80">
                <Markdown>{analysisText}</Markdown>
              </div>
            ) : (
              <div className="py-6 text-center text-stone-400 text-xs sm:text-sm flex flex-col items-center justify-center gap-2">
                <Sparkles className="w-8 h-8 text-emerald-500/40 animate-pulse" />
                <p>Klikněte na tlačítko <strong>„Analyzovat jízdu“</strong> pro získání kompletního sportovního rozboru od AI asistenta.</p>
              </div>
            )}
          </div>

          {/* Export & Data Sharing */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-stone-950/40 border border-stone-800 rounded-2xl">
            <div className="text-xs text-stone-400">
              <strong className="text-stone-300 block mb-0.5">Export trasy (veřejný standard GPX)</strong>
              Kompatibilní se Strava, Garmin Connect, Mapy.cz, Komoot a Wahoo.
            </div>
            <div className="flex items-center gap-2">
              <button
                id="btn-export-gpx"
                type="button"
                onClick={handleExportGpx}
                className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold flex items-center gap-1.5 border border-stone-700 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                Stáhnout GPX
              </button>
              <button
                id="btn-export-json"
                type="button"
                onClick={handleExportJson}
                className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold flex items-center gap-1.5 border border-stone-700 transition-all cursor-pointer"
              >
                JSON záloha
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-stone-800 bg-stone-950/90 flex items-center justify-between gap-3">
          <button
            id="btn-discard"
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-stone-400 hover:text-stone-200 text-sm font-medium transition-all cursor-pointer"
          >
            Zavřít
          </button>

          <button
            id="btn-save-ride"
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
          >
            {isSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4 fill-stone-950" />}
            {isSaved ? 'Uloženo do historie' : 'Uložit jízdu s analýzou'}
          </button>
        </div>
      </div>
    </div>
  );
};
