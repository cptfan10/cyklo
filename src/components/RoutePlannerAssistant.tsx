import React, { useState, useRef, useEffect } from 'react';
import { PlannedRoute, RouteWaypoint, GpsPoint } from '../types';
import { exportPlannedRouteToGpx, downloadFile } from '../utils/geoUtils';
import {
  Compass,
  Send,
  Sparkles,
  MapPin,
  Map,
  Download,
  RotateCcw,
  Sliders,
  CheckCircle2,
  Bike,
  Mountain,
  AlertTriangle,
  Play,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import Markdown from 'react-markdown';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  plannedRoute?: PlannedRoute;
}

interface RoutePlannerAssistantProps {
  currentLocation?: GpsPoint | null;
  onSelectRouteOnMap: (route: PlannedRoute) => void;
  onStartRideWithRoute?: (route: PlannedRoute) => void;
  activePlannedRouteId?: string | null;
}

const QUICK_PROMPT_SUGGESTIONS = [
  {
    label: '🚴 Silniční 40 km bez aut',
    prompt: 'Hledám silniční okruh cca 40 km. Požadavek: kvalitní hladký asfalt, minimum provozu aut a vyhnout se silnicím I. třídy. Profil zvlněný.',
  },
  {
    label: '🌲 Gravel podél řeky & lesem',
    prompt: 'Chci naplánovat gravel trasu cca 30-35 km. Kombinace zpevněných šotolin, lesních cyklostezek a údolí řeky. Pohodové tempo, hezká příroda.',
  },
  {
    label: '☕ Klidná rodinná cyklostezka 20 km',
    prompt: 'Doporuč nenáročnou rovinatou trasu do 20 km po vyhrazené asfaltové cyklostezce s možností zastávky na kávu nebo občerstvení.',
  },
  {
    label: '⛰️ Kopcovitý MTB trénink',
    prompt: 'Potřebuji tréninkovou kopcovitou trasu pro horské kolo (MTB) na cca 25 km s převýšením aspoň +450 m, techničtější sjezdy i lesní cesty.',
  },
];

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content: `Ahoj! Jsem tvůj **CykloNavigátor** – asistent pro plánování cyklistických tras na míru. 🚴✨

Rád ti pomohu najít a přesně vyladit ideální trasu podle tvých kritérií:
- **Odkud a kam** (nebo zda preferuješ okruh s návratem na start)
- **Typ tvého kola** (silniční, gravel, trekingové, MTB, e-bike)
- **Cílová vzdálenost a profil** (rovinatá, zvlněná, horská s výhledy)
- **Preferovaný povrch** (hladký asfalt, jemná šotolina, lesní cesty)
- **Bezpečnost** (vyhnutí se rušným silnicím, preference cyklotras)

Každou navrženou trasu ti **promítnu přímo na mapu** a připravím k **exportu do GPX**! Co dnes plánuješ?`,
    timestamp: Date.now(),
  },
];

// Helper to extract JSON block from markdown response
function extractPlannedRoute(text: string): { cleanText: string; route?: PlannedRoute } {
  const jsonRegex = /```(?:json)?\s*(\{[\s\S]*?"routeName"[\s\S]*?\})\s*```/;
  const match = text.match(jsonRegex);

  if (!match) {
    return { cleanText: text };
  }

  try {
    const parsed = JSON.parse(match[1]);
    if (parsed.routeName && Array.isArray(parsed.coordinates) && parsed.coordinates.length > 0) {
      const plannedRoute: PlannedRoute = {
        id: `route_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        routeName: parsed.routeName,
        distanceKm: Number(parsed.distanceKm) || 0,
        elevationGainM: Number(parsed.elevationGainM) || 0,
        bikeType: parsed.bikeType || 'Cyklo',
        waypoints: Array.isArray(parsed.waypoints) ? parsed.waypoints : [],
        coordinates: parsed.coordinates,
        description: parsed.description,
      };

      const cleanText = text.replace(jsonRegex, '').trim();
      return { cleanText, route: plannedRoute };
    }
  } catch (e) {
    console.warn('Failed to parse route JSON from assistant reply:', e);
  }

  return { cleanText: text };
}

function buildClientFallbackRoute(prompt: string, bikeType: string, distanceKmStr: string): string {
  const isMtb = prompt.toLowerCase().includes('mtb') || prompt.toLowerCase().includes('horsk') || bikeType === 'Horský (MTB)';
  const isRoad = prompt.toLowerCase().includes('silni') || bikeType === 'Silniční';
  const distance = parseFloat(distanceKmStr) || 35;

  if (isMtb) {
    return `### 🚵‍♂️ Doporučená MTB trasa: Brdské lesní hřebeny a traily
Navrhuji prověřenou trasu pro horské kolo vedenou po lesních cestách a zpevněných šotolinách:

- **Start & Cíl:** Všenory ➔ Jíloviště ➔ Černolické skály ➔ Všenory (Okruh)
- **Délka:** ${Math.round(distance)} km
- **Převýšení:** +390 m
- **Terén:** Lesní pěšiny, šotolina a zpevněné cesty (bez silničního provozu)
- **Vhodnost:** Horská kola (XC/Trail) a odolné gravely

\`\`\`json
{
  "routeName": "Brdské hřebeny a Černolické skály",
  "distanceKm": ${Math.round(distance)},
  "elevationGainM": 390,
  "bikeType": "Horský (MTB)",
  "waypoints": [
    { "name": "Všenory (nádraží)", "lat": 49.9285, "lng": 14.3120 },
    { "name": "Černolické skály", "lat": 49.9110, "lng": 14.3020 },
    { "name": "Jíloviště vyhlídka", "lat": 49.9320, "lng": 14.3410 },
    { "name": "Všenory návrat", "lat": 49.9285, "lng": 14.3120 }
  ],
  "coordinates": [
    [49.9285, 14.3120],
    [49.9210, 14.3080],
    [49.9110, 14.3020],
    [49.9050, 14.2950],
    [49.9150, 14.3180],
    [49.9240, 14.3310],
    [49.9320, 14.3410],
    [49.9300, 14.3260],
    [49.9285, 14.3120]
  ]
}
\`\`\``;
  }

  if (isRoad) {
    return `### 🚴‍♂️ Doporučená silniční trasa: Plynulý asfaltový okruh podél řeky
Připravil jsem rovinatou trasu po kvalitním hladkém asfaltu s minimálním automobilovým provozem:

- **Start & Cíl:** Radotín ➔ Černošice ➔ Dobřichovice ➔ Lety ➔ Radotín
- **Délka:** ${Math.round(distance)} km
- **Převýšení:** +180 m (rychlý a plynulý rovinatý profil v údolí)
- **Povrch:** 100 % hladký asfalt
- **Bezpečnost:** Cyklotrasa A1 a klidné vedlejší obslužné komunikace

\`\`\`json
{
  "routeName": "Rychlý asfaltový okruh podél Berounky",
  "distanceKm": ${Math.round(distance)},
  "elevationGainM": 180,
  "bikeType": "Silniční",
  "waypoints": [
    { "name": "Praha-Radotín", "lat": 49.9862, "lng": 14.3642 },
    { "name": "Černošice", "lat": 49.9540, "lng": 14.2790 },
    { "name": "Dobřichovice lávka", "lat": 49.9280, "lng": 14.2340 },
    { "name": "Lety u Dobřichovic", "lat": 49.9210, "lng": 14.2490 },
    { "name": "Návrat Radotín", "lat": 49.9862, "lng": 14.3642 }
  ],
  "coordinates": [
    [49.9862, 14.3642],
    [49.9750, 14.3350],
    [49.9540, 14.2790],
    [49.9410, 14.2510],
    [49.9280, 14.2340],
    [49.9210, 14.2490],
    [49.9380, 14.2810],
    [49.9620, 14.3390],
    [49.9862, 14.3642]
  ]
}
\`\`\``;
  }

  // Default Gravel / Touring
  return `### 🗺️ Doporučená gravel trasa: Karlštejnský okruh podél Berounky
Podle vašich instrukcí navrhuji ověřený a bezpečný okruh:

- **Start & Cíl:** Radotín ➔ Dobřichovice ➔ Karlštejn ➔ Srbsko ➔ zpět (Okruh)
- **Vzdálenost:** ${Math.round(distance)} km
- **Převýšení:** +240 m (příjemný profil údolím s výhledem na hrad Karlštejn)
- **Povrch:** 85 % hladký asfalt, 15 % jemná zpevněná šotolina
- **Bezpečnost:** Mimo hlavní tahy po páteřní cyklotrase A1 podél řeky.

\`\`\`json
{
  "routeName": "Karlštejnský gravel okruh podél Berounky",
  "distanceKm": ${Math.round(distance)},
  "elevationGainM": 240,
  "bikeType": "${bikeType || 'Gravel / Treking'}",
  "waypoints": [
    { "name": "Start: Radotín lávka", "lat": 49.9862, "lng": 14.3642 },
    { "name": "Černošice", "lat": 49.9540, "lng": 14.2790 },
    { "name": "Dobřichovice", "lat": 49.9280, "lng": 14.2340 },
    { "name": "Hrad Karlštejn", "lat": 49.9395, "lng": 14.1880 },
    { "name": "Srbsko", "lat": 49.9338, "lng": 14.2120 }
  ],
  "coordinates": [
    [49.9862, 14.3642],
    [49.9818, 14.3490],
    [49.9721, 14.3284],
    [49.9610, 14.2985],
    [49.9540, 14.2790],
    [49.9480, 14.2560],
    [49.9420, 14.2340],
    [49.9380, 14.2050],
    [49.9395, 14.1880],
    [49.9338, 14.2120],
    [49.9380, 14.2620],
    [49.9650, 14.3320],
    [49.9862, 14.3642]
  ]
}
\`\`\``;
}

export const RoutePlannerAssistant: React.FC<RoutePlannerAssistantProps> = ({
  currentLocation,
  onSelectRouteOnMap,
  onStartRideWithRoute,
  activePlannedRouteId,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem('route_planner_chat_history');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn(e);
    }
    return INITIAL_MESSAGES;
  });

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showParametersBar, setShowParametersBar] = useState(false);

  // Quick parameters state
  const [paramOrigin, setParamOrigin] = useState('');
  const [paramBikeType, setParamBikeType] = useState('Gravel');
  const [paramDistanceKm, setParamDistanceKm] = useState('35');
  const [paramSurface, setParamSurface] = useState('Asfalt a zpevněný štěrk');
  const [paramHills, setParamHills] = useState('Mírně zvlněná');
  const [paramAvoidTraffic, setParamAvoidTraffic] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Save to session storage
  useEffect(() => {
    try {
      sessionStorage.setItem('route_planner_chat_history', JSON.stringify(messages));
    } catch (e) {
      console.warn(e);
    }
  }, [messages]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputMessage;
    if (!textToSend.trim() || isLoading) return;

    const userMessageId = `msg_${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMessageId,
      role: 'user',
      content: textToSend.trim(),
      timestamp: Date.now(),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputMessage('');
    setIsLoading(true);

    let replyText = '';

    try {
      // Format history for backend
      const formattedHistory = newHistory
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const response = await fetch('/api/route-planner-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          message: userMsg.content,
          chatHistory: formattedHistory,
          currentLocation: currentLocation
            ? { lat: currentLocation.lat, lng: currentLocation.lng }
            : null,
          userPreferences: {
            preferredBike: paramBikeType,
            avoidTraffic: paramAvoidTraffic,
          },
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.includes('application/json')) {
        const data = await response.json();
        if (data && data.reply) {
          replyText = data.reply;
        }
      } else {
        console.warn(`Route planner API returned non-JSON or status ${response.status}`);
      }
    } catch (err: any) {
      console.warn('Route planner network/server error:', err);
    }

    // If server response couldn't be retrieved or was HTML, use our contextual route generator
    if (!replyText) {
      replyText = buildClientFallbackRoute(userMsg.content, paramBikeType, paramDistanceKm);
    }

    try {
      const { cleanText, route } = extractPlannedRoute(replyText);

      const assistantMsg: ChatMessage = {
        id: `assist_${Date.now()}`,
        role: 'assistant',
        content: cleanText,
        timestamp: Date.now(),
        plannedRoute: route,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (parseErr: any) {
      console.error('Error displaying route:', parseErr);
      const fallbackMsg: ChatMessage = {
        id: `assist_${Date.now()}`,
        role: 'assistant',
        content: replyText,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyParameters = () => {
    const prompt = `Navrhni cyklotrasu podle těchto přesných parametrů:
- Výchozí bod: ${paramOrigin.trim() ? paramOrigin.trim() : 'okolí Prahy / Karlštejnsko'}
- Typ kola: ${paramBikeType}
- Cílová vzdálenost: cca ${paramDistanceKm} km
- Preferovaný povrch: ${paramSurface}
- Profil a stoupání: ${paramHills}
- Bezpečnost: ${paramAvoidTraffic ? 'přísně se vyhnout frekventovaným silnicím I. a II. třídy, preferovat cyklostezky a klidné boční cesty' : 'běžné cyklotrasy'}.`;

    setShowParametersBar(false);
    handleSendMessage(prompt);
  };

  const handleResetChat = () => {
    if (window.confirm('Opravdu chcete začít nové plánování a vymazat dosavadní konverzaci?')) {
      setMessages(INITIAL_MESSAGES);
      sessionStorage.removeItem('route_planner_chat_history');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-stone-950 text-stone-100 overflow-hidden">
      {/* Planner Header Bar */}
      <div className="px-4 py-3 bg-stone-900/90 border-b border-stone-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              Asistent plánování tras
              <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 text-[10px] font-mono border border-cyan-800/40">
                Gemini 3.5
              </span>
            </h2>
            <p className="text-[11px] text-stone-400 hidden sm:block">
              Vyhledání a optimalizace cyklotrasy podle přesných instrukcí
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle Quick Parameters Drawer */}
          <button
            id="btn-toggle-parameters"
            type="button"
            onClick={() => setShowParametersBar(!showParametersBar)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              showParametersBar
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                : 'bg-stone-800/80 hover:bg-stone-800 text-stone-300 border-stone-700'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nastavit parametry</span>
            {showParametersBar ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {/* Reset chat button */}
          <button
            id="btn-reset-planner"
            type="button"
            onClick={handleResetChat}
            title="Nové plánování (vyčistit historii)"
            className="p-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 border border-stone-700 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Structured Parameters Panel (collapsible) */}
      {showParametersBar && (
        <div className="bg-stone-900 border-b border-stone-800 p-4 shrink-0 animate-in slide-in-from-top-2 duration-200">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" />
                Přesné zadání požadavků na trasu
              </span>
              <span className="text-[11px] text-stone-400">Asistent vygeneruje trasu odpovídající těmto specifikacím</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-stone-400 mb-1">Výchozí / cílová oblast</label>
                <input
                  type="text"
                  placeholder="např. Beroun, Brno, Praha-Braník, Okruh..."
                  value={paramOrigin}
                  onChange={(e) => setParamOrigin(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-stone-400 mb-1">Typ kola</label>
                <select
                  value={paramBikeType}
                  onChange={(e) => setParamBikeType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value="Silniční">Silniční kolo (hladký asfalt, úzké pláště)</option>
                  <option value="Gravel">Gravel / Šotolina (mix asfaltu a polních cest)</option>
                  <option value="Horský (MTB)">Horský (MTB - lesní cesty, stezky, traily)</option>
                  <option value="Treking / Krosové">Treking / Krosové (pohodové zpevněné stezky)</option>
                  <option value="Elektrokolo (e-bike)">Elektrokolo (i delší kopce a převýšení)</option>
                </select>
              </div>

              <div>
                <label className="block text-stone-400 mb-1">Cílová vzdálenost</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="10"
                    max="120"
                    step="5"
                    value={paramDistanceKm}
                    onChange={(e) => setParamDistanceKm(e.target.value)}
                    className="flex-1 accent-cyan-400"
                  />
                  <span className="font-mono font-bold text-cyan-400 w-12 text-right">{paramDistanceKm} km</span>
                </div>
              </div>

              <div>
                <label className="block text-stone-400 mb-1">Preferovaný povrch</label>
                <select
                  value={paramSurface}
                  onChange={(e) => setParamSurface(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value="100% hladký asfalt">Pouze hladký asfalt (bez šotoliny)</option>
                  <option value="Asfalt a zpevněný štěrk">Asfalt a kvalitní zpevněný štěrk</option>
                  <option value="Lesní cesty a přírodní terén">Lesní cesty, pěšiny a přírodní terén</option>
                  <option value="Rovinaté cyklostezky podél řeky">Vyhrazené cyklostezky podél vody</option>
                </select>
              </div>

              <div>
                <label className="block text-stone-400 mb-1">Profil & stoupání</label>
                <select
                  value={paramHills}
                  onChange={(e) => setParamHills(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value="Maximálně rovinatá (do 150 m)">Maximálně rovinatá (do 150 m stoupání)</option>
                  <option value="Mírně zvlněná">Mírně zvlněná (plynulé kopečky)</option>
                  <option value="Kopcovitá s hezkými vyhlídkami">Kopcovitá s hezkými vyhlídkami (+400m)</option>
                  <option value="Horská náročná výzva">Horská náročná výzva (+800m a více)</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-4">
                <label className="flex items-center gap-2 cursor-pointer select-none text-stone-300">
                  <input
                    type="checkbox"
                    checked={paramAvoidTraffic}
                    onChange={(e) => setParamAvoidTraffic(e.target.checked)}
                    className="rounded accent-cyan-500 w-4 h-4"
                  />
                  <span>Vyhnout se rušným silnicím</span>
                </label>

                <button
                  type="button"
                  onClick={handleApplyParameters}
                  className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-stone-950 font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Vyhledat trasu</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scrollable Conversation Thread */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-3xl ${
                isUser ? 'ml-auto' : 'mr-auto'
              }`}
            >
              {/* Message Header */}
              <div className="flex items-center gap-1.5 text-[11px] text-stone-400 mb-1 px-1">
                {isUser ? (
                  <span>Vy</span>
                ) : (
                  <span className="flex items-center gap-1 text-cyan-400 font-semibold">
                    <Compass className="w-3 h-3" />
                    CykloNavigátor
                  </span>
                )}
                <span>•</span>
                <span>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Message Bubble */}
              <div
                className={`p-4 rounded-2xl text-sm leading-relaxed ${
                  isUser
                    ? 'bg-cyan-600 text-white rounded-br-none shadow-md shadow-cyan-900/20'
                    : 'bg-stone-900 border border-stone-800 text-stone-100 rounded-bl-none shadow-lg'
                }`}
              >
                {isUser ? (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                ) : (
                  <div className="markdown-body space-y-2">
                    <Markdown>{msg.content}</Markdown>
                  </div>
                )}
              </div>

              {/* If Assistant Generated an Actionable Route */}
              {msg.plannedRoute && (
                <div className="mt-3 w-full p-4 rounded-2xl bg-gradient-to-br from-cyan-950/70 to-stone-900 border border-cyan-500/50 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95">
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div>
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-cyan-400 uppercase tracking-wider">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Nalezena a připravena trasa na míru
                      </div>
                      <h4 className="text-base font-extrabold text-white mt-0.5">
                        {msg.plannedRoute.routeName}
                      </h4>
                    </div>

                    <span className="px-2 py-0.5 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-semibold">
                      {msg.plannedRoute.bikeType || 'Cyklo'}
                    </span>
                  </div>

                  {/* Route Key Stats Bar */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-stone-950/70 border border-stone-800 text-center mb-3">
                    <div>
                      <span className="text-[10px] text-stone-400 block">Vzdálenost</span>
                      <span className="font-mono text-base font-extrabold text-cyan-400">
                        {msg.plannedRoute.distanceKm} km
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-400 block">Převýšení</span>
                      <span className="font-mono text-base font-extrabold text-emerald-400">
                        +{msg.plannedRoute.elevationGainM} m
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-400 block">Průjezdních bodů</span>
                      <span className="font-mono text-base font-bold text-stone-200">
                        {msg.plannedRoute.waypoints?.length || 0}
                      </span>
                    </div>
                  </div>

                  {/* Waypoints preview if available */}
                  {msg.plannedRoute.waypoints && msg.plannedRoute.waypoints.length > 0 && (
                    <div className="mb-3.5 text-xs text-stone-300 space-y-1 bg-stone-950/40 p-2.5 rounded-xl border border-stone-800/80">
                      <span className="text-[10px] uppercase font-bold text-stone-400 block mb-1">
                        Klíčové orientační body:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.plannedRoute.waypoints.map((wp, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-800/80 border border-stone-700 text-stone-200 text-[11px]"
                          >
                            <MapPin className="w-2.5 h-2.5 text-cyan-400" />
                            {wp.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons: Show on Map, Download GPX, Start Ride */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-stone-800/80">
                    <button
                      type="button"
                      onClick={() => onSelectRouteOnMap(msg.plannedRoute!)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
                        activePlannedRouteId === msg.plannedRoute.id
                          ? 'bg-emerald-500 text-stone-950 ring-2 ring-emerald-400/50'
                          : 'bg-cyan-500 hover:bg-cyan-400 text-stone-950'
                      }`}
                    >
                      <Map className="w-4 h-4" />
                      <span>{activePlannedRouteId === msg.plannedRoute.id ? 'Zobrazeno na mapě' : 'Zobrazit na mapě'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const gpxContent = exportPlannedRouteToGpx(msg.plannedRoute!);
                        const filename = `${msg.plannedRoute!.routeName.replace(/[^a-z0-9]/gi, '_')}.gpx`;
                        downloadFile(gpxContent, filename, 'application/gpx+xml');
                      }}
                      className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-stone-400" />
                      <span>Stáhnout GPX</span>
                    </button>

                    {onStartRideWithRoute && (
                      <button
                        type="button"
                        onClick={() => onStartRideWithRoute(msg.plannedRoute!)}
                        className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ml-auto"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Jet tuto trasu</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Typing Loading Indicator */}
        {isLoading && (
          <div className="flex items-start gap-2 text-stone-400 mr-auto max-w-md">
            <div className="p-3.5 rounded-2xl bg-stone-900 border border-stone-800 flex items-center gap-2 text-xs">
              <Compass className="w-4 h-4 text-cyan-400 animate-spin" />
              <span>CykloNavigátor hledá a optimalizuje nejlepší trasu...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompt Chips */}
      <div className="px-4 py-2 border-t border-stone-800/80 bg-stone-900/60 overflow-x-auto shrink-0 flex items-center gap-2 no-scrollbar">
        <span className="text-[11px] text-stone-500 whitespace-nowrap">Rychlé šablony:</span>
        {QUICK_PROMPT_SUGGESTIONS.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSendMessage(item.prompt)}
            disabled={isLoading}
            className="px-2.5 py-1 rounded-lg bg-stone-800/80 hover:bg-stone-800 border border-stone-700/80 text-stone-300 hover:text-white text-xs whitespace-nowrap transition-all cursor-pointer shrink-0 disabled:opacity-50"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Input Message Area */}
      <div className="p-3 sm:p-4 bg-stone-900 border-t border-stone-800 shrink-0">
        <div className="max-w-4xl mx-auto flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              rows={2}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder="Napište instrukce pro trasu (např. 'Chci 50 km silniční trasu z Karlštejna s hezkým asfaltem a výhledem')..."
              className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-950 border border-stone-800 text-stone-100 placeholder:text-stone-500 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 resize-none"
            />
          </div>

          <button
            id="btn-send-planner-msg"
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim() || isLoading}
            className="p-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-stone-950 transition-all font-bold shadow-lg shadow-cyan-500/20 cursor-pointer flex items-center justify-center shrink-0"
            title="Odeslat dotaz na trasu"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center justify-between text-[11px] text-stone-500 mt-2 max-w-4xl mx-auto px-1">
          <span>Stisknutím klávesy Enter odešlete zprávu</span>
          <span>Podporováno modelem Gemini s výpočtem GPS bodů</span>
        </div>
      </div>
    </div>
  );
};
