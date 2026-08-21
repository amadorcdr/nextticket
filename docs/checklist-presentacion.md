# Lista de verificación para la presentación

Hazla **el día anterior**, no diez minutos antes. Toma unos 15 minutos.

---

## Datos que hay que tener a la mano

| Qué | Valor |
|---|---|
| IP del servidor | `34.234.111.11` |
| API | `http://34.234.111.11:3001` |
| Sitio web | `http://nextticket-frontend-2026.s3-website-us-east-1.amazonaws.com` |
| Instancia EC2 | `i-0680af9542b703cac` (`nextticket`) |

**Cuentas para la demo:**

| Palabra clave (Alexa) | Correo | Contraseña (web) | Rol |
|---|---|---|---|
| **jaguar morado** | organizador@test.com | Test1234 | ORGANIZER |
| **faro azul** | admin@test.com | Admin1234 | ADMIN |
| **roble sereno** | cliente@test.com | Cliente1234 | CLIENT |
| colibrí blanco | validador@test.com | Valida1234 | VALIDATOR |

También existe `admin@nextticket.com` / `Admin123!`, que crea el propio
`auth-service` en su primer arranque.

---

## El día anterior

**1. Encender el laboratorio.** AWS Academy → **Start Lab**, esperar el círculo
verde. La instancia arranca sola y los siete contenedores vuelven con ella.

**2. Esperar dos minutos.** Son siete contenedores; no pruebes de inmediato.

**3. Confirmar que la IP no cambió.** EC2 → Instancias → debe seguir diciendo
`34.234.111.11`. La IP elástica lo garantiza, pero verifícalo.

**4. Probar la API desde tu máquina** (no desde dentro del servidor):

```bash
curl http://34.234.111.11:3001/health
```

Debe responder `{"status":"ok","service":"api-gateway"}`.

**5. Probar el login por palabra clave:**

```bash
curl -s -X POST http://34.234.111.11:3001/auth/alexa/seed -H "Content-Type: application/json" -d '{"seed":"jaguar morado"}'
```

Debe devolver `{ token, user }` con rol **ORGANIZER**. Si dice "palabra clave no
válida", los datos se perdieron: ver *Si algo falla* abajo.

**6. Abrir el sitio web** en el navegador. Con `http://`, no `https://` — los
sitios estáticos de S3 no soportan HTTPS.

**7. Probar la skill** en el Alexa Developer Console → pestaña Test →
Development:

```
abre next ticket
jaguar morado
cuáles son mis eventos
```

Debe listar los 4 eventos. Si dice *"perdí la conexión con el servidor"*, la IP
cambió o el laboratorio está apagado.

---

## Guion sugerido de la demo

**Organizador** — lo que ve quien organiza:
```
abre next ticket
jaguar morado
cuáles son mis eventos
cómo van las ventas
qué zonas tiene
hay lugares en la zona vip
```

**Cliente** — catálogo abierto y control por rol:
```
cerrar sesión
roble sereno
qué eventos hay
cuál es el evento más taquillero
```
El último lo niega explicando que esa consulta es de administradores.

**Administrador** — las métricas:
```
cerrar sesión
faro azul
cuál es el evento más taquillero
cuánto se recaudó en agosto
```

**El manejo de errores**, si lo piden: apaga el laboratorio (o desconecta la red)
y pregunta cualquier cosa. La skill responde *"No pude conectarme con el
servidor de Next Ticket"* y en CloudWatch queda `code=NETWORK`.

**Variantes de habla**, por si preguntan si solo funciona con frases exactas:
```
qué cantidad se juntó en agosto
cuánto dinero entró en agosto
cuánto ganamos en agosto
```
Las tres llegan al mismo intent.

---

## Si algo falla

**"Perdí la conexión con el servidor"** → el laboratorio está apagado, o la IP
cambió. Si cambió: ponerla en `API_URL_FIJA` dentro de `index.js` y hacer
**Deploy** en la consola de Alexa.

**"Tu cuenta no tiene permiso"** sin razón aparente → sesión guardada con un
token viejo. Di **`cerrar sesión`** y vuelve a entrar. La skill debería
recuperarse sola, pero esto lo resuelve de inmediato.

**El sitio web no abre en el celular** → estás entrando por `https://`. Los
sitios estáticos de S3 solo hablan HTTP.

**No hay eventos ni usuarios** → se perdió el volumen de datos. Reconstruir:

```bash
ssh -i ~/Downloads/labsuser.pem ubuntu@34.234.111.11
```

```bash
cd ~/nextticket && AUTH_URL=http://localhost:3001 bash scripts/seed-users.sh
```

```bash
cd ~/nextticket && sudo docker compose -f docker-compose.prod.yml run --rm --no-deps -v ~/nextticket/apps/backend/venues-events-service/src:/app/src venues-events-service ./node_modules/.bin/ts-node src/seed/seed-dev-data.ts
```

```bash
cd ~/nextticket && sudo bash apps/alexa-skill/seed-alexa.sh
```

**Un contenedor no levanta** → ver qué dice:

```bash
cd ~/nextticket && sudo docker compose -f docker-compose.prod.yml ps
```

```bash
cd ~/nextticket && sudo docker compose -f docker-compose.prod.yml logs --tail 50 NOMBRE-DEL-SERVICIO
```

---

## Después de presentar

**End Lab** en la plataforma. Detiene la instancia y con ella el gasto por horas
de cómputo, que es el grueso.

El disco y la IP elástica siguen costando unos 20 centavos al día. Vale la pena:
es lo que hace que la próxima vez solo tengas que encender el laboratorio.

---

## Cosas que conviene saber si preguntan

**Por qué el puerto 3001 está abierto a internet.** La Lambda de la skill vive en
servidores de Amazon y no tiene IP fija que autorizar. Solo el gateway está
expuesto: Postgres, Redis y los cuatro microservicios quedan en la red interna de
Docker, sin puerto publicado.

**Por qué la API va por HTTP y no HTTPS.** La skill es Alexa-Hosted: su Lambda
hace llamadas *de salida*, y esas no requieren certificado. El requisito de HTTPS
aplica a los endpoints de skill alojados por uno mismo, que no es el caso.

**Qué pasa si se cae el servidor a media demo.** La skill no se rompe: explica en
voz alta qué falló y mantiene la conversación abierta. Hay 18 pruebas
adversariales en `apps/alexa-skill/test/romper.js` que lo comprueban.
