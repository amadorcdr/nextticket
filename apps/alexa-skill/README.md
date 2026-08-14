# Next Ticket — Alexa Skill

Skill en español (es-MX) conectada a la **API real** de Next Ticket.
Login por **palabra clave**, token guardado en DynamoDB, 7 intents de negocio.

```
index.js              la skill completa (esto se pega en el Developer Console)
package.json          dependencias
models/es-MX.json     modelo de interacción
test/simulate.js      simulador local con API falsa
seed-alexa.sh         da de alta las palabras clave de los usuarios de prueba
```

> Se trabaja con **un solo archivo** a propósito: es lo que acepta el editor web
> del Alexa Developer Console, que es donde se corre este proyecto.

---

## 1. El backend ya está listo

`POST /auth/alexa/seed` y el filtro `?from=&to=` de `/purchases/stats` ya están
aplicados en `develop`. Solo falta correr la migración:

```bash
cd apps/backend/auth-service && pnpm exec prisma migrate dev --name add_alexa_seed
```

---

## 2. Dar de alta las palabras clave

```bash
./apps/alexa-skill/seed-alexa.sh
```

| Correo | Rol | Se dice en voz alta |
|---|---|---|
| organizador@test.com | ORGANIZER | **jaguar morado** |
| admin@test.com | ADMIN | **faro azul** |
| cliente@test.com | CLIENT | **roble sereno** |
| validador@test.com | VALIDATOR | colibrí blanco |

Se guardan **normalizadas** (sin espacios, sin acentos, minúsculas). El usuario
dice *"jaguar morado"* y tanto la skill como el backend lo convierten a
`jaguarmorado`.

---

## 3. Exponer la API con ngrok

```bash
docker compose up -d
```

```bash
ngrok http 3001
```

> La URL **cambia cada vez que reinicias ngrok** en el plan gratuito. Si la
> skill deja de responder, casi siempre es eso.

---

## 4. Subir la skill al Developer Console

**Modelo de interacción**
1. Build → JSON Editor
2. Pega el contenido de `models/es-MX.json`
3. **Save Model** y luego **Build Model** (tarda ~1 minuto)

**Código**
1. Code → pega `index.js` completo
2. Abre `package.json` y pega el de este repo (agrega `axios`)
3. En la línea `const API_URL_FIJA = ""` pega la URL de ngrok
4. **Save** y **Deploy**

**Sobre la URL:** las skills Alexa-Hosted **no permiten agregar variables de
entorno propias** — esa Lambda la administra Amazon. Por eso la URL va como
constante arriba de `index.js`. Si algún día se migra a una Lambda propia, ahí
sí se define `API_BASE_URL` y la constante se ignora sola.

`DYNAMODB_PERSISTENCE_TABLE_NAME` y `DYNAMODB_PERSISTENCE_REGION` sí vienen de
fábrica en Alexa-Hosted: no hay que tocarlas.

---

## 5. Probar

### Sin desplegar nada

```bash
npm install
```

```bash
node test/simulate.js
```

Levanta una API falsa con la forma exacta del backend real y corre 6 escenarios:
organizador, diálogo incompleto, administrador, palabra clave incorrecta, **la
API caída**, y sin sesión. No necesita AWS, ni ngrok, ni el backend.

### En el Developer Console

Pestaña Test → cambia el desplegable a **Development** → **escribe** (no dictes
al principio):

```
abre next ticket
mi palabra clave es jaguar morado
dime mis eventos activos
qué zonas tiene rock revolution
hay lugares en vip
```

---

## 6. Cómo cumple cada requisito

| Requisito | Dónde está |
|---|---|
| 5+ utterances por intent | `models/es-MX.json` — el que menos tiene, 6 |
| Modularidad | secciones numeradas 1–10 en `index.js` |
| Manejo de errores | `safeHandle()` + `reportError()` (sección 3) |
| Interceptores | 3 de request + 3 de response (sección 8) |
| Manejo de sesión | `PERSISTED_KEYS` → DynamoDB, TTL de 12 h |
| Protección por rol | `withAuth([roles], fn)` (sección 7) |
| Ayuda y error | `HelpIntentHandler`, `FallbackIntentHandler`, `ErrorHandler` |
| Traducciones | `es` / `en` (sección 6), cero texto en los handlers |
| **Try/catch genérico** | `safeHandle()` envuelve **todos** los handlers |
| **Voz que explica el fallo** | `SPEECH_BY_CODE` → claves `ERR_API_*` |
| **Directivas + dialogState** | `canHandleCompleted()` y `InProgressDialogHandler` |
| **Login por palabra clave** | `CaptureSeedHandler` → `POST /auth/alexa/seed` |
| **Token en DynamoDB** | `token` dentro de `PERSISTED_KEYS` |
| **Intent de zonas** | `GetZonesIntentHandler` |
| **Conectada a la API** | sección 2, todo sale de `axios` |

---

## 7. Ver los errores en CloudWatch

Todos los errores llevan la misma marca:

```
fields @timestamp, @message | filter @message like /NEXTTICKET_ERROR/ | sort @timestamp desc
```

Cada línea trae `source` (qué handler falló), `code`, `status` y el contexto.

**Para provocar un error a propósito** y comprobar que el manejo funciona: apaga
ngrok y pregunta cualquier cosa. Alexa responde *"No pude conectarme con el
servidor de Next Ticket"* y en CloudWatch aparece un `code=NETWORK`.

---

## 8. Detalles que conviene saber

**Los eventos ya no están quemados.** El modelo trae dos de ejemplo solo para
poder compilar. Al iniciar sesión, la skill manda una directiva
`Dialog.UpdateDynamicEntities` con los eventos reales de la API, así que Alexa
reconoce eventos nuevos **sin volver a hacer Build**.

**El diálogo lo maneja Alexa.** Los intents con slots tienen
`elicitationRequired`, así que Alexa pregunta por los slots faltantes. Los
handlers de negocio solo corren con `dialogState === "COMPLETED"`. Si el evento
ya se mencionó antes, `InProgressDialogHandler` rellena el slot con el recordado
para no volver a preguntar.

**Timeout de 4 segundos.** Alexa corta la respuesta a los 8 s. Con 4 s hay
margen para que la skill alcance a explicar el error en voz alta.

**El evento se recuerda entre intents.** Después de preguntar por un evento,
puedes decir *"y hay lugares en vip"* sin repetir el nombre. La skill responde
*"Sigo con el evento X…"*.

**Los boletos vendidos salen de `byEventZone[].ticketsSold`**, que se agregó al
backend junto con este trabajo: antes el endpoint solo devolvía la recaudación
por zona, sin el conteo.
