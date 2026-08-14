/**
 * simulate.js — Simulador local de conversación
 * ============================================================================
 * Levanta una API falsa que responde EXACTAMENTE con la forma del backend real
 * (paginado { data, meta }, camelCase, publicName / eventPrice /
 * availableCapacity) y corre la skill contra ella.
 *
 * No necesita AWS, ni ngrok, ni el backend levantado.
 *
 *   node test/simulate.js
 * ============================================================================
 */

const http = require("http");

// ─── API FALSA ───────────────────────────────────────────────────────────────

const EVENTS = [
  {
    id: "evt-100",
    name: "Rock Revolution Tour",
    startsAt: "2026-07-20T20:00:00.000Z",
    status: "PUBLISHED",
    organizerId: "usr-100",
    venue: { id: "ven-100", name: "Estadio Olímpico", city: "Ciudad de México", state: "CDMX" },
    zones: [
      { id: "zon-101", publicName: "VIP", eventPrice: "2500.00", availableCapacity: 45 },
      { id: "zon-102", publicName: "General", eventPrice: "800.00", availableCapacity: 255 },
    ],
  },
  {
    id: "evt-200",
    name: "Neon Nights Festival",
    startsAt: "2026-07-22T19:00:00.000Z",
    status: "PUBLISHED",
    organizerId: "usr-100",
    venue: { id: "ven-200", name: "Arena Movistar", city: "Monterrey", state: "Nuevo León" },
    zones: [
      { id: "zon-201", publicName: "General Única", eventPrice: "1200.00", availableCapacity: 500 },
    ],
  },
];

const SEEDS = {
  jaguarmorado: { id: "usr-100", name: "Carlos Rivera", email: "carlos@nextticket.com", role: { name: "ORGANIZER" } },
  faroazul: { id: "usr-200", name: "Admin NextTicket", email: "admin@nextticket.com", role: { name: "ADMIN" } },
  robleserenoo: { id: "usr-300", name: "Juan Pérez", email: "juan@cliente.com", role: { name: "CLIENT" } },
};

const STATS = {
  "evt-100": { totalRevenue: "5000.00", recentPurchasesCount: 1, zones: [{ zoneId: "zon-101", ticketsSold: 2, revenue: "5000.00" }] },
  "evt-200": { totalRevenue: "1200.00", recentPurchasesCount: 1, zones: [{ zoneId: "zon-201", ticketsSold: 1, revenue: "1200.00" }] },
};

/** Si está en true, la API responde 500: sirve para probar el manejo de errores. */
let failEverything = false;

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;

  if (failEverything) {
    return json(res, 500, { message: "Base de datos no disponible" });
  }

  if (req.method === "POST" && path === "/auth/alexa/seed") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const seed = (JSON.parse(body || "{}").seed || "").toLowerCase();
      const user = SEEDS[seed];
      if (!user) return json(res, 401, { message: "Semilla no válida" });
      return json(res, 200, { token: `token-de-${user.id}`, user });
    });
    return;
  }

  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return json(res, 401, { message: "Falta el token" });

  if (path === "/auth/me") {
    const user = Object.values(SEEDS).find((u) => token === `token-de-${u.id}`);
    return user ? json(res, 200, user) : json(res, 401, { message: "Token inválido" });
  }

  if (path === "/events") {
    const organizerId = url.searchParams.get("organizerId");
    const data = organizerId ? EVENTS.filter((e) => e.organizerId === organizerId) : EVENTS;
    return json(res, 200, { data, meta: { total: data.length, page: 1, limit: 50 } });
  }

  const zonesMatch = path.match(/^\/events\/([^/]+)\/zones$/);
  if (zonesMatch) {
    const event = EVENTS.find((e) => e.id === zonesMatch[1]);
    return event ? json(res, 200, event.zones) : json(res, 404, { message: "Evento no encontrado" });
  }

  const eventMatch = path.match(/^\/events\/([^/]+)$/);
  if (eventMatch) {
    const event = EVENTS.find((e) => e.id === eventMatch[1]);
    return event ? json(res, 200, event) : json(res, 404, { message: "Evento no encontrado" });
  }

  if (path === "/purchases/stats") {
    const eventId = url.searchParams.get("eventId");
    if (eventId) return json(res, 200, STATS[eventId] || { totalRevenue: "0", zones: [] });

    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    // Mayo 2026 tiene ventas; el resto de meses no.
    const isMay = from && from.startsWith("2026-05");
    return json(res, 200, {
      totalRevenue: isMay ? "6200.00" : "0.00",
      recentPurchasesCount: isMay ? 2 : 0,
      zones: [],
      from: from || null,
      to: to || null,
    });
  }

  return json(res, 404, { message: `Ruta no encontrada: ${path}` });
});

// ─── ENVELOPES DE ALEXA ──────────────────────────────────────────────────────

function slot(name, value, resolvedValue) {
  const built = { name, value, confirmationStatus: "NONE" };
  if (resolvedValue) {
    built.resolutions = {
      resolutionsPerAuthority: [
        { status: { code: "ER_SUCCESS_MATCH" }, values: [{ value: { name: resolvedValue, id: "x" } }] },
      ],
    };
  }
  return built;
}

function envelope(request, sessionAttributes) {
  return {
    version: "1.0",
    session: { new: false, sessionId: "sim", attributes: sessionAttributes || {}, application: { applicationId: "sim" }, user: { userId: "sim-user" } },
    context: { System: { application: { applicationId: "sim" }, user: { userId: "sim-user" } } },
    request,
  };
}

function launchRequest() {
  return { type: "LaunchRequest", requestId: `r-${Date.now()}`, timestamp: new Date().toISOString(), locale: "es-MX" };
}

function intentRequest(name, slots, dialogState) {
  return {
    type: "IntentRequest",
    requestId: `r-${Date.now()}`,
    timestamp: new Date().toISOString(),
    locale: "es-MX",
    dialogState: dialogState || undefined,
    intent: { name, confirmationStatus: "NONE", slots: slots || {} },
  };
}

// ─── EJECUCIÓN ───────────────────────────────────────────────────────────────

function speechOf(response) {
  const out = response.response.outputSpeech;
  if (!out) return "(sin voz)";
  return String(out.ssml || out.text || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function directivesOf(response) {
  return (response.response.directives || []).map((d) => d.type).join(", ") || "-";
}

async function main() {
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  process.env.API_BASE_URL = `http://127.0.0.1:${port}`;
  process.env.API_TIMEOUT_MS = "3000";
  delete process.env.DYNAMODB_PERSISTENCE_TABLE_NAME;

  const skill = require("../index.js");

  // Los sessionAttributes se encadenan a mano, igual que hace el servicio real.
  let attributes = {};

  async function turn(label, request) {
    const response = await new Promise((resolve, reject) => {
      skill.handler(envelope(request, attributes), {}, (err, result) =>
        err ? reject(err) : resolve(result),
      );
    });

    attributes = response.sessionAttributes || attributes;

    console.log(`\n\x1b[36m▶ ${label}\x1b[0m`);
    console.log(`  Alexa: ${speechOf(response)}`);
    console.log(`  \x1b[90mdirectivas: ${directivesOf(response)}\x1b[0m`);
    return response;
  }

  console.log("\n════════ ESCENARIO 1: ORGANIZADOR ════════");
  await turn("Abrir la skill (sin sesión)", launchRequest());
  await turn("«mi palabra clave es jaguar morado»",
    intentRequest("CaptureInputIntent", { userInput: slot("userInput", "jaguar morado") }));
  await turn("«dime mis eventos activos»", intentRequest("GetActiveEventsIntent"));
  await turn("«cómo van las ventas de rock revolution»",
    intentRequest("GetTicketsSoldIntent",
      { eventName: slot("eventName", "rock revolution", "Rock Revolution Tour") }, "COMPLETED"));
  // Sin slot eventName: debe recuperar el evento de la memoria de sesión.
  await turn("«qué zonas tiene» (SIN decir el evento: usa el recordado)",
    intentRequest("GetZonesIntent", { eventName: slot("eventName", null) }, "COMPLETED"));
  await turn("«hay lugares en vip»",
    intentRequest("GetSeatAvailabilityIntent", {
      eventName: slot("eventName", "Rock Revolution Tour"),
      zoneName: slot("zoneName", "vip", "VIP"),
    }, "COMPLETED"));
  await turn("«cuál es el evento más taquillero» (debe NEGARSE por rol)",
    intentRequest("GetTopRevenueEventIntent"));
  await turn("«repite»", intentRequest("AMAZON.RepeatIntent"));

  console.log("\n════════ ESCENARIO 2: DIÁLOGO INCOMPLETO ════════");
  attributes = {};
  await turn("Abrir la skill", launchRequest());
  await turn("Login como cliente", intentRequest("CaptureInputIntent", { userInput: slot("userInput", "roble sereno o") }));
  await turn("«hay lugares disponibles» (IN_PROGRESS: debe delegar)",
    intentRequest("GetSeatAvailabilityIntent",
      { eventName: slot("eventName", null), zoneName: slot("zoneName", null) }, "IN_PROGRESS"));

  console.log("\n════════ ESCENARIO 3: ADMINISTRADOR ════════");
  attributes = {};
  await turn("Abrir la skill", launchRequest());
  await turn("Login como admin", intentRequest("CaptureInputIntent", { userInput: slot("userInput", "faro azul") }));
  await turn("«cuál es el evento más taquillero»", intentRequest("GetTopRevenueEventIntent"));
  await turn("«cuánto se recaudó en mayo»",
    intentRequest("GetTotalRevenueByPeriodIntent", { monthName: slot("monthName", "mayo") }, "COMPLETED"));
  await turn("«cuánto se recaudó en enero»",
    intentRequest("GetTotalRevenueByPeriodIntent", { monthName: slot("monthName", "enero") }, "COMPLETED"));

  console.log("\n════════ ESCENARIO 4: SEMILLA INCORRECTA ════════");
  attributes = {};
  await turn("Abrir la skill", launchRequest());
  await turn("«mi palabra clave es pinguino verde» (no existe)",
    intentRequest("CaptureInputIntent", { userInput: slot("userInput", "pinguino verde") }));

  console.log("\n════════ ESCENARIO 5: LA API SE CAE ════════");
  attributes = {};
  await turn("Abrir la skill", launchRequest());
  await turn("Login como organizador", intentRequest("CaptureInputIntent", { userInput: slot("userInput", "jaguar morado") }));
  failEverything = true;
  console.log("\n  \x1b[31m(la API ahora responde 500)\x1b[0m");
  await turn("«dime mis eventos activos» -> debe EXPLICAR el fallo",
    intentRequest("GetActiveEventsIntent"));
  failEverything = false;

  console.log("\n════════ ESCENARIO 6: SIN SESIÓN ════════");
  attributes = {};
  await turn("«dime mis eventos activos» sin haber entrado",
    intentRequest("GetActiveEventsIntent"));
  await turn("«ayuda»", intentRequest("AMAZON.HelpIntent"));
  await turn("«detente»", intentRequest("AMAZON.StopIntent"));

  server.close();
  console.log("\n\x1b[32m✓ Simulación terminada\x1b[0m\n");
}

main().catch((error) => {
  console.error("Falló la simulación:", error);
  server.close();
  process.exit(1);
});
