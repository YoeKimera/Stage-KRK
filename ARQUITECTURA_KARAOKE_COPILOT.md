# Karaoke Web --- Arquitectura y especificación para GitHub Copilot

**Estado:** arquitectura inicial\
**Objetivo:** aplicación web de una sola pantalla para operar un karaoke
desde una PC Windows, alojada como sitio estático en GitHub Pages.\
**Restricción principal:** no instalar ni depender de Node.js, Python ni
un servidor propio en la PC de la cabina. Node.js puede utilizarse
durante el desarrollo y la compilación, pero no debe ser un requisito de
ejecución para el usuario final.

------------------------------------------------------------------------

## 1. Objetivo del producto

Construir una aplicación web de una sola pantalla que combine:

1.  Reproducción continua de música de fondo desde una carpeta local.
2.  Exploración de carpetas locales con videos de karaoke.
3.  Administración de una cola de videos.
4.  Reproducción de karaoke con prioridad sobre la música de fondo.
5.  Automatización de fades entre la música de fondo y los videos.
6.  Control opcional de nivel/normalización de audio.
7.  Una segunda ventana independiente para mostrar el video en otro
    monitor.
8.  Búsqueda de videos de YouTube y descarga mediante un proveedor
    externo, siempre que el proveedor permita legalmente la descarga,
    tenga una API utilizable desde navegador y cumpla los requisitos
    técnicos indicados en este documento.
9.  Evaluación de transmisión a Chromecast, sujeta a las limitaciones
    descritas en la sección 12.

La aplicación debe tener una interfaz clara para uso durante un evento:
controles grandes, estados visibles, pocas operaciones y ninguna
navegación innecesaria.

## 2. Restricciones y decisiones fundamentales

### 2.1 Despliegue

-   El frontend se publica como sitio estático en GitHub Pages.
-   El repositorio contiene el código fuente y la configuración de
    compilación.
-   La compilación puede utilizar Vite, TypeScript y las herramientas
    necesarias en desarrollo/CI.
-   La PC de la cabina solo necesita un navegador moderno basado en
    Chromium, preferentemente Chrome o Edge.
-   No se ejecuta Node.js, Python, PHP, un servidor HTTP propio ni un
    ejecutable auxiliar en la PC de la cabina.

### 2.2 Acceso a archivos

Utilizar **File System Access API** cuando esté disponible para permitir
que el usuario seleccione carpetas locales y conceda acceso explícito.

-   `showDirectoryPicker()` para seleccionar carpetas.
-   `FileSystemDirectoryHandle` para recorrer directorios.
-   `FileSystemFileHandle.getFile()` para obtener archivos
    reproducibles.
-   IndexedDB para persistir los handles y preferencias, cuando el
    navegador lo permita.
-   Consultar y solicitar permisos de lectura/escritura cuando
    corresponda.
-   Ofrecer una alternativa mediante
    `<input type="file" webkitdirectory>` para navegadores sin soporte
    completo. Esta alternativa puede no permitir persistir el acceso ni
    escribir archivos en la carpeta seleccionada.

No intentar eludir permisos del navegador. El usuario debe seleccionar
las carpetas y conceder acceso.

### 2.3 Descargas de YouTube

Una página web no puede ejecutar `yt-dlp.exe`, FFmpeg ni procesos del
sistema operativo. Tampoco puede descargar un video desde YouTube por el
mero hecho de tener una URL.

La descarga solo se implementará mediante una API de terceros que cumpla
todos estos requisitos:

-   Uso permitido por sus términos y por los derechos aplicables al
    contenido.
-   Endpoint HTTPS.
-   CORS habilitado para el origen de GitHub Pages, o mecanismo
    documentado que permita invocarlo desde navegador.
-   Respuesta con archivo o URL temporal de descarga accesible desde el
    navegador.
-   Límites de tamaño, duración, concurrencia y cuota conocidos.
-   Política de privacidad y retención aceptable.
-   Autenticación compatible con una aplicación frontend.

**No incluir claves secretas de proveedores en el código publicado.**
Todo valor incluido en JavaScript distribuido al navegador puede ser
inspeccionado. Si el proveedor exige una clave privada o un proxy
propio, ese proveedor no es compatible con la arquitectura estrictamente
estática y sin backend.

La API oficial de YouTube puede utilizarse para búsqueda y metadatos, no
como mecanismo de descarga de archivos audiovisuales. No implementar
extracción de streams ni mecanismos para eludir controles de YouTube. La
descarga debe limitarse a material propio, autorizado o cuyo proveedor
permita expresamente esa operación.

Si no se encuentra un proveedor que satisfaga los requisitos, mantener
el módulo de descarga desacoplado y deshabilitado, sin simular una
descarga funcional. La aplicación debe seguir siendo plenamente útil
como reproductor de archivos locales.

### 2.4 Chromecast

La transmisión de un archivo local a Chromecast no se resuelve
simplemente llamando a una API desde el navegador. El dispositivo
receptor debe poder acceder al recurso multimedia mediante una URL de
red compatible.

Sin un servidor local, Chromecast normalmente no puede leer un archivo
que existe únicamente en el disco de la PC. Por lo tanto:

-   La reproducción local y la segunda ventana son funciones
    prioritarias.
-   Chromecast se considera una función experimental/condicionada.
-   Para transmitir archivos locales se necesitaría un servidor HTTP
    local, una aplicación receptora o una solución de casting que
    exponga el archivo en la red.
-   Eso implicaría incorporar un componente local, incompatible con la
    restricción actual de cero servicios/ejecutables locales.
-   Una URL remota de un proveedor podría ser accesible por Chromecast,
    pero dependerá de que el dispositivo pueda obtenerla directamente,
    de su vigencia, formato, códecs, CORS/restricciones del receptor y
    compatibilidad con Google Cast.
-   No prometer compatibilidad universal con Chromecast.

No desarrollar Chromecast antes de validar un caso real de extremo a
extremo.

------------------------------------------------------------------------

## 3. Stack tecnológico

  -----------------------------------------------------------------------
  Área                                Tecnología
  ----------------------------------- -----------------------------------
  Interfaz                            React + TypeScript + TSX

  Estilos                             Meta StyleX

  Bundler                             Vite

  Publicación                         GitHub Pages

  Reproducción de audio               HTMLAudioElement + Web Audio API

  Reproducción de video               HTMLVideoElement

  Archivos locales                    File System Access API

  Persistencia                        IndexedDB

  Estado                              React Context o Zustand (elegir
                                      uno, no ambos)

  Comunicación entre ventanas         BroadcastChannel

  Búsqueda YouTube                    YouTube Data API, si se configura
                                      una clave restringida

  Descargas                           Adaptador opcional para proveedor
                                      externo compatible

  Pruebas                             Vitest + Playwright
  -----------------------------------------------------------------------

### Nota sobre StyleX

Utilizar StyleX real, con sus transformaciones y configuración de
compilación. No reemplazarlo por CSS Modules, Tailwind ni clases
utilitarias. Centralizar tokens de diseño y evitar estilos globales
salvo reset, tipografía y variables estrictamente necesarias.

### Nota sobre dependencias

El producto final debe ser estático. Las herramientas de desarrollo
pueden requerir Node.js para compilar, instalar dependencias y ejecutar
pruebas, pero el usuario de la cabina no debe instalar ni ejecutar
Node.js.

------------------------------------------------------------------------

## 4. Experiencia e interfaz

Aplicación de una sola pantalla, con tema oscuro y diseño de consola de
operación.

### Distribución sugerida

**Barra superior** - Nombre/logo de la aplicación. - Estado de permisos
de carpetas. - Estado de audio. - Estado de pantalla secundaria. -
Estado de conexión, si aplica.

**Zona central** - Reproductor actual. - Título, artista/nombre del
archivo y duración. - Barra de progreso. - Play/Pause, anterior,
siguiente, detener. - Control de volumen general. - Indicador de fuente
activa: música de fondo o karaoke.

**Panel de biblioteca** - Selector de carpeta de música. - Selector de
carpeta de karaoke. - Explorador de directorios. - Búsqueda local por
nombre. - Filtros por extensión. - Acción para agregar a la cola. -
Acción para reproducir ahora.

**Panel de cola** - Lista ordenada de videos pendientes. -
Reordenamiento. - Eliminar elemento. - Vaciar cola. - Reproducir
siguiente. - Mostrar cantidad de elementos.

**Panel de música de fondo** - Nombre de pista. - Play/Pause. -
Anterior/siguiente. - Volumen independiente. - Activar/desactivar
reproducción en bucle. - Estado de atenuación automática.

**Panel de YouTube** - Campo de búsqueda/URL. - Resultados con título,
miniatura, duración y canal cuando la API lo permita. - Botón de
descarga solo si hay proveedor configurado y validado. - Progreso, error
y destino de descarga. - No mostrar un botón que prometa descargar
cuando el proveedor no esté disponible.

**Configuración** - Duración de fade-out y fade-in. - Volumen de
música. - Volumen de karaoke. - Normalización. - Carpeta predeterminada,
si se puede persistir el permiso. - Preferencia de ventana secundaria. -
Proveedor de descarga y estado de configuración.

------------------------------------------------------------------------

## 5. Módulos y responsabilidades

Proponer una estructura modular. No concentrar la lógica en `App.tsx`.

``` text
karaoke-web/
├── public/
│   └── assets/
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── routes.ts
│   │   └── providers/
│   ├── components/
│   │   ├── TopBar.tsx
│   │   ├── MainPlayer.tsx
│   │   ├── BackgroundPlayer.tsx
│   │   ├── LibraryExplorer.tsx
│   │   ├── QueuePanel.tsx
│   │   ├── YoutubeSearchPanel.tsx
│   │   ├── AudioControls.tsx
│   │   ├── SettingsPanel.tsx
│   │   └── SecondaryWindowControls.tsx
│   ├── features/
│   │   ├── audio/
│   │   │   ├── AudioEngine.ts
│   │   │   ├── AudioEngine.types.ts
│   │   │   └── normalization.ts
│   │   ├── video/
│   │   │   ├── VideoController.ts
│   │   │   └── video.types.ts
│   │   ├── library/
│   │   │   ├── directoryAccess.ts
│   │   │   ├── fileIndex.ts
│   │   │   └── library.types.ts
│   │   ├── queue/
│   │   │   ├── QueueManager.ts
│   │   │   └── queue.types.ts
│   │   ├── downloads/
│   │   │   ├── DownloadProvider.ts
│   │   │   ├── providers/
│   │   │   │   └── DisabledProvider.ts
│   │   │   └── download.types.ts
│   │   ├── youtube/
│   │   │   ├── YouTubeSearch.ts
│   │   │   └── youtube.types.ts
│   │   ├── secondary-window/
│   │   │   ├── SecondaryWindow.ts
│   │   │   └── windowMessages.ts
│   │   └── cast/
│   │       ├── CastProvider.ts
│   │       └── cast.types.ts
│   ├── persistence/
│   │   ├── database.ts
│   │   ├── settingsRepository.ts
│   │   └── handlesRepository.ts
│   ├── state/
│   │   ├── appStore.ts
│   │   └── selectors.ts
│   ├── styles/
│   │   ├── tokens.stylex.ts
│   │   ├── theme.stylex.ts
│   │   └── global.css
│   ├── types/
│   ├── utils/
│   ├── main.tsx
│   └── vite-env.d.ts
├── index.html
├── vite.config.ts
├── package.json
├── tsconfig.json
├── COPILOT_INSTRUCTIONS.md
└── README.md
```

Esta estructura es orientativa. Mantenerla simple y evitar crear
archivos sin responsabilidad real.

------------------------------------------------------------------------

## 6. Modelo de datos

Definir tipos TypeScript explícitos.

### MediaItem

``` ts
type MediaKind = "audio" | "video";

interface MediaItem {
  id: string;
  name: string;
  kind: MediaKind;
  mimeType: string;
  size: number;
  duration?: number;
  relativePath?: string;
  source: "local" | "download";
  fileHandle?: FileSystemFileHandle;
  thumbnailUrl?: string;
}
```

No persistir objetos `File` ni URLs `blob:` como si fueran referencias
permanentes. Las URLs blob deben recrearse al iniciar una sesión y
revocarse cuando ya no se utilizan. Persistir handles en IndexedDB
cuando el navegador los soporte y el usuario haya concedido permisos.

### QueueItem

``` ts
interface QueueItem {
  queueId: string;
  mediaId: string;
  title: string;
  fileHandle?: FileSystemFileHandle;
  addedAt: number;
}
```

### PlaybackState

``` ts
type PlaybackMode = "idle" | "background" | "karaoke" | "transition";

interface PlaybackState {
  mode: PlaybackMode;
  currentVideoId?: string;
  currentBackgroundId?: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}
```

### AppSettings

``` ts
interface AppSettings {
  backgroundVolume: number; // 0..1
  karaokeVolume: number;   // 0..1
  masterVolume: number;    // 0..1
  fadeOutMs: number;
  fadeInMs: number;
  normalizeAudio: boolean;
  loopBackgroundPlaylist: boolean;
  autoPlayNextKaraoke: boolean;
}
```

------------------------------------------------------------------------

## 7. Motor de reproducción y transiciones

### 7.1 Dos fuentes independientes

Mantener dos elementos multimedia separados:

-   Un `HTMLAudioElement` para la música de fondo.
-   Un `HTMLVideoElement` para el karaoke.

Conectar ambos a un `AudioContext` mediante `createMediaElementSource()`
y controlar sus ganancias con nodos `GainNode`.

Diagrama lógico:

``` text
HTMLAudioElement (playlist)
        |
  MediaElementSource
        |
  GainNode background ------------------\
                                          \
                                           Master Gain -> salida
                                          /
HTMLVideoElement (karaoke)                /
        |                                /
  MediaElementSource                    /
        |                              /
  GainNode karaoke -------------------/
```

No conectar el mismo elemento multimedia más de una vez al grafo de Web
Audio. Gestionar correctamente el ciclo de vida del `AudioContext`, que
puede requerir una acción explícita del usuario para iniciarse.

### 7.2 Reglas de prioridad

1.  La música de fondo puede reproducirse en bucle.
2.  Cuando comienza un karaoke, iniciar fade-out de fondo.
3.  Al llegar el fondo a volumen cero, mantener su reproducción pausada
    o silenciada, según la estrategia elegida. Preferir pausa para
    reducir consumo, conservando el tiempo.
4.  Reproducir el video de karaoke.
5.  Si hay elementos en cola, al terminar el video iniciar el siguiente
    sin recuperar el fondo entre videos.
6.  Cuando la cola queda vacía, reanudar el playlist desde la posición
    conservada y aplicar fade-in.
7.  Si el usuario detiene manualmente el karaoke, aplicar la misma
    política de retorno al fondo.
8.  Si ocurre un error de reproducción, informar el error y permitir
    saltar al siguiente elemento.
9.  Evitar dobles avances por eventos `ended` repetidos o callbacks
    concurrentes.

Implementar una máquina de estados o controlador explícito. No
distribuir estas reglas entre múltiples componentes React.

### 7.3 Fades

Usar `AudioParam.linearRampToValueAtTime()` o `setTargetAtTime()` para
transiciones suaves. Cancelar y reemplazar automatizaciones anteriores
cuando el estado cambie durante un fade.

Duraciones iniciales: - Fade-out: 1200 ms. - Fade-in: 1800 ms.

Permitir modificarlas en configuración.

### 7.4 Normalización

Separar tres conceptos:

-   Volumen de pista.
-   Volumen general.
-   Normalización de loudness.

La primera versión puede ofrecer un control de ganancia y,
opcionalmente, un limitador suave si se implementa correctamente. No
llamar "normalización LUFS" a un simple aumento de volumen.

La normalización real requiere analizar el archivo o medir loudness. El
análisis completo en navegador puede consumir mucha memoria,
especialmente con archivos largos. Diseñar el módulo como opcional y
documentar sus límites. No procesar todo el video en memoria de forma
indiscriminada.

------------------------------------------------------------------------

## 8. Biblioteca y archivos locales

### 8.1 Selección

-   Botón "Seleccionar carpeta de música".
-   Botón "Seleccionar carpeta de karaoke".
-   Solicitar permiso con gesto directo del usuario.
-   Mostrar nombre y estado de acceso de cada carpeta.
-   Permitir volver a conceder permisos si expiran.
-   Recordar handles en IndexedDB cuando sea posible.

### 8.2 Indexación

-   Recorrer carpetas y subcarpetas bajo demanda.
-   No cargar todos los archivos en memoria.
-   Filtrar extensiones conocidas.
-   Mostrar nombre, tipo y tamaño.
-   Leer duración solo cuando se necesite, mediante metadata del
    elemento multimedia.
-   No generar miniaturas para toda la biblioteca al iniciar.

Extensiones iniciales: - Audio: `.mp3`, `.wav`, `.flac`, `.ogg`, `.m4a`,
`.aac`, `.opus`. - Video: `.mp4`, `.webm`, `.ogv`, `.m4v`, `.mov` (la
reproducción efectiva depende de códecs del navegador).

MP4 con H.264/AAC suele ser una opción de compatibilidad práctica en
Chrome/Edge sobre Windows. No asumir que la extensión garantiza que el
códec sea compatible.

### 8.3 URLs de objeto

Al abrir un archivo:

``` ts
const file = await fileHandle.getFile();
const objectUrl = URL.createObjectURL(file);
```

Al reemplazar o cerrar el recurso:

``` ts
URL.revokeObjectURL(objectUrl);
```

Mantener un registro de URLs creadas para evitar fugas de memoria.

------------------------------------------------------------------------

## 9. Búsqueda y descarga

### 9.1 Búsqueda

Crear una interfaz `YouTubeSearchProvider` independiente.

La búsqueda puede utilizar YouTube Data API para metadatos, si se
configura una API key restringida por origen y cuota. La clave visible
en frontend no es secreta; aplicar restricciones desde Google Cloud y
vigilar cuotas.

No descargar videos mediante la API oficial de YouTube ni intentar
extraer streams privados o eludir DRM, autenticación, controles de
acceso o restricciones técnicas.

### 9.2 Reproducción oficial incrustada

La reproducción de un resultado de YouTube se realizará mediante el
reproductor oficial IFrame Player API. Las pistas de YouTube pueden
reproducirse inmediatamente o agregarse a la cola junto con archivos
locales, pero deben conservar un tipo de medio distinto: el audio del
iframe no puede conectarse al grafo Web Audio local. Se pueden usar los
controles y el volumen/fade que ofrece la API, sujeto a las restricciones
del reproductor.

El propietario puede impedir la inserción; además, las restricciones del
navegador pueden bloquear autoplay. La interfaz debe mostrar el error
recibido y permitir iniciar desde los controles oficiales. La segunda
pantalla debe crear su propio reproductor incrustado, silenciado y
sincronizado con la consola, sin intentar leer ni extraer su stream.

### 9.3 Adaptador de descarga

Definir una interfaz independiente:

``` ts
interface DownloadRequest {
  sourceUrl: string;
  title?: string;
  preferredFormat: "mp4";
}

interface DownloadProgress {
  status: "queued" | "processing" | "downloading" | "completed" | "failed";
  progress?: number;
  message?: string;
}

interface DownloadProvider {
  isAvailable(): Promise<boolean>;
  download(
    request: DownloadRequest,
    onProgress: (progress: DownloadProgress) => void
  ): Promise<Blob>;
}
```

La implementación real debe seleccionarse solo después de verificar un
proveedor concreto.

Requisitos del proveedor: - Permitir el uso previsto. - CORS desde
GitHub Pages. - Sin secretos privados embebidos en el frontend. -
Entrega de Blob o URL de descarga. - Soporte de archivos grandes o
descarga por streaming. - Límites y términos documentados.

**No asumir que Cobalt, Apify, Vid Kraken u otro servicio tiene una API
pública gratuita, estable o apta para este uso sin comprobar
documentación, términos, CORS y disponibilidad actuales.** No codificar
endpoints ficticios ni usar servicios proxy desconocidos.

### 9.3 Guardado

Para guardar el archivo: - Preferir `showSaveFilePicker()` cuando esté
disponible y el usuario lo invoque mediante un gesto. - Como
alternativa, descargar mediante un enlace `blob:` y atributo
`download`. - Si el proveedor devuelve una URL remota, verificar CORS y
`Content-Disposition`; el navegador puede abrirla en vez de
descargarla. - Mostrar progreso y errores. - No almacenar videos grandes
completos en IndexedDB salvo decisión explícita y pruebas de cuota. La
biblioteca debe residir en carpetas locales del usuario.

### 9.4 Seguridad

-   No aceptar URLs arbitrarias para enviarlas a proveedores sin
    validación.
-   Permitir únicamente dominios y protocolos esperados.
-   No exponer tokens privados.
-   No insertar HTML remoto con `dangerouslySetInnerHTML`.
-   Limitar tamaño de archivo y tiempo de espera.
-   Tratar títulos, nombres de archivos y metadatos como datos no
    confiables.

------------------------------------------------------------------------

## 10. Segunda ventana

Abrir una ventana secundaria mediante `window.open()` después de una
acción explícita del usuario. Los bloqueadores de ventanas emergentes
pueden impedirla si no se abre directamente desde un clic.

La ventana secundaria debe mostrar: - Video a pantalla completa. - Fondo
de espera cuando no hay karaoke. - Opcionalmente título de canción y
artista, configurable. - Ningún panel de administración.

Usar `BroadcastChannel` para sincronizar: - archivo actual; - estado
play/pause; - posición; - volumen, si la ventana secundaria reproduce el
audio; - cambio de video; - pantalla de espera.

Decisión recomendada: mantener una única autoridad de reproducción. La
ventana principal controla la cola y el estado. Evitar que ambas
ventanas intenten controlar simultáneamente el mismo recurso.

Validar el comportamiento de `FileSystemFileHandle` y `Blob` entre
contextos. Si el archivo no puede transferirse o reabrirse en la ventana
secundaria, utilizar un mecanismo de sesión compartida y solicitar
permiso cuando corresponda. No asumir que una URL blob persistirá
después de cerrar o recargar una ventana.

La ventana secundaria debe poder moverse a otro monitor y entrar en
pantalla completa mediante una acción del usuario.

------------------------------------------------------------------------

## 11. Persistencia y recuperación

Usar IndexedDB para: - handles de carpetas; - configuración; - última
selección de biblioteca; - orden de playlist; - cola, si se decide
conservarla entre sesiones; - preferencias de pantalla secundaria.

No persistir: - URLs blob; - objetos `File` completos; - estados
transitorios de reproducción; - tokens secretos.

Al iniciar: 1. Cargar configuración. 2. Recuperar handles. 3. Comprobar
permisos. 4. Mostrar claramente qué carpetas requieren autorización. 5.
No iniciar reproducción automática hasta una interacción del usuario,
por las políticas de autoplay.

------------------------------------------------------------------------

## 12. Chromecast: alcance realista

No implementar como si Chromecast pudiera leer el disco local.

Para Google Cast, el receptor necesita una URL accesible y un formato
compatible. Un archivo local seleccionado con File System Access API no
es una URL que el Chromecast pueda solicitar desde otro dispositivo.

Alternativas futuras: 1. Transmitir una URL remota compatible y vigente,
si el proveedor la ofrece y el receptor puede acceder a ella. 2.
Incorporar un servidor HTTP local que exponga temporalmente el archivo
en la LAN. Esto requiere un proceso local y contradice la restricción de
no instalar/ejecutar servicios. 3. Evaluar una aplicación receptora o
solución de casting alternativa.

Mantener `CastProvider` como interfaz desacoplada. En la primera versión
mostrar "No disponible en esta modalidad" si no existe una
implementación funcional. No mostrar botones decorativos que no hagan
nada.

------------------------------------------------------------------------

## 13. GitHub Pages y rutas

Configurar Vite con `base` adecuado para el nombre del repositorio. Si
se publica en `https://usuario.github.io/repositorio/`, los assets deben
resolverse bajo esa ruta.

-   Usar una sola ruta o navegación interna por estado.
-   Evitar depender de rutas del servidor que GitHub Pages no puede
    resolver.
-   Configurar GitHub Actions para compilar y publicar `dist/`.
-   No subir secretos al repositorio.
-   Probar la aplicación desde el dominio real de GitHub Pages, no
    solamente en `localhost`, porque permisos, CORS y políticas de
    origen pueden variar.

La segunda ventana debe abrir una URL válida del mismo sitio, por
ejemplo una ruta/hash dedicado o una página `secondary.html` incluida en
el build.

------------------------------------------------------------------------

## 14. Compatibilidad y limitaciones del navegador

Objetivo primario: versiones actuales de Google Chrome y Microsoft Edge
en Windows.

Verificar soporte real de: - `showDirectoryPicker`; -
`showSaveFilePicker`; - IndexedDB con handles; - `BroadcastChannel`; -
Web Audio API; - reproducción de MP4/H.264/AAC; - Picture-in-Picture, si
se decide ofrecerlo; - ventanas emergentes; - Google Cast SDK, si se
implementa.

No asumir que Firefox o Safari ofrecen el mismo soporte para File System
Access API.

La aplicación debe detectar capacidades y mostrar mensajes
comprensibles. No fallar silenciosamente.

------------------------------------------------------------------------

## 15. Seguridad, privacidad y operación

-   Todo acceso local requiere acción y permiso del usuario.
-   No enviar nombres de archivos ni contenido local a terceros salvo
    que sea necesario y esté explicado.
-   Las búsquedas remotas solo envían la consulta.
-   Las descargas envían la URL al proveedor seleccionado.
-   No registrar datos sensibles en consola en producción.
-   Aplicar Content Security Policy compatible con los proveedores
    efectivamente utilizados.
-   Mantener dependencias actualizadas.
-   Documentar límites de tamaño y formatos.
-   Mostrar errores operativos visibles: permiso denegado, formato no
    soportado, archivo perdido, proveedor no disponible, cuota excedida.

------------------------------------------------------------------------

## 16. Plan de desarrollo por etapas

### Etapa 1 --- Esqueleto y diseño

-   Crear Vite + React + TypeScript.
-   Configurar StyleX real.
-   Preparar tokens de diseño y layout de una sola pantalla.
-   Configurar GitHub Pages y GitHub Actions.
-   Crear detección de capacidades del navegador.

**Criterio de aceptación:** la interfaz se publica correctamente en
GitHub Pages y funciona en Chrome/Edge.

### Etapa 2 --- Biblioteca local

-   Selección de carpeta de música.
-   Selección de carpeta de karaoke.
-   Explorador de directorios.
-   Filtros por tipo.
-   Persistencia de handles y permisos.
-   Guardado de preferencias.

**Criterio de aceptación:** seleccionar carpetas, recorrer archivos y
recuperar permisos después de recargar.

### Etapa 3 --- Reproducción

-   Reproductor de música de fondo.
-   Reproductor de video.
-   Playlist en bucle.
-   Cola de karaoke.
-   Reproducción siguiente/anterior.
-   Errores y archivos no compatibles.

**Criterio de aceptación:** reproducir una lista musical y una cola de
videos sin intervención manual entre elementos.

### Etapa 4 --- Mezcla y transiciones

-   Web Audio API.
-   Ganancias independientes.
-   Fade-out al iniciar karaoke.
-   Fade-in al terminar la cola.
-   Controles de volumen.
-   Pruebas de interrupciones y errores.

**Criterio de aceptación:** no hay solapamientos involuntarios ni saltos
bruscos de volumen.

### Etapa 5 --- Segunda ventana

-   Apertura por acción del usuario.
-   Sincronización con BroadcastChannel.
-   Pantalla de espera.
-   Pantalla completa.
-   Pruebas en dos monitores.

**Criterio de aceptación:** la segunda ventana refleja correctamente el
video y los cambios de estado.

### Etapa 6 --- YouTube y descargas

-   Búsqueda de metadatos.
-   Reproducción oficial incrustada integrada con la cola mixta local /
    YouTube.
-   Sincronización de YouTube con la segunda pantalla.
-   Adaptador de proveedor.
-   Validación de CORS, términos, cuotas y seguridad.
-   Descarga y guardado local.
-   Estados de progreso y error.

**Criterio de aceptación:** los resultados se reproducen con el
reproductor oficial y avanzan dentro de la cola mixta. La descarga solo
se habilita si un proveedor real y autorizado descarga un archivo de
prueba que queda disponible en la biblioteca; mientras no exista un
proveedor compatible, debe permanecer desactivada y documentada.

### Etapa 7 --- Normalización y Chromecast

-   Evaluar normalización de loudness.
-   Probar Cast con un recurso realmente accesible por el receptor.
-   Documentar requisitos adicionales.
-   No introducir servicios locales sin aprobación explícita.

**Criterio de aceptación:** cada función se declara compatible solo
después de una prueba real en el hardware de destino.

------------------------------------------------------------------------

## 17. Instrucciones específicas para GitHub Copilot

1.  Leer este documento antes de proponer o modificar arquitectura.
2.  Respetar la restricción de ejecución: no Node.js, Python, PHP ni
    servidor local en la PC de cabina.
3.  Se permite Node.js durante desarrollo y compilación. No confundir
    herramienta de build con dependencia de runtime.
4.  No crear backend, API proxy propio ni ejecutables auxiliares sin
    autorización explícita.
5.  No inventar APIs, endpoints, SDKs, proveedores ni capacidades del
    navegador.
6.  Antes de implementar una integración externa, comprobar
    documentación oficial, CORS, autenticación, términos y límites.
7.  No incluir claves secretas en el frontend.
8.  Usar TypeScript estricto y tipos compartidos.
9.  Usar StyleX real para estilos.
10. Separar componentes visuales de lógica de reproducción y
    persistencia.
11. Mantener una única autoridad para el estado de reproducción.
12. Implementar estados de carga, vacío, error y permiso denegado.
13. No crear botones sin comportamiento.
14. No almacenar URLs blob como persistencia.
15. No cargar bibliotecas multimedia completas en memoria
    innecesariamente.
16. Escribir pruebas para la máquina de estados de reproducción y las
    transiciones.
17. Trabajar por etapas pequeñas. No implementar todas las funciones en
    un único cambio.
18. Antes de modificar archivos, explicar brevemente qué archivos se
    tocarán y por qué.
19. No reemplazar una función no viable por una simulación visual.
    Informar la limitación.
20. Mantener README actualizado con pasos de desarrollo, publicación y
    uso.

### Primera tarea sugerida para Copilot

Implementar únicamente la Etapa 1:

-   Inicializar el proyecto Vite + React + TypeScript.
-   Configurar StyleX real y verificar que compile.
-   Crear el layout de una sola pantalla con componentes vacíos y datos
    ficticios claramente identificados.
-   Configurar GitHub Actions para GitHub Pages.
-   No implementar todavía descargas, reproducción ni Chromecast.
-   Entregar instrucciones exactas para ejecutar el entorno de
    desarrollo y publicar el sitio.

------------------------------------------------------------------------

## 18. Riesgos y decisiones pendientes

  -----------------------------------------------------------------------
  Tema                                Riesgo / decisión
  ----------------------------------- -----------------------------------
  Descarga YouTube                    Encontrar proveedor autorizado,
                                      estable, con CORS y sin secretos
                                      privados en frontend

  API keys                            Restringir por origen y cuota;
                                      nunca publicar secretos

  Archivos grandes                    Evitar cargar videos completos en
                                      memoria

  Códecs                              No todos los MP4 contienen códecs
                                      reproducibles

  Permisos locales                    Pueden requerir renovación después
                                      de cerrar el navegador

  Segunda ventana                     Requiere sincronización y gestión
                                      de recursos entre contextos

  Chromecast                          No accede directamente a archivos
                                      locales sin un recurso de red

  Normalización                       Loudness real no equivale a subir
                                      el volumen

  GitHub Pages                        No ejecuta backend ni procesos
                                      locales
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 19. Definición de producto

La primera versión debe ser un reproductor de karaoke local robusto, con
biblioteca, playlist de fondo, cola, transiciones automáticas y segunda
pantalla.

La búsqueda de YouTube, descarga externa, normalización avanzada y
Chromecast son módulos adicionales, no dependencias del núcleo.

**Principio rector:** priorizar una aplicación que funcione de manera
confiable en la cabina antes que una lista de integraciones vistosas que
dependan de servicios inestables o capacidades que el navegador no
tiene.
