# Stage — Karaoke Console

Stage es una interfaz web estática para operar una sesión de karaoke desde un navegador moderno. La **Etapa 4** añade mezcla Web Audio y fades configurables a la exploración local, reproducción, cola y música de fondo.

## Requisitos para desarrollo

- Node.js 22 o superior y npm.
- Chrome o Edge actualizado para validar la interfaz.

Node.js se utiliza únicamente para instalar dependencias, ejecutar el servidor de desarrollo y compilar. El sitio publicado no requiere Node.js ni un servidor local en la PC de la cabina.

## Desarrollo local

```bash
npm ci
npm run dev
```

Abre la URL que Vite muestra en la terminal, normalmente `http://localhost:5173`.

## Compilar y previsualizar

```bash
npm run build
npm run preview
```

El build verifica TypeScript y genera el sitio estático en `dist/`.

## Publicar en GitHub Pages

El workflow [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) compila y publica el sitio al hacer push a `main`, o al iniciarlo manualmente desde GitHub Actions. En el repositorio, configura **Settings → Pages → Build and deployment → Source: GitHub Actions**.

La configuración de Vite utiliza `/Stage-KRK/` como base de assets en GitHub Actions para este repositorio. Si se cambia el nombre del repositorio, actualiza `base` en `vite.config.ts`.

## Biblioteca local

En Chrome o Edge actualizado, usa **Elegir carpeta** para autorizar una carpeta de música o de videos. La app muestra archivos de audio y video compatibles, permite navegar subcarpetas, buscar en la carpeta actual y filtrar por tipo. Los permisos se guardan en IndexedDB cuando el navegador lo permite; al volver a abrir la app puede ser necesario conceder acceso otra vez.

En navegadores sin File System Access API, la selección alternativa carga los archivos de la carpeta elegida en la pestaña actual. No guarda el permiso y no permite persistir esa selección al cerrar la pestaña.

La app solo recorre la carpeta seleccionada y sus subcarpetas cuando el usuario las abre. No envía nombres ni contenido de archivos a servicios externos. La extensión no garantiza que el navegador pueda reproducir los códecs de un archivo.

## Reproducción y cola

En Biblioteca, **Reproducir** inicia un video al momento y **+ Cola** lo agrega a la lista. La cola permite cambiar el orden, quitar pistas y elegir **Auto siguiente**. Activado, Stage inicia la próxima pista al terminar; desactivado, conserva la cola, reanuda la música de fondo y espera a que pulses **Reproducir siguiente**. Al detener un karaoke, la música de fondo puede reanudarse desde su posición anterior.

Agrega pistas de audio con **+ Ambiente**. La playlist comienza al agregar su primera pista, admite pausa, repetición y volumen independiente. El volumen de karaoke y el volumen maestro también son independientes. Al iniciar un karaoke, el ambiente baja gradualmente; vuelve gradualmente al terminar si el avance automático está desactivado o la cola no tiene más pistas.

Los controles **Fade salida** y **Fade entrada** permiten ajustar por separado la duración de cada transición entre 0 y 5 segundos. Los valores iniciales son 1,2 y 1,8 segundos. Los fades usan Web Audio API y el motor de audio se habilita con la primera acción de reproducción. Si el navegador no permite inicializar Web Audio, Stage muestra el error y mantiene la reproducción directa sin fades.

Chrome y Edge aplican políticas de autoplay y compatibilidad de códecs. Stage muestra los errores y ofrece controles para reanudar manualmente cuando el navegador bloquea la reproducción.

## Alcance actual

- Interfaz adaptable de consola en español y tema oscuro.
- Estilos procesados por StyleX.
- Exploración local de audio y video, búsqueda, filtros y navegación por carpetas.
- Persistencia de handles locales en IndexedDB cuando está soportada.
- Reproducción local con mezcla Web Audio, volúmenes independientes, master y fades configurables.
- Playlist de ambiente y cola de karaoke con avance automático opcional y prioridad de audio durante el karaoke.
- Publicación estática automatizada en GitHub Pages.

## Segunda pantalla

Pulsa **Segunda pantalla** para abrir una ventana independiente. Permite moverla a otro monitor y activar pantalla completa desde esa ventana. Opcionalmente, **Imagen de fondo** permite elegir una imagen del equipo para la pantalla de espera; puedes cambiarla o quitarla desde la consola. La imagen se comparte solo entre las dos ventanas durante la sesión y no se sube ni se guarda. El video, el título, la pausa y la posición se sincronizan desde la consola mediante `BroadcastChannel`; la ventana secundaria permanece silenciada para evitar duplicar el audio.

El archivo de video se comparte solo durante la sesión y la segunda ventana crea y libera su propia URL temporal. No se guarda la URL ni el archivo en la persistencia. Permite ventanas emergentes para el sitio. Si el navegador no puede compartir o decodificar el archivo en esa ventana, Stage muestra el error en pantalla.

## Búsqueda de YouTube

La pestaña **YouTube** busca hasta 10 resultados usando `search.list` de YouTube Data API v3 y pide solo videos que permiten inserción. Puedes reproducirlos al instante o agregarlos a la misma cola que los archivos locales. Stage usa el reproductor oficial incrustado de YouTube; no extrae streams ni descarga contenido. Cada búsqueda usa cuota de API, pero la reproducción incrustada no requiere una API key.

El filtro de inserción reduce resultados que el propietario bloqueó para reproductores externos, pero no garantiza disponibilidad: YouTube también puede restringir videos por país, edad, cuenta o cambios posteriores. En esos casos, usa **Abrir en YouTube**; Stage no puede omitir restricciones del reproductor. El autoplay puede ser bloqueado; inicia la reproducción con el control del iframe si ocurre. El volumen se controla desde Stage, pero el audio de YouTube se procesa dentro del iframe y no se mezcla mediante el grafo Web Audio usado para los archivos locales.

Para habilitarla:

1. Crea un proyecto en Google Cloud, habilita **YouTube Data API v3** y crea una API key.
2. Restringe la key por **HTTP referrers (web sites)** a los orígenes que usarás, como `https://<usuario>.github.io/*` (y el dominio personalizado, si corresponde). Restringe también la key a YouTube Data API v3 y vigila la cuota en Google Cloud.
3. Copia `.env.example` como `.env.local` y asigna la key a `VITE_YOUTUBE_API_KEY`.
4. Para GitHub Pages, crea la variable de repositorio `VITE_YOUTUBE_API_KEY` en **Settings → Secrets and variables → Actions → Variables** y vuelve a publicar. El workflow la pasa al build. Vite incorpora esta key al JavaScript publicado: **no es un secreto**. No uses una key privada ni una credencial con permisos adicionales.

Sin una key válida, la búsqueda permanece deshabilitada y la app local sigue funcionando. La consulta envía las palabras clave a Google.

La descarga se mantiene desactivada. No se encontró ni verificó un proveedor que permita el uso previsto, CORS desde GitHub Pages, archivos grandes y una integración frontend sin secretos. El adaptador informa esta limitación en vez de simular la descarga.

## Funciones pendientes

La ventana secundaria está implementada, pero todavía debe validarse en dos monitores y con archivos/códecs reales en Chrome y Edge. También quedan pendientes las pruebas automatizadas de reproducción/transiciones y la persistencia de ajustes. La búsqueda requiere una API key configurada; las descargas siguen desactivadas hasta encontrar un proveedor autorizado compatible con el despliegue estático. Normalización avanzada y Chromecast requieren pruebas reales de hardware y compatibilidad.
