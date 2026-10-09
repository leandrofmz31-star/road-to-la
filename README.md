# Road to LA · The countdown to California

Cuenta regresiva de Costa Rica a Los Ángeles (2 de octubre → 6 de noviembre de 2026). Cada medianoche, hora de Costa Rica, se abre un día nuevo con una canción, un dato real, un lugar de LA y un consejo de viaje. Es una PWA estática: HTML, CSS y JavaScript, sin servidor, sin librerías y sin login.

## Qué hay en la carpeta

```
road-to-la/
├── index.html            Estructura de la app
├── styles.css            Diseño (temas Noche y Pacific Day)
├── app.js                Lógica: cuenta regresiva, días, progreso, PWA
├── data.js               TODO el contenido editable (días, fotos, lugares, configuración)
├── manifest.json         Datos de instalación de la PWA
├── sw.js                 Service worker: modo sin conexión y notificaciones
├── assets/
│   ├── fonts/            Anton, Yellowtail y Manrope (con sus licencias)
│   ├── icons/            Íconos de la app (192, 512, maskable, iPhone, favicon, insignia)
│   └── scenes/           Ilustraciones propias (respaldo de fotos y días bloqueados)
├── tools/vapid-keys.html Generador de claves para Web Push (opcional)
├── scripts/send-push.mjs Envío diario de notificaciones (opcional)
└── .github/workflows/daily-push.yml   Programación diaria en GitHub Actions (opcional)
```

---

## DEPLOYMENT GUIDE: publicar en GitHub Pages

Tiempo: unos 15 minutos. Es más cómodo desde una computadora; desde Android funciona abriendo github.com en Chrome con la opción **Sitio de escritorio**.

### 1. Guardar los archivos
Descomprime `road-to-la.zip`. Vas a usar el **contenido** de la carpeta `road-to-la/` (el `index.html` debe quedar en la raíz del repositorio).

### 2. Crear el repositorio
1. Entra a github.com (crea una cuenta si no tienes).
2. Botón **New** (o **+ → New repository**).
3. Nombre: `road-to-la`. Visibilidad: **Public** (GitHub Pages gratis requiere repositorio público).
4. No marques “Add a README”. Pulsa **Create repository**.

### 3. Subir los archivos
1. En el repositorio vacío, pulsa **uploading an existing file**.
2. Arrastra todo el contenido de la carpeta `road-to-la/` (archivos y subcarpetas `assets`, `tools`, `scripts`).
3. Escribe un mensaje, por ejemplo “Primera versión”, y pulsa **Commit changes**.

> La carpeta oculta `.github` a veces no se sube al arrastrar. Solo hace falta si vas a activar Web Push (sección Notificaciones). Si la necesitas: **Add file → Create new file**, escribe como nombre `.github/workflows/daily-push.yml`, pega el contenido del archivo y haz commit.

### 4. Activar GitHub Pages
**Settings → Pages → Build and deployment**:
- **Source:** Deploy from a branch
- **Branch:** `main`
- **Folder:** `/ (root)`

Pulsa **Save**.

### 5. Rama y carpeta correctas
Siempre `main` y `/ (root)`. Si tu repositorio usa `master`, elige `master`.

### 6. La URL de tu app
En uno o dos minutos, la misma pantalla de Pages muestra **“Your site is live at…”**:

```
https://TU-USUARIO.github.io/road-to-la/
```

Esa es la URL pública para compartir. No necesita login.

### 7. Actualizar la página después
1. Edita el archivo en GitHub (ícono del lápiz) o súbelo de nuevo con **Add file → Upload files**.
2. **Importante:** abre `sw.js` y sube la versión: `const VERSION = 'v1.0.0';` → `'v1.0.1'`. Así la app instalada descarga los cambios.
3. Commit. En uno o dos minutos la web se actualiza; la app instalada muestra el aviso “Hay una versión nueva” con el botón **Actualizar**.

### Instalar la PWA en Android
1. Abre la URL en **Chrome**.
2. Ve a **About** y pulsa **Instalar Road to LA**; o abre el menú **⋮** y elige **Instalar aplicación** (en algunos teléfonos dice “Agregar a pantalla principal”).
3. Queda con su ícono y se abre a pantalla completa. Después de la primera carga funciona sin conexión.

En iPhone: Safari → botón Compartir → **Agregar a pantalla de inicio**.

---

## Dominio personalizado (opcional)

1. Compra un dominio (por ejemplo `roadtola.com`) en cualquier registrador.
2. En GitHub: **Settings → Pages → Custom domain** → escribe el dominio → **Save** (GitHub crea un archivo `CNAME`).
3. En el panel DNS de tu registrador:
   - Para `www.roadtola.com`: registro **CNAME** `www` → `TU-USUARIO.github.io`
   - Para `roadtola.com` (dominio raíz): cuatro registros **A** → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - Opcional IPv6, registros **AAAA**: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`
4. Espera la propagación (de minutos a 24 horas) y marca **Enforce HTTPS**.

La app usa rutas relativas, así que funciona igual en `github.io` y en tu dominio. Ojo: la app instalada desde `github.io` y la instalada desde tu dominio son apps distintas, con progreso separado. Decide una antes de instalar.

---

## Cómo funciona la cuenta regresiva

- El contador llega a cero el **6 de noviembre de 2026 a las 00:00, hora de Costa Rica (UTC−6)**. Ese momento cambia la app al modo **TODAY / ROAD TO LA IS OVER / THE ADVENTURE BEGINS**, con confeti.
- **DAY 35, DAY 34…** son días de calendario. El contador es exacto: el 2 de octubre en la noche muestra 34 días y unas horas, porque cuenta hasta la medianoche del 6.
- Los días se abren a medianoche de Costa Rica aunque el teléfono esté en otra zona horaria. Si la app está abierta a medianoche, el día nuevo aparece solo.
- Si cambias la fecha del teléfono a mano, la app se reacomoda: antes del 2 de octubre muestra “Coming soon” y después del 6 de noviembre queda en modo “Now playing”, con los 36 días abiertos.
- El progreso (días vistos y completados) se guarda en el dispositivo con `localStorage`. No se sincroniza entre teléfonos.

### Probar fechas futuras
Agrega `?preview=` a la URL:

```
https://TU-USUARIO.github.io/road-to-la/?preview=2026-10-30            (ONE WEEK)
https://TU-USUARIO.github.io/road-to-la/?preview=2026-11-05T23:59:50   (cambio a THE DAY en 10 segundos)
```

Aparece una etiqueta “Vista previa” y no se guarda progreso. Muestra el contenido de días futuros: si no quieres spoilers, no lo uses.

---

## Notificaciones diarias

Hay dos modos. El primero no requiere configurar nada; el segundo es exacto a las 8:00 a. m. y también es gratis.

### Modo A: recordatorio local (sin servidor)
Android + Chrome + app instalada → **About → Activar recordatorio**. Usa *Periodic Background Sync*: Chrome decide cuándo despertar a la app (como mínimo cada 12 horas, según cuánto la uses) y la app muestra la notificación del día una sola vez, a partir de las 8:00 a. m. La hora no es exacta y Chrome puede no activarlo si la app casi no se usa. El botón **Probar notificación** muestra cómo se ve.

### Modo B: Web Push a las 8:00 a. m. con GitHub Actions (gratis)
GitHub ejecuta cada día `scripts/send-push.mjs`, que envía la notificación a tu teléfono. No hay servidor que mantener.

1. **Claves:** abre `https://TU-USUARIO.github.io/road-to-la/tools/vapid-keys.html` → **Generar un par de claves**. Copia ambas claves (se crean en tu navegador y no se envían a ningún lado).
2. **Clave pública en la app:** en `data.js`, pega la clave pública en `CONFIG.push.vapidPublicKey`. Sube la versión en `sw.js` y haz commit.
3. **Secretos en GitHub:** **Settings → Secrets and variables → Actions → New repository secret**:
   - `VAPID_PUBLIC_KEY`: la clave pública
   - `VAPID_PRIVATE_KEY`: la clave privada (nunca en un archivo del repositorio)
   - `VAPID_SUBJECT`: `mailto:tu-correo@ejemplo.com`
4. **Suscripción:** en el teléfono, con la app instalada y actualizada, **About → Activar recordatorio**. Copia el texto que aparece y guárdalo como el secreto `PUSH_SUBSCRIPTIONS`. Para varios teléfonos, usa una lista JSON: `[ {...}, {...} ]`.
5. **Prueba:** pestaña **Actions → Road to LA daily push → Run workflow**. Debe llegar la notificación. Desde ahí corre sola cada día cerca de las 8:03 a. m. (GitHub puede retrasarla unos minutos).

Mensaje que llega: “ROAD TO LA — Quedan 18 días. Descubre la canción y curiosidad de hoy.” El 5 de noviembre avisa “Mañana: Los Ángeles” y el 6, “Hoy es el día”.

Notas:
- Sin secretos configurados, el flujo termina sin hacer nada y sin marcarse como error.
- Si borras los datos de Chrome o reinstalas la app, la suscripción cambia: vuelve a copiarla.
- GitHub pausa los flujos programados tras 60 días sin actividad en el repositorio; no afecta a una cuenta de 35 días.
- Otras opciones (Firebase Cloud Messaging o Cloudflare Workers) también son gratis, pero agregan otra cuenta y otro servicio. GitHub Actions usa lo que ya tienes.

---

## Editar el contenido (`data.js`)

Cada día tiene: `date`, `dayNumber`, `title`, `theme`, `description`, `song`, `artist`, `youtubeUrl`, `spotifyUrl`, `songWhy`, `fact`, `factSource`, `place`, `movie`, `tip`, `image`, `category` y `scene`. Los días especiales agregan `milestone`, `story` y `list`.

- **Música:** por defecto los botones abren una búsqueda exacta en YouTube y Spotify (“Midnight City M83”). Así nunca quedan enlaces rotos aunque un video se borre. Si prefieres el enlace directo a una pista, cópialo desde la app y reemplaza `youtubeUrl` o `spotifyUrl` de ese día.
- **Fotos:** se cargan desde Wikimedia Commons. Cada día prueba sus fotos en orden; si ninguna carga (sin conexión, o un archivo que se borró), queda la ilustración propia de la escena. Para agregar una foto, copia el nombre exacto del archivo desde su página `File:` en Commons y añádelo a `PHOTOS` con su autor y licencia.
- **Fechas:** `CONFIG.startDate` y `CONFIG.departureDate`. Si cambias la fecha de salida, ajusta también las fechas y `dayNumber` de los días.

---

## Créditos y licencias

Fotos de Wikimedia Commons (el crédito de cada una aparece en la app, junto a la foto):
- Nserrano, *LA Skyline Mountains2.jpg*
- Thomas Pintaric, *LosAngeles06.jpg* (GFDL)
- Diliff, *Los Angeles Pollution.jpg* (CC BY 2.5)
- Matthew Field, *Griffith observatory 2006.jpg* (CC BY-SA 3.0)
- Dwaynewilbert, *Santa Monica Ferris Wheel.jpg* (CC BY-SA 4.0)
- Thomas Wolf, www.foto-tw.de, *Hollywood Sign (Zuschnitt).jpg* (CC BY-SA 3.0)
- boereck, *HollywoodSign.jpg* (CC BY-SA 2.0); Mike Dillon, *Hollywood Sign close up 2006.jpg* (CC BY-SA 2.5)
- Tuxyso, *Sleeping Beauty Castle Disneyland Anaheim 2013* (CC BY-SA 3.0); Lyght, *Sleepingbeautycastle50.jpg* (CC BY-SA 3.0)
- Diego Delso, *Psycho House-Universal Studios-Hollywood-California4481.JPG*
- Dietmar Rabich, estrellas del Paseo de la Fama, Ruta 66 en Amboy y playa de Santa Mónica (CC BY-SA 4.0)
- CChen, *Stewart walk of fame.jpg* (CC BY-SA 3.0); Adrian104, *Venice Beach Lifeguard Tower.JPG*
- *Hollywood-Studios-1922.jpg*, Biblioteca Pública de Los Ángeles (dominio público)

Tipografías: Anton y Manrope (SIL Open Font License 1.1), Yellowtail (Apache 2.0); licencias en `assets/fonts/`. Ilustraciones e íconos: originales para este proyecto. Los nombres de lugares, películas y canciones pertenecen a sus dueños y se mencionan solo como referencia.

---

## Checklist de QA

Verificado antes de entregar:
- [x] 36 días consecutivos (2 oct → 6 nov), `dayNumber` de 35 a 0, sin canciones repetidas
- [x] Hitos en las fechas correctas: 30 (7 oct), 14 (23 oct), 7 (30 oct), 3 (3 nov), 2 (4 nov), 1 (5 nov), 0 (6 nov)
- [x] Cambio de medianoche con la app abierta (5 nov 23:59:58 → THE DAY) y modos “antes” y “después”
- [x] Sin errores de consola; sin desborde horizontal en 390×844, 360×640, 844×390 y 1280×800
- [x] Service worker activo, 29 archivos en caché para uso sin conexión; todas las rutas del precaché existen
- [x] Búsqueda sin tildes, filtros por categoría y estado, tema claro, días bloqueados
- [x] Script de push en modo prueba y claves VAPID compatibles con la librería `web-push`

Para revisar en tu teléfono (no se puede probar desde el entorno donde se construyó):
- [ ] Que las fotos de Wikimedia carguen. En las pruebas, la red bloqueaba Wikimedia y se vio el respaldo ilustrado, no las fotos.
- [ ] Instalación desde Chrome y apertura sin conexión (modo avión) después de la primera visita
- [ ] Permiso de notificaciones y botón “Probar notificación”
- [ ] Con “Quitar animaciones” activado en Android, que no haya movimiento ni confeti
- [ ] Una pasada rápida con TalkBack por la barra inferior y una tarjeta
