import React, { useState } from 'react';
import { Sparkles, Send, X, Bot, User, HelpCircle, Loader2 } from 'lucide-react';
import Markdown from 'react-markdown';
import { RideData } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AiCoachDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentRideContext?: Partial<RideData>;
}

const PRESET_QUESTIONS = [
  'Jak zvýšit průměrnou rychlost na kole?',
  'Kolik pít a jíst během jízdy nad 50 km?',
  'Jak správně točit kadenci do prudkého kopce?',
  'Jak rychle zregenerovat po dnešním převýšení?'
];

function getClientCoachTip(query: string, rideContext?: Partial<RideData>): string {
  const lower = (query || '').toLowerCase();
  let ctx = '';
  if (rideContext && (rideContext.distanceKm || 0) > 0) {
    ctx = `\n\n*K vaší vyjížďce (${(rideContext.distanceKm || 0).toFixed(1)} km, ${(rideContext.avgSpeedKmh || 0).toFixed(1)} km/h):*`;
  }

  if (lower.includes('rychlost') || lower.includes('rychlej') || lower.includes('tempo')) {
    return `### ⚡ Jak zvýšit průměrnou rychlost na kole
1. **Plynulost a setrvačnost:** Zbytečně nebrzděte před mírnými horizonty, udržujte rychlost na vrcholku stoupání ještě 5–10 sekund po překonání kopce.
2. **Aerodynamika:** Až 80 % odporu při rychlosti nad 25 km/h tvoří tělo jezdce. Jízda ve spodním úchopu (nebo s pokrčenými lokty) vám ušetří 20–40 wattů.
3. **Kadence 85–95 RPM:** Vyšší kadence neunaví svalová vlákna tak rychle jako silové šlapání.
4. **Trénink základní vytrvalosti (Zóna 2):** Rychlost v kopcích roste z velkého objemu najetých kilometrů v pohodovém tempu.${ctx}`;
  }

  if (lower.includes('pit') || lower.includes('jíst') || lower.includes('jidlo') || lower.includes('50 km') || lower.includes('výživ')) {
    return `### 💧 Pitný režim a výživa pro jízdy nad 50 km
- **Tekutiny:** Vypijte 500–750 ml tekutin za hodinu. V jedné lahvi mějte čistou vodu, ve druhé hypotonický iontový nápoj.
- **Sacharidy:** Začněte jíst už po 45 minutách jízdy! Tělo dokáže vstřebat 40–60 g sacharidů za hodinu (1 banán = cca 25 g sacharidů, 1 energetický gel = cca 25 g).
- **Po dojezdu:** Do 30 minut doplňte sacharidy a bílkoviny v poměru 3:1 (např. regenerační nápoj, tvaroh s banánem a ovesnými vločkami).${ctx}`;
  }

  if (lower.includes('kopec') || lower.includes('kadenc') || lower.includes('šlap')) {
    return `### ⛰️ Kadence v prudkém stoupání
- V kopcích udržujte frekvenci šlapání ideálně mezi **75–85 ot/min**.
- Přeřaďte na lehčí převod s předstihem ještě před vjezdem do stoupání, ne až když se nohy zastavují.
- Při jízdě ze sedla ("ze stoje") zařaďte o 1–2 pastorky těžší převod a využijte váhu těla. Střídejte sedlo a stoj každých pár minut pro uvolnění beder.${ctx}`;
  }

  if (lower.includes('regener') || lower.includes('unav') || lower.includes('sval')) {
    return `### 🔋 Rychlá regenerace po náročné jízdě
1. **Okamžitá hydratace:** Doplňte sodík a tekutiny (zvažte se před a po jízdě, na každý ztracený kilogram vypijte 1.2 l vody).
2. **Nohy nahoru:** 15 minut s nohama opřenýma o zeď výrazně zlepší žilní návrat a odplavení metabolitů.
3. **Spánek:** Minimálně 7.5–8 hodin kvalitního spánku je 90 % úspěšné regenerace.
4. **Druhý den:** Pouze lehká vyjížďka do 45 minut po rovině (tzv. vyjetí nohou) na lehký převod s kadencí 90+ RPM.${ctx}`;
  }

  return `### 🚴 Osobní cyklistický rádce
- **Posed:** Zkontrolujte výšku sedla – pata na pedálu má mít v dolní úvrati zcela napnutou nohu.
- **Tlak plášťů:** Na gravelu 2.2–2.8 bar, silnice 4.5–5.5 bar, MTB 1.4–1.8 bar.
- **Trénink:** Udržujte 80 % jízd v konverzačním tempu pro stavbu aerobního základu.${ctx}`;
}

export const AiCoachDrawer: React.FC<AiCoachDrawerProps> = ({
  isOpen,
  onClose,
  currentRideContext
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Ahoj! Jsem tvůj osobní **Cyklistický Asistent**. Rád ti pomohu s tréninkem, technikou šlapání, výživou v sedle, servisem kola i rozborem tvých tras. Na co se chceš zeptat?'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const message = textToSend || inputText;
    if (!message.trim() || isLoading) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: message }];
    setMessages(newMessages);
    setInputText('');
    setIsLoading(true);

    let replyText = '';

    try {
      const response = await fetch('/api/coach-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          message,
          currentRideContext,
          chatHistory: newMessages.slice(-6),
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        if (data && data.reply) {
          replyText = data.reply;
        }
      }
    } catch (err) {
      console.warn('Network error in coach chat, using client fallback:', err);
    }

    if (!replyText) {
      replyText = getClientCoachTip(message, currentRideContext);
    }

    setMessages((prev) => [...prev, { role: 'assistant', content: replyText }]);
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-[700] w-full max-w-md glass-panel !rounded-none !border-y-0 !border-r-0 flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-4 border-b border-white/10 bg-stone-950/40 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
              Cyklistický AI Asistent
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            </h3>
            <p className="text-xs text-stone-300">Osobní trenér a rádce pro vyjížďky</p>
          </div>
        </div>
        <button
          id="btn-close-coach"
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg bg-stone-800/80 text-stone-300 hover:text-white hover:bg-stone-700 transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            )}
            <div
              className={`max-w-[85%] px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-emerald-600 text-white rounded-2xl rounded-br-none shadow-md'
                  : 'glass-tile text-stone-100 !rounded-bl-none shadow-md'
              }`}
            >
              {m.role === 'user' ? (
                m.content
              ) : (
                <div className="markdown-body">
                  <Markdown>{m.content}</Markdown>
                </div>
              )}
            </div>
            {m.role === 'user' && (
              <div className="w-6 h-6 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center shrink-0 mt-1">
                <User className="w-3.5 h-3.5 text-stone-300" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-stone-300 py-1">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Trenér přemýšlí nad odpovědí...</span>
          </div>
        )}
      </div>

      {/* Suggested Quick Prompts */}
      <div className="p-3 bg-stone-950/40 border-t border-white/10">
        <div className="text-xs font-semibold text-stone-300 mb-1.5 flex items-center gap-1">
          <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
          Rychlé otázky na asistenta:
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(q)}
              className="text-xs px-3 py-1.5 rounded-lg glass-tile-interactive !rounded-lg text-stone-200 transition-all cursor-pointer text-left font-medium"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-3 bg-stone-950/50 border-t border-white/10 flex items-center gap-2"
      >
        <input
          id="input-coach-chat"
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Zeptejte se cyklo asistenta..."
          className="flex-1 glass-tile !rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-stone-400 outline-none focus:!border-emerald-500"
        />
        <button
          id="btn-send-coach"
          type="submit"
          disabled={!inputText.trim() || isLoading}
          className="p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-stone-950 font-bold transition-all cursor-pointer"
        >
          <Send className="w-4 h-4 fill-stone-950" />
        </button>
      </form>
    </div>
  );
};
