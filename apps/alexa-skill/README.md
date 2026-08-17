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

## 1. Preparar el backend

El endpoint `POST /auth/alexa/seed` y el filtro `?from=&to=` de
`/purchases/stats` ya están en `develop`. Con Docker arriba:

```bash
docker compose up -d
```

Aplicar las migraciones pendientes de los tres servicios que la skill usa:

```bash
cd apps/backend/auth-service && pnpm exec prisma migrate deploy
```

```bash
cd apps/backend/purchases-service && pnpm exec prisma migrate deploy
```

> `migrate dev` no sirve en una terminal sin TTY: es interactivo y aborta.
> `migrate deploy` hace lo mismo sin preguntar y no es destructivo.

---

## 2. Datos de prueba

Sin eventos publicados la skill no tiene nada que responder. El sembrador crea
5 eventos PUBLISHED con zonas, a nombre de `organizador@test.com`:

```bash
cd apps/backend/venues-events-service && ./node_modules/.bin/ts-node src/seed/seed-dev-data.ts
```

> Ojo: está declarado bajo `prisma.seed` en el `package.json`, no en `scripts`.
> Por eso `pnpm run seed` falla con "Missing script", y `prisma db seed`
> también, porque busca un `ts-node` global que no existe. Hay que invocar el
> binario local, como arriba.

Y si `venues-events-service` no compila con errores de `multer`, le faltan
dependencias nuevas: `pnpm install` dentro de ese servicio.

---

## 3. Dar de alta las palabras clave

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

## 4. Exponer la API con ngrok

```bash
docker compose up -d
```

```bash
ngrok http 3001
```

> La URL **cambia cada vez que reinicias ngrok** en el plan gratuito. Si la
> skill deja de responder, casi siempre es eso.

---

## 5. Subir la skill al Developer Console

**Modelo de interacción**
1. Build → JSON Editor
2. Pega el contenido de `models/es-MX.json`
3. **Save Model** y luego **Build Model** (tarda ~1 minuto)

**Código**
1. Code → pega `index.js` completo
2. Abre `package.json` y pega el de este repo (agrega `axios`)
3. En la línea `const API_URL_FIJA` pega **tu** URL de ngrok
4. **Save** y **Deploy** — guardar no publica nada, hay que desplegar

> El repo trae una URL de ngrok escrita de una sesión de pruebas. Es temporal y
> ya estará muerta: cámbiala por la tuya. No es un secreto, las URLs gratuitas
> de ngrok son públicas y efímeras.

**Cuál de los dos botones:** si tocaste `models/es-MX.json` hay que hacer
**Build Model**; si tocaste `index.js`, **Deploy**. Son pestañas distintas y se
olvida fácil: un cambio de código sin Deploy deja la skill como estaba.

**Sobre la URL:** las skills Alexa-Hosted **no permiten agregar variables de
entorno propias** — esa Lambda la administra Amazon. Por eso la URL va como
constante arriba de `index.js`. Si algún día se migra a una Lambda propia, ahí
sí se define `API_BASE_URL` y la constante se ignora sola.

`DYNAMODB_PERSISTENCE_TABLE_NAME` y `DYNAMODB_PERSISTENCE_REGION` sí vienen de
fábrica en Alexa-Hosted: no hay que tocarlas.

---

## 6. Probar

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
jaguar morado
cuáles son mis eventos
cómo van las ventas de rock en vivo
qué zonas tiene
hay lugares en la zona vip
```

Como cliente, para ver el catálogo:

```
cerrar sesión
roble sereno
qué eventos hay
cuándo es el evento
rock en vivo
```

Y para demostrar el control por rol, con la sesión de cliente:

```
cuál es el evento más taquillero
```

Debe negarlo explicando que esa consulta es de administradores.

> Para cambiar de usuario di **`cerrar sesión`** y luego la palabra a secas.
> No escribas frases libres tipo "entrar como admin": el sample abierto
> `{userInput}` las interpreta como intento de palabra clave.

---

## 7. Cómo cumple cada requisito

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

## 8. Ver los errores en CloudWatch

Todos los errores llevan la misma marca:

```
fields @timestamp, @message | filter @message like /NEXTTICKET_ERROR/ | sort @timestamp desc
```

Cada línea trae `source` (qué handler falló), `code`, `status` y el contexto.

**Para provocar un error a propósito** y comprobar que el manejo funciona: apaga
ngrok y pregunta cualquier cosa. Alexa responde *"No pude conectarme con el
servidor de Next Ticket"* y en CloudWatch aparece un `code=NETWORK`.

---

## 9. Detalles que conviene saber

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
