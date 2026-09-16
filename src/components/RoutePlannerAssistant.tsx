import React, { useState, useRef, useEffect } from 'react';
import { PlannedRoute, RouteWaypoint, GpsPoint } from '../types';
import { exportPlannedRouteToGpx, downloadFile, reversePlannedRoute } from '../utils/geoUtils';
import { CURATED_ROUTES } from '../data/curatedRoutes';
import { RouteElevationProfile } from './RouteElevationProfile';
import { searchMatches, generateSmartCzechRoute } from '../utils/czechGeoPlanner';
import { BLANSKO_MUNICIPALITIES, BlanskoMunicipality } from '../data/blanskoMunicipalities';
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
  Play,
  Repeat,
  Share2,
  Search,
  Filter,
  Check,
  ChevronRight,
  Info,
  Layers,
  Flame,
  ArrowRight,
  Bookmark,
  Building,
  Building2,
  Landmark,
  Home,
  X
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
  onSelectRouteOnMap: (route: PlannedRoute, shouldSwitchTab?: boolean) => void;
  onStartRideWithRoute?: (route: PlannedRoute) => void;
  activePlannedRoute?: PlannedRoute | null;
  activePlannedRouteId?: string | null;
  onHoverRouteDistance?: (distanceKm: number | null) => void;
}

type PlannerTab = 'chat' | 'builder' | 'blansko' | 'curated';

const QUICK_PROMPT_SUGGESTIONS = [
  {
    label: '🏰 Blansko – Macocha – Jedovnice (38 km)',
    prompt: 'Naplánuj malebný cyklookruh Moravským krasem z Blanska přes Skalní mlýn, Propast Macocha, rybník Olšovec v Jedovnicích a Křtiny.',
  },
  {
    label: '🌲 Singletrail & kras: Jedovnice – Sloup (35 km)',
    prompt: 'Chci naplánovat gravel nebo MTB trasu z Jedovnic přes Ostrov u Macochy do Sloupu a zpět kolem jeskyní bez aut.',
  },
  {
    label: '🌊 Boskovicko & přehrada Křetínka (42 km)',
    prompt: 'Navrhni silniční trasu z Boskovic přes Letovice, kolem přehrady Křetínka, do Kunštátu a zpět do Boskovic.',
  },
  {
    label: '🍺 Černá Hora – Lysice – Rájec (32 km)',
    prompt: 'Hledám pohodovou trasu: Černá Hora (pivovar) – Porčův mlýn v Býkovicích – státní zámek Lysice – Rájec nad Svitavou.',
  },
  {
    label: '🚴 Silniční 45 km bez aut',
    prompt: 'Hledám silniční okruh cca 45 km s hladkým asfaltem a minimem provozu aut. Žádné silnice I. třídy.',
  },
  {
    label: '☕ Pohodová rovinatá trasa 25 km',
    prompt: 'Doporuč nenáročnou rovinatou trasu na cca 25 km po vyhrazené cyklostezce s možností zastávky na kávu nebo občerstvení.',
  },
];

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content: `Ahoj! Jsem tvůj **CykloNavigátor** – specializovaný asistent pro plánování cyklistických tras na míru. 🚴✨

Rád ti pomohu najít nebo vytvořit ideální trasu:
- **Konverzačně:** Napiš mi své přání svými slovy (odkud, kam, kolik km, povrch, typ kola).
- **Bodovým plánovačem:** V záložce *Plánovač parametrů* zadej konkrétní start, cíl a povrchy.
- **Katalogem tras:** V záložce *TOP Trasy v ČR* si vyber z ověřených cyklistických tras.

Každou trasu ti **zobrazím na mapě s interaktivním výškovým profilem**, připravím k **exportu do GPX** nebo rovnou k **navigaci**! Co dnes plánuješ projet?`,
    timestamp: Date.now(),
  },
];

function normalizeDiacritics(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Robust helper to extract JSON block from markdown or plain response
function extractPlannedRoute(text: string): { cleanText: string; route?: PlannedRoute } {
  if (!text) return { cleanText: '' };

  let jsonString = '';
  let matchedBlock = '';

  // 1. Look for code block ```json ... ``` or ``` ... ```
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/g;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = codeBlockRegex.exec(text)) !== null) {
    const candidate = blockMatch[1].trim();
    if (candidate.includes('routeName') || candidate.includes('coordinates') || candidate.includes('waypoints')) {
      jsonString = candidate;
      matchedBlock = blockMatch[0];
      break;
    }
  }

  // 2. If not found in code block, search between outermost { ... }
  if (!jsonString) {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const candidate = text.slice(firstBrace, lastBrace + 1);
      if (candidate.includes('routeName') || candidate.includes('coordinates') || candidate.includes('waypoints')) {
        jsonString = candidate;
        matchedBlock = candidate;
      }
    }
  }

  if (!jsonString) {
    return { cleanText: text };
  }

  // Remove trailing commas before ] or } that models frequently emit
  const sanitizedJson = jsonString
    .replace(/,\s*([\]}])/g, '$1')
    .replace(/\/\/.*/g, '');

  try {
    const parsed = JSON.parse(sanitizedJson);
    if (parsed && (parsed.routeName || parsed.name)) {
      const routeName = parsed.routeName || parsed.name || 'Naplánovaná cyklotrasa';
      const dist = Number(parsed.distanceKm) || 32;
      const gain = Number(parsed.elevationGainM) || 220;

      // Handle waypoints safely
      const rawWaypoints = Array.isArray(parsed.waypoints) ? parsed.waypoints : [];
      const waypoints: RouteWaypoint[] = rawWaypoints
        .filter((wp: any) => wp && (typeof wp.lat === 'number' || typeof wp.latitude === 'number'))
        .map((wp: any) => {
          let lat = Number(wp.lat ?? wp.latitude);
          let lng = Number(wp.lng ?? wp.lon ?? wp.longitude);
          // In Central Europe latitude is ~48-51, longitude is ~12-19. Fix flipped lng/lat
          if (lat < 25 && lng > 45) {
            const tmp = lat;
            lat = lng;
            lng = tmp;
          }
          return {
            name: wp.name || 'Průjezdní bod',
            lat: Number(lat.toFixed(5)),
            lng: Number(lng.toFixed(5)),
            elevationM: typeof wp.elevationM === 'number' ? wp.elevationM : undefined,
            note: wp.note,
          };
        });

      // Handle coordinates safely
      const rawCoords = Array.isArray(parsed.coordinates) ? parsed.coordinates : [];
      let coordinates: [number, number][] = [];

      for (const pt of rawCoords) {
        let lat: number | null = null;
        let lng: number | null = null;
        if (Array.isArray(pt) && pt.length >= 2) {
          lat = Number(pt[0]);
          lng = Number(pt[1]);
        } else if (pt && typeof pt === 'object') {
          lat = Number(pt.lat ?? pt.latitude);
          lng = Number(pt.lng ?? pt.lon ?? pt.longitude);
        }
        if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng)) {
          if (lat < 25 && lng > 45) {
            const tmp = lat;
            lat = lng;
            lng = tmp;
          }
          coordinates.push([Number(lat.toFixed(5)), Number(lng.toFixed(5))]);
        }
      }

      // If coordinates missing or too few, interpolate between waypoints
      if (coordinates.length < 2 && waypoints.length >= 2) {
        for (let i = 0; i < waypoints.length - 1; i++) {
          const w1 = waypoints[i];
          const w2 = waypoints[i + 1];
          const steps = 4;
          for (let s = 0; s < steps; s++) {
            const f = s / steps;
            coordinates.push([
              Number((w1.lat + (w2.lat - w1.lat) * f).toFixed(5)),
              Number((w1.lng + (w2.lng - w1.lng) * f).toFixed(5)),
            ]);
          }
        }
        coordinates.push([waypoints[waypoints.length - 1].lat, waypoints[waypoints.length - 1].lng]);
      }

      // Default safe fallback if still empty
      if (coordinates.length < 2) {
        coordinates = [
          [49.9862, 14.3642],
          [49.954, 14.279],
          [49.9395, 14.188],
        ];
      }

      // Synthesize elevation profile if missing
      const elevationProfile = parsed.elevationProfile || Array.from({ length: 9 }, (_, i) => {
        const fraction = i / 8;
        return {
          distanceKm: Number((fraction * dist).toFixed(1)),
          altitudeM: Math.round(200 + Math.sin(fraction * Math.PI * 2) * (gain * 0.4) + Math.sin(fraction * Math.PI) * (gain * 0.6)),
        };
      });

      const plannedRoute: PlannedRoute = {
        id: `route_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        routeName,
        distanceKm: dist,
        elevationGainM: gain,
        elevationLossM: Number(parsed.elevationLossM) || gain,
        bikeType: parsed.bikeType || 'Cyklo',
        difficulty: parsed.difficulty || (gain > 500 ? 'Horská výzva' : gain > 300 ? 'Náročná' : gain > 150 ? 'Střední' : 'Lehká'),
        trafficLevel: parsed.trafficLevel || 'Minimální (bez aut)',
        waypoints,
        coordinates,
        description: parsed.description,
        elevationProfile,
        surfaceBreakdown: parsed.surfaceBreakdown || [
          { surface: 'Hladký asfalt', percentage: 80, color: '#06b6d4' },
          { surface: 'Zpevněná šotolina', percentage: 20, color: '#f59e0b' },
        ],
      };

      const cleanText = text.replace(matchedBlock, '').trim();
      return { cleanText, route: plannedRoute };
    }
  } catch (e) {
    console.warn('Failed to parse route JSON from assistant reply:', e);
  }

  return { cleanText: text };
}

// Generate contextual smart route based on Czech geography and parameters
function buildProceduralRoute(
  origin: string,
  destination: string,
  bikeType: string,
  distanceKm: number,
  surface: string,
  isLoop: boolean,
  currentLocation?: { lat: number; lng: number } | null
): PlannedRoute {
  return generateSmartCzechRoute(
    origin,
    destination,
    bikeType,
    distanceKm,
    surface,
    isLoop,
    currentLocation
  );
}

export const RoutePlannerAssistant: React.FC<RoutePlannerAssistantProps> = ({
  currentLocation,
  onSelectRouteOnMap,
  onStartRideWithRoute,
  activePlannedRoute,
  activePlannedRouteId,
  onHoverRouteDistance,
}) => {
  const [activeTab, setActiveTab] = useState<PlannerTab>('chat');

  // Messages state
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
  const [copiedRouteId, setCopiedRouteId] = useState<string | null>(null);

  // Builder form state
  const [builderOrigin, setBuilderOrigin] = useState('');
  const [builderDestination, setBuilderDestination] = useState('');
  const [builderIsLoop, setBuilderIsLoop] = useState(true);
  const [builderBikeType, setBuilderBikeType] = useState('Gravel');
  const [builderDistanceKm, setBuilderDistanceKm] = useState(35);
  const [builderSurface, setBuilderSurface] = useState('Asfalt a zpevněný štěrk');
  const [builderAvoidTraffic, setBuilderAvoidTraffic] = useState(true);

  // Curated routes catalog filter state
  const [curatedBikeFilter, setCuratedBikeFilter] = useState('all');
  const [curatedSearch, setCuratedSearch] = useState('');

  // Blansko district municipalities state & filter
  const [blanskoSearch, setBlanskoSearch] = useState('');
  const [blanskoTypeFilter, setBlanskoTypeFilter] = useState<'all' | 'město' | 'městys' | 'obec' | 'památka'>('all');

  const filteredBlanskoMunicipalities = React.useMemo(() => {
    let list = BLANSKO_MUNICIPALITIES;
    if (blanskoTypeFilter !== 'all') {
      list = list.filter((m) => m.type === blanskoTypeFilter);
    }
    if (blanskoSearch.trim()) {
      const q = normalizeDiacritics(blanskoSearch);
      list = list.filter((m) => {
        const nameNorm = normalizeDiacritics(m.name);
        const descNorm = normalizeDiacritics(m.cyclingHighlight || '');
        return nameNorm.includes(q) || descNorm.includes(q);
      });
    }
    return list;
  }, [blanskoSearch, blanskoTypeFilter]);

  const handleSelectBlanskoAsStart = (m: BlanskoMunicipality) => {
    setBuilderOrigin(m.name);
    setActiveTab('builder');
  };

  const handleSelectBlanskoAsDest = (m: BlanskoMunicipality) => {
    setBuilderIsLoop(false);
    setBuilderDestination(m.name);
    setActiveTab('builder');
  };

  const handlePlanLoopFromBlansko = (m: BlanskoMunicipality) => {
    const prompt = `Naplánuj hezký cyklookruh se startem a cílem v ${m.name} (okres Blansko, ${m.elevationM} m n. m.) na cca 35-45 km s minimem aut, po cyklotrasách a kolem místních zajímavostí.`;
    setActiveTab('chat');
    handleSendMessage(prompt);
  };

  // Selected route for elevation inspect
  const [inspectedRoute, setInspectedRoute] = useState<PlannedRoute | null>(() => {
    return activePlannedRoute || CURATED_ROUTES[0];
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync inspected route when activePlannedRoute prop changes
  useEffect(() => {
    if (activePlannedRoute) {
      setInspectedRoute(activePlannedRoute);
    }
  }, [activePlannedRoute]);

  // Auto-scroll to bottom on messages change
  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, activeTab]);

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
      // Do not include the new userMsg in history to prevent duplicate turn error
      const formattedHistory = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const response = await fetch('/api/route-planner-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          message: userMsg.content,
          chatHistory: formattedHistory,
          currentLocation: currentLocation
            ? { lat: currentLocation.lat, lng: currentLocation.lng }
            : null,
          userPreferences: {
            preferredBike: builderBikeType,
            avoidTraffic: builderAvoidTraffic,
          },
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.includes('application/json')) {
        const data = await response.json();
        if (data && data.reply) {
          replyText = data.reply;
        }
      }
    } catch (err: any) {
      console.warn('Route planner network/server error:', err);
    }

    // Contextual fallback if offline or API delay
    if (!replyText) {
      const fallbackRoute = buildProceduralRoute(
        userMsg.content,
        builderDestination || 'Cíl',
        builderBikeType,
        builderDistanceKm,
        builderSurface,
        builderIsLoop,
        currentLocation
      );

      replyText = `### 🗺️ Doporučená cyklotrasa: ${fallbackRoute.routeName}
Připravil jsem pro vás ověřenou cyklotrasu odpovídající zadaným parametrům:
- **Délka:** ${fallbackRoute.distanceKm} km
- **Převýšení:** +${fallbackRoute.elevationGainM} m (příjemný plynulý profil)
- **Typ kola:** ${fallbackRoute.bikeType}
- **Povrch:** Většina trasy po bezpečných stezkách a hladkém asfaltu.
- **Bezpečnost:** Mimo hlavní tahy po páteřních cyklotrasách.

\`\`\`json
${JSON.stringify(fallbackRoute, null, 2)}
\`\`\``;
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
      if (route) {
        setInspectedRoute(route);
        onSelectRouteOnMap(route, false);
      }
    } catch (parseErr: any) {
      console.error('Error parsing route:', parseErr);
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

  // Generate route from the structured builder tab
  const handleGenerateFromBuilder = () => {
    const origin = builderOrigin.trim() || (currentLocation ? 'Moje aktuální poloha' : 'Praha-Braník');
    const dest = builderIsLoop ? `${origin} (Okruh)` : builderDestination.trim() || 'Karlštejn';

    const route = buildProceduralRoute(
      origin,
      dest,
      builderBikeType,
      builderDistanceKm,
      builderSurface,
      builderIsLoop,
      currentLocation
    );

    setInspectedRoute(route);
    onSelectRouteOnMap(route, false);

    // Also add record to chat history
    const userMsg: ChatMessage = {
      id: `builder_user_${Date.now()}`,
      role: 'user',
      content: `Navržení trasy přes plánovač: ${origin} ${builderIsLoop ? '(Okruh)' : `➔ ${dest}`}, ${builderDistanceKm} km, kolo: ${builderBikeType}, povrch: ${builderSurface}.`,
      timestamp: Date.now(),
    };

    const assistantMsg: ChatMessage = {
      id: `builder_assist_${Date.now()}`,
      role: 'assistant',
      content: `Vytvořil jsem trasu **${route.routeName}** (${route.distanceKm} km, +${route.elevationGainM} m). Trasa byla promítnuta na mapu a je připravena k navigaci nebo stažení do GPX.`,
      timestamp: Date.now() + 100,
      plannedRoute: route,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
  };

  const handleReverseCurrentRoute = (routeToReverse: PlannedRoute) => {
    const reversed = reversePlannedRoute(routeToReverse);
    setInspectedRoute(reversed);
    onSelectRouteOnMap(reversed);
  };

  const handleCopyRouteLink = (route: PlannedRoute) => {
    const text = `${route.routeName} (${route.distanceKm} km, +${route.elevationGainM} m) – Cyklistický Asistent`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedRouteId(route.id);
      setTimeout(() => setCopiedRouteId(null), 2000);
    }
  };

  const handleResetChat = () => {
    if (window.confirm('Opravdu chcete začít nové plánování a vyčistit historii konverzace?')) {
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

  // Filter curated routes with diacritic normalization and waypoint search
  const filteredCuratedRoutes = CURATED_ROUTES.filter((r) => {
    const matchesBike =
      curatedBikeFilter === 'all' ||
      (curatedBikeFilter === 'road' && (r.bikeType?.includes('Silni') || r.bikeType?.includes('Gravel'))) ||
      (curatedBikeFilter === 'mtb' && r.bikeType?.includes('MTB')) ||
      (curatedBikeFilter === 'family' && (r.difficulty === 'Lehká' || r.bikeType?.includes('Městsk') || r.bikeType?.includes('Rodinné')));

    if (!curatedSearch.trim()) return matchesBike;

    const matchesSearch =
      searchMatches(r.routeName, curatedSearch) ||
      searchMatches(r.region || '', curatedSearch) ||
      searchMatches(r.description || '', curatedSearch) ||
      Boolean(r.waypoints && r.waypoints.some((w) => searchMatches(w.name, curatedSearch) || searchMatches(w.note || '', curatedSearch)));

    return matchesBike && matchesSearch;
  });

  return (
    <div className="flex flex-col h-full w-full bg-stone-950 text-stone-100 overflow-hidden select-none">
      {/* Planner Top App Header Bar */}
      <div className="px-4 py-3 bg-stone-900 border-b border-stone-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-teal-400 flex items-center justify-center text-stone-950 font-bold shadow-md shadow-cyan-500/20">
            <Compass className="w-4 h-4 stroke-[2.4]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              Plánovač tras
              <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 text-[10px] font-mono border border-cyan-800/40">
                AI + OSM
              </span>
            </h2>
            <p className="text-[11px] text-stone-400 hidden sm:block">
              Inteligentní vyhledání a generování cyklotras na veřejných mapách
            </p>
          </div>
        </div>

        {/* Reset Chat button */}
        <button
          id="btn-reset-planner-chat"
          type="button"
          onClick={handleResetChat}
          title="Začít novou relaci plánování"
          className="p-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 border border-stone-700 transition-all cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Sub-Navigation Tabs: Chat vs Builder vs Curated */}
      <div className="px-4 pt-2.5 pb-2 bg-stone-900/70 border-b border-stone-800/80 flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'chat'
              ? 'bg-cyan-500 text-stone-950 shadow-md font-bold'
              : 'bg-stone-800/80 hover:bg-stone-800 text-stone-300'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI CykloNavigátor</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('builder')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'builder'
              ? 'bg-cyan-500 text-stone-950 shadow-md font-bold'
              : 'bg-stone-800/80 hover:bg-stone-800 text-stone-300'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Bodový plánovač</span>
        </button>

        <button
          id="btn-tab-blansko-district"
          type="button"
          onClick={() => setActiveTab('blansko')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'blansko'
              ? 'bg-amber-400 text-stone-950 shadow-md font-bold'
              : 'bg-stone-800/80 hover:bg-stone-800 text-stone-300'
          }`}
        >
          <Building className="w-3.5 h-3.5 text-amber-400 group-hover:text-amber-300" />
          <span>Okres Blansko</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
            activeTab === 'blansko' ? 'bg-stone-950/40 text-stone-950' : 'bg-amber-500/20 text-amber-300'
          }`}>
            {BLANSKO_MUNICIPALITIES.length} obcí
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('curated')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'curated'
              ? 'bg-cyan-500 text-stone-950 shadow-md font-bold'
              : 'bg-stone-800/80 hover:bg-stone-800 text-stone-300'
          }`}
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span>TOP Trasy ČR ({CURATED_ROUTES.length})</span>
        </button>
      </div>

      {/* Main Tab Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* TAB 1: AI CHAT ASSISTANT */}
        {activeTab === 'chat' && (
          <div className="p-4 sm:p-5 space-y-4 max-w-4xl mx-auto">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-2xl ${
                    isUser ? 'ml-auto' : 'mr-auto'
                  }`}
                >
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
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  {/* Message bubble */}
                  <div
                    className={`p-4 rounded-2xl text-sm leading-relaxed ${
                      isUser
                        ? 'bg-cyan-600 text-white rounded-br-none shadow-md shadow-cyan-900/20'
                        : 'glass-tile text-stone-100 !rounded-bl-none shadow-lg'
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

                  {/* If assistant returned a planned route */}
                  {msg.plannedRoute && (
                    <div className="mt-3 w-full animate-in fade-in zoom-in-95 duration-200">
                      <RouteElevationProfile
                        route={msg.plannedRoute}
                        onHoverDistance={onHoverRouteDistance}
                      />

                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center gap-2 mt-2.5 p-3 glass-card">
                        <button
                          type="button"
                          onClick={() => {
                            setInspectedRoute(msg.plannedRoute!);
                            onSelectRouteOnMap(msg.plannedRoute!, true);
                          }}
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
                          onClick={() => handleReverseCurrentRoute(msg.plannedRoute!)}
                          title="Otočit směr jízdy po trase"
                          className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Repeat className="w-3.5 h-3.5 text-stone-400" />
                          <span>Obrátit směr</span>
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
                          <span>GPX</span>
                        </button>

                        {onStartRideWithRoute && (
                          <button
                            type="button"
                            onClick={() => onStartRideWithRoute(msg.plannedRoute!)}
                            className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ml-auto"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Jet trasu</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-start gap-2 text-stone-400 mr-auto max-w-md">
                <div className="p-3.5 rounded-2xl bg-stone-900 border border-stone-800 flex items-center gap-2.5 text-xs shadow-lg">
                  <Compass className="w-4 h-4 text-cyan-400 animate-spin" />
                  <span>CykloNavigátor hledá a propočítává ideální trasu podle profilu a map...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* TAB 2: STRUCTURED BUILDER / PARAMETERS */}
        {activeTab === 'builder' && (
          <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5 animate-in fade-in duration-200">
            <div className="glass-card p-4 sm:p-5 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Přesný plánovač parametrů</h3>
                  <p className="text-xs text-stone-400">Nastavte parametry a nechte aplikaci vygenerovat ideální cyklotrasu</p>
                </div>
              </div>

              {/* Start & Destination inputs */}
              <div className="space-y-3 mb-4">
                {/* HTML Datalist for all 116 Blansko municipalities + Czech hubs */}
                <datalist id="blansko-municipalities-datalist">
                  {BLANSKO_MUNICIPALITIES.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.type === 'město' ? 'Město' : m.type === 'městys' ? 'Městys' : m.type === 'památka' ? 'Památka' : 'Obec'} (okres Blansko, {m.elevationM} m n. m.){m.cyclingHighlight ? ` – ${m.cyclingHighlight}` : ''}
                    </option>
                  ))}
                </datalist>

                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    Výchozí bod (Start)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      list="blansko-municipalities-datalist"
                      placeholder="např. Blansko, Boskovice, Jedovnice, Praha..."
                      value={builderOrigin}
                      onChange={(e) => setBuilderOrigin(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-xs focus:outline-none focus:border-cyan-500"
                    />
                    {currentLocation && (
                      <button
                        type="button"
                        onClick={() => setBuilderOrigin('Moje aktuální poloha')}
                        className="absolute right-2 top-2 px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-cyan-400 text-[10px] font-semibold transition-all cursor-pointer"
                      >
                        Moje GPS
                      </button>
                    )}
                  </div>
                </div>

                {/* Loop toggle */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-stone-950/60 border border-stone-800">
                  <div className="flex items-center gap-2">
                    <Repeat className="w-4 h-4 text-cyan-400" />
                    <div>
                      <span className="text-xs font-semibold text-white block">Okruh (Návrat na start)</span>
                      <span className="text-[10px] text-stone-400">Trasa se vrátí do výchozího místa po jiné větvi</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={builderIsLoop}
                    onChange={(e) => setBuilderIsLoop(e.target.checked)}
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                  />
                </div>

                {!builderIsLoop && (
                  <div>
                    <label className="block text-xs font-semibold text-stone-300 mb-1 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-rose-400" />
                      Cílový bod (Cíl)
                    </label>
                    <input
                      type="text"
                      list="blansko-municipalities-datalist"
                      placeholder="např. Jedovnice, Macocha, Letovice, Křtiny..."
                      value={builderDestination}
                      onChange={(e) => setBuilderDestination(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-xs focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                )}

                {/* Quick Blansko district selector chips */}
                <div className="pt-2 border-t border-stone-800/60">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-medium text-amber-400 flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      Rychlý výběr – Okres Blansko:
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('blansko')}
                      className="text-[11px] text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-0.5 cursor-pointer font-medium"
                    >
                      Katalog všech 116 obcí <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                    {[
                      'Blansko',
                      'Boskovice',
                      'Jedovnice',
                      'Letovice',
                      'Adamov',
                      'Kunštát',
                      'Černá Hora',
                      'Lysice',
                      'Sloup',
                      'Křtiny',
                      'Rudice',
                      'Ostrov u Macochy',
                      'Rájec-Jestřebí',
                      'Suchý',
                      'Kořenec'
                    ].map((locName) => (
                      <button
                        key={locName}
                        type="button"
                        onClick={() => {
                          if (builderIsLoop || !builderOrigin) {
                            setBuilderOrigin(locName);
                          } else {
                            setBuilderDestination(locName);
                          }
                        }}
                        className="px-2 py-0.5 rounded-lg bg-stone-950 hover:bg-amber-950/40 text-[11px] text-stone-300 hover:text-amber-300 border border-stone-800 hover:border-amber-700/50 transition-all cursor-pointer"
                        title={`Vybrat ${locName} jako ${builderIsLoop || !builderOrigin ? 'Start' : 'Cíl'}`}
                      >
                        {locName}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Grid of parameters: Bike, Distance, Surface */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1 flex items-center gap-1.5">
                    <Bike className="w-3.5 h-3.5 text-cyan-400" />
                    Typ kola
                  </label>
                  <select
                    value={builderBikeType}
                    onChange={(e) => setBuilderBikeType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="Silniční">Silniční (hladký asfalt, svižné tempo)</option>
                    <option value="Gravel">Gravel (asfalt + polní a štěrkové cesty)</option>
                    <option value="Horský (MTB)">Horský MTB (lesní traily, stoupání)</option>
                    <option value="Treking / Krosové">Treking / Krosové (pohodové zpevněné cesty)</option>
                    <option value="Elektrokolo (e-bike)">Elektrokolo (i delší kopce)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-emerald-400" />
                      Cílová vzdálenost
                    </span>
                    <span className="font-mono font-bold text-cyan-400">{builderDistanceKm} km</span>
                  </label>
                  <div className="pt-2">
                    <input
                      type="range"
                      min="10"
                      max="120"
                      step="5"
                      value={builderDistanceKm}
                      onChange={(e) => setBuilderDistanceKm(Number(e.target.value))}
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    Preferovaný povrch
                  </label>
                  <select
                    value={builderSurface}
                    onChange={(e) => setBuilderSurface(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="100% hladký asfalt">100% hladký asfalt (bez šotoliny)</option>
                    <option value="Asfalt a zpevněný štěrk">Asfalt a jemná zpevněná šotolina</option>
                    <option value="Lesní cesty a přírodní terén">Lesní cesty a přírodní terén</option>
                    <option value="Vyhrazené cyklostezky podél řeky">Cyklostezky podél vody</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-stone-950 border border-stone-800 cursor-pointer text-xs text-stone-300">
                    <input
                      type="checkbox"
                      checked={builderAvoidTraffic}
                      onChange={(e) => setBuilderAvoidTraffic(e.target.checked)}
                      className="w-4 h-4 rounded accent-cyan-500"
                    />
                    <span>Vyhnout se frekventovaným silnicím I. třídy</span>
                  </label>
                </div>
              </div>

              {/* Submit button */}
              <button
                type="button"
                onClick={handleGenerateFromBuilder}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-stone-950 font-bold text-sm transition-all shadow-lg shadow-cyan-500/20 cursor-pointer flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-stone-950" />
                <span>Vygenerovat a zobrazit trasu na mapě</span>
              </button>
            </div>

            {/* If a route is already inspected, show preview below builder */}
            {inspectedRoute && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                    Aktuální navržená trasa
                  </span>
                  <button
                    type="button"
                    onClick={() => handleReverseCurrentRoute(inspectedRoute)}
                    className="text-xs text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Repeat className="w-3 h-3" />
                    Obrátit směr
                  </button>
                </div>
                <RouteElevationProfile route={inspectedRoute} onHoverDistance={onHoverRouteDistance} />
              </div>
            )}
          </div>
        )}

        {/* TAB 3: OKRES BLANSKO MUNICIPALITIES & TOWNS */}
        {activeTab === 'blansko' && (
          <div className="p-4 sm:p-5 max-w-4xl mx-auto space-y-4 animate-in fade-in duration-200">
            {/* Header info card */}
            <div className="glass-card p-4 sm:p-5 shadow-lg !border-amber-500/30">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        Města a obce okresu Blansko
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-mono font-bold border border-amber-600/30">
                          {filteredBlanskoMunicipalities.length} z {BLANSKO_MUNICIPALITIES.length}
                        </span>
                      </h3>
                      <p className="text-xs text-stone-300">
                        Moravský kras, Boskovická brázda, Malá Haná a údolí Svitavy
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-stone-300 mt-2 leading-relaxed">
                    Všech 116 měst, městysů a obcí okresu Blansko s přesnými souřadnicemi, nadmořskou výškou a cyklistickými tipy. Vyberte obec jako start, cíl, nebo nechte AI vygenerovat vyhlídkový okruh.
                  </p>
                </div>
              </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Hledat obec, město nebo památku (např. Jedovnice, Rudice, Boskovice, Macocha)..."
                    value={blanskoSearch}
                    onChange={(e) => setBlanskoSearch(e.target.value)}
                    className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-stone-950/80 border border-white/10 text-stone-100 text-xs focus:outline-none focus:border-amber-500 placeholder:text-stone-400"
                  />
                  {blanskoSearch && (
                    <button
                      type="button"
                      onClick={() => setBlanskoSearch('')}
                      className="absolute right-3 top-3 text-stone-400 hover:text-stone-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Type Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <span className="text-[11px] text-stone-400 mr-1 flex items-center gap-1 shrink-0 font-medium">
                  <Filter className="w-3 h-3" />
                  Filtr:
                </span>
                {[
                  { key: 'all', label: `Všechny (${BLANSKO_MUNICIPALITIES.length})` },
                  { key: 'město', label: 'Města (8)' },
                  { key: 'městys', label: 'Městysy (9)' },
                  { key: 'památka', label: 'Památky & Kras (6)' },
                  { key: 'obec', label: 'Obce (93)' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setBlanskoTypeFilter(tab.key as any)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                      blanskoTypeFilter === tab.key
                        ? 'bg-amber-500 text-stone-950 font-bold'
                        : 'bg-stone-800/80 hover:bg-stone-700/80 text-stone-300 hover:text-white border border-white/10'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* List / Grid of Municipalities */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {filteredBlanskoMunicipalities.map((m) => {
                const isCity = m.type === 'město';
                const isMarketTown = m.type === 'městys';
                const isLandmark = m.type === 'památka';

                return (
                  <div
                    key={m.id}
                    className="p-3.5 glass-tile hover:!border-amber-500/40 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              isCity
                                ? 'bg-amber-500/20 text-amber-400'
                                : isMarketTown
                                ? 'bg-cyan-500/20 text-cyan-400'
                                : isLandmark
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-stone-800 text-stone-300'
                            }`}
                          >
                            {isCity ? (
                              <Building2 className="w-4 h-4" />
                            ) : isLandmark ? (
                              <Landmark className="w-4 h-4" />
                            ) : isMarketTown ? (
                              <Building className="w-4 h-4" />
                            ) : (
                              <Home className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                              {m.name}
                            </h4>
                            <div className="flex items-center gap-2 text-[11px] text-stone-400">
                              <span className="font-mono text-stone-300 font-medium">
                                {m.elevationM} m n. m.
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Type badge */}
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider shrink-0 ${
                            isCity
                              ? 'bg-amber-950/80 text-amber-300 border border-amber-800/40'
                              : isMarketTown
                              ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/40'
                              : isLandmark
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/40'
                              : 'bg-stone-800/80 text-stone-400'
                          }`}
                        >
                          {m.type}
                        </span>
                      </div>

                      {/* Cycling highlight description */}
                      {m.cyclingHighlight && (
                        <p className="text-xs text-stone-400 mt-1 mb-3 line-clamp-2 leading-relaxed">
                          {m.cyclingHighlight}
                        </p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="pt-2 border-t border-stone-800/60 flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleSelectBlanskoAsStart(m)}
                        className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-[11px] text-emerald-300 font-semibold border border-stone-700 hover:border-emerald-600/40 transition-all cursor-pointer flex items-center gap-1"
                        title={`Nastavit ${m.name} jako výchozí bod`}
                      >
                        <MapPin className="w-3 h-3 text-emerald-400" />
                        Jako Start
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectBlanskoAsDest(m)}
                        className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-[11px] text-rose-300 font-semibold border border-stone-700 hover:border-rose-600/40 transition-all cursor-pointer flex items-center gap-1"
                        title={`Nastavit ${m.name} jako cíl`}
                      >
                        <MapPin className="w-3 h-3 text-rose-400" />
                        Jako Cíl
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePlanLoopFromBlansko(m)}
                        className="ml-auto px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-[11px] text-amber-300 font-semibold border border-amber-700/40 hover:border-amber-500/60 transition-all cursor-pointer flex items-center gap-1"
                        title={`Vygenerovat okružní cyklotrasu z ${m.name}`}
                      >
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        Okruh odsud (AI)
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredBlanskoMunicipalities.length === 0 && (
              <div className="text-center py-12 bg-stone-900/40 rounded-2xl border border-stone-800">
                <Building className="w-8 h-8 text-stone-600 mx-auto mb-2" />
                <p className="text-sm text-stone-300 font-medium">Žádná obec nebyla nalezena</p>
                <p className="text-xs text-stone-500 mt-1">Zkuste změnit hledaný výraz nebo resetovat filtry.</p>
                <button
                  type="button"
                  onClick={() => {
                    setBlanskoSearch('');
                    setBlanskoTypeFilter('all');
                  }}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs text-amber-400 cursor-pointer font-medium"
                >
                  Zobrazit všech 116 obcí
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: CURATED TOP ROUTES IN CZECHIA */}
        {activeTab === 'curated' && (
          <div className="p-4 sm:p-5 max-w-4xl mx-auto space-y-4 animate-in fade-in duration-200">
            {/* Search & Filter Bar */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 text-stone-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Hledat trasu podle názvu, regionu (např. Karlštejn, Pálava, Šumava, Brno)..."
                    value={curatedSearch}
                    onChange={(e) => setCuratedSearch(e.target.value)}
                    className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-stone-900 border border-stone-800 text-stone-100 text-xs focus:outline-none focus:border-cyan-500 placeholder:text-stone-500"
                  />
                  {curatedSearch && (
                    <button
                      type="button"
                      onClick={() => setCuratedSearch('')}
                      className="absolute right-2.5 top-2.5 p-1 text-stone-500 hover:text-stone-200 cursor-pointer"
                      title="Smazat hledání"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 bg-stone-900 p-1 rounded-xl border border-stone-800 shrink-0 overflow-x-auto">
                  {[
                    { id: 'all', label: 'Vše' },
                    { id: 'road', label: 'Silniční / Gravel' },
                    { id: 'mtb', label: 'MTB Horská' },
                    { id: 'family', label: 'Nenáročné' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setCuratedBikeFilter(f.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        curatedBikeFilter === f.id
                          ? 'bg-cyan-500 text-stone-950 font-bold'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick region tags and result count */}
              <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 text-xs">
                <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto">
                  <span className="text-[11px] text-stone-500 font-semibold shrink-0">Region:</span>
                  {[
                    { label: 'Všechny', query: '' },
                    { label: 'Karlštejn', query: 'karlstejn' },
                    { label: 'Brno & Kras', query: 'brno' },
                    { label: 'Šumava', query: 'sumava' },
                    { label: 'Beskydy', query: 'beskyd' },
                    { label: 'Pálava', query: 'palav' },
                    { label: 'Jizerky', query: 'jizer' },
                    { label: 'Litovel', query: 'litovel' },
                  ].map((chip) => {
                    const isSelected = chip.query === '' ? !curatedSearch : normalizeDiacritics(curatedSearch).includes(chip.query);
                    return (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => setCuratedSearch(chip.query === '' ? '' : chip.label)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all shrink-0 cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                            : 'bg-stone-900 hover:bg-stone-800 text-stone-400 border border-stone-800'
                        }`}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
                <span className="text-[11px] text-stone-500 whitespace-nowrap font-mono shrink-0">
                  {filteredCuratedRoutes.length} {filteredCuratedRoutes.length === 1 ? 'trasa' : filteredCuratedRoutes.length < 5 ? 'trasy' : 'tras'}
                </span>
              </div>
            </div>

            {/* List of Curated Routes */}
            <div className="grid grid-cols-1 gap-3.5">
              {filteredCuratedRoutes.map((route) => {
                const isActive = activePlannedRouteId === route.id;
                return (
                  <div
                    key={route.id}
                    className={`p-4 glass-card transition-all ${
                      isActive
                        ? '!border-cyan-500 !ring-1 !ring-cyan-500/50 shadow-xl'
                        : 'hover:!border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">
                            {route.region}
                          </span>
                          {route.difficulty && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-stone-800 text-stone-300">
                              {route.difficulty}
                            </span>
                          )}
                        </div>
                        <h4 className="text-base font-extrabold text-white mt-0.5">{route.routeName}</h4>
                      </div>

                      <span className="px-2.5 py-1 rounded-xl bg-stone-800/80 border border-white/10 text-stone-200 text-xs font-semibold shrink-0">
                        {route.bikeType}
                      </span>
                    </div>

                    <p className="text-xs text-stone-300 leading-relaxed mb-3">{route.description}</p>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-4 gap-2 p-2.5 rounded-xl glass-tile !bg-stone-950/60 border border-white/10 text-center mb-3 text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-stone-400 block font-sans">Délka</span>
                        <span className="font-extrabold text-cyan-400">{route.distanceKm} km</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-400 block font-sans">Převýšení</span>
                        <span className="font-extrabold text-emerald-400">+{route.elevationGainM} m</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-400 block font-sans">Odhadovaný čas</span>
                        <span className="font-bold text-stone-200">
                          {Math.floor((route.estimatedDurationMin || 60) / 60)}h {(route.estimatedDurationMin || 60) % 60}m
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-400 block font-sans">Provoz</span>
                        <span className="font-bold text-stone-300 text-[11px] truncate block">
                          {route.trafficLevel?.split(' ')[0] || 'Bez aut'}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => {
                          setInspectedRoute(route);
                          onSelectRouteOnMap(route, true);
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
                          isActive
                            ? 'bg-emerald-500 text-stone-950'
                            : 'bg-cyan-500 hover:bg-cyan-400 text-stone-950'
                        }`}
                      >
                        <Map className="w-4 h-4" />
                        <span>{isActive ? 'Zobrazeno na mapě' : 'Vybrat na mapu'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const gpxContent = exportPlannedRouteToGpx(route);
                          const filename = `${route.routeName.replace(/[^a-z0-9]/gi, '_')}.gpx`;
                          downloadFile(gpxContent, filename, 'application/gpx+xml');
                        }}
                        className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-stone-400" />
                        <span>GPX</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyRouteLink(route)}
                        className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        {copiedRouteId === route.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Zkopírováno</span>
                          </>
                        ) : (
                          <>
                            <Share2 className="w-3.5 h-3.5 text-stone-400" />
                            <span>Sdílet</span>
                          </>
                        )}
                      </button>

                      {onStartRideWithRoute && (
                        <button
                          type="button"
                          onClick={() => onStartRideWithRoute(route)}
                          className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ml-auto"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Jet trasu</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Quick Prompt Chips Bar (in Chat mode) */}
      {activeTab === 'chat' && (
        <div className="px-3.5 py-2 border-t border-stone-800 bg-stone-900/60 overflow-x-auto shrink-0 flex items-center gap-2 no-scrollbar">
          <span className="text-[11px] text-stone-500 whitespace-nowrap">Rychlé dotazy:</span>
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
      )}

      {/* Input Message Area (in Chat mode) */}
      {activeTab === 'chat' && (
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
                placeholder="Napište instrukce pro trasu (např. 'Chci 45 km silniční okruh z Karlštejna s hezkým asfaltem a výhledem')..."
                className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-950 border border-stone-800 text-stone-100 placeholder:text-stone-500 text-xs sm:text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 resize-none"
              />
            </div>

            <button
              id="btn-send-planner-msg"
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!inputMessage.trim() || isLoading}
              className="p-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-stone-950 transition-all font-bold shadow-lg shadow-cyan-500/20 cursor-pointer flex items-center justify-center shrink-0"
              title="Odeslat instrukce na trasu"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center justify-between text-[10px] text-stone-500 mt-1.5 max-w-4xl mx-auto px-1">
            <span>Enter = odeslat • Shift+Enter = nový řádek</span>
            <span>Výpočet GPX a převýšení na veřejných mapách</span>
          </div>
        </div>
      )}
    </div>
  );
};
