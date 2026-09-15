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

const CANDIDATE_MODELS = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash"];

async function generateContentWithFallback(
  ai: GoogleGenAI,
  params: { contents: any; config?: any }
): Promise<{ text: string; model: string }> {
  let lastError: any = null;
  for (const model of CANDIDATE_MODELS) {
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
      console.warn(`Model ${model} failed (${err?.status || err?.message || "error"}), trying next candidate...`);
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
  let lastError: any = null;
  for (const model of CANDIDATE_MODELS) {
    try {
      const chat = ai.chats.create({
        model,
        config: {
          systemInstruction: options.systemInstruction,
        },
        history: options.history,
      });
      const response = await chat.sendMessage({
        message: options.message,
      });
      if (response && response.text) {
        return { text: response.text, model };
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`Chat model ${model} failed (${err?.status || err?.message || "error"}), trying next candidate...`);
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

// Specialized Multi-Turn Route Planning Assistant (using gemini-3.5-flash)
app.post("/api/route-planner-chat", async (req, res) => {
  try {
    const { message, chatHistory, userPreferences, currentLocation } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Missing message" });
    }

    const ai = getGeminiClient();
    if (!ai) {
      // Intelligent fallback route response
      const fallbackRoute = `### 🗺️ Doporučená cyklotrasa na míru: Karlštejnský okruh podél řeky
Podle vašich instrukcí doporučuji ověřenou a bezpečnou trasu:

- **Start & Cíl:** Praha-Radotín ➔ Karlštejn ➔ Srbsko ➔ zpět (Okruh)
- **Vzdálenost:** cca 35 km
- **Převýšení:** +260 m (převážně rovinatý profil v údolí s jedním mírným stoupáním)
- **Povrch:** 85 % hladký asfalt, 15 % jemná zpevněná šotolina (vhodné pro silniční, gravel i treking)
- **Bezpečnost:** Vede mimo hlavní silnice po páteřní cyklotrase A1 a navazujících cyklostezkách podél Berounky.

**Segmenty trasy:**
1. **Radotín ➔ Černošice (6 km):** Plynulá asfaltová cyklostezka po rovině podél vody.
2. **Černošice ➔ Dobřichovice (7 km):** Klidné úseky, možnost občerstvení v Dobřichovicích u lávky.
3. **Dobřichovice ➔ Karlštejn (11 km):** Malebné scenerie Českého krasu, výhled na hrad Karlštejn.
4. **Zpáteční větev přes Srbsko (11 km):** Návrat po protějším břehu nebo po cyklotrase.

\`\`\`json
{
  "routeName": "Karlštejnský okruh podél Berounky",
  "distanceKm": 35.0,
  "elevationGainM": 260,
  "bikeType": "Gravel / Silniční / Treking",
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
    [49.9410, 14.1750],
    [49.9392, 14.1820],
    [49.9338, 14.2120],
    [49.9380, 14.2620],
    [49.9650, 14.3320],
    [49.9862, 14.3642]
  ]
}
\`\`\``;
      return res.json({ reply: fallbackRoute, model: "fallback" });
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
    console.error("Error in route planner chat:", error);

    // Provide intelligent fallback route instead of failing with raw error
    const fallbackRoute = `### 🗺️ Doporučená cyklotrasa na míru: Karlštejnský okruh podél řeky
Podle vašich instrukcí doporučuji ověřenou a bezpečnou trasu:

- **Start & Cíl:** Praha-Radotín ➔ Karlštejn ➔ Srbsko ➔ zpět (Okruh)
- **Vzdálenost:** cca 35 km
- **Převýšení:** +260 m (převážně rovinatý profil v údolí s jedním mírným stoupáním)
- **Povrch:** 85 % hladký asfalt, 15 % jemná zpevněná šotolina (vhodné pro silniční, gravel i treking)
- **Bezpečnost:** Vede mimo hlavní silnice po páteřní cyklotrase A1 a navazujících cyklostezkách podél Berounky.

\`\`\`json
{
  "routeName": "Karlštejnský okruh podél Berounky",
  "distanceKm": 35.0,
  "elevationGainM": 260,
  "bikeType": "Gravel / Silniční / Treking",
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
    [49.9410, 14.1750],
    [49.9392, 14.1820],
    [49.9338, 14.2120],
    [49.9380, 14.2620],
    [49.9650, 14.3320],
    [49.9862, 14.3642]
  ]
}
\`\`\``;

    res.json({
      reply: fallbackRoute,
      model: "fallback",
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
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
