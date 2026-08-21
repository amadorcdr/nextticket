/**
 * index.js — Next Ticket (Alexa Skill)
 * ============================================================================
 * Versión de ARCHIVO ÚNICO para el editor del Alexa Developer Console.
 * Pegar tal cual en lambda/index.js y hacer Deploy.
 *
 *   1. CONFIGURACIÓN     dónde vive la API
 *   2. API               cliente HTTP (único punto que habla con el backend)
 *   3. ERRORES           safeHandle + reportError + voz que explica el fallo
 *   4. REPOSITORIO       consultas de datos ya normalizadas
 *   5. HELPERS           funciones puras
 *   6. I18N              textos es / en
 *   7. SESIÓN            login por semilla + token en DynamoDB + withAuth()
 *   8. INTERCEPTORES     3 de request y 3 de response
 *   9. HANDLERS          login, 7 intents de negocio, ayuda / error / repetir
 *  10. SKILL BUILDER
 * ============================================================================
 */

const Alexa = require("ask-sdk-core");
const AWS = require("aws-sdk");
const ddbAdapter = require("ask-sdk-dynamodb-persistence-adapter");
const axios = require("axios");


// ═══════════════════════════════════════════════════════════════════════════
// 1. CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  👇 PEGA AQUÍ LA URL DE NGROK CADA VEZ QUE LA REINICIES               │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * Las skills Alexa-Hosted NO permiten agregar variables de entorno propias:
 * esa Lambda la administra Amazon. Por eso la URL se pone aquí, como constante.
 *
 * Si algún día se migra a una Lambda propia en AWS, basta con definir
 * API_BASE_URL en las variables de entorno y esta constante se ignora sola.
 *
 * SIN diagonal al final.  Ejemplo: "https://a1b2-c3d4.ngrok-free.app"
 */
const API_URL_FIJA = "https://tummy-graves-slate.ngrok-free.dev";

const BASE_URL = (process.env.API_BASE_URL || API_URL_FIJA).replace(/\/+$/, "");

/** Alexa corta la respuesta a los 8 s: con 4 s queda margen para explicar el error. */
const TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS || 4000);

if (!BASE_URL) {
  console.warn(
    "[CONFIG] No hay URL de API. Pega la de ngrok en API_URL_FIJA (arriba del todo) " +
    "o define API_BASE_URL. La skill responderá que no puede conectarse.",
  );
}

/** La sesión guardada caduca a las 12 horas. */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const ROLES = { ORGANIZER: "ORGANIZER", ADMIN: "ADMIN", CUSTOMER: "CUSTOMER" };


// ═══════════════════════════════════════════════════════════════════════════
// 2. API — cliente HTTP
// ═══════════════════════════════════════════════════════════════════════════

const API_ERRORS = {
  NOT_CONFIGURED: "NOT_CONFIGURED",
  NETWORK: "NETWORK",
  TIMEOUT: "TIMEOUT",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  SERVER: "SERVER",
  TUNNEL_DOWN: "TUNNEL_DOWN",
};

class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status || null;
  }
}

function toApiError(error, path) {
  if (error.code === "ECONNABORTED") {
    return new ApiError(API_ERRORS.TIMEOUT, `${path} tardó más de ${TIMEOUT_MS} ms`);
  }
  if (!error.response) {
    return new ApiError(API_ERRORS.NETWORK, `Sin respuesta de ${BASE_URL}${path}: ${error.message}`);
  }

  const status = error.response.status;
  const detail = (error.response.data && error.response.data.message) || error.message;

  if (status === 401) return new ApiError(API_ERRORS.UNAUTHORIZED, detail, status);
  if (status === 403) return new ApiError(API_ERRORS.FORBIDDEN, detail, status);
  if (status === 404) {
    // ngrok responde 404 con una página HTML cuando el túnel ya no existe.
    // Sin distinguirlo, la skill diría "no encontré esa información" y mandaría
    // a buscar un bug donde solo hay un túnel caído: el fallo más frecuente de
    // esta configuración.
    const cuerpo = error.response.data;
    const esHtml = typeof cuerpo === "string" && /ngrok|<html/i.test(cuerpo.slice(0, 400));
    if (esHtml) {
      return new ApiError(API_ERRORS.TUNNEL_DOWN,
        `El túnel de ${BASE_URL} ya no existe (ngrok reiniciado)`, status);
    }
    return new ApiError(API_ERRORS.NOT_FOUND, detail, status);
  }
  return new ApiError(API_ERRORS.SERVER, `HTTP ${status}: ${detail}`, status);
}

/** Toda petición pasa por aquí: un solo lugar para el log y el try/catch. */
async function request(method, path, options) {
  const { token, body, params } = options || {};

  if (!BASE_URL) {
    throw new ApiError(API_ERRORS.NOT_CONFIGURED, "Falta API_BASE_URL en la Lambda");
  }

  const startedAt = Date.now();

  try {
    const response = await axios({
      method,
      url: `${BASE_URL}${path}`,
      data: body,
      params,
      timeout: TIMEOUT_MS,
      headers: Object.assign(
        {
          "Content-Type": "application/json",
          // Sin esta cabecera ngrok devuelve una página HTML de advertencia.
          "ngrok-skip-browser-warning": "true",
        },
        token ? { Authorization: `Bearer ${token}` } : {},
      ),
    });

    console.log(`[API] ${method.toUpperCase()} ${path} -> ${response.status} (${Date.now() - startedAt} ms)`);
    return response.data;
  } catch (error) {
    const apiError = toApiError(error, path);
    console.error(`[API] ${method.toUpperCase()} ${path} -> ${apiError.code} (${Date.now() - startedAt} ms): ${apiError.message}`);
    throw apiError;
  }
}

const api = {
  loginWithSeed: (seed) => request("post", "/auth/alexa/seed", { body: { seed } }),
  getMe: (token) => request("get", "/auth/me", { token }),
  listEvents: (token, params) => request("get", "/events", { token, params }),
  getEventById: (token, id) => request("get", `/events/${id}`, { token }),
  listZones: (token, eventId) => request("get", `/events/${eventId}/zones`, { token }),
  purchaseStats: (token, params) => request("get", "/purchases/stats", { token, params }),
};


// ═══════════════════════════════════════════════════════════════════════════
// 3. ERRORES — función genérica + voz que explica el fallo
// ═══════════════════════════════════════════════════════════════════════════

/** Filtrar en CloudWatch:  filter @message like /NEXTTICKET_ERROR/ */
const LOG_TAG = "NEXTTICKET_ERROR";

/**
 * Último recurso, construido a mano y sin dependencias: ni i18n, ni
 * responseBuilder, ni sesión. Si algo falla tan abajo que ni siquiera se puede
 * armar una respuesta normal, se devuelve esto y la skill sigue viva.
 */
const RESPUESTA_DE_EMERGENCIA = {
  version: "1.0",
  response: {
    outputSpeech: {
      type: "SSML",
      ssml: "<speak>Tuve un problema para procesar eso. ¿Qué deseas consultar?</speak>",
    },
    reprompt: {
      outputSpeech: {
        type: "SSML",
        ssml: "<speak>¿Qué deseas consultar?</speak>",
      },
    },
    shouldEndSession: false,
  },
};

const SPEECH_BY_CODE = {
  [API_ERRORS.NOT_CONFIGURED]: "ERR_API_NOT_CONFIGURED",
  [API_ERRORS.NETWORK]: "ERR_API_NETWORK",
  [API_ERRORS.TIMEOUT]: "ERR_API_TIMEOUT",
  [API_ERRORS.UNAUTHORIZED]: "ERR_API_UNAUTHORIZED",
  [API_ERRORS.FORBIDDEN]: "ERR_API_FORBIDDEN",
  [API_ERRORS.NOT_FOUND]: "ERR_API_NOT_FOUND",
  [API_ERRORS.SERVER]: "ERR_API_SERVER",
  [API_ERRORS.TUNNEL_DOWN]: "ERR_API_TUNNEL",
};

/**
 * Punto ÚNICO por el que pasan todos los errores de la skill.
 * Devuelve la clave de i18n que explica el fallo al usuario.
 */
function reportError(source, error, context) {
  const isApiError = error instanceof ApiError;
  const code = isApiError ? error.code : "UNEXPECTED";
  // `error` puede no ser un Error: una promesa rechazada con un string, por
  // ejemplo. Se trata siempre como algo de lo que solo se puede leer.

  let contexto = "{}";
  try {
    contexto = JSON.stringify(context || {});
  } catch (circular) {
    contexto = "(no serializable)";
  }

  console.error(
    `[${LOG_TAG}] source=${source} code=${code} status=${(error && error.status) || "-"} ` +
    `message="${(error && error.message) || error}" context=${contexto}`,
  );

  if (!isApiError && error && error.stack) {
    console.error(`[${LOG_TAG}] stack de ${source}:\n${error.stack}`);
  }

  return SPEECH_BY_CODE[code] || "ERR_UNEXPECTED";
}

/**
 * Envuelve el handle de un intent en try/catch. Ningún handler queda sin
 * protección, y el usuario siempre escucha POR QUÉ falló.
 */
function safeHandle(handlerName, handleFn) {
  return async function protectedHandle(handlerInput) {
    try {
      return await handleFn(handlerInput);
    } catch (error) {
      const t = typeof handlerInput.t === "function" ? handlerInput.t : (k) => k;
      const request = handlerInput.requestEnvelope.request;

      const key = reportError(handlerName, error, {
        intent: request.intent ? request.intent.name : request.type,
        dialogState: request.dialogState || "-",
      });

      try {
        // Sesión guardada que ya no sirve. Pasa cuando el token se emitió antes
        // de que a la cuenta le cambiaran el rol: el rol viaja DENTRO del token,
        // así que la base dice ORGANIZER y el token sigue diciendo CLIENT, y la
        // API responde 403. withAuth ya validó el rol de la sesión, de modo que
        // un 401 o un 403 aquí solo puede ser eso.
        //
        // Sin esto el usuario oye "no tienes permiso" sin saber por qué, y
        // decir la palabra clave no arregla nada porque la skill se cree con
        // sesión abierta. Se cierra y se pide de nuevo: eso sí lo resuelve.
        const esSesionVencida =
          error instanceof ApiError &&
          (error.code === API_ERRORS.UNAUTHORIZED ||
            error.code === API_ERRORS.FORBIDDEN) &&
          isLoggedIn(getSession(handlerInput));

        if (esSesionVencida) {
          console.warn(
            `[${LOG_TAG}] sesión vencida en ${handlerName} (${error.code}); se cierra y se pide la palabra clave`,
          );
          logoutUser(handlerInput);
          return askForSeed(handlerInput, t("SESSION_STALE"));
        }

        return handlerInput.responseBuilder
          .speak(capSpeech(`${t(key)} ${t("WHAT_TO_QUERY")}`))
          .reprompt(t("WHAT_TO_QUERY"))
          .getResponse();
      } catch (fallo) {
        // Si hasta el manejo de errores falla, se responde con lo mínimo
        // indispensable: la sesión sigue abierta y la skill no muere.
        console.error(`[${LOG_TAG}] falló el propio manejo de ${handlerName}: ${fallo.message}`);
        return RESPUESTA_DE_EMERGENCIA;
      }
    }
  };
}


// ═══════════════════════════════════════════════════════════════════════════
// 4. REPOSITORIO — datos ya normalizados
// ═══════════════════════════════════════════════════════════════════════════

/** El backend usa CLIENT; la skill habla de CUSTOMER. Se traduce en un solo sitio. */
function normalizeRole(role) {
  const value = role && role.name ? role.name : role;
  if (value === "CLIENT" || value === "CUSTOMER") return ROLES.CUSTOMER;
  if (value === "ORGANIZER") return ROLES.ORGANIZER;
  if (value === "ADMIN") return ROLES.ADMIN;
  return ROLES.CUSTOMER;
}

// Todo lo que viene de la API se sanea AQUÍ, en el único punto de entrada,
// para que ningún handler pueda meter texto crudo en la respuesta hablada.
function toUser(raw) {
  const user = raw || {};
  return {
    id: user.id,
    name: sanitizeSpeech(user.name, 80),
    email: user.email || "",
    role: normalizeRole(user.role),
  };
}

function toZone(zone) {
  const z = zone || {};
  return {
    id: z.id,
    name: sanitizeSpeech(z.publicName, 60) || "sin nombre",
    price: Number(z.eventPrice) || 0,
    available: Number(z.availableCapacity) || 0,
  };
}

function toEvent(raw) {
  if (!raw) return null;
  const venue = raw.venue || {};

  return {
    id: raw.id,
    name: sanitizeSpeech(raw.name, 100) || "evento sin nombre",
    startsAt: raw.startsAt,
    status: raw.status,
    organizerId: raw.organizerId,
    venue: {
      name: sanitizeSpeech(venue.name, 80),
      city: sanitizeSpeech(venue.city, 60),
      state: sanitizeSpeech(venue.state, 60),
    },
    zones: (Array.isArray(raw.zones) ? raw.zones : []).map(toZone),
  };
}

/** El listado del backend viene paginado: { data, meta }. */
function unwrapList(payload) {
  if (Array.isArray(payload)) return payload;
  return (payload && payload.data) || [];
}

const repo = {
  async loginWithSeed(seed) {
    const payload = await api.loginWithSeed(seed);
    return { token: payload.token, user: toUser(payload.user) };
  },

  async getSessionUser(token) {
    return toUser(await api.getMe(token));
  },

  async getPublishedEvents(token, organizerId) {
    const payload = await api.listEvents(token, {
      status: "PUBLISHED",
      organizerId,
      limit: 50,
    });
    return unwrapList(payload).map(toEvent);
  },

  async getEventById(token, eventId) {
    return toEvent(await api.getEventById(token, eventId));
  },

  /** Búsqueda tolerante: el catálogo resuelve sinónimos, pero el nombre puede variar. */
  async findEventByName(token, name) {
    if (!name) return null;
    const needle = String(name).toLowerCase().trim();
    const events = await repo.getPublishedEvents(token);

    return events.find((event) => {
      const candidate = event.name.toLowerCase();
      return candidate.includes(needle) || needle.includes(candidate);
    }) || null;
  },

  async getZones(token, eventId) {
    return unwrapList(await api.listZones(token, eventId)).map(toZone);
  },

  /**
   * Ventas de un evento. El backend devuelve el desglose en `byEventZone`, y
   * cada entrada trae `revenue` y `ticketsSold`. La capacidad total no existe
   * como campo: se reconstruye sumando lo disponible más lo ya vendido.
   */
  async getEventSales(token, event) {
    const stats = await api.purchaseStats(token, { eventId: event.id });
    const zones = stats.byEventZone || [];

    const sold = zones.reduce((sum, z) => sum + (Number(z.ticketsSold) || 0), 0);
    const available = event.zones.reduce((sum, z) => sum + z.available, 0);
    const capacity = available + sold;

    return {
      sold,
      available,
      capacity,
      occupancy: capacity > 0 ? Math.round((sold / capacity) * 100) : 0,
      revenue: Number(stats.totalRevenue) || 0,
    };
  },

  /** Eventos ordenados por recaudación (una llamada de stats por evento). */
  async getEventsRankedByRevenue(token) {
    const events = await repo.getPublishedEvents(token);

    const ranked = await Promise.all(
      events.map(async (event) => {
        const sales = await repo.getEventSales(token, event);
        return Object.assign({ event }, sales);
      }),
    );

    return ranked.sort((a, b) => b.revenue - a.revenue);
  },

  /**
   * Recaudación de un mes, vía el filtro from/to de GET /purchases/stats.
   * Si el backend no lo soportara, no devolvería `from` y la skill lo avisa en
   * vez de presentar el acumulado como si fuera del mes.
   */
  async getRevenueByMonth(token, monthNumber, year) {
    const from = new Date(Date.UTC(year, monthNumber - 1, 1)).toISOString();
    const to = new Date(Date.UTC(year, monthNumber, 0, 23, 59, 59)).toISOString();

    const stats = await api.purchaseStats(token, { from, to });

    return {
      total: Number(stats.totalRevenue) || 0,
      purchases: Number(stats.recentPurchasesCount) || 0,
      filtered: Boolean(stats.from),
    };
  },
};


// ═══════════════════════════════════════════════════════════════════════════
// 5. HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const MONTHS_ES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12,
};

const MONTHS_EN = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/**
 * Limpia lo que dicta el usuario para la semilla:
 * "jaguar morado" -> "jaguarmorado" (sin acentos, sin espacios, minúsculas).
 * Debe coincidir con la normalización del backend.
 */
function normalizeSeed(input) {
  if (!input) return "";
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/^(mi (palabra|clave|semilla) es|la (palabra|clave|semilla) es|es|dime)\s+/i, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Deja cualquier texto seguro para meterlo en la respuesta hablada.
 *
 * El SDK envuelve lo que se le pasa en <speak>…</speak>, así que un nombre con
 * "&" o "<" produce SSML inválido y Alexa RECHAZA la respuesta entera: la skill
 * se cae por un dato, no por un bug. Un evento llamado "Rock & Roll" bastaba.
 *
 * También se recortan los textos larguísimos: Alexa corta la respuesta si se
 * pasa de unos 8000 caracteres.
 */
function sanitizeSpeech(value, maxLen = 300) {
  if (value === null || value === undefined) return "";

  let texto = String(value)
    // Caracteres de control: no se pronuncian y ensucian el SSML.
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (texto.length > maxLen) {
    texto = `${texto.slice(0, maxLen - 1).trimEnd()}…`;
  }

  // Escapado XML. El & va primero o se escaparían dos veces los demás.
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Límite duro de la respuesta hablada. Si una lista crece de más (cien eventos,
 * por ejemplo), se corta en una frase completa en vez de dejar que Alexa
 * rechace la respuesta por longitud.
 */
const MAX_SPEECH_CHARS = 6000;

function capSpeech(texto) {
  const limpio = String(texto || "").trim();
  if (limpio.length <= MAX_SPEECH_CHARS) return limpio;

  const cortado = limpio.slice(0, MAX_SPEECH_CHARS);
  const ultimoPunto = cortado.lastIndexOf(". ");
  console.warn(`[SPEECH] respuesta de ${limpio.length} caracteres recortada`);
  return ultimoPunto > 0 ? cortado.slice(0, ultimoPunto + 1) : `${cortado}…`;
}

/** Nunca se escriben credenciales en CloudWatch. */
function maskSecret(value) {
  if (!value) return "(vacío)";
  return `${String(value).length} caracteres`;
}

/** Prioriza el valor canónico del catálogo sobre lo que se dictó. */
function getSlotValue(slots, slotName) {
  const slot = slots && slots[slotName];
  if (!slot) return null;

  const authorities =
    (slot.resolutions && slot.resolutions.resolutionsPerAuthority) || [];

  for (const authority of authorities) {
    const matched =
      authority.status &&
      authority.status.code === "ER_SUCCESS_MATCH" &&
      authority.values &&
      authority.values.length > 0;
    if (matched) return sanitizeSpeech(authority.values[0].value.name, 100);
  }

  // Lo que dicta el usuario también se sanea: se repite en voz alta cuando no
  // se encuentra ("No encontré el evento X"), y un valor con & o < rompería el
  // SSML igual que un dato de la API.
  return sanitizeSpeech(slot.value, 100) || null;
}

function getSlots(handlerInput) {
  const request = handlerInput.requestEnvelope.request;
  return (request.intent && request.intent.slots) || {};
}

function getDialogState(handlerInput) {
  return handlerInput.requestEnvelope.request.dialogState || null;
}

function pluralize(count, singular, plural) {
  return count === 1 ? singular : plural;
}

/**
 * Une una lista en lenguaje natural. El conector es parte del idioma, así que
 * viene del diccionario: estaba fijo en "y" y las listas en inglés salían
 * "Gira de Comedia y Sinfónica de Otoño".
 */
/**
 * Conector del idioma en curso. Lo fija LocalizationInterceptor en cada
 * petición, para que joinList no tenga que recibirlo en sus siete llamadas.
 */
let conectorDeLista = "y";

function joinList(items, connector = conectorDeLista) {
  const list = (items || []).filter(Boolean);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  return `${list.slice(0, -1).join(", ")} ${connector} ${list[list.length - 1]}`;
}

function formatDate(isoString, locale = "es-MX") {
  if (!isoString) return "";
  try {
    return new Date(isoString).toLocaleDateString(locale, {
      year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit",
      timeZone: "America/Mexico_City",
    });
  } catch (error) {
    return isoString;
  }
}

function formatCurrency(amount, locale = "es-MX") {
  const value = Number(amount) || 0;
  try {
    return value.toLocaleString(locale, { style: "currency", currency: "MXN" });
  } catch (error) {
    return `${value} pesos`;
  }
}

function getMonthNumber(monthName) {
  if (!monthName) return null;
  const key = String(monthName).toLowerCase().trim();

  // AMAZON.Month puede devolver "mayo" o "05".
  if (/^\d{1,2}$/.test(key)) {
    const number = parseInt(key, 10);
    return number >= 1 && number <= 12 ? number : null;
  }

  return MONTHS_ES[key] || MONTHS_EN[key] || null;
}

function stripSsml(ssml) {
  if (!ssml) return "";
  return String(ssml).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Formas alternativas de nombrar un evento, para que Alexa lo reconozca aunque
 * el usuario no diga el título completo.
 *
 * Los nombres reales traen ruido que nadie dice en voz alta: un prefijo de
 * entorno ("DEV - Rock en Vivo") y un subtítulo tras los dos puntos
 * ("Rock en Vivo: Noches Eléctricas"). Tomar las primeras palabras a ciegas
 * daba "DEV" para TODOS los eventos: sinónimos idénticos y ambiguos que no
 * distinguían nada.
 */
function buildEventSynonyms(name) {
  const limpio = String(name)
    // Prefijo de entorno o categoría: "DEV - ", "PROD — ", …
    .replace(/^[A-Za-z0-9]{1,6}\s*[-–—]\s*/, "")
    .trim();

  // Parte principal, antes del subtítulo.
  const principal = limpio.split(/[:–—]/)[0].trim();

  const candidatos = [
    limpio,
    principal,
    // Las primeras palabras significativas de la parte principal.
    principal.split(/\s+/).slice(0, 3).join(" "),
    principal.split(/\s+/).slice(0, 2).join(" "),
  ];

  const vistos = new Set([String(name).toLowerCase()]);

  return candidatos.filter((s) => {
    const clave = s.toLowerCase();
    // Se descartan los vacíos, los repetidos y los de una sola palabra corta
    // ("de", "la"), que provocarían falsos positivos.
    if (!s || s.length < 4 || vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}

/**
 * Entidades dinámicas: reemplaza el catálogo EventType en tiempo de ejecución
 * con los eventos que devuelve la API. Sin esto, Alexa solo reconocería los
 * eventos hardcodeados en el modelo de interacción.
 */
function buildEventEntitiesDirective(events) {
  return {
    type: "Dialog.UpdateDynamicEntities",
    updateBehavior: "REPLACE",
    types: [
      {
        name: "EventType",
        values: (events || []).slice(0, 100).map((event) => ({
          id: event.id,
          name: {
            value: event.name,
            synonyms: buildEventSynonyms(event.name),
          },
        })),
      },
    ],
  };
}


// ═══════════════════════════════════════════════════════════════════════════
// 6. I18N
// ═══════════════════════════════════════════════════════════════════════════

const es = {
  // ── Autenticación por semilla ──
  GREETING_NEW: "Bienvenido a Next Ticket. Para entrar, dime tu palabra clave.",
  ASK_SEED: "Dime tu palabra clave.",
  SEED_NOT_FOUND: "Esa palabra clave no es válida. Intentemos de nuevo, ¿cuál es tu palabra clave?",
  LOGIN_OK: "Bienvenido, %s. %s",
  LOGIN_OK_BACK: "Bienvenido de nuevo, %s. %s",
  LOGIN_REQUIRED: "Primero necesitas identificarte. Dime tu palabra clave.",
  SESSION_EXPIRED: "Por seguridad cerré tu sesión anterior. Dime tu palabra clave.",
  SESSION_STALE: "Tu sesión guardada ya no es válida, seguramente porque cambiaron los permisos de tu cuenta. La cerré para que puedas entrar de nuevo. ¿Cuál es tu palabra clave?",
  LOGOUT: "Sesión cerrada. Dime la palabra clave de la cuenta con la que quieres entrar.",
  ALREADY_LOGGED_IN: "Ya tienes la sesión iniciada, %s. %s",
  ROLE_DENIED: "Esta consulta solo está disponible para %s, y tu cuenta es de tipo %s. %s",

  ROLE_NAME_ORGANIZER: "organizador",
  ROLE_NAME_ADMIN: "administrador",
  ROLE_NAME_CUSTOMER: "cliente",
  ROLE_PLURAL_ORGANIZER: "organizadores",
  ROLE_PLURAL_ADMIN: "administradores",
  ROLE_PLURAL_CUSTOMER: "clientes",

  // ── Menús ──
  // Los menús dan frases LITERALES que el usuario puede repetir. Antes describían
  // las consultas en abstracto ("puedes preguntarme qué zonas tiene un evento")
  // y la gente lo repetía tal cual, sin nombrar ningún evento: caía en Fallback.
  MENU_ORGANIZER: "Puedes decir: cuáles son mis eventos; cómo van las ventas; qué zonas tiene; o hay lugares disponibles. ¿Qué deseas consultar?",
  MENU_ADMIN: "Puedes decir: qué eventos hay; cuál es el evento más taquillero; cuánto se recaudó en agosto; o qué zonas tiene. ¿Qué deseas consultar?",
  MENU_CUSTOMER: "Puedes decir: qué eventos hay; qué zonas tiene; hay lugares disponibles; o cuándo es el evento. ¿Qué deseas consultar?",
  LIST_CONNECTOR: "y",
  WHAT_TO_QUERY: "¿Qué deseas consultar?",
  ANYTHING_ELSE: "¿Hay algo más que quieras consultar?",

  // ── Preguntas por slot ──
  ASK_EVENT_TICKETS: "¿De qué evento deseas consultar los boletos vendidos?",
  ASK_EVENT_AVAILABILITY: "¿De qué evento deseas consultar la disponibilidad?",
  ASK_EVENT_INFO: "¿De qué evento deseas la información?",
  ASK_EVENT_ZONES: "¿De qué evento quieres conocer las zonas?",
  ASK_EVENT_SHORT: "¿De qué evento?",
  ASK_ZONE: "¿En qué zona de %s deseas consultar la disponibilidad?",
  ASK_ZONE_SHORT: "¿En qué zona?",
  ASK_MONTH: "¿De qué mes deseas consultar los ingresos?",
  ASK_MONTH_SHORT: "¿De qué mes?",

  // ── Errores de datos ──
  EVENT_NOT_FOUND: "No encontré el evento %s. Los eventos disponibles son: %s. ¿Cuál de ellos te interesa?",
  NO_EVENTS_AT_ALL: "Ahora mismo no hay eventos publicados en la plataforma. %s",
  ZONE_NOT_FOUND: "No encontré la zona %s en el evento %s. Las zonas disponibles son: %s. ¿Cuál quieres consultar?",
  MONTH_NOT_RECOGNIZED: "No reconocí el mes %s. Dime el nombre del mes, por ejemplo: mayo.",
  NOT_EVENT_OWNER: "El evento %s no está registrado a tu nombre, así que no puedo darte sus cifras de venta. %s",
  USING_REMEMBERED_EVENT: "Sigo con el evento %s.",

  // ── Consultas ──
  NO_ACTIVE_EVENTS: "No tienes eventos activos en este momento. %s",
  ACTIVE_EVENTS_ONE: "Tienes 1 evento activo: %s. ¿Quieres saber cómo van sus ventas?",
  ACTIVE_EVENTS_MANY: "Tienes %s eventos activos: %s. Di el nombre de uno para saber más.",

  // Catálogo para quien no organiza: no son "sus" eventos, son los que hay.
  NO_EVENTS_AVAILABLE: "Ahora mismo no hay eventos publicados. %s",
  EVENTS_AVAILABLE_ONE: "Hay 1 evento disponible: %s. ¿Quieres saber sus zonas o su disponibilidad?",
  EVENTS_AVAILABLE_MANY: "Hay %s eventos disponibles: %s. Di el nombre de uno para saber más.",
  // Con un solo evento sí cabe el detalle; con varios, solo el nombre.
  EVENT_LIST_ITEM: "%s, en %s el %s",

  // Se pregunta por un evento SIEMPRE ofreciendo la lista: si el usuario no
  // sabe qué hay, preguntarle "¿de qué evento?" lo deja sin salida.
  ASK_WHICH_EVENT: "%s Los eventos disponibles son: %s. ¿Cuál te interesa?",
  ACTIVE_EVENT_ITEM: "%s, en %s el %s",

  TICKETS_SOLD: "El evento %s ha vendido %s de %s boletos, es decir un %s por ciento de ocupación. Aún quedan %s %s. %s",
  TICKETS_SOLD_NONE: "El evento %s todavía no registra boletos vendidos. Tiene %s lugares disponibles. %s",

  ZONES_LIST: "El evento %s tiene %s %s: %s. %s",
  ZONES_ITEM: "%s, a %s, con %s %s",
  ZONES_EMPTY: "El evento %s todavía no tiene zonas configuradas. %s",

  SEAT_AVAILABLE: "Para el evento %s, la zona %s tiene %s %s. El precio por boleto es de %s. %s",
  SEAT_SOLD_OUT: "La zona %s del evento %s está agotada. %s",

  EVENT_INFO: "El evento %s se realizará el %s en %s, ubicado en %s, %s. Cuenta con las zonas: %s. %s %s",
  EVENT_INFO_AVAILABLE: "Aún hay %s lugares disponibles.",
  EVENT_INFO_SOLD_OUT: "El evento está agotado.",

  TOP_REVENUE: "El evento con mayor recaudación es %s, con %s generados y un %s por ciento de ocupación.",
  TOP_REVENUE_SECOND: "Le sigue %s con %s.",
  NO_REVENUE_DATA: "Todavía no hay ventas registradas en la plataforma. %s",

  REVENUE_MONTH: "Durante %s la plataforma generó %s en ingresos. %s",
  REVENUE_MONTH_EMPTY: "No se registraron ingresos en el mes de %s. %s",
  REVENUE_NOT_FILTERED: "Aún no puedo separar los ingresos por mes, así que te doy el total acumulado: %s. %s",

  // ── Plurales ──
  TICKET_ONE: "boleto", TICKET_MANY: "boletos",
  PLACE_ONE: "lugar disponible", PLACE_MANY: "lugares disponibles",
  EVENT_ONE: "evento activo", EVENT_MANY: "eventos activos",
  ZONE_ONE: "zona", ZONE_MANY: "zonas",

  // ── Errores del sistema: explican POR QUÉ falló ──
  ERR_API_NOT_CONFIGURED: "No tengo configurada la dirección del servidor de Next Ticket, así que no puedo consultar nada.",
  ERR_API_NETWORK: "No pude conectarme con el servidor de Next Ticket. Puede que esté apagado o sin conexión.",
  ERR_API_TIMEOUT: "El servidor de Next Ticket tardó demasiado en responder y tuve que cancelar la consulta.",
  ERR_API_UNAUTHORIZED: "Tu sesión ya no es válida. Dime tu palabra clave para entrar de nuevo.",
  ERR_API_FORBIDDEN: "Tu cuenta no tiene permiso para consultar esa información en el servidor.",
  ERR_API_NOT_FOUND: "El servidor no encontró esa información.",
  ERR_API_SERVER: "El servidor de Next Ticket respondió con un error interno.",
  ERR_API_TUNNEL: "Perdí la conexión con el servidor de Next Ticket. Hay que revisar que siga publicado.",
  ERR_UNEXPECTED: "Ocurrió un error inesperado al procesar tu consulta.",

  // ── Ayuda y salida ──
  HELP_ANONYMOUS: "Soy Next Ticket. Para consultar, primero dime tu palabra clave, que es una sola palabra que te identifica. ¿Cuál es?",
  HELP_LOGGED: "%s También puedes decir: repite, para escuchar otra vez; cambiar usuario, para entrar con otra cuenta; o detente, para salir.",
  FALLBACK: "No entendí eso. %s",
  FALLBACK_LOGIN: "No entendí eso. Dime solo tu palabra clave. %s",
  REPEAT_NOTHING: "Todavía no he dicho nada que pueda repetir. %s",
  GOODBYE: "Gracias por usar Next Ticket. ¡Hasta luego!",
};

/**
 * Inglés. Antes solo redefinía una docena de claves y el resto caía al español
 * por el Object.assign: la skill saludaba en inglés y seguía hablando español.
 * Ahora está completo, con el MISMO número y orden de %s que su equivalente.
 */
const en = Object.assign({}, es, {
  // ── Autenticación ──
  GREETING_NEW: "Welcome to Next Ticket. To sign in, tell me your key word.",
  ASK_SEED: "Tell me your key word.",
  SEED_NOT_FOUND: "That key word is not valid. Let's try again, what is your key word?",
  LOGIN_OK: "Welcome, %s. %s",
  LOGIN_OK_BACK: "Welcome back, %s. %s",
  LOGIN_REQUIRED: "You need to identify yourself first. Tell me your key word.",
  SESSION_EXPIRED: "I closed your previous session for security. Tell me your key word.",
  SESSION_STALE: "Your saved session is no longer valid, most likely because your account permissions changed. I closed it so you can sign in again. What is your key word?",
  LOGOUT: "Session closed. Tell me the key word of the account you want to use.",
  ALREADY_LOGGED_IN: "You are already signed in, %s. %s",
  ROLE_DENIED: "This information is only available to %s. Your account type is %s. %s",

  ROLE_NAME_ORGANIZER: "organizer",
  ROLE_NAME_ADMIN: "administrator",
  ROLE_NAME_CUSTOMER: "customer",
  ROLE_PLURAL_ORGANIZER: "organizers",
  ROLE_PLURAL_ADMIN: "administrators",
  ROLE_PLURAL_CUSTOMER: "customers",

  // ── Menús ──
  MENU_ORGANIZER: "You can say: what are my events; how are sales going; what zones does it have; or are there seats available. What would you like to know?",
  MENU_ADMIN: "You can say: what events are there; which event earned the most; how much did we make in August; or what zones does it have. What would you like to know?",
  MENU_CUSTOMER: "You can say: what events are there; what zones does it have; are there seats available; or when is the event. What would you like to know?",
  LIST_CONNECTOR: "and",
  WHAT_TO_QUERY: "What would you like to know?",
  ANYTHING_ELSE: "Is there anything else you want to check?",

  // ── Preguntas por slot ──
  ASK_EVENT_TICKETS: "Which event do you want the sales for? Just say the name, for example: Rock en Vivo.",
  ASK_EVENT_AVAILABILITY: "Which event? Just say the name, for example: Rock en Vivo.",
  ASK_EVENT_INFO: "Which event? Just say the name, for example: Rock en Vivo.",
  ASK_EVENT_ZONES: "Which event do you want the zones for? Just say the name.",
  ASK_EVENT_SHORT: "Which event?",
  ASK_ZONE: "Which zone of %s do you want to check?",
  ASK_ZONE_SHORT: "Which zone?",
  ASK_MONTH: "Which month do you want the revenue for?",
  ASK_MONTH_SHORT: "Which month?",

  // ── Errores de datos ──
  EVENT_NOT_FOUND: "I couldn't find the event %s. The available events are: %s. Which one are you interested in?",
  NO_EVENTS_AT_ALL: "There are no published events on the platform right now. %s",
  ZONE_NOT_FOUND: "I couldn't find the zone %s in the event %s. The available zones are: %s. Which one do you want?",
  MONTH_NOT_RECOGNIZED: "I didn't recognize the month %s. Tell me the name of the month, for example: May.",
  NOT_EVENT_OWNER: "The event %s is not registered under your name, so I can't give you its sales figures. %s",
  USING_REMEMBERED_EVENT: "Still on the event %s.",

  // ── Consultas ──
  NO_ACTIVE_EVENTS: "You have no active events at the moment. %s",
  ACTIVE_EVENTS_ONE: "You have 1 active event: %s. Would you like to know how its sales are going?",
  ACTIVE_EVENTS_MANY: "You have %s active events: %s. Say the name of one to hear more.",
  NO_EVENTS_AVAILABLE: "There are no published events right now. %s",
  EVENTS_AVAILABLE_ONE: "There is 1 event available: %s. Would you like to know its zones or its availability?",
  EVENTS_AVAILABLE_MANY: "There are %s events available: %s. Say the name of one to hear more.",
  EVENT_LIST_ITEM: "%s, at %s on %s",
  ASK_WHICH_EVENT: "%s The available events are: %s. Which one are you interested in?",
  ACTIVE_EVENT_ITEM: "%s, at %s on %s",

  TICKETS_SOLD: "The event %s has sold %s out of %s tickets, that is %s percent occupancy. There are still %s %s. %s",
  TICKETS_SOLD_NONE: "The event %s has no tickets sold yet. It has %s seats available. %s",

  ZONES_LIST: "The event %s has %s %s: %s. %s",
  ZONES_ITEM: "%s, at %s, with %s %s",
  ZONES_EMPTY: "The event %s has no zones set up yet. %s",

  SEAT_AVAILABLE: "For the event %s, the %s zone has %s %s. The price per ticket is %s. %s",
  SEAT_SOLD_OUT: "The %s zone of the event %s is sold out. %s",

  EVENT_INFO: "The event %s takes place on %s at %s, located in %s, %s. It has these zones: %s. %s %s",
  EVENT_INFO_AVAILABLE: "There are still %s seats available.",
  EVENT_INFO_SOLD_OUT: "The event is sold out.",

  TOP_REVENUE: "The highest earning event is %s, with %s generated and %s percent occupancy.",
  TOP_REVENUE_SECOND: "Next is %s with %s.",
  NO_REVENUE_DATA: "There are no sales recorded on the platform yet. %s",

  REVENUE_MONTH: "During %s the platform generated %s in revenue. %s",
  REVENUE_MONTH_EMPTY: "No revenue was recorded in %s. %s",
  REVENUE_NOT_FILTERED: "I can't break revenue down by month yet, so here is the running total: %s. %s",

  // ── Plurales ──
  TICKET_ONE: "ticket", TICKET_MANY: "tickets",
  PLACE_ONE: "seat available", PLACE_MANY: "seats available",
  EVENT_ONE: "active event", EVENT_MANY: "active events",
  ZONE_ONE: "zone", ZONE_MANY: "zones",

  // ── Errores del sistema ──
  ERR_API_NOT_CONFIGURED: "I don't have the address of the Next Ticket server configured, so I can't look anything up.",
  ERR_API_NETWORK: "I couldn't reach the Next Ticket server. It may be offline.",
  ERR_API_TIMEOUT: "The Next Ticket server took too long to answer, so I cancelled the request.",
  ERR_API_UNAUTHORIZED: "Your session is no longer valid. Tell me your key word to sign in again.",
  ERR_API_FORBIDDEN: "Your account doesn't have permission to look that up on the server.",
  ERR_API_NOT_FOUND: "The server couldn't find that information.",
  ERR_API_SERVER: "The Next Ticket server responded with an internal error.",
  ERR_API_TUNNEL: "I lost the connection to the Next Ticket server. Someone needs to check that it is still published.",
  ERR_UNEXPECTED: "An unexpected error occurred while processing your request.",

  // ── Ayuda y salida ──
  HELP_ANONYMOUS: "This is Next Ticket. To look anything up, first tell me your key word, which is a single word that identifies you. What is it?",
  HELP_LOGGED: "%s You can also say: repeat, to hear it again; switch user, to sign in with another account; or stop, to exit.",
  FALLBACK: "I didn't get that. %s",
  FALLBACK_LOGIN: "I didn't get that. Just tell me your key word. %s",
  REPEAT_NOTHING: "I haven't said anything I can repeat yet. %s",
  GOODBYE: "Thanks for using Next Ticket. Goodbye!",
});

const LANGUAGE_STRINGS = { es, en };
const DEFAULT_LANGUAGE = "es";

function getLanguageCode(locale) {
  const lang = String(locale || DEFAULT_LANGUAGE).split("-")[0].toLowerCase();
  return LANGUAGE_STRINGS[lang] ? lang : DEFAULT_LANGUAGE;
}

function translate(locale, key, ...args) {
  const lang = getLanguageCode(locale);
  let value = LANGUAGE_STRINGS[lang][key];

  if (value === undefined) value = LANGUAGE_STRINGS[DEFAULT_LANGUAGE][key];
  if (value === undefined) {
    console.warn(`i18n: falta la clave "${key}" en "${lang}"`);
    return key;
  }
  if (Array.isArray(value)) value = value[Math.floor(Math.random() * value.length)];

  let index = 0;
  return String(value)
    .replace(/%s/g, () => {
      const replacement = args[index];
      index += 1;
      return replacement === undefined || replacement === null ? "" : String(replacement);
    })
    .replace(/\s+/g, " ")
    .trim();
}


// ═══════════════════════════════════════════════════════════════════════════
// 7. SESIÓN Y PROTECCIÓN POR ROL
// ═══════════════════════════════════════════════════════════════════════════

function getSession(handlerInput) {
  return handlerInput.attributesManager.getSessionAttributes() || {};
}

function patchSession(handlerInput, patch) {
  const session = Object.assign({}, getSession(handlerInput), patch);
  handlerInput.attributesManager.setSessionAttributes(session);
  return session;
}

function isLoggedIn(session) {
  return Boolean(session && session.loggedIn && session.token);
}

function isSessionExpired(session) {
  if (!session || !session.loginAt) return false;
  return Date.now() - session.loginAt > SESSION_TTL_MS;
}

function startLogin(handlerInput) {
  patchSession(handlerInput, { awaitingSeed: true });
}

/**
 * Pide la palabra clave DEJANDO A ALEXA ESPERANDO una respuesta libre.
 *
 * Sin esto no funciona: un slot AMAZON.SearchQuery no se puede capturar con un
 * sample que sea solo "{userInput}" — Alexa exige palabras portadoras alrededor
 * ("mi palabra clave es ..."). Así que si el usuario contesta "jaguar morado" a
 * secas, no coincide con nada y cae en FallbackIntent, dando la sensación de
 * que la skill ignora la respuesta.
 *
 * Al elicitar el slot explícitamente, Alexa mete TODO lo que se diga a
 * continuación dentro de userInput, sin necesidad de frase portadora.
 */
function askForSeed(handlerInput, speech) {
  const t = handlerInput.t;
  startLogin(handlerInput);

  return handlerInput.responseBuilder
    .speak(speech)
    .reprompt(t("ASK_SEED"))
    .addElicitSlotDirective("userInput", {
      name: "CaptureInputIntent",
      confirmationStatus: "NONE",
      slots: {
        userInput: { name: "userInput", confirmationStatus: "NONE" },
      },
    })
    .getResponse();
}

/** Guarda el token que devolvió la semilla: se reutiliza en las próximas visitas. */
function loginUser(handlerInput, token, user) {
  patchSession(handlerInput, {
    loggedIn: true,
    token,
    userId: user.id,
    userRole: user.role,
    userName: user.name,
    loginAt: Date.now(),
    awaitingSeed: false,
  });
}

function logoutUser(handlerInput) {
  patchSession(handlerInput, {
    loggedIn: false,
    token: null,
    userId: null,
    userRole: null,
    userName: null,
    loginAt: null,
    lastEventId: null,
    lastEventName: null,
    awaitingSeed: true,
  });
}

function getFirstName(session) {
  return session && session.userName ? String(session.userName).split(" ")[0] : "";
}

function menuForRole(t, role) {
  const conocido = rolConocido(role);
  if (conocido === ROLES.ORGANIZER) return t("MENU_ORGANIZER");
  if (conocido === ROLES.ADMIN) return t("MENU_ADMIN");
  return t("MENU_CUSTOMER");
}

/**
 * Un rol desconocido (sesión vieja, dato corrupto) no debe filtrar la clave de
 * i18n a la voz: se oiría "tu cuenta es de tipo ROLE_NAME_MARCIANO".
 */
function rolConocido(role) {
  return role === ROLES.ORGANIZER || role === ROLES.ADMIN || role === ROLES.CUSTOMER
    ? role
    : ROLES.CUSTOMER;
}

function roleName(t, role) {
  return t(`ROLE_NAME_${rolConocido(role)}`);
}

function rolePlural(t, role) {
  return t(`ROLE_PLURAL_${rolConocido(role)}`);
}

/**
 * Envoltorio de autorización. Valida sesión y rol una sola vez para los
 * 7 intents de negocio, y encima aplica safeHandle para el try/catch.
 */
function withAuth(handlerName, allowedRoles, handleFn) {
  return safeHandle(handlerName, async (handlerInput) => {
    const t = handlerInput.t;
    const session = getSession(handlerInput);

    if (!isLoggedIn(session)) {
      return askForSeed(handlerInput, t("LOGIN_REQUIRED"));
    }

    if (Array.isArray(allowedRoles) && !allowedRoles.includes(session.userRole)) {
      const allowed = allowedRoles.map((role) => rolePlural(t, role)).join(" o ");
      return handlerInput.responseBuilder
        .speak(t("ROLE_DENIED", allowed, roleName(t, session.userRole), menuForRole(t, session.userRole)))
        .reprompt(t("WHAT_TO_QUERY"))
        .getResponse();
    }

    return handleFn(handlerInput, session);
  });
}


// ═══════════════════════════════════════════════════════════════════════════
// 8. INTERCEPTORES
// ═══════════════════════════════════════════════════════════════════════════

/** Solo estas claves viajan a DynamoDB. El token incluido: es el punto del profe. */
const PERSISTED_KEYS = [
  "loggedIn", "token", "userId", "userRole", "userName",
  "loginAt", "lastEventId", "lastEventName",
];

/**
 * Sin tabla configurada, el SDK lanza "Cannot get PersistentAttributes without
 * PersistenceManager" en cada turno. Eso no es un fallo de la skill, así que no
 * debe ensuciar el filtro NEXTTICKET_ERROR de CloudWatch.
 */
const HAS_PERSISTENCE = Boolean(process.env.DYNAMODB_PERSISTENCE_TABLE_NAME);

const LocalizationInterceptor = {
  process(handlerInput) {
    const locale = handlerInput.requestEnvelope.request.locale || "es-MX";
    handlerInput.locale = locale;
    handlerInput.t = (key, ...args) => translate(locale, key, ...args);
    conectorDeLista = translate(locale, "LIST_CONNECTOR");
  },
};

const LoadAttributesInterceptor = {
  async process(handlerInput) {
    const attributesManager = handlerInput.attributesManager;
    const session = attributesManager.getSessionAttributes() || {};
    if (session._loaded) return;

    let persistent = {};
    if (HAS_PERSISTENCE) {
      try {
        persistent = (await attributesManager.getPersistentAttributes()) || {};
      } catch (error) {
        reportError("LoadAttributesInterceptor", error);
      }
    }

    if (isSessionExpired(persistent)) {
      console.log("Sesión persistida expirada; se pedirá la semilla otra vez.");
      attributesManager.setSessionAttributes({
        _loaded: true, sessionExpired: true, awaitingSeed: true,
      });
      return;
    }

    const restored = { _loaded: true };
    PERSISTED_KEYS.forEach((key) => {
      if (persistent[key] !== undefined) restored[key] = persistent[key];
    });

    attributesManager.setSessionAttributes(Object.assign(restored, session));
  },
};

const LoggingRequestInterceptor = {
  process(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    const session = handlerInput.attributesManager.getSessionAttributes() || {};
    console.log(
      `[REQUEST] type=${request.type} intent=${request.intent ? request.intent.name : "-"} ` +
      `dialogState=${request.dialogState || "-"} user=${session.userId || "anónimo"} role=${session.userRole || "-"}`,
    );
  },
};

const RememberSpeechInterceptor = {
  process(handlerInput, response) {
    if (!response || !response.outputSpeech) return;
    const spoken = stripSsml(response.outputSpeech.ssml || response.outputSpeech.text);
    if (!spoken) return;

    const session = handlerInput.attributesManager.getSessionAttributes() || {};
    session.lastSpeech = spoken;
    if (response.reprompt && response.reprompt.outputSpeech) {
      session.lastReprompt = stripSsml(
        response.reprompt.outputSpeech.ssml || response.reprompt.outputSpeech.text,
      );
    }
    handlerInput.attributesManager.setSessionAttributes(session);
  },
};

const SaveAttributesInterceptor = {
  async process(handlerInput) {
    if (!HAS_PERSISTENCE) return;

    const attributesManager = handlerInput.attributesManager;
    const session = attributesManager.getSessionAttributes() || {};

    const toPersist = {};
    PERSISTED_KEYS.forEach((key) => {
      if (session[key] !== undefined) toPersist[key] = session[key];
    });

    try {
      attributesManager.setPersistentAttributes(toPersist);
      await attributesManager.savePersistentAttributes();
    } catch (error) {
      reportError("SaveAttributesInterceptor", error);
    }
  },
};

const LoggingResponseInterceptor = {
  process(handlerInput, response) {
    if (!response) return;
    const speech = response.outputSpeech ? stripSsml(response.outputSpeech.ssml) : "(sin voz)";
    console.log(`[RESPONSE] endSession=${Boolean(response.shouldEndSession)} speech="${speech}"`);
  },
};


// ═══════════════════════════════════════════════════════════════════════════
// 9. HANDLERS — utilidades compartidas
// ═══════════════════════════════════════════════════════════════════════════

function rememberEvent(handlerInput, event) {
  if (!event) return;
  patchSession(handlerInput, { lastEventId: event.id, lastEventName: event.name });
}

/** Resuelve el evento del slot o, si viene vacío, el último consultado. */
async function resolveEvent(handlerInput, session) {
  const rawValue = getSlotValue(getSlots(handlerInput), "eventName");

  if (rawValue) {
    const event = await repo.findEventByName(session.token, rawValue);
    return { event, rawValue, remembered: false };
  }

  if (session.lastEventId) {
    const event = await repo.getEventById(session.token, session.lastEventId);
    if (event) return { event, rawValue: event.name, remembered: true };
  }

  return { event: null, rawValue: null, remembered: false };
}

/**
 * Pregunta por un evento MOSTRANDO los que hay. Preguntar "¿de qué evento?" a
 * secas deja atascado a quien no conoce el catálogo: contesta cualquier cosa
 * ("todos") y vuelve a la misma pregunta, en bucle.
 */
async function askWhichEvent(handlerInput, session, promptKey) {
  const t = handlerInput.t;
  const events = await repo.getPublishedEvents(session.token);

  if (events.length === 0) {
    return handlerInput.responseBuilder
      .speak(t("NO_EVENTS_AT_ALL", t("WHAT_TO_QUERY")))
      .reprompt(t("WHAT_TO_QUERY"))
      .getResponse();
  }

  return handlerInput.responseBuilder
    .speak(t("ASK_WHICH_EVENT", t(promptKey), joinList(events.map((e) => e.name))))
    .reprompt(t("ASK_EVENT_SHORT"))
    .addElicitSlotDirective("eventName")
    .addDirective(buildEventEntitiesDirective(events))
    .getResponse();
}

async function eventNotFound(handlerInput, session, rawValue) {
  const t = handlerInput.t;
  const events = await repo.getPublishedEvents(session.token);

  if (events.length === 0) {
    return handlerInput.responseBuilder
      .speak(t("NO_EVENTS_AT_ALL", t("WHAT_TO_QUERY")))
      .reprompt(t("WHAT_TO_QUERY"))
      .getResponse();
  }

  return handlerInput.responseBuilder
    .speak(t("EVENT_NOT_FOUND", rawValue, joinList(events.map((e) => e.name))))
    .reprompt(t("ASK_EVENT_SHORT"))
    .addElicitSlotDirective("eventName")
    .getResponse();
}

function withRememberedPrefix(handlerInput, resolved, speech) {
  if (!resolved.remembered) return speech;
  return `${handlerInput.t("USING_REMEMBERED_EVENT", resolved.event.name)} ${speech}`;
}

/** true si el diálogo aún no termina de llenar los slots. */
function isDialogIncomplete(handlerInput) {
  const state = getDialogState(handlerInput);
  return state === "STARTED" || state === "IN_PROGRESS";
}

/** canHandle para un intent con slots: solo corre cuando el diálogo terminó. */
function canHandleCompleted(intentName) {
  return (handlerInput) =>
    Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
    Alexa.getIntentName(handlerInput.requestEnvelope) === intentName &&
    getDialogState(handlerInput) === "COMPLETED";
}

function canHandleIntent(intentName) {
  return (handlerInput) =>
    Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
    Alexa.getIntentName(handlerInput.requestEnvelope) === intentName;
}


// ═══════════════════════════════════════════════════════════════════════════
// 9a. HANDLERS — autenticación por semilla
// ═══════════════════════════════════════════════════════════════════════════

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest";
  },
  handle: safeHandle("LaunchRequest", async (handlerInput) => {
    const t = handlerInput.t;
    const session = getSession(handlerInput);

    // Hay token guardado: se revalida contra la API antes de confiar en él.
    if (isLoggedIn(session)) {
      try {
        const user = await repo.getSessionUser(session.token);
        patchSession(handlerInput, { userRole: user.role, userName: user.name });

        const events = await repo.getPublishedEvents(session.token);
        return handlerInput.responseBuilder
          .speak(t("LOGIN_OK_BACK", getFirstName(session), menuForRole(t, user.role)))
          .reprompt(t("WHAT_TO_QUERY"))
          .addDirective(buildEventEntitiesDirective(events))
          .getResponse();
      } catch (error) {
        // Token vencido o backend caído: se vuelve a pedir la semilla.
        reportError("LaunchRequest.revalidateToken", error);
        logoutUser(handlerInput);
      }
    }

    const speech = session.sessionExpired ? t("SESSION_EXPIRED") : t("GREETING_NEW");
    return askForSeed(handlerInput, speech);
  }),
};

/** Captura la palabra semilla cuando la skill la está pidiendo. */
const CaptureSeedHandler = {
  canHandle(handlerInput) {
    const session = getSession(handlerInput);
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "CaptureInputIntent" &&
      session.awaitingSeed === true
    );
  },
  handle: safeHandle("CaptureSeed", async (handlerInput) => {
    const t = handlerInput.t;
    const raw = getSlotValue(getSlots(handlerInput), "userInput");
    const seed = normalizeSeed(raw);

    console.log(`Login por semilla: recibida ${maskSecret(seed)}`);

    let result;
    try {
      result = await repo.loginWithSeed(seed);
    } catch (error) {
      // 401 = semilla incorrecta: es un caso de negocio, no una falla técnica.
      if (error instanceof ApiError && error.code === API_ERRORS.UNAUTHORIZED) {
        return askForSeed(handlerInput, t("SEED_NOT_FOUND"));
      }
      throw error; // el resto lo explica safeHandle
    }

    loginUser(handlerInput, result.token, result.user);

    const events = await repo.getPublishedEvents(result.token);

    return handlerInput.responseBuilder
      .speak(t("LOGIN_OK", result.user.name.split(" ")[0], menuForRole(t, result.user.role)))
      .reprompt(t("WHAT_TO_QUERY"))
      .addDirective(buildEventEntitiesDirective(events))
      .getResponse();
  }),
};

/** El usuario dicta algo suelto cuando no se le está pidiendo la semilla. */
const CaptureInputOutOfContextHandler = {
  canHandle: canHandleIntent("CaptureInputIntent"),
  handle: safeHandle("CaptureInputOutOfContext", (handlerInput) => {
    const t = handlerInput.t;
    const session = getSession(handlerInput);

    if (isLoggedIn(session)) {
      return handlerInput.responseBuilder
        .speak(t("ALREADY_LOGGED_IN", getFirstName(session), menuForRole(t, session.userRole)))
        .reprompt(t("WHAT_TO_QUERY"))
        .getResponse();
    }

    return askForSeed(handlerInput, t("GREETING_NEW"));
  }),
};

const LogoutIntentHandler = {
  canHandle: canHandleIntent("LogoutIntent"),
  handle: safeHandle("LogoutIntent", (handlerInput) => {
    logoutUser(handlerInput);
    return askForSeed(handlerInput, handlerInput.t("LOGOUT"));
  }),
};


// ═══════════════════════════════════════════════════════════════════════════
// 9b. HANDLERS — diálogo en progreso (validación de directivas)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Un solo handler cubre los intents con slots mientras el diálogo NO está
 * completo: delega en Alexa para que use los prompts del modelo. Así los
 * handlers de negocio solo se ejecutan con todos los slots llenos.
 */
const DIALOG_INTENTS = [
  "GetTicketsSoldIntent",
  "GetSeatAvailabilityIntent",
  "GetEventInfoIntent",
  "GetZonesIntent",
  "GetTotalRevenueByPeriodIntent",
];

const InProgressDialogHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      DIALOG_INTENTS.indexOf(Alexa.getIntentName(handlerInput.requestEnvelope)) > -1 &&
      isDialogIncomplete(handlerInput)
    );
  },
  handle: safeHandle("InProgressDialog", async (handlerInput) => {
    const session = getSession(handlerInput);

    // Sin sesión no tiene sentido llenar slots: se corta aquí.
    if (!isLoggedIn(session)) {
      return askForSeed(handlerInput, handlerInput.t("LOGIN_REQUIRED"));
    }

    const intent = handlerInput.requestEnvelope.request.intent;

    // Si el evento ya está en memoria, se rellena el slot para no volver a pedirlo.
    if (intent.slots && intent.slots.eventName && !intent.slots.eventName.value && session.lastEventName) {
      const filled = JSON.parse(JSON.stringify(intent));
      filled.slots.eventName.value = session.lastEventName;
      filled.slots.eventName.confirmationStatus = "NONE";

      console.log(`[DIÁLOGO] eventName vacío -> se rellena con "${session.lastEventName}"`);
      return handlerInput.responseBuilder.addDelegateDirective(filled).getResponse();
    }

    console.log(`[DIÁLOGO] delegando a Alexa: ${intent.name} (${getDialogState(handlerInput)})`);
    return handlerInput.responseBuilder.addDelegateDirective(intent).getResponse();
  }),
};


// ═══════════════════════════════════════════════════════════════════════════
// 9c. HANDLERS — consultas de negocio
// ═══════════════════════════════════════════════════════════════════════════

// ─── 1. Listar eventos (todos los roles, con alcance distinto) ───────────────

/**
 * Un organizador pregunta por SUS eventos; un cliente por los que hay a la
 * venta. Es la misma pregunta con distinto alcance, así que la resuelve un
 * solo intent en vez de negarle el catálogo a quien no organiza: un cliente
 * que no sabe qué eventos existen no puede preguntar por ninguno.
 */
const GetActiveEventsIntentHandler = {
  canHandle: canHandleIntent("GetActiveEventsIntent"),
  handle: withAuth(
    "GetActiveEvents",
    [ROLES.ORGANIZER, ROLES.ADMIN, ROLES.CUSTOMER],
    async (handlerInput, session) => {
      const t = handlerInput.t;
      const esOrganizador = session.userRole === ROLES.ORGANIZER;

      // Solo el organizador filtra por dueño; los demás ven el catálogo.
      const events = await repo.getPublishedEvents(
        session.token,
        esOrganizador ? session.userId : undefined,
      );

      if (events.length === 0) {
        return handlerInput.responseBuilder
          .speak(
            esOrganizador
              ? t("NO_ACTIVE_EVENTS", menuForRole(t, session.userRole))
              : t("NO_EVENTS_AVAILABLE", menuForRole(t, session.userRole)),
          )
          .reprompt(t("WHAT_TO_QUERY"))
          .getResponse();
      }

      // Con un solo evento se puede dar el detalle; con varios, solo el nombre:
      // una lista de cuatro con recinto y fecha es imposible de retener, y el
      // usuario termina repitiéndola completa en vez de decir un nombre.
      const items =
        events.length === 1
          ? [t("EVENT_LIST_ITEM", events[0].name, events[0].venue.name, formatDate(events[0].startsAt, handlerInput.locale))]
          : events.map((event) => event.name);

      // Con un solo evento se recuerda: lo siguiente que pregunte ya tiene contexto.
      if (events.length === 1) rememberEvent(handlerInput, events[0]);

      let speech;
      if (esOrganizador) {
        speech = events.length === 1
          ? t("ACTIVE_EVENTS_ONE", items[0])
          : t("ACTIVE_EVENTS_MANY", events.length, joinList(items));
      } else {
        speech = events.length === 1
          ? t("EVENTS_AVAILABLE_ONE", items[0])
          : t("EVENTS_AVAILABLE_MANY", events.length, joinList(items));
      }

      return handlerInput.responseBuilder
        .speak(speech)
        .reprompt(t("WHAT_TO_QUERY"))
        .addDirective(buildEventEntitiesDirective(events))
        .getResponse();
    },
  ),
};

// ─── 2. Boletos vendidos (ORGANIZER + ADMIN) ─────────────────────────────────

const GetTicketsSoldIntentHandler = {
  canHandle: canHandleCompleted("GetTicketsSoldIntent"),
  handle: withAuth("GetTicketsSold", [ROLES.ORGANIZER, ROLES.ADMIN], async (handlerInput, session) => {
    const t = handlerInput.t;
    const resolved = await resolveEvent(handlerInput, session);

    if (!resolved.rawValue) {
      return askWhichEvent(handlerInput, session, "ASK_EVENT_TICKETS");
    }

    if (!resolved.event) return eventNotFound(handlerInput, session, resolved.rawValue);

    const event = resolved.event;

    if (session.userRole === ROLES.ORGANIZER && event.organizerId !== session.userId) {
      return handlerInput.responseBuilder
        .speak(t("NOT_EVENT_OWNER", event.name, menuForRole(t, session.userRole)))
        .reprompt(t("WHAT_TO_QUERY"))
        .getResponse();
    }

    rememberEvent(handlerInput, event);
    const sales = await repo.getEventSales(session.token, event);

    const speech =
      sales.sold === 0
        ? t("TICKETS_SOLD_NONE", event.name, sales.available, t("ANYTHING_ELSE"))
        : t("TICKETS_SOLD", event.name, sales.sold, sales.capacity, sales.occupancy,
            sales.available, pluralize(sales.available, t("PLACE_ONE"), t("PLACE_MANY")),
            t("ANYTHING_ELSE"));

    return handlerInput.responseBuilder
      .speak(withRememberedPrefix(handlerInput, resolved, speech))
      .reprompt(t("WHAT_TO_QUERY"))
      .getResponse();
  }),
};

// ─── 3. Zonas de un evento (todos los roles) — INTENT NUEVO ──────────────────

const GetZonesIntentHandler = {
  canHandle: canHandleCompleted("GetZonesIntent"),
  handle: withAuth("GetZones", [ROLES.CUSTOMER, ROLES.ORGANIZER, ROLES.ADMIN], async (handlerInput, session) => {
    const t = handlerInput.t;
    const resolved = await resolveEvent(handlerInput, session);

    if (!resolved.rawValue) {
      return askWhichEvent(handlerInput, session, "ASK_EVENT_ZONES");
    }

    if (!resolved.event) return eventNotFound(handlerInput, session, resolved.rawValue);

    const event = resolved.event;
    rememberEvent(handlerInput, event);

    const zones = await repo.getZones(session.token, event.id);

    if (zones.length === 0) {
      return handlerInput.responseBuilder
        .speak(t("ZONES_EMPTY", event.name, t("ANYTHING_ELSE")))
        .reprompt(t("WHAT_TO_QUERY"))
        .getResponse();
    }

    const items = zones.map((zone) =>
      t("ZONES_ITEM", zone.name, formatCurrency(zone.price, handlerInput.locale),
        zone.available, pluralize(zone.available, t("PLACE_ONE"), t("PLACE_MANY"))),
    );

    const speech = t("ZONES_LIST", event.name, zones.length,
      pluralize(zones.length, t("ZONE_ONE"), t("ZONE_MANY")),
      joinList(items), t("ANYTHING_ELSE"));

    return handlerInput.responseBuilder
      .speak(withRememberedPrefix(handlerInput, resolved, speech))
      .reprompt(t("WHAT_TO_QUERY"))
      .getResponse();
  }),
};

// ─── 4. Disponibilidad por zona (todos los roles) ────────────────────────────

const GetSeatAvailabilityIntentHandler = {
  canHandle: canHandleCompleted("GetSeatAvailabilityIntent"),
  handle: withAuth("GetSeatAvailability", [ROLES.CUSTOMER, ROLES.ORGANIZER, ROLES.ADMIN], async (handlerInput, session) => {
    const t = handlerInput.t;
    const resolved = await resolveEvent(handlerInput, session);
    const zoneValue = getSlotValue(getSlots(handlerInput), "zoneName");

    if (!resolved.rawValue) {
      return askWhichEvent(handlerInput, session, "ASK_EVENT_AVAILABILITY");
    }

    if (!resolved.event) return eventNotFound(handlerInput, session, resolved.rawValue);

    const event = resolved.event;
    rememberEvent(handlerInput, event);

    const zones = await repo.getZones(session.token, event.id);

    if (!zoneValue) {
      return handlerInput.responseBuilder
        .speak(t("ASK_ZONE", event.name))
        .reprompt(t("ASK_ZONE_SHORT"))
        .addElicitSlotDirective("zoneName")
        .getResponse();
    }

    const needle = String(zoneValue).toLowerCase().trim();
    const zone = zones.find((z) => {
      const candidate = String(z.name).toLowerCase();
      return candidate.includes(needle) || needle.includes(candidate);
    });

    if (!zone) {
      return handlerInput.responseBuilder
        .speak(t("ZONE_NOT_FOUND", zoneValue, event.name, joinList(zones.map((z) => z.name))))
        .reprompt(t("ASK_ZONE_SHORT"))
        .addElicitSlotDirective("zoneName")
        .getResponse();
    }

    const speech =
      zone.available > 0
        ? t("SEAT_AVAILABLE", event.name, zone.name, zone.available,
            pluralize(zone.available, t("PLACE_ONE"), t("PLACE_MANY")),
            formatCurrency(zone.price, handlerInput.locale), t("ANYTHING_ELSE"))
        : t("SEAT_SOLD_OUT", zone.name, event.name, t("ANYTHING_ELSE"));

    return handlerInput.responseBuilder
      .speak(withRememberedPrefix(handlerInput, resolved, speech))
      .reprompt(t("WHAT_TO_QUERY"))
      .getResponse();
  }),
};

// ─── 5. Información del evento (todos los roles) ─────────────────────────────

const GetEventInfoIntentHandler = {
  canHandle: canHandleCompleted("GetEventInfoIntent"),
  handle: withAuth("GetEventInfo", [ROLES.CUSTOMER, ROLES.ORGANIZER, ROLES.ADMIN], async (handlerInput, session) => {
    const t = handlerInput.t;
    const resolved = await resolveEvent(handlerInput, session);

    if (!resolved.rawValue) {
      return askWhichEvent(handlerInput, session, "ASK_EVENT_INFO");
    }

    if (!resolved.event) return eventNotFound(handlerInput, session, resolved.rawValue);

    const event = resolved.event;
    rememberEvent(handlerInput, event);

    const available = event.zones.reduce((sum, zone) => sum + zone.available, 0);
    const availabilityText =
      available > 0 ? t("EVENT_INFO_AVAILABLE", available) : t("EVENT_INFO_SOLD_OUT");

    const speech = t("EVENT_INFO", event.name,
      formatDate(event.startsAt, handlerInput.locale),
      event.venue.name, event.venue.city, event.venue.state,
      joinList(event.zones.map((z) => z.name)),
      availabilityText, t("ANYTHING_ELSE"));

    return handlerInput.responseBuilder
      .speak(withRememberedPrefix(handlerInput, resolved, speech))
      .reprompt(t("WHAT_TO_QUERY"))
      .getResponse();
  }),
};

// ─── 6. Evento más taquillero (ADMIN) ────────────────────────────────────────

const GetTopRevenueEventIntentHandler = {
  canHandle: canHandleIntent("GetTopRevenueEventIntent"),
  handle: withAuth("GetTopRevenueEvent", [ROLES.ADMIN], async (handlerInput, session) => {
    const t = handlerInput.t;
    const ranking = await repo.getEventsRankedByRevenue(session.token);

    if (ranking.length === 0 || ranking[0].revenue === 0) {
      return handlerInput.responseBuilder
        .speak(t("NO_REVENUE_DATA", t("ANYTHING_ELSE")))
        .reprompt(t("WHAT_TO_QUERY"))
        .getResponse();
    }

    const top = ranking[0];
    const second = ranking[1];
    rememberEvent(handlerInput, top.event);

    let speech = t("TOP_REVENUE", top.event.name,
      formatCurrency(top.revenue, handlerInput.locale), top.occupancy);

    if (second) {
      speech += " " + t("TOP_REVENUE_SECOND", second.event.name,
        formatCurrency(second.revenue, handlerInput.locale));
    }

    return handlerInput.responseBuilder
      .speak(`${speech} ${t("ANYTHING_ELSE")}`)
      .reprompt(t("WHAT_TO_QUERY"))
      .getResponse();
  }),
};

// ─── 7. Ingresos por mes (ADMIN) ─────────────────────────────────────────────

const GetTotalRevenueByPeriodIntentHandler = {
  canHandle: canHandleCompleted("GetTotalRevenueByPeriodIntent"),
  handle: withAuth("GetTotalRevenueByPeriod", [ROLES.ADMIN], async (handlerInput, session) => {
    const t = handlerInput.t;
    const monthValue = getSlotValue(getSlots(handlerInput), "monthName");

    if (!monthValue) {
      return handlerInput.responseBuilder
        .speak(t("ASK_MONTH"))
        .reprompt(t("ASK_MONTH_SHORT"))
        .addElicitSlotDirective("monthName")
        .getResponse();
    }

    const monthNumber = getMonthNumber(monthValue);
    if (!monthNumber) {
      return handlerInput.responseBuilder
        .speak(t("MONTH_NOT_RECOGNIZED", monthValue))
        .reprompt(t("ASK_MONTH_SHORT"))
        .addElicitSlotDirective("monthName")
        .getResponse();
    }

    const year = new Date().getUTCFullYear();
    const result = await repo.getRevenueByMonth(session.token, monthNumber, year);

    let speech;
    if (!result.filtered) {
      // El backend no aplicó el filtro: se dice la verdad en vez de presentar
      // el acumulado como si fuera del mes.
      speech = t("REVENUE_NOT_FILTERED",
        formatCurrency(result.total, handlerInput.locale), t("ANYTHING_ELSE"));
    } else if (result.total === 0) {
      speech = t("REVENUE_MONTH_EMPTY", monthValue, t("ANYTHING_ELSE"));
    } else {
      speech = t("REVENUE_MONTH", monthValue,
        formatCurrency(result.total, handlerInput.locale), t("ANYTHING_ELSE"));
    }

    return handlerInput.responseBuilder
      .speak(speech)
      .reprompt(t("WHAT_TO_QUERY"))
      .getResponse();
  }),
};


// ═══════════════════════════════════════════════════════════════════════════
// 9d. HANDLERS — ayuda, repetir, error y salida
// ═══════════════════════════════════════════════════════════════════════════

function safeT(handlerInput) {
  if (handlerInput && typeof handlerInput.t === "function") return handlerInput.t;
  const locale =
    (handlerInput && handlerInput.requestEnvelope && handlerInput.requestEnvelope.request.locale) || "es-MX";
  return (key, ...args) => translate(locale, key, ...args);
}

const HelpIntentHandler = {
  canHandle: canHandleIntent("AMAZON.HelpIntent"),
  handle: safeHandle("HelpIntent", (handlerInput) => {
    const t = handlerInput.t;
    const session = getSession(handlerInput);

    if (!isLoggedIn(session)) {
      return askForSeed(handlerInput, t("HELP_ANONYMOUS"));
    }

    return handlerInput.responseBuilder
      .speak(t("HELP_LOGGED", menuForRole(t, session.userRole)))
      .reprompt(t("WHAT_TO_QUERY"))
      .getResponse();
  }),
};

const RepeatIntentHandler = {
  canHandle: canHandleIntent("AMAZON.RepeatIntent"),
  handle: safeHandle("RepeatIntent", (handlerInput) => {
    const t = handlerInput.t;
    const session = getSession(handlerInput);

    if (!session.lastSpeech) {
      return handlerInput.responseBuilder
        .speak(t("REPEAT_NOTHING", t("WHAT_TO_QUERY")))
        .reprompt(t("WHAT_TO_QUERY"))
        .getResponse();
    }

    return handlerInput.responseBuilder
      .speak(session.lastSpeech)
      .reprompt(session.lastReprompt || t("WHAT_TO_QUERY"))
      .getResponse();
  }),
};

const FallbackIntentHandler = {
  canHandle: canHandleIntent("AMAZON.FallbackIntent"),
  handle: safeHandle("FallbackIntent", (handlerInput) => {
    const t = handlerInput.t;
    const session = getSession(handlerInput);

    if (!isLoggedIn(session)) {
      return askForSeed(handlerInput, t("FALLBACK_LOGIN", t("ASK_SEED")));
    }

    return handlerInput.responseBuilder
      .speak(t("FALLBACK", menuForRole(t, session.userRole)))
      .reprompt(t("WHAT_TO_QUERY"))
      .getResponse();
  }),
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      (intentName === "AMAZON.CancelIntent" || intentName === "AMAZON.StopIntent")
    );
  },
  handle: safeHandle("CancelAndStop", (handlerInput) =>
    handlerInput.responseBuilder
      .speak(handlerInput.t("GOODBYE"))
      .withShouldEndSession(true)
      .getResponse(),
  ),
};

const NavigateHomeIntentHandler = {
  canHandle: canHandleIntent("AMAZON.NavigateHomeIntent"),
  handle: safeHandle("NavigateHome", (handlerInput) => {
    const t = handlerInput.t;
    const session = getSession(handlerInput);
    const speech = isLoggedIn(session) ? menuForRole(t, session.userRole) : t("GREETING_NEW");

    return handlerInput.responseBuilder
      .speak(speech)
      .reprompt(t("WHAT_TO_QUERY"))
      .getResponse();
  }),
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === "SessionEndedRequest";
  },
  handle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    console.log(`Sesión terminada. Razón: ${request.reason}`, JSON.stringify(request.error || {}));
    return handlerInput.responseBuilder.getResponse();
  },
};

/** Última red de seguridad: lo que safeHandle no atrapó, cae aquí. */
const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    // Este handler es la última red: si él revienta, la skill muere. Por eso
    // todo su cuerpo va protegido y termina en una respuesta literal.
    try {
      const t = safeT(handlerInput);
      let session = {};
      try {
        session = getSession(handlerInput);
      } catch (sinSesion) {
        // Sin attributesManager utilizable: se sigue con sesión vacía.
      }

      let tipo = "-";
      try {
        tipo = handlerInput.requestEnvelope.request.type;
      } catch (sinTipo) {
        // Sobre de petición malformado: no impide responder.
      }

      const key = reportError("ErrorHandler", error, { type: tipo });
      const siguiente = isLoggedIn(session) ? menuForRole(t, session.userRole) : t("ASK_SEED");

      return handlerInput.responseBuilder
        .speak(capSpeech(`${t(key)} ${siguiente}`))
        .reprompt(t("WHAT_TO_QUERY"))
        .getResponse();
    } catch (fallo) {
      console.error(`[${LOG_TAG}] el ErrorHandler falló: ${fallo && fallo.message}`);
      return RESPUESTA_DE_EMERGENCIA;
    }
  },
};


// ═══════════════════════════════════════════════════════════════════════════
// 10. SKILL BUILDER
// ═══════════════════════════════════════════════════════════════════════════

const skillBuilder = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    CaptureSeedHandler,            // login en curso: va antes del out-of-context
    LogoutIntentHandler,
    InProgressDialogHandler,       // diálogo incompleto: va antes de los de negocio
    GetActiveEventsIntentHandler,
    GetTicketsSoldIntentHandler,
    GetZonesIntentHandler,
    GetSeatAvailabilityIntentHandler,
    GetEventInfoIntentHandler,
    GetTopRevenueEventIntentHandler,
    GetTotalRevenueByPeriodIntentHandler,
    HelpIntentHandler,
    RepeatIntentHandler,
    FallbackIntentHandler,
    NavigateHomeIntentHandler,
    CancelAndStopIntentHandler,
    CaptureInputOutOfContextHandler,
    SessionEndedRequestHandler,
  )
  .addRequestInterceptors(
    LocalizationInterceptor,
    LoadAttributesInterceptor,
    LoggingRequestInterceptor,
  )
  .addResponseInterceptors(
    RememberSpeechInterceptor,
    SaveAttributesInterceptor,
    LoggingResponseInterceptor,
  )
  .addErrorHandlers(ErrorHandler);

// La persistencia solo se conecta si existe la tabla: así la skill corre
// también en local sin credenciales de AWS.
if (HAS_PERSISTENCE) {
  skillBuilder.withPersistenceAdapter(
    new ddbAdapter.DynamoDbPersistenceAdapter({
      tableName: process.env.DYNAMODB_PERSISTENCE_TABLE_NAME,
      createTable: false,
      dynamoDBClient: new AWS.DynamoDB({
        apiVersion: "latest",
        region: process.env.DYNAMODB_PERSISTENCE_REGION,
      }),
    }),
  );
} else {
  console.warn("DYNAMODB_PERSISTENCE_TABLE_NAME no definida: la sesión no se guardará entre visitas.");
}

exports.handler = skillBuilder.lambda();
