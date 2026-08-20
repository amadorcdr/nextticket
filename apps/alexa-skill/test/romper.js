/**
 * romper.js — Intenta tumbar la skill a propósito.
 * Ninguna entrada debe provocar una excepción sin respuesta.
 */
delete process.env.API_BASE_URL;
process.env.DYNAMODB_PERSISTENCE_TABLE_NAME = "";
process.env.API_TIMEOUT_MS = "8000";
const skill = require("/Users/angeldanielocampomartinez/Desktop/nextticket/apps/alexa-skill/index.js");

let rotas = 0, sobrevive = 0;

async function intentar(nombre, envelope) {
  try {
    const res = await new Promise((y, n) =>
      skill.handler(envelope, {}, (e, r) => (e ? n(e) : y(r))));
    const o = res && res.response && res.response.outputSpeech;
    const dicho = o ? String(o.ssml || o.text).replace(/<[^>]+>/g, "").trim() : "";
    // SSML mal formado = Alexa rechaza = skill rota
    const ssml = o ? String(o.ssml || "") : "";
    const malSsml = /&(?!(amp|lt|gt|quot|apos|#\d+);)/.test(ssml);
    if (!res || !res.response) { rotas++; return console.log(`  ROTA    ${nombre} (sin respuesta)`); }
    if (malSsml)               { rotas++; return console.log(`  ROTA    ${nombre} (SSML inválido)`); }
    sobrevive++;
    console.log(`  sobrevive  ${nombre}  -> "${dicho.slice(0, 60)}${dicho.length>60?"…":""}"`);
  } catch (e) {
    rotas++;
    console.log(`  ROTA    ${nombre}  EXCEPCIÓN: ${e && e.message}`);
  }
}

const base = (request, attrs) => ({
  version: "1.0",
  session: { new: false, sessionId: "s", attributes: attrs || {}, application: { applicationId: "a" }, user: { userId: "u" } },
  context: { System: { application: { applicationId: "a" }, user: { userId: "u" } } },
  request,
});
const ahora = () => new Date().toISOString();

(async () => {
  console.log("\n════ ENTRADAS MALFORMADAS ════");
  await intentar("petición sin type", base({ requestId: "r", timestamp: ahora(), locale: "es-MX" }));
  await intentar("tipo desconocido", base({ type: "Connections.Response", requestId: "r", timestamp: ahora(), locale: "es-MX" }));
  await intentar("IntentRequest sin intent", base({ type: "IntentRequest", requestId: "r", timestamp: ahora(), locale: "es-MX" }));
  await intentar("intent inexistente", base({ type: "IntentRequest", requestId: "r", timestamp: ahora(), locale: "es-MX", intent: { name: "NoExisteIntent", slots: {} } }));
  await intentar("sin locale", base({ type: "LaunchRequest", requestId: "r", timestamp: ahora() }));
  await intentar("locale inventado", base({ type: "LaunchRequest", requestId: "r", timestamp: ahora(), locale: "xx-YY" }));
  await intentar("slots = null", base({ type: "IntentRequest", requestId: "r", timestamp: ahora(), locale: "es-MX", intent: { name: "GetZonesIntent", slots: null }, dialogState: "COMPLETED" }));

  console.log("\n════ SESIÓN CORRUPTA ════");
  await intentar("token basura", base({ type: "IntentRequest", requestId: "r", timestamp: ahora(), locale: "es-MX", intent: { name: "GetActiveEventsIntent", slots: {} } },
    { _loaded: true, loggedIn: true, token: "no-es-un-jwt", userRole: "ORGANIZER", userId: "x", userName: "X" }));
  await intentar("rol inventado", base({ type: "IntentRequest", requestId: "r", timestamp: ahora(), locale: "es-MX", intent: { name: "GetZonesIntent", slots: {} }, dialogState: "COMPLETED" },
    { _loaded: true, loggedIn: true, token: "t", userRole: "MARCIANO", userId: "x", userName: "X" }));
  await intentar("userName null", base({ type: "LaunchRequest", requestId: "r", timestamp: ahora(), locale: "es-MX" },
    { _loaded: true, loggedIn: true, token: "t", userRole: "ADMIN", userId: "x", userName: null }));

  console.log("\n════ VALORES HOSTILES EN SLOTS ════");
  const conSlot = (intent, slotName, valor, ds) => base({
    type: "IntentRequest", requestId: "r", timestamp: ahora(), locale: "es-MX", dialogState: ds,
    intent: { name: intent, confirmationStatus: "NONE", slots: { [slotName]: { name: slotName, value: valor, confirmationStatus: "NONE" } } },
  }, { _loaded: true, loggedIn: true, token: "t", userRole: "ADMIN", userId: "x", userName: "X" });

  await intentar("evento con < y &", conSlot("GetZonesIntent", "eventName", "Rock & <Roll>", "COMPLETED"));
  await intentar("evento con SSML inyectado", conSlot("GetZonesIntent", "eventName", "</speak><audio src='x'/>", "COMPLETED"));
  await intentar("evento de 5000 caracteres", conSlot("GetZonesIntent", "eventName", "a".repeat(5000), "COMPLETED"));
  await intentar("evento con emoji", conSlot("GetZonesIntent", "eventName", "🎸🔥 Rock", "COMPLETED"));
  await intentar("mes numérico raro", conSlot("GetTotalRevenueByPeriodIntent", "monthName", "99", "COMPLETED"));
  await intentar("mes vacío", conSlot("GetTotalRevenueByPeriodIntent", "monthName", "", "COMPLETED"));
  await intentar("semilla de 10000 chars", base({ type: "IntentRequest", requestId: "r", timestamp: ahora(), locale: "es-MX", dialogState: "IN_PROGRESS",
    intent: { name: "CaptureInputIntent", slots: { userInput: { name: "userInput", value: "x".repeat(10000) } } } }, { _loaded: true, awaitingSeed: true }));
  await intentar("semilla con comillas y SQL", base({ type: "IntentRequest", requestId: "r", timestamp: ahora(), locale: "es-MX", dialogState: "IN_PROGRESS",
    intent: { name: "CaptureInputIntent", slots: { userInput: { name: "userInput", value: "' OR 1=1; DROP TABLE \"User\";--" } } } }, { _loaded: true, awaitingSeed: true }));

  console.log(`\n════ ${sobrevive} sobrevivieron, ${rotas} rompieron ════\n`);
  process.exit(rotas ? 1 : 0);
})();
