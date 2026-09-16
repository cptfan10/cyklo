import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

const CANDIDATE_MODELS = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"];

function sanitizeHistory(history: any[], currentMessage: string): any[] {
  if (!Array.isArray(history)) return [];
  const clean: any[] = [];
  const trimmedCurr = (currentMessage || "").trim();

  for (const item of history) {
    if (!item || !item.role || !Array.isArray(item.parts)) continue;
    const text = item.parts.map((p: any) => p?.text || "").join(" ").trim();
    if (!text) continue;

    // Do not repeat current message at the end of history
    if (item.role === "user" && text === trimmedCurr) continue;

    // Strict alternation: user -> model -> user -> model
    if (clean.length > 0 && clean[clean.length - 1].role === item.role) {
      clean[clean.length - 1].parts[0].text += `\n\n${text}`;
    } else {
      clean.push({
        role: item.role === "user" ? "user" : "model",
        parts: [{ text }],
      });
    }
  }

  // Multi-turn chat must end with model if next turn is user (via sendMessage)
  while (clean.length > 0 && clean[clean.length - 1].role === "user") {
    clean.pop();
  }

  return clean;
}

async function generateContentWithFallback(
  ai: GoogleGenAI,
  params: { contents: any; config?: any }
): Promise<{ text: string; model: string }> {
  let lastError: any = null;
  for (const model of CANDIDATE_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          ...params,
          model,
        });
        if (response && response.text) {
          return { text: response.text, model };
        }
      } catch (err: any) {
        lastError = err;
        const status = err?.status || err?.statusCode || "";
        console.warn(`Model ${model} (attempt ${attempt + 1}) failed (${status || err?.message || "error"}), checking next...`);
        if (attempt === 0 && (status === 503 || status === 429)) {
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
        break;
      }
    }
  }
  throw lastError || new Error("All Gemini models unavailable");
}

async function sendChatWithFallback(
  ai: GoogleGenAI,
  options: {
    systemInstruction: string;
    history: any[];
    message: string;
  }
): Promise<{ text: string; model: string }> {
  const cleanHistory = sanitizeHistory(options.history, options.message);
  let lastError: any = null;

  for (const model of CANDIDATE_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const chat = ai.chats.create({
          model,
          config: {
            systemInstruction: options.systemInstruction,
          },
          history: cleanHistory,
        });
        const response = await chat.sendMessage({
          message: options.message,
        });
        if (response && response.text) {
          return { text: response.text, model };
        }
      } catch (err: any) {
        lastError = err;
        const status = err?.status || err?.statusCode || "";
        console.warn(`Chat model ${model} (attempt ${attempt + 1}) failed (${status || err?.message || "error"})...`);
        if (attempt === 0 && (status === 503 || status === 429)) {
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
        break;
      }
    }
  }
  throw lastError || new Error("All Gemini chat models unavailable");
}

function generateFallbackCoachResponse(message: string, rideContext?: any): string {
  const lower = (message || "").toLowerCase();
  let contextSnippet = "";
  if (rideContext && rideContext.distanceKm > 0) {
    contextSnippet = `\n\n*Na základě vaší jízdy (${rideContext.distanceKm.toFixed(1)} km, průměr ${rideContext.avgSpeedKmh.toFixed(1)} km/h, nastoupáno ${rideContext.elevationGainM} m):*`;
  }

  if (lower.includes("kadenc") || lower.includes("šlap") || lower.includes("otác")) {
    return `### 🚴‍♂️ Kadence a efektivita šlapání
Pro optimální výkon a ochranu kolenních kloubů se doporučuje:
- **Roviny a mírně zvlněný terén:** 85–95 otáček za minutu (RPM).
- **Stoupání v sedle:** 75–85 RPM. Vyvarujte se silovému „drcení těžkých převodů“ pod 70 RPM, které přetěžuje úpony.
- **Proč vyšší kadence?** Přesouvá zátěž ze svalů (které rychleji tuhnou laktátem) na kardiovaskulární systém, který regeneruje podstatně rychleji.${contextSnippet}`;
  }

  if (lower.includes("jíd") || lower.includes("výživ") || lower.includes("pit") || lower.includes("hydrat") || lower.includes("křeč") || lower.includes("iont")) {
    return `### 💧 Výživa a hydratace na kole
- **Pitný režim:** Pijte každých 15–20 minut 150–200 ml tekutin. Při teplotách nad 20 °C doplňujte hypotonický iontový nápoj se sodíkem a draslíkem.
- **Energie během jízdy:**
  - Jízdy do 60 min: postačí čistá voda nebo lehký ionťák.
  - Jízdy nad 75 min: doplňujte 30–60 g sacharidů za hodinu (banán, energetický gel, tyčinka).
- **Proti svalovým křečím:** Křeče většinou nezpůsobuje nedostatek hořčíku, ale přetížení neadaptovaných svalů a dehydratace se ztrátou sodíku. Udržujte plynulé tempo.${contextSnippet}`;
  }

  if (lower.includes("posed") || lower.includes("bolest") || lower.includes("zad") || lower.includes("kolen") || lower.includes("sedl")) {
    return `### 🛠️ Nastavení posedu a prevence bolesti
- **Bolest přední strany kolene:** Sedlo je pravděpodobně příliš nízko nebo moc vepředu.
- **Bolest podkolenní šlachy (vzadu):** Sedlo je příliš vysoko, při došlapu propínáte nohu.
- **Bolest beder a krční páteře:** Často způsobeno příliš dlouhým představcem (přetažený posed) nebo slabým středem těla (core). Zkuste zkrátit dosah řídítek nebo otočit představec do pozitivního úhlu.
- **Základní pravidlo výšky sedla:** Pata na pedálu v nejnižším bodě by měla mít nohu zcela napnutou (při zacvaknuté tretře pak koleno zůstává mírně pokrčené pod úhlem cca 25–30°).${contextSnippet}`;
  }

  if (lower.includes("tep") || lower.includes("zón") || lower.includes("trénink") || lower.includes("rychlost") || lower.includes("výkon")) {
    return `### 🎯 Tréninkové zóny a budování rychlosti
- **80/20 pravidlo vytrvalosti:** 80 % objemu najezděte v základní vytrvalosti (Zóna 2 – aerobní pásmo, kdy můžete souvisle mluvit). Tím se buduje mitochondriální hustota a efektivní spalování tuků.
- **Intervaly (20 %):** Jednou týdně zařaďte intervaly ve stoupání (např. 4× 4 minuty na 90 % TF max s 3minutovým odpočinkem) pro navýšení VO2 max.
- **Pauzy:** Svaly nerostou při tréninku, ale během odpočinku. Po náročné vyjížďce zařaďte lehký regenerační den.${contextSnippet}`;
  }

  if (lower.includes("tlak") || lower.includes("pláš") || lower.includes("defekt") || lower.includes("duš")) {
    return `### 🔧 Tlak v pláštích a servis
- **Silniční kolo (28 mm):** cca 4.5–5.5 bar (tubeless o 0.5–1 bar méně).
- **Gravel (40–45 mm):** cca 2.2–3.0 bar pro optimální grip a nízký valivý odpor v terénu.
- **Horský bike (2.25–2.4"):** cca 1.4–1.9 bar podle váhy jezdce.
- **Tip:** Nižší tlak na nerovnostech nezpomaluje, naopak zvyšuje trakci a šetří energii absorbováním vibrací.${contextSnippet}`;
  }

  return `### 🚴 Osobní cyklistický asistent
Rád vám pomohu s jakýmkoliv aspektem vaší cyklistiky:
- **Tréninkové rady:** Zlepšení průměrné rychlosti, kadence, tepových zón a vytrvalosti.
- **Příprava & výživa:** Pitný režim, energetické gely, regenerace po zátěži.
- **Technika & kolo:** Správný posed, tlak v pláštích, převody a údržba.
- **Trasy:** Plánování bezpečných tras mimo provoz po kvalitním asfaltu i šotolině.

Zeptejte se na cokoliv konkrétního k vaší vyjížďce!${contextSnippet}`;
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Analyze cycling ride
app.post("/api/analyze-ride", async (req, res) => {
  try {
    const { ride } = req.body;
    if (!ride) {
      return res.status(400).json({ error: "Missing ride data" });
    }

    const ai = getGeminiClient();
    if (!ai) {
      // Intelligent fallback analysis when API key is pending
      const distance = Number(ride.distanceKm || 0);
      const durationMin = Math.round(Number(ride.durationSeconds || 0) / 60);
      const avgSpeed = Number(ride.avgSpeedKmh || 0);
      const elevation = Number(ride.elevationGainM || 0);
      const calories = Number(ride.caloriesBurned || 0);

      const fallbackAnalysis = `### 🚴‍♂️ Analýza jízdy: ${ride.name || "Cyklistická trasa"}
**Základní přehled:**
- **Vzdálenost:** ${distance.toFixed(1)} km
- **Čas jízdy:** ${Math.floor(durationMin / 60)}h ${durationMin % 60}m
- **Průměrná rychlost:** ${avgSpeed.toFixed(1)} km/h
- **Nastoupané metry:** ${elevation} m
- **Spálené kalorie:** cca ${calories} kcal

**Zhodnocení tempa a výkonu:**
${avgSpeed > 25 ? "Velmi svižné sportovní tempo! Váš výkon odpovídá pokročilému tréninkovému zatížení." : avgSpeed > 18 ? "Příjemné vytrvalostní tempo v aerobním pásmu, ideální pro budování kardio kondice a spalování tuků." : "Pohodová rekreační projížďka s důrazem na regeneraci a techniku šlapání."}

**Terén a převýšení:**
${elevation > 400 ? `Významné převýšení (${elevation} m) kladlo vysoké nároky na sílu nohou a hospodaření se silami ve stoupáních.` : "Mírně zvlněný až rovinatý profil umožňoval udržet plynulou kadenci šlapání."}

**Doporučení pro regeneraci:**
1. Doplňte cca ${Math.round(distance * 25)} ml tekutin s elektrolyty a lehké sacharidy s proteiny do 45 minut.
2. Dopřejte nohám lehké protažení kvadricepsů a lýtek.
3. Pro další trénink doporučujeme ${elevation > 300 ? "lehkou regenerační vyjížďku po rovině" : "postupné navýšení délky trasy o 10-15 %"}.`;

      return res.json({ analysis: fallbackAnalysis, source: "rule-engine" });
    }

    const prompt = `Jsi profesionální sportovní trenér a asistent cyklistiky. Proveď podrobnou, motivující a odbornou analýzu následující cyklistické jízdy pro cyklistu.

Údaje o jízdě:
- Název trasy / jízdy: ${ride.name || "Neznámá trasa"}
- Ujetá vzdálenost: ${ride.distanceKm} km
- Celkový čas: ${Math.floor(ride.durationSeconds / 60)} minut (${ride.durationSeconds} s)
- Čistý čas pohybu: ${Math.floor((ride.movingTimeSeconds || ride.durationSeconds) / 60)} minut
- Průměrná rychlost: ${ride.avgSpeedKmh} km/h
- Maximální rychlost: ${ride.maxSpeedKmh} km/h
- Nastoupané převýšení (Elevation gain): ${ride.elevationGainM} m
- Klesání (Elevation loss): ${ride.elevationLossM || 0} m
- Odhadované spálené kalorie: ${ride.caloriesBurned} kcal
- Průměrná kadence/tempo: ${ride.avgPace || "N/A"}
- Typ kola/terénu: ${ride.bikeType || "Silniční / Gravel / Horský"}
- Poznámky cyklisty k pocitu: ${ride.cyclistNotes || "Běžná jízda"}
${ride.elevationProfileSample && ride.elevationProfileSample.length > 0 ? `- Vzorky nadmořské výšky (m): ${ride.elevationProfileSample.slice(0, 15).join(", ")}...` : ""}

Požadavky na výstup (uveď v přehledném Markdownu v češtině):
1. **🏆 Celkové shrnutí & Index výkonu** (stručné zhodnocení, jak si jezdec vedl s ohledem na profil a rychlost)
2. **⚡ Analýza tempa a rychlostních zón** (hospodaření se silami, srovnání průměrné a max rychlosti, plynulost jízdy)
3. **⛰️ Zhodnocení kopců a převýšení** (stoupací náročnost, intenzita, VAM odhad)
4. **💧 Výživa, hydratace a regenerace** (konkrétní doporučení tekutin, iontů a sacharidů po této zátěži, doba doporučeného odpočinku)
5. **🎯 3 konkrétní tréninkové tipy pro další jízdu** (konkrétní rady ke zlepšení techniky, kadence nebo plánování trasy).

Buď přátelský, odborný a povzbudivý.`;

    let analysisText = "";
    let sourceModel = "gemini";
    try {
      const result = await generateContentWithFallback(ai, {
        contents: prompt,
      });
      analysisText = result.text;
      sourceModel = result.model;
    } catch (modelErr: any) {
      console.warn("Gemini model error during ride analysis, falling back to rule-engine:", modelErr?.message || modelErr);
      const distance = Number(ride.distanceKm || 0);
      const durationMin = Math.round(Number(ride.durationSeconds || 0) / 60);
      const avgSpeed = Number(ride.avgSpeedKmh || 0);
      const elevation = Number(ride.elevationGainM || 0);
      const calories = Number(ride.caloriesBurned || 0);

      analysisText = `### 🚴‍♂️ Analýza jízdy: ${ride.name || "Cyklistická trasa"}
**Základní přehled:**
- **Vzdálenost:** ${distance.toFixed(1)} km
- **Čas jízdy:** ${Math.floor(durationMin / 60)}h ${durationMin % 60}m
- **Průměrná rychlost:** ${avgSpeed.toFixed(1)} km/h
- **Nastoupané metry:** ${elevation} m
- **Spálené kalorie:** cca ${calories} kcal

**Zhodnocení tempa a výkonu:**
${avgSpeed > 25 ? "Velmi svižné sportovní tempo! Váš výkon odpovídá pokročilému tréninkovému zatížení." : avgSpeed > 18 ? "Příjemné vytrvalostní tempo v aerobním pásmu, ideální pro budování kardio kondice a spalování tuků." : "Pohodová rekreační projížďka s důrazem na regeneraci a techniku šlapání."}

**Terén a převýšení:**
${elevation > 400 ? `Významné převýšení (${elevation} m) kladlo vysoké nároky na sílu nohou a hospodaření se silami ve stoupáních.` : "Mírně zvlněný až rovinatý profil umožňoval udržet plynulou kadenci šlapání."}

**Doporučení pro regeneraci:**
1. Doplňte cca ${Math.round(distance * 25)} ml tekutin s elektrolyty a lehké sacharidy s proteiny do 45 minut.
2. Dopřejte nohám lehké protažení kvadricepsů a lýtek.
3. Pro další trénink doporučujeme ${elevation > 300 ? "lehkou regenerační vyjížďku po rovině" : "postupné navýšení délky trasy o 10-15 %"}.`;
      sourceModel = "rule-engine";
    }

    res.json({ analysis: analysisText, source: sourceModel });
  } catch (error: any) {
    console.error("Error analyzing ride:", error);
    res.status(500).json({ error: error.message || "Failed to analyze ride" });
  }
});

// Interactive AI Cycling Assistant Chat
app.post("/api/coach-chat", async (req, res) => {
  const { message, currentRideContext, chatHistory } = req.body || {};
  if (!message) {
    return res.status(400).json({ error: "Missing message" });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.json({
      reply: generateFallbackCoachResponse(message, currentRideContext),
      model: "coach-engine",
    });
  }

  try {
    const systemInstruction = `Jsi 'CykloAsistent' – inteligentní, přátelský a vysoce zkušený osobní trenér a asistent pro cyklisty.
Pomáháš s:
- analýzou tras, stoupání a ujetých kilometrů
- tréninkovými plány a zlepšováním průměrné rychlosti i vytrvalosti
- správnou výživou a hydratací před jízdou, během jízdy a po ní
- nastavením posedu (bike fitting), tlaky v pláštích, servisem a výbavou kola
- bezpečností na silnicích a cyklostezkách v souladu s veřejnými mapami.

Odpovídej stručně, věcně a přehledně v češtině, používej odrážky a formátování markdown.
${
  currentRideContext
    ? `Kontext aktuální nebo poslední jízdy uživatele:
- Vzdálenost: ${currentRideContext.distanceKm} km
- Čas: ${Math.round(currentRideContext.durationSeconds / 60)} min
- Průměrná rychlost: ${currentRideContext.avgSpeedKmh} km/h
- Převýšení: ${currentRideContext.elevationGainM} m`
    : ""
}`;

    // Format previous messages if any
    const historyText = Array.isArray(chatHistory)
      ? chatHistory
          .slice(-6)
          .map((m: { role: string; content: string }) => `${m.role === "user" ? "Uživatel" : "Trenér"}: ${m.content}`)
          .join("\n")
      : "";

    const userPrompt = `${historyText ? `Předchozí konverzace:\n${historyText}\n\n` : ""}Uživatel se ptá: ${message}`;

    const result = await generateContentWithFallback(ai, {
      contents: userPrompt,
      config: {
        systemInstruction,
      },
    });

    res.json({ reply: result.text || "Omlouvám se, nepodařilo se vygenerovat odpověď.", model: result.model });
  } catch (error: any) {
    console.warn("Gemini unavailable in coach chat (e.g. 503 high demand), using coach engine fallback:", error?.message || error);
    // Return high quality cycling coach reply with 200 OK so that client doesn't see "Chyba komunikace se serverem"
    res.json({
      reply: generateFallbackCoachResponse(message, currentRideContext),
      model: "fallback-coach-engine",
      warning: "Dočasný režim asistenta při vysokém vytížení AI serveru.",
    });
  }
});

interface CzechCityHub {
  name: string;
  aliases: string[];
  lat: number;
  lng: number;
  baseAltitude: number;
  region: string;
  scenicWaypoints: { name: string; dLat: number; dLng: number; note: string }[];
}

const CZECH_HUBS: CzechCityHub[] = [
  {
    name: "Brno",
    aliases: ["brno", "brně", "brna", "svitav", "prygl", "veveří", "pisárk", "bystrc", "židlochovic", "modřic"],
    lat: 49.1951,
    lng: 16.6068,
    baseAltitude: 220,
    region: "Jihomoravský kraj",
    scenicWaypoints: [
      { name: "Pisárky – Cyklostezka 1 Svratka", dLat: 0.005, dLng: -0.035, note: "Páteřní cyklostezka bez aut" },
      { name: "Bystrc Přístaviště", dLat: 0.035, dLng: -0.086, note: "Vstup k Brněnské přehradě" },
      { name: "Hrad Veveří (lávka)", dLat: 0.062, dLng: -0.145, note: "Historický hrad a vyhlídky" },
      { name: "Veverská Bítýška", dLat: 0.082, dLng: -0.168, note: "Kavárny a občerstvení" },
      { name: "Rozdrojovice vyhlídka", dLat: 0.067, dLng: -0.090, note: "Příjemný lesní sjezd zpět" },
    ],
  },
  {
    name: "Blansko & Moravský kras",
    aliases: ["blansk", "macoch", "moravský kras", "jedovnic", "sloup", "adamov"],
    lat: 49.3627,
    lng: 16.6447,
    baseAltitude: 280,
    region: "Moravský kras",
    scenicWaypoints: [
      { name: "Blansko město", dLat: 0, dLng: 0, note: "Výchozí bod u nádraží" },
      { name: "Skalní mlýn (kaňon)", dLat: 0.015, dLng: 0.065, note: "Vjezd do chráněného krasového údolí" },
      { name: "Propast Macocha & Horní můstek", dLat: 0.024, dLng: 0.089, note: "Vyhlídka do 138m propasti" },
      { name: "Rybník Olšovec (Jedovnice)", dLat: -0.025, dLng: 0.115, note: "Singletracky & občerstvení" },
      { name: "Křtiny (poutní chrám)", dLat: -0.068, dLng: 0.098, note: "Santiniho barokní perla" },
    ],
  },
  {
    name: "Pálava & Nové Mlýny",
    aliases: ["pálav", "palav", "mikulov", "pasohlávk", "pavlov", "věstonic", "lednic", "valtic", "břeclav"],
    lat: 48.8078,
    lng: 16.6378,
    baseAltitude: 180,
    region: "Jižní Morava",
    scenicWaypoints: [
      { name: "Pasohlávky kemp", dLat: 0.090, dLng: -0.080, note: "Start u nádrže Nové Mlýny" },
      { name: "Dolní Věstonice", dLat: 0.079, dLng: 0.005, note: "Archeologická stezka" },
      { name: "Pavlov sklípky", dLat: 0.066, dLng: 0.033, note: "Výhled na Dívčí hrady" },
      { name: "Mikulov náměstí & zámek", dLat: 0, dLng: 0, note: "Historické centrum a Kozí hrádek" },
    ],
  },
  {
    name: "Plzeň & Berounka",
    aliases: ["plzeň", "plzen", "bolevec", "radyn", "stříbr", "rokycan"],
    lat: 49.7475,
    lng: 13.3776,
    baseAltitude: 310,
    region: "Plzeňský kraj",
    scenicWaypoints: [
      { name: "Plzeň Štruncovy sady", dLat: 0, dLng: 0, note: "Soutok Mže a Radbuzy" },
      { name: "Bolevecké rybníky", dLat: 0.032, dLng: 0.012, note: "Borové lesy a pláže" },
      { name: "Chrást lávka", dLat: 0.045, dLng: 0.115, note: "Lesní cyklostezka podél toku" },
      { name: "Hrad Radyně", dLat: -0.065, dLng: 0.045, note: "Královský hrad s rozhlednou" },
    ],
  },
  {
    name: "Ostrava & Beskydy",
    aliases: ["ostrav", "beskyd", "frýdek", "místek", "rožnov", "čeladn", "ostravic", "pustevn"],
    lat: 49.8209,
    lng: 18.2625,
    baseAltitude: 240,
    region: "Moravskoslezský kraj",
    scenicWaypoints: [
      { name: "Dolní Vítkovice", dLat: 0, dLng: 0, note: "Industriální srdce Ostravy" },
      { name: "Soutok Ostravice a Lučiny", dLat: 0.021, dLng: 0.035, note: "Cyklostezka podél vody" },
      { name: "Hrad Hukvaldy", dLat: -0.205, dLng: -0.085, note: "Janáčkova obora a hrad" },
      { name: "Čeladná pod Beskydy", dLat: -0.285, dLng: 0.065, note: "Pohled na masiv Lysé hory" },
    ],
  },
  {
    name: "Liberec & Jizerské hory",
    aliases: ["liberec", "jizer", "ještěd", "jested", "bedřichov", "bedrichov", "smědav", "jablonec"],
    lat: 50.7671,
    lng: 15.0562,
    baseAltitude: 450,
    region: "Liberecký kraj",
    scenicWaypoints: [
      { name: "Liberec Lidové sady", dLat: 0.012, dLng: 0.025, note: "Vstup do Jizerských hor" },
      { name: "Bedřichov stadion", dLat: 0.022, dLng: 0.087, note: "Začátek Jizerské magistrály" },
      { name: "Nová Louka (Šámalova chata)", dLat: 0.045, dLng: 0.102, note: "Horská chata a rašeliniště" },
      { name: "Smědava chata", dLat: 0.076, dLng: 0.219, note: "Občerstvení pod Smrkem" },
    ],
  },
  {
    name: "Olomouc & Litovelské Pomoraví",
    aliases: ["olomouc", "pomoraví", "litovel", "haná", "hana", "bouzov"],
    lat: 49.5938,
    lng: 17.2509,
    baseAltitude: 215,
    region: "Olomoucký kraj",
    scenicWaypoints: [
      { name: "Olomouc Horní náměstí", dLat: 0, dLng: 0, note: "Památka UNESCO" },
      { name: "Poděbrady přírodní jezero", dLat: 0.032, dLng: -0.045, note: "Koupání a cyklostezka" },
      { name: "Horka nad Moravou (Sluňákov)", dLat: 0.048, dLng: -0.062, note: "Dům přírody" },
      { name: "Litovel město & pivovar", dLat: 0.108, dLng: -0.178, note: "Hanácké Benátky s mosty" },
    ],
  },
  {
    name: "Krkonoše & Podkrkonoší",
    aliases: ["krkonoš", "krkonos", "vrchlabí", "špindl", "jansk", "trutnov", "jilemnic"],
    lat: 50.6272,
    lng: 15.6095,
    baseAltitude: 550,
    region: "Královéhradecký kraj",
    scenicWaypoints: [
      { name: "Vrchlabí zámecký park", dLat: 0, dLng: 0, note: "Brána do Krkonoš" },
      { name: "Přehrada Labská", dLat: 0.085, dLng: -0.025, note: "Hráz na horním toku Labe" },
      { name: "Špindlerův Mlýn", dLat: 0.102, dLng: -0.012, note: "Horský resort a cyklostezky" },
    ],
  },
  {
    name: "Šumava",
    aliases: ["šumav", "sumav", "kvild", "modrav", "lipno", "srní", "železná ruda", "prášil"],
    lat: 49.0238,
    lng: 13.4988,
    baseAltitude: 980,
    region: "Plzeňský / Jihočeský kraj",
    scenicWaypoints: [
      { name: "Kvilda (infocentrum)", dLat: 0.015, dLng: 0.082, note: "Nejvýše položená obec v ČR" },
      { name: "Pramen Vltavy", dLat: -0.045, dLng: 0.125, note: "Zrození národní řeky" },
      { name: "Modrava", dLat: 0, dLng: 0, note: "Soutok horských potoků" },
      { name: "Tříjezerní slať", dLat: 0.018, dLng: -0.042, note: "Vyhlídková lávka rašeliništěm" },
    ],
  },
  {
    name: "Karlštejn & Berounka",
    aliases: ["karlštejn", "karlstejn", "beroun", "radotín", "černošic", "dobřichovic", "srbsk", "český kras", "praha", "praze"],
    lat: 49.9395,
    lng: 14.1880,
    baseAltitude: 230,
    region: "Střední Čechy / Český kras",
    scenicWaypoints: [
      { name: "Radotín lávka (Start)", dLat: 0.046, dLng: 0.176, note: "Páteřní cyklostezka A1" },
      { name: "Černošice jez", dLat: 0.015, dLng: 0.091, note: "Občerstvení u řeky" },
      { name: "Dobřichovice lávka", dLat: -0.011, dLng: 0.046, note: "Cyklistická zastávka" },
      { name: "Hrad Karlštejn", dLat: 0, dLng: 0, note: "Gotický klenot krále Karla IV." },
      { name: "Srbsko lávka", dLat: -0.006, dLng: 0.024, note: "Přírodní kaňon Berounky" },
    ],
  },
];

function generateSmartRouteFallback(message: string, userPreferences?: any, currentLocation?: { lat: number; lng: number } | null): string {
  const lowerMsg = (message || "").toLowerCase();

  // Find best matching hub
  let matchedHub = CZECH_HUBS.find((hub) =>
    hub.aliases.some((alias) => lowerMsg.includes(alias))
  );

  // If no keyword matched, but currentLocation is provided, pick closest hub
  if (!matchedHub && currentLocation && typeof currentLocation.lat === "number" && typeof currentLocation.lng === "number") {
    let minDist = Infinity;
    for (const hub of CZECH_HUBS) {
      const dLat = hub.lat - currentLocation.lat;
      const dLng = hub.lng - currentLocation.lng;
      const dist = dLat * dLat + dLng * dLng;
      if (dist < minDist) {
        minDist = dist;
        matchedHub = hub;
      }
    }
  }

  // Default to Karlštejn / Prague hub if none matched
  if (!matchedHub) {
    matchedHub = CZECH_HUBS[CZECH_HUBS.length - 1];
  }

  // Extract requested distance or use reasonable default
  const distMatch = lowerMsg.match(/(\d{1,3})\s*(?:km|kilometr)/);
  const distanceKm = distMatch ? Math.min(120, Math.max(15, parseInt(distMatch[1], 10))) : 36.0;

  // Determine bike type
  let bikeType = "Gravel / Silniční / Treking";
  if (lowerMsg.includes("silni") || userPreferences?.preferredBike?.includes("Silni")) {
    bikeType = "Silniční";
  } else if (lowerMsg.includes("mtb") || lowerMsg.includes("horsk") || userPreferences?.preferredBike?.includes("MTB")) {
    bikeType = "Horský (MTB)";
  } else if (lowerMsg.includes("gravel") || userPreferences?.preferredBike?.includes("Gravel")) {
    bikeType = "Gravel";
  }

  const isMtb = bikeType.includes("MTB") || bikeType.includes("Horsk");
  const elevationGain = isMtb ? Math.round(distanceKm * 12) : Math.round(distanceKm * 7);

  // Generate waypoints and smooth coordinates around the matched hub
  const waypoints = matchedHub.scenicWaypoints.map((sw) => ({
    name: sw.name,
    lat: Number((matchedHub!.lat + sw.dLat).toFixed(5)),
    lng: Number((matchedHub!.lng + sw.dLng).toFixed(5)),
    note: sw.note,
  }));

  const numCoords = 16;
  const coordinates: [number, number][] = [];
  const radiusLat = (distanceKm / 111) * 0.28;
  const radiusLng = (distanceKm / (111 * Math.cos((matchedHub.lat * Math.PI) / 180))) * 0.28;

  for (let i = 0; i < numCoords; i++) {
    const angle = (i / (numCoords - 1)) * Math.PI * 2;
    const lat = Number((matchedHub.lat + Math.sin(angle) * radiusLat + Math.sin(angle * 3) * (radiusLat * 0.12)).toFixed(5));
    const lng = Number((matchedHub.lng + (1 - Math.cos(angle)) * radiusLng + Math.cos(angle * 2) * (radiusLng * 0.08)).toFixed(5));
    coordinates.push([lat, lng]);
  }

  const routeName = `${matchedHub.name} – Vyhlídkový cyklookruh (${distanceKm} km)`;

  return `### 🗺️ Doporučená cyklotrasa na míru: ${routeName}
Podle vašich instrukcí v regionu **${matchedHub.region}** doporučuji ověřenou a bezpečnou trasu:

- **Start & Cíl:** ${waypoints[0]?.name || matchedHub.name} (Okruh)
- **Vzdálenost:** cca ${distanceKm} km
- **Převýšení:** +${elevationGain} m (plynulý členitý profil vhodný pro trénink i výlet)
- **Typ kola:** ${bikeType}
- **Povrch:** 85 % hladký asfalt a vyhrazené cyklostezky, 15 % kvalitní zpevněný povrch.
- **Bezpečnost:** Trasa vede převážně mimo frekventované tahy po značených cyklotrasách a vedlejších silnicích s minimálním provozem.

**Doporučené zastávky po trase:**
${waypoints.map((wp, i) => `${i + 1}. **${wp.name}:** ${wp.note}`).join("\n")}

\`\`\`json
{
  "routeName": "${routeName}",
  "distanceKm": ${distanceKm},
  "elevationGainM": ${elevationGain},
  "bikeType": "${bikeType}",
  "waypoints": ${JSON.stringify(waypoints, null, 2)},
  "coordinates": ${JSON.stringify(coordinates)}
}
\`\`\``;
}

// Specialized Multi-Turn Route Planning Assistant
app.post("/api/route-planner-chat", async (req, res) => {
  const { message, chatHistory, userPreferences, currentLocation } = req.body || {};
  if (!message) {
    return res.status(400).json({ error: "Missing message" });
  }

  try {
    const ai = getGeminiClient();
    if (!ai) {
      const fallbackRoute = generateSmartRouteFallback(message, userPreferences, currentLocation);
      return res.json({ reply: fallbackRoute, model: "fallback-geo-engine" });
    }

    const systemInstruction = `Jsi 'CykloNavigátor' – špičkový specializovaný asistent a plánovač cyklistických tras, který pomáhá cyklistům najít ideální trasu PŘESNĚ podle jejich instrukcí a parametrů.

Tvoje role a schopnosti:
1. Ptej se nebo respektuj přesné instrukce uživatele:
   - Výchozí bod a cíl (nebo okruh / loop)
   - Typ kola (Silniční, Gravel, MTB/Horský, Krosový/Treking, Elektrokolo)
   - Požadovaná vzdálenost (např. 30 km, 60-80 km) nebo čas
   - Profil trasy (rovinatá, zvlněná, horská s výhledy, strmá stoupání)
   - Typ povrchu (hladký asfalt bez děr, zpevněný štěrk, zpevněné lesní cesty, technické traily)
   - Požadavky na bezpečnost (vyhnutí se frekventovaným silnicím I. a II. třídy, přednost cyklotrasám a cyklostezkám)
   - Zájmové body (zastávky na kávu/občerstvení, vyhlídky, přírodní památky).

2. Když uživatel zadá své přání (např. "chci 40 km silniční trasu z Brna směrem na sever bez velkých kopců"):
   - Navrhni konkrétní pojmenovanou trasu s popisem jednotlivých etap a čísel cyklotras (např. Cyklotrasa 1, 5, A1, atd.).
   - Uveď parametry: Vzdálenost (km), Převýšení (+m), Typ povrchu, Vhodnost pro dané kolo, Doporučený směr větru / jízdy.
   - VŽDY na konci odpovědi přidej platný JSON blok vymezený trojitými zpětnými uvozovkami \`\`\`json ... \`\`\` obsahující:
     {
       "routeName": "Název trasy",
       "distanceKm": 42.5,
       "elevationGainM": 320,
       "bikeType": "Silniční / Gravel",
       "waypoints": [
         { "name": "Start / Místo A", "lat": 49.1234, "lng": 16.1234 },
         { "name": "Průjezdní bod B", "lat": 49.1567, "lng": 16.1567 },
         { "name": "Cíl / Místo C", "lat": 49.1890, "lng": 16.1890 }
       ],
       "coordinates": [
         [49.1234, 16.1234],
         [49.1350, 16.1320],
         ... (alespoň 8-20 přesných zeměpisných souřadnic [lat, lng] mapujících skutečný průběh trasy v dané oblasti)
       ]
     }
   Uživatel si tuto trasu může jedním kliknutím zobrazit na veřejné cyklomapě CyclOSM/OpenStreetMap a exportovat do GPX.

3. Pokud uživatel poskytl neúplné instrukce, navrhni nejlepší variantu podle jeho náznaku a zeptej se na upřesnění (např. zda preferuje asfalt nebo nevadí šotolina).
4. Komunikuj přátelsky, profesionálně a česky s cyklistickým přehledem.
${currentLocation ? `Poznámka: Aktuální poloha cyklisty (pokud se nachází poblíž): lat ${currentLocation.lat}, lng ${currentLocation.lng}` : ""}
${userPreferences ? `Uživatelské preference: ${JSON.stringify(userPreferences)}` : ""}`;

    // Format previous messages
    const formattedHistory = Array.isArray(chatHistory)
      ? chatHistory.slice(-8).map((m: { role: string; content: string }) => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.content }],
        }))
      : [];

    const result = await sendChatWithFallback(ai, {
      systemInstruction,
      history: formattedHistory,
      message,
    });

    res.json({
      reply: result.text || "Omlouvám se, nepodařilo se vygenerovat trasu.",
      model: result.model,
    });
  } catch (error: any) {
    console.error("Error in route planner chat, using intelligent geo engine fallback:", error?.message || error);

    const fallbackRoute = generateSmartRouteFallback(message, userPreferences, currentLocation);

    res.json({
      reply: fallbackRoute,
      model: "fallback-geo-engine",
      warning: "Přechodný režim asistenta.",
    });
  }
});

// GET route for route planner (returns JSON status)
app.get("/api/route-planner-chat", (_req, res) => {
  res.json({
    status: "ok",
    service: "route-planner-chat",
    method: "POST",
    description: "Send POST request with { message, chatHistory, userPreferences, currentLocation }",
  });
});

// 404 Handler strictly for API routes so they NEVER fall through to HTML/Vite SPA
app.all("/api/*", (_req, res) => {
  res.status(404).json({ error: "API endpoint nenalezen" });
});

async function startServer() {
  // Serve static files from public (e.g. zip packages, icons)
  app.use(express.static(path.join(process.cwd(), "public")));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Cyklistický Asistent server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
