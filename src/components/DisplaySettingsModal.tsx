import React, { useState } from 'react';
import {
  Sliders,
  Sun,
  Smartphone,
  ShieldCheck,
  Zap,
  Moon,
  Sparkles,
  Gauge,
  Vibrate,
  Palette,
  Type,
  Maximize2,
  X,
  RotateCcw,
  Check,
  Download,
  Info
} from 'lucide-react';
import {
  DisplaySettings,
  DisplayContrastMode,
  DisplayTypography,
  TextScale,
  TouchTargetSize,
  MetricColorTheme,
  SpeedometerSize,
  DisplayPresetId
} from '../types';
import { DISPLAY_PRESETS } from '../hooks/useDisplaySettings';
import { ApkInstallModal } from './ApkInstallModal';

interface DisplaySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: DisplaySettings;
  onUpdateSettings: (partial: Partial<Omit<DisplaySettings, 'activePreset'>>) => void;
  onApplyPreset: (presetId: Exclude<DisplayPresetId, 'custom'>) => void;
  onTriggerHaptic: (pattern?: number | number[]) => void;
}

export const DisplaySettingsModal: React.FC<DisplaySettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onApplyPreset,
  onTriggerHaptic,
}) => {
  const [activeTab, setActiveTab] = useState<'presets' | 'custom' | 'device'>('presets');
  const [showApkModal, setShowApkModal] = useState(false);
  const [vibrationSuccess, setVibrationSuccess] = useState(false);

  if (!isOpen) return null;

  const handleTestVibrate = () => {
    onTriggerHaptic([50, 80, 50]);
    setVibrationSuccess(true);
    setTimeout(() => setVibrationSuccess(false), 1500);
  };

  // Preview styling helpers
  const getPreviewTypoClass = () => {
    switch (settings.typography) {
      case 'bernard-mt':
        return 'font-bernard-mt';
      case 'dot-matrix':
        return 'font-dot-matrix';
      case 'bold-sans':
        return 'font-bold-sans';
      case 'sports-mono':
      default:
        return 'font-sports-mono';
    }
  };

  const getPreviewColorClass = () => {
    switch (settings.metricColorTheme) {
      case 'cyan':
        return 'text-cyan-400';
      case 'amber':
        return 'text-amber-400';
      case 'white':
        return 'text-white';
      case 'emerald':
      default:
        return 'text-emerald-400';
    }
  };

  const getPreviewBgClass = () => {
    switch (settings.contrastMode) {
      case 'amoled-pure-black':
        return 'bg-black border-stone-800';
      case 'high-contrast-sun':
        return 'bg-black border-2 border-white/80 shadow-[0_0_20px_rgba(255,255,255,0.15)]';
      case 'oled-night':
        return 'bg-[#0a0302] border-amber-900/60';
      case 'slate-glass':
      default:
        return 'glass-tile border-white/10';
    }
  };

  return (
    <div className="fixed inset-0 z-[850] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl glass-modal text-stone-100 flex flex-col max-h-[92vh] overflow-hidden !rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-stone-950/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 shadow-lg shadow-cyan-950/50">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Nastavení displeje & AMOLED</h3>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-xs font-bold text-cyan-300">
                  Všechny modely
                </span>
              </div>
              <p className="text-xs text-stone-300">
                Přizpůsobení kontrastu, typografie a velikosti tlačítek pro rukavice
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800/80 transition cursor-pointer"
            aria-label="Zavřít"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Preview Banner */}
        <div className="px-4 py-3 bg-stone-950/80 border-b border-white/10 shrink-0">
          <div className="flex items-center justify-between text-xs text-stone-300 font-semibold mb-1.5">
            <span>ŽIVÝ NÁHLED VYBRANÉHO VZHLEDU:</span>
            <span className="font-bold text-cyan-300">
              {settings.activePreset !== 'custom'
                ? DISPLAY_PRESETS[settings.activePreset]?.name || 'Předvolba'
                : 'Vlastní individuální nastavení'}
            </span>
          </div>

          <div
            className={`p-3.5 rounded-xl flex items-center justify-between transition-all duration-200 ${getPreviewBgClass()}`}
          >
            <div className="flex items-baseline gap-2">
              <span
                className={`font-black leading-none ${getPreviewTypoClass()} ${getPreviewColorClass()} ${
                  settings.speedometerSize === 'giant' ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl'
                }`}
              >
                29.4
              </span>
              <span className="text-xs font-bold text-stone-300 uppercase">km/h</span>
            </div>

            <div className="flex items-center gap-2">
              <div
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 ${
                  settings.touchTargetSize === 'heavy-glove-60'
                    ? 'min-h-[44px] px-4 text-sm'
                    : settings.touchTargetSize === 'glove-50'
                    ? 'min-h-[38px] px-3 text-xs'
                    : 'min-h-[32px] px-2.5 text-xs'
                } ${
                  settings.contrastMode === 'high-contrast-sun'
                    ? 'bg-white text-black border-white'
                    : 'bg-stone-800/90 text-white border-white/20'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {settings.touchTargetSize === 'heavy-glove-60'
                    ? 'Rukavice 60px'
                    : settings.touchTargetSize === 'glove-50'
                    ? 'Rukavice 50px'
                    : 'Standard 44px'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-stone-950/40 px-3 pt-2 gap-1.5 shrink-0 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`px-3.5 py-2 font-bold rounded-t-xl transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'presets'
                ? 'bg-stone-900 text-cyan-300 border-t border-x border-white/10'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Předvolby zobrazení</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={`px-3.5 py-2 font-bold rounded-t-xl transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'custom'
                ? 'bg-stone-900 text-cyan-300 border-t border-x border-white/10'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Individuální nastavení</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('device')}
            className={`px-3.5 py-2 font-bold rounded-t-xl transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'device'
                ? 'bg-stone-900 text-cyan-300 border-t border-x border-white/10'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Galaxy S10+ & Telefon</span>
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto max-h-[58vh] space-y-5 text-xs text-stone-200">
          {/* TAB 1: PRESETS */}
          {activeTab === 'presets' && (
            <div className="space-y-3">
              <div className="text-xs text-stone-300 flex items-center justify-between">
                <span>Vyberte předkonfigurovaný profil nebo jej níže upravte:</span>
                <span className="text-xs font-semibold text-cyan-400">Okamžitá aplikace</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(Object.entries(DISPLAY_PRESETS) as [Exclude<DisplayPresetId, 'custom'>, typeof DISPLAY_PRESETS['galaxy-s10']][]).map(
                  ([id, preset]) => {
                    const isSelected = settings.activePreset === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          onApplyPreset(id);
                          onTriggerHaptic(30);
                        }}
                        className={`p-3.5 rounded-xl text-left border transition-all cursor-pointer relative flex flex-col justify-between ${
                          isSelected
                            ? 'bg-cyan-950/40 border-cyan-400 shadow-lg shadow-cyan-950/60 ring-1 ring-cyan-400'
                            : 'glass-card hover:border-white/20'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-sm text-white flex items-center gap-1.5">
                              {id === 'bernard-classic' && <Type className="w-4 h-4 text-amber-400" />}
                              {id === 'galaxy-s10' && <Smartphone className="w-4 h-4 text-emerald-400" />}
                              {id === 'outdoor-sun' && <Sun className="w-4 h-4 text-amber-400" />}
                              {id === 'gloves-winter' && <ShieldCheck className="w-4 h-4 text-orange-400" />}
                              {id === 'digital-led' && <Gauge className="w-4 h-4 text-cyan-400" />}
                              {id === 'night-ride' && <Moon className="w-4 h-4 text-amber-500" />}
                              {id === 'slate-glass' && <Sparkles className="w-4 h-4 text-teal-400" />}
                              {preset.name}
                            </span>
                            {isSelected && (
                              <span className="w-5 h-5 rounded-full bg-cyan-400 text-stone-950 flex items-center justify-center shrink-0">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-stone-300 line-clamp-2 leading-relaxed">
                            {preset.description}
                          </p>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center gap-2 text-xs font-semibold text-stone-300">
                          <span className="px-2 py-0.5 rounded bg-stone-900 border border-white/10">
                            {preset.settings.touchTargetSize === 'heavy-glove-60'
                              ? '60 px tlačítka'
                              : preset.settings.touchTargetSize === 'glove-50'
                              ? '50 px tlačítka'
                              : '44 px tlačítka'}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-stone-900 border border-white/10">
                            {preset.settings.typography === 'bernard-mt'
                              ? 'Bernard MT'
                              : preset.settings.typography === 'dot-matrix'
                              ? 'Dot-Matrix LED'
                              : preset.settings.typography === 'sports-mono'
                              ? 'Sports Mono'
                              : 'Bold Sans'}
                          </span>
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          )}

          {/* TAB 2: INDIVIDUAL CUSTOMIZATION */}
          {activeTab === 'custom' && (
            <div className="space-y-4">
              {/* 1. Kontrast & AMOLED režim */}
              <div className="glass-tile p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Sun className="w-4 h-4 text-amber-400" />
                    Režim kontrastu displeje
                  </span>
                  <span className="text-xs text-stone-300">Šetření baterie & Čitelnost</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'amoled-pure-black', label: 'AMOLED Pure Black', desc: 'Vypnuté pixely (#000)' },
                    { id: 'high-contrast-sun', label: 'Přímé slunce', desc: 'Max kontrast & obrysy' },
                    { id: 'slate-glass', label: 'Břidlicové sklo', desc: 'Matný tmavý blur' },
                    { id: 'oled-night', label: 'Noční OLED', desc: 'Ochrana zraku v noci' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => {
                        onUpdateSettings({ contrastMode: mode.id as DisplayContrastMode });
                        onTriggerHaptic(20);
                      }}
                      className={`p-2.5 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                        settings.contrastMode === mode.id
                          ? 'bg-cyan-950/40 border-cyan-400 text-white shadow-sm ring-1 ring-cyan-400'
                          : 'bg-stone-900/60 border-white/10 text-stone-300 hover:border-white/20'
                      }`}
                    >
                      <span className="font-bold text-xs sm:text-sm">{mode.label}</span>
                      <span className="text-xs text-stone-300 mt-1">{mode.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Velikost písma a slov (Čitelnost textu za jízdy) */}
              <div className="glass-tile p-3.5 space-y-2.5 !border-emerald-500/40">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Maximize2 className="w-4 h-4 text-emerald-400" />
                    Velikost písma a slov (Čitelnost textu)
                  </span>
                  <span className="text-xs font-bold text-emerald-400">
                    {settings.textScale === 'extra-large'
                      ? 'Extra velké (130%)'
                      : settings.textScale === 'large'
                      ? 'Zvětšené (115%)'
                      : 'Standardní (100%)'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    {
                      id: 'standard',
                      label: 'Standardní text (100%)',
                      desc: 'Běžná velikost písmen a slov pro prohlížení zblízka',
                      tag: 'Základní',
                    },
                    {
                      id: 'large',
                      label: 'Zvětšené písmo (115%)',
                      desc: 'Zřetelně větší slova, čísla i popisky bez mhouření očí',
                      tag: 'Doporučeno',
                    },
                    {
                      id: 'extra-large',
                      label: 'Extra velká slova (130%)',
                      desc: 'Masivní čitelnost pro řídítka, vibrace v terénu a slunce',
                      tag: 'Pro řídítka',
                    },
                  ].map((scale) => (
                    <button
                      key={scale.id}
                      type="button"
                      onClick={() => {
                        onUpdateSettings({ textScale: scale.id as TextScale });
                        onTriggerHaptic([30, 30]);
                      }}
                      className={`p-3 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                        settings.textScale === scale.id
                          ? 'bg-emerald-950/40 border-emerald-400 text-white ring-1 ring-emerald-400 shadow-md'
                          : 'bg-stone-900/60 border-white/10 text-stone-200 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-extrabold text-sm text-white">{scale.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          settings.textScale === scale.id
                            ? 'bg-emerald-500/30 text-emerald-300'
                            : 'bg-stone-800 text-stone-400'
                        }`}>
                          {scale.tag}
                        </span>
                      </div>
                      <span className="text-xs text-stone-300 leading-snug">{scale.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Typografický styl tachometru & metrik */}
              <div className="glass-tile p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Type className="w-4 h-4 text-cyan-400" />
                    Styl písma tachometru a metrik
                  </span>
                  <span className="text-xs font-semibold text-stone-300">Typografický vzor</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    {
                      id: 'bernard-mt',
                      label: 'Bernard MT',
                      sub: 'Klasický výrazný serif',
                      sample: '32.5',
                      fontCls: 'font-bernard-mt',
                    },
                    {
                      id: 'dot-matrix',
                      label: 'Tečkovaný LED',
                      sub: 'Dot-Matrix LED styl',
                      sample: '32.5',
                      fontCls: 'font-dot-matrix',
                    },
                    {
                      id: 'sports-mono',
                      label: 'Sportovní Mono',
                      sub: 'Přesné číslice',
                      sample: '32.5',
                      fontCls: 'font-sports-mono',
                    },
                    {
                      id: 'bold-sans',
                      label: 'Ultra Bold Sans',
                      sub: 'Čistý tučný styl',
                      sample: '32.5',
                      fontCls: 'font-bold-sans',
                    },
                  ].map((typo) => (
                    <button
                      key={typo.id}
                      type="button"
                      onClick={() => {
                        onUpdateSettings({ typography: typo.id as DisplayTypography });
                        onTriggerHaptic(20);
                      }}
                      className={`p-2.5 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                        settings.typography === typo.id
                          ? 'bg-amber-950/40 border-amber-400 text-white ring-1 ring-amber-400'
                          : 'bg-stone-900/60 border-white/10 text-stone-300 hover:border-white/20'
                      }`}
                    >
                      <span className="font-bold text-xs sm:text-sm">{typo.label}</span>
                      <span className="text-xs text-stone-300 mt-0.5">{typo.sub}</span>
                      <span className={`text-xl font-bold mt-2 ${settings.typography === typo.id ? 'text-amber-300' : 'text-cyan-300'} ${typo.fontCls}`}>{typo.sample}</span>
                    </button>
                  ))}
                </div>

                {/* Global UI Font Theme Toggle */}
                <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-white block">
                      Aplikovat Bernard MT na celou aplikaci
                    </span>
                    <span className="text-xs text-stone-300">
                      Použije styl písma Bernard MT pro hlavní nadpisy, navigační tlačítka a karty trasy
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateSettings({
                        uiFontTheme: settings.uiFontTheme === 'bernard-mt' ? 'default' : 'bernard-mt',
                      });
                      onTriggerHaptic(25);
                    }}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      settings.uiFontTheme === 'bernard-mt'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-sm'
                        : 'bg-stone-900 border-white/15 text-stone-400 hover:text-white'
                    }`}
                  >
                    <Check className={`w-3.5 h-3.5 ${settings.uiFontTheme === 'bernard-mt' ? 'opacity-100 text-amber-400' : 'opacity-20'}`} />
                    <span>{settings.uiFontTheme === 'bernard-mt' ? 'Aktivní' : 'Vypnuto'}</span>
                  </button>
                </div>
              </div>

              {/* 4. Velikost dotykových ploch (Rukavice vs Prsty) */}
              <div className="glass-tile p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Velikost tlačítek (pro jízdu v rukavicích)
                  </span>
                  <span className="text-xs font-semibold text-stone-300">Dotyková plocha</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'standard-44', label: 'Standardní (44 px)', desc: 'Běžné prsty / klidná jízda' },
                    { id: 'glove-50', label: 'Zvětšená (50 px)', desc: 'Cyklo rukavice & Galaxy S10+' },
                    { id: 'heavy-glove-60', label: 'Masivní (60 px)', desc: 'Zimní rukavice & těžký terén' },
                  ].map((target) => (
                    <button
                      key={target.id}
                      type="button"
                      onClick={() => {
                        onUpdateSettings({ touchTargetSize: target.id as TouchTargetSize });
                        onTriggerHaptic(30);
                      }}
                      className={`p-2.5 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                        settings.touchTargetSize === target.id
                          ? 'bg-cyan-950/40 border-cyan-400 text-white ring-1 ring-cyan-400'
                          : 'bg-stone-900/60 border-white/10 text-stone-300 hover:border-white/20'
                      }`}
                    >
                      <span className="font-bold text-xs sm:text-sm">{target.label}</span>
                      <span className="text-xs text-stone-300 mt-1 leading-snug">{target.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 5. Barevný akcent metrik & Rychloměr */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Barvy metrik */}
                <div className="glass-tile p-3.5 space-y-2">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Palette className="w-4 h-4 text-cyan-400" />
                    Barevný akcent metrik
                  </span>

                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    {[
                      { id: 'emerald', label: 'Smaragd', cls: 'bg-emerald-500 text-emerald-400' },
                      { id: 'cyan', label: 'Azurová', cls: 'bg-cyan-500 text-cyan-400' },
                      { id: 'amber', label: 'Jantar', cls: 'bg-amber-500 text-amber-400' },
                      { id: 'white', label: 'Bílá', cls: 'bg-white text-white' },
                    ].map((col) => (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => {
                          onUpdateSettings({ metricColorTheme: col.id as MetricColorTheme });
                          onTriggerHaptic(20);
                        }}
                        className={`p-2 rounded-xl border flex flex-col items-center gap-1.5 transition cursor-pointer ${
                          settings.metricColorTheme === col.id
                            ? 'border-white bg-white/10'
                            : 'border-white/10 bg-stone-900/60 hover:border-white/20'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-full ${col.cls.split(' ')[0]}`}></span>
                        <span className="text-xs font-semibold text-stone-200">{col.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Velikost tachometru */}
                <div className="glass-tile p-3.5 space-y-2">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Maximize2 className="w-4 h-4 text-emerald-400" />
                    Velikost číslic rychloměru
                  </span>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {[
                      { id: 'standard', label: 'Standardní', desc: 'Klasická velikost' },
                      { id: 'giant', label: 'Obří (Giant)', desc: 'Bleskový pohled za jízdy' },
                    ].map((sz) => (
                      <button
                        key={sz.id}
                        type="button"
                        onClick={() => {
                          onUpdateSettings({ speedometerSize: sz.id as SpeedometerSize });
                          onTriggerHaptic(20);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                          settings.speedometerSize === sz.id
                            ? 'bg-cyan-950/40 border-cyan-400 text-white ring-1 ring-cyan-400'
                            : 'bg-stone-900/60 border-white/10 text-stone-300 hover:border-white/20'
                        }`}
                      >
                        <span className="font-bold text-xs sm:text-sm block">{sz.label}</span>
                        <span className="text-xs text-stone-300">{sz.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 6. Haptika & Obrysy */}
              <div className="glass-tile p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Vibrate className="w-4 h-4 text-amber-400" />
                    <div>
                      <span className="font-bold text-white block">Haptická odezva tlačítek (vibrace)</span>
                      <span className="text-xs text-stone-300">Potvrzení stisku v rukavicích i na nerovnostech</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTestVibrate}
                      className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold border border-white/10 transition cursor-pointer"
                    >
                      {vibrationSuccess ? '✓ Vibrováno' : 'Vyzkoušet vibraci'}
                    </button>
                    <input
                      type="checkbox"
                      checked={settings.hapticFeedback}
                      onChange={(e) => onUpdateSettings({ hapticFeedback: e.target.checked })}
                      className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <Sun className="w-4 h-4 text-cyan-400" />
                    <div>
                      <span className="font-bold text-white block">Zvýrazněné obrysy dlaždic</span>
                      <span className="text-xs text-stone-300">Vyšší optické oddělení prvků na přímém slunci</span>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={settings.highContrastBorders}
                    onChange={(e) => onUpdateSettings({ highContrastBorders: e.target.checked })}
                    className="w-5 h-5 accent-cyan-500 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: GALAXY S10+ & HARDWARE TIPS */}
          {activeTab === 'device' && (
            <div className="space-y-3">
              <div className="p-3.5 glass-tile border-cyan-500/30 flex items-start gap-2.5">
                <Smartphone className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block mb-0.5 text-sm">Podpora všech telefonů & Samsung Galaxy S10+:</strong>
                  <p className="text-stone-300 text-xs leading-relaxed">
                    Aplikace automaticky detekuje poměr stran displeje, výřez fotoaparátu (průstřel) i AMOLED panely. Nastavení výše lze libovolně přizpůsobit pro jakýkoliv telefon i tablet na řídítkách.
                  </p>
                </div>
              </div>

              <div className="glass-tile p-3.5 flex items-start gap-2.5">
                <Sun className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <strong className="text-white block mb-0.5 text-sm">Trvalé rozsvícení displeje (Wake Lock):</strong>
                  Displej vašeho zařízení nezhasne ani při dlouhých sjezdech či stoupáních. Vždy vidíte tachometr a mapu.
                </div>
              </div>

              <div className="glass-tile p-3.5 flex items-start gap-2.5">
                <Zap className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <strong className="text-white block mb-0.5 text-sm">AMOLED Pure Dark šetří baterii:</strong>
                  Při volbě <em>„AMOLED Pure Black”</em> se černé pixely fyzicky vypnou, což šetří až 40 % energie baterie během dlouhých celodenních vyjížděk.
                </div>
              </div>

              <div className="glass-tile p-3.5 flex items-start gap-2.5">
                <Download className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1 text-xs leading-relaxed">
                  <strong className="text-white block mb-0.5 text-sm">Nativní WebAPK instalace na plochu:</strong>
                  Aplikaci lze nainstalovat bez obchodu Google Play jako nativní celoobrazovkovou aplikaci pro Android.
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowApkModal(true)}
                      className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs cursor-pointer shadow"
                    >
                      <Download className="w-4 h-4" />
                      Otevřít průvodce instalací APK
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-stone-950/50 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => {
              onApplyPreset('galaxy-s10');
              onTriggerHaptic(20);
            }}
            className="px-3 py-2 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-300 text-xs font-semibold flex items-center gap-1.5 border border-white/10 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset na S10+</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition cursor-pointer"
          >
            Použít & Zavřít
          </button>
        </div>
      </div>

      <ApkInstallModal isOpen={showApkModal} onClose={() => setShowApkModal(false)} />
    </div>
  );
};
