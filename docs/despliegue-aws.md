# Desplegar NextTicket en AWS Academy Learner Lab

Guía completa: backend en EC2, frontend en S3 y la skill de Alexa apuntando ahí.

---

## Antes de empezar: cómo funciona el Learner Lab

Tres cosas que cambian la forma de trabajar y conviene tener claras desde el
principio:

**La sesión caduca.** El laboratorio dura unas 4 horas. Al terminar, las
instancias EC2 se **detienen** (no se borran: los discos y los datos siguen
ahí). Para presentar hay que entrar, darle **Start Lab** y esperar a que la
instancia arranque.

**El crédito corre solo mientras algo está encendido.** Una `t3.medium` cuesta
unos 4 centavos de dólar por hora. Si la usas 60 horas en total, son ~2.50 USD
de tus 50. Lo que dispara el gasto es dejarla prendida sin usarla.

**La IP pública cambia** cada vez que la instancia se detiene y vuelve a
arrancar, salvo que reserves una IP elástica. Eso importa mucho aquí, porque
esa IP está escrita dentro de la skill.

---

## Resumen de lo que vamos a crear

| Recurso | Para qué | Costo aproximado |
|---|---|---|
| 1 instancia EC2 `t3.medium` | Los 5 microservicios, Postgres y Redis | ~0.04 USD/hora |
| 1 IP elástica | Que la dirección no cambie entre sesiones | ~0.005 USD/hora |
| 1 grupo de seguridad | Abrir solo los puertos necesarios | gratis |
| 1 bucket S3 | El frontend, como sitio estático | centavos |

---

## Paso 1 — Entrar al laboratorio

1. AWS Academy → **Start Lab** y esperar a que el círculo se ponga verde
2. Click en **AWS** para abrir la consola
3. Arriba a la derecha, comprobar que la región sea **N. Virginia (us-east-1)**

En la página del laboratorio, abre **AWS Details** y descarga el archivo
**`labsuser.pem`**: es la llave para conectarte por SSH. Guárdala en tu carpeta
`~/Descargas` y déjala ahí, la vas a necesitar en el paso 4.

---

## Paso 2 — Crear el grupo de seguridad

Un grupo de seguridad es el cortafuegos de la instancia: define qué puertos
quedan abiertos y para quién.

EC2 → **Security Groups** → **Create security group**

| Campo | Valor |
|---|---|
| Nombre | `nextticket-sg` |
| Descripción | `Backend de NextTicket` |
| VPC | la que aparece por defecto |

**Reglas de entrada** (Inbound rules) — agregar dos:

| Tipo | Puerto | Origen | Por qué |
|---|---|---|---|
| SSH | 22 | **My IP** | Para conectarte. Solo desde tu conexión. |
| Custom TCP | **3001** | `0.0.0.0/0` | La API. Tiene que ser abierto. |

> **Por qué el 3001 va abierto a todo internet:** la Lambda de tu skill vive en
> los servidores de Amazon y no tiene una IP fija que podamos autorizar. Es el
> precio de que la skill funcione. Lo que sí controlamos es que **solo el
> gateway** esté expuesto: Postgres, Redis y los cuatro microservicios quedan en
> la red interna de Docker, sin puerto publicado.

Reglas de salida: dejar la que viene por defecto (todo permitido).

---

## Paso 3 — Crear la instancia EC2

EC2 → **Instances** → **Launch instances**

| Campo | Valor | Por qué |
|---|---|---|
| Nombre | `nextticket-backend` | |
| Sistema operativo | **Ubuntu Server 24.04 LTS** | Docker se instala sin fricción |
| Arquitectura | **64-bit (x86)** | Las imágenes se construyen para esta |
| Tipo de instancia | **t3.medium** | 2 vCPU y 4 GB de RAM |
| Par de claves | **vockey** | Ya existe en el laboratorio; es la de `labsuser.pem` |
| Grupo de seguridad | **Seleccionar existente → `nextticket-sg`** | El del paso anterior |
| Almacenamiento | **30 GB gp3** | ⚠️ los 8 GB por defecto NO alcanzan |

Tres decisiones que vale la pena entender:

**Por qué `t3.medium` y no `t3.micro`.** La micro tiene 1 GB de RAM. Compilar
los cinco servicios de TypeScript no cabe ahí: el proceso muere a media
compilación. La medium tiene 4 GB, y aun así el script agrega 4 GB de swap por
si acaso.

**Por qué 30 GB de disco.** Las cinco imágenes pesan cerca de 1 GB cada una, más
la caché de construcción. Con los 8 GB que trae por defecto, el build se queda
sin espacio a la mitad.

**Por qué `vockey`.** El Learner Lab no te deja crear pares de claves nuevos,
pero trae uno ya hecho. Es el que corresponde al `labsuser.pem` que descargaste.

Click en **Launch instance**.

---

## Paso 4 — Reservar la IP (importante)

Sin esto, cada vez que el laboratorio reinicie la instancia tendrás una IP
distinta, y habrá que reescribirla en la skill y volver a desplegarla.

EC2 → **Elastic IPs** → **Allocate Elastic IP address** → **Allocate**

Con la IP seleccionada: **Actions → Associate Elastic IP address** → elegir tu
instancia `nextticket-backend` → **Associate**.

Anota esa IP. Es la dirección de tu API para todo lo que sigue.

> Si el laboratorio no te deja crear IPs elásticas, no pasa nada: sigue
> adelante, pero **añade a tu lista previa a la presentación** el paso de copiar
> la IP nueva a `index.js` y hacer Deploy. Son cinco minutos.

---

## Paso 5 — Conectarse y levantar todo

En tu terminal, desde la carpeta donde está el `.pem`:

```bash
chmod 400 ~/Downloads/labsuser.pem
```

```bash
ssh -i ~/Downloads/labsuser.pem ubuntu@TU-IP-ELASTICA
```

Ya dentro de la instancia, un solo comando hace el resto:

```bash
curl -fsSL https://raw.githubusercontent.com/amadorcdr/nextticket/develop/scripts/ec2-setup.sh | bash
```

Ese script instala Docker, lo deja arrancando solo al encender la máquina, crea
swap, clona el repositorio, genera las contraseñas y levanta el stack.

**Tarda entre 10 y 20 minutos** la primera vez, casi todo en compilar. Cuando
termina imprime la URL pública de tu API.

> Si el repositorio es privado, el `curl` fallará. En ese caso copia el script a
> mano: `scp -i ~/Downloads/labsuser.pem scripts/ec2-setup.sh ubuntu@TU-IP:~/`
> y ejecútalo con `bash ec2-setup.sh`.

### Comprobar que quedó bien

```bash
curl http://TU-IP-ELASTICA:3001/health
```

Debe responder `{"status":"ok","service":"api-gateway"}` **desde tu máquina**, no
solo desde dentro de la instancia. Si funciona dentro pero no fuera, el problema
está en el grupo de seguridad.

### Datos de prueba

```bash
cd ~/nextticket && sudo docker compose -f docker-compose.prod.yml exec venues-events-service ./node_modules/.bin/ts-node src/seed/seed-dev-data.ts
```

Y las cuentas con sus palabras clave para Alexa:

```bash
cd ~/nextticket && bash scripts/seed-users.sh && bash apps/alexa-skill/seed-alexa.sh
```

---

## Paso 6 — Apuntar la skill a AWS

En `apps/alexa-skill/index.js`, cambiar la línea de la URL:

```js
const API_URL_FIJA = "http://TU-IP-ELASTICA:3001";
```

Sin diagonal al final. Luego en el Alexa Developer Console: pestaña **Code** →
pegar el archivo → **Save** → **Deploy**.

Y a probar:

```
abre next ticket
jaguar morado
cuáles son mis eventos
```

**A partir de aquí ya no necesitas ngrok ni tener tu laptop encendida.**

---

## Paso 7 — El frontend en S3

Este es el orden correcto: el frontend necesita saber la URL de la API **antes**
de compilarse, y esa URL no existía hasta el paso 4.

En tu máquina, con la IP ya conocida:

```bash
cd apps/frontend && VITE_API_URL=http://TU-IP-ELASTICA:3001 npm run build
```

El sitio queda en **`apps/frontend/apps/webshell/dist`** (unos 2.4 MB). Esa es la
carpeta cuyo contenido se sube al bucket.

> La URL se incrusta al compilar, no se lee en tiempo de ejecución. Si la IP
> cambia hay que **volver a compilar y volver a subir**, no basta con editar un
> archivo en S3.

S3 → **Create bucket**

| Campo | Valor |
|---|---|
| Nombre | `presentacion-angel-2026` |
| Bloqueo de acceso público | **desactivado** (como en la práctica) |

Dentro del bucket: **Upload** → arrastrar el contenido de la carpeta `dist` →
**Upload**.

Después: **Properties** → bajar hasta **Static website hosting** → **Edit** →
activar, y poner `index.html` tanto en documento de índice como en el de error
(hace falta para que funcionen las rutas de React).

La URL del sitio queda en esa misma pantalla.

### Cerrar el círculo

El backend necesita saber la URL del frontend para el CORS y para los enlaces de
activación de cuenta. De vuelta en la instancia:

```bash
cd ~/nextticket && nano .env
```

Poner `FRONTEND_URL=` con la URL del sitio de S3, guardar, y reiniciar:

```bash
cd ~/nextticket && sudo docker compose -f docker-compose.prod.yml up -d
```

---

## Lista de verificación antes de presentar

Hazla **el día anterior**, no diez minutos antes.

- [ ] **Start Lab** y esperar el círculo verde
- [ ] La instancia aparece como *running* en EC2
- [ ] `curl http://TU-IP:3001/health` responde desde tu máquina
- [ ] Si la IP cambió: actualizar `index.js` y hacer **Deploy**
- [ ] En el simulador: `abre next ticket` → `jaguar morado` → `cuáles son mis eventos`
- [ ] El sitio de S3 abre y muestra eventos

Los contenedores arrancan solos con la instancia (`restart: unless-stopped` y
Docker habilitado en el arranque), así que no deberías tener que entrar por SSH.
Pero dale un par de minutos después de encender: son siete contenedores.

---

## Cuando algo falle

**El `curl` funciona dentro de la instancia pero no desde fuera.** Es el grupo de
seguridad: falta la regla del puerto 3001, o quedó restringida a tu IP y esta
cambió.

**La skill dice "perdí la conexión con el servidor".** O la instancia está
apagada (¿arrancaste el laboratorio?), o la IP cambió y hay que actualizarla en
`index.js`.

**Un contenedor reiniciándose sin parar.** Ver qué dice:

```bash
cd ~/nextticket && sudo docker compose -f docker-compose.prod.yml logs --tail 50 NOMBRE-DEL-SERVICIO
```

**Se acabó el espacio en disco.** Limpiar lo que Docker dejó de builds viejos:

```bash
sudo docker system prune -af
```

**Actualizar a la última versión del código:**

```bash
cd ~/nextticket && git pull && sudo docker compose -f docker-compose.prod.yml up -d --build
```

---

## Apagar para no gastar crédito

Al terminar cada sesión de trabajo, **End Lab** en la plataforma. Eso detiene la
instancia y el cobro por horas de cómputo.

Los datos sobreviven. La IP elástica sigue costando unos centavos al día aunque
la instancia esté detenida, y eso está bien: es lo que evita tener que
reconfigurar la skill cada vez.

Cuando el proyecto ya no se necesite: liberar la IP elástica, terminar la
instancia y vaciar y borrar el bucket.
