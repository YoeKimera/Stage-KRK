import { useEffect, useRef, useState, type FormEvent } from 'react';
import * as stylex from '@stylexjs/stylex';
import { colors } from '../../styles/tokens.stylex';
import { disabledDownloadProvider } from './disabledDownloadProvider';
import { createYouTubeSearchProvider, getVideoUrl } from './youtubeSearchProvider';
import type { YouTubeVideoResult } from './youtube.types';

const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY ?? '';
const searchProvider = createYouTubeSearchProvider(apiKey);

interface YouTubeSearchPanelProps {
  onPlayNow: (video: YouTubeVideoResult) => void;
  onAddToQueue: (video: YouTubeVideoResult) => void;
}

export function YouTubeSearchPanel({ onPlayNow, onAddToQueue }: YouTubeSearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YouTubeVideoResult[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'complete'>('idle');
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const [downloadsAvailable, setDownloadsAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    void disabledDownloadProvider.isAvailable().then((available) => {
      if (active) setDownloadsAvailable(available);
    });
    return () => {
      active = false;
    };
  }, []);

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      setError('Escribe qué video quieres buscar.');
      return;
    }
    if (!searchProvider.isAvailable()) {
      setError('La búsqueda no está configurada. Sigue las instrucciones del README para habilitar la API de YouTube.');
      return;
    }

    const currentRequest = ++requestId.current;
    setStatus('loading');
    setError('');
    setResults([]);
    try {
      const found = await searchProvider.search(normalizedQuery);
      if (currentRequest !== requestId.current) return;
      setResults(found);
      setStatus('complete');
    } catch (searchError) {
      if (currentRequest !== requestId.current) return;
      setStatus('complete');
      setError(searchError instanceof Error ? searchError.message : 'La búsqueda de YouTube falló.');
    }
  }

  return (
    <section {...stylex.props(styles.section)} aria-labelledby="youtube-heading">
      <header {...stylex.props(styles.heading)}>
        <div>
          <span {...stylex.props(styles.eyebrow)}>BÚSQUEDA EXTERNA · METADATOS</span>
          <h2 id="youtube-heading" {...stylex.props(styles.title)}>Buscar en YouTube</h2>
          <p {...stylex.props(styles.subtitle)}>Busca videos y reprodúcelos desde el reproductor oficial de YouTube, ahora o al llegar su turno en la cola.</p>
        </div>
      </header>

      {!searchProvider.isAvailable() && (
        <div {...stylex.props(styles.notice)} role="status">
          La búsqueda está deshabilitada hasta configurar una API key pública de YouTube restringida por HTTP referrer.
        </div>
      )}
      {!downloadsAvailable && (
        <div {...stylex.props(styles.notice)} role="note">
          Descargas desactivadas: no se encontró un proveedor que podamos verificar para este despliegue estático.
        </div>
      )}

      <form {...stylex.props(styles.searchForm)} onSubmit={(event) => void submitSearch(event)}>
        <label htmlFor="youtube-query" {...stylex.props(styles.label)}>Palabras clave</label>
        <div {...stylex.props(styles.searchRow)}>
          <input
            id="youtube-query"
            type="search"
            maxLength={100}
            autoComplete="off"
            placeholder="Artista, canción o karaoke"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            disabled={!searchProvider.isAvailable() || status === 'loading'}
            {...stylex.props(styles.input)}
          />
          <button type="submit" disabled={!searchProvider.isAvailable() || status === 'loading' || !query.trim()} {...stylex.props(styles.searchButton)}>
            {status === 'loading' ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
      </form>

      {error && <p role="alert" {...stylex.props(styles.error)}>{error}</p>}
      {status === 'complete' && !error && results.length === 0 && (
        <p role="status" {...stylex.props(styles.empty)}>No se encontraron videos para esa búsqueda.</p>
      )}

      {results.length > 0 && (
        <div {...stylex.props(styles.results)} aria-live="polite">
          {results.map((video) => (
            <article key={video.id} {...stylex.props(styles.resultCard)}>
              {video.thumbnailUrl
                ? <img src={video.thumbnailUrl} alt="" loading="lazy" {...stylex.props(styles.thumbnail)} />
                : <div aria-hidden="true" {...stylex.props(styles.thumbnailPlaceholder)}>▶</div>}
              <div {...stylex.props(styles.resultInfo)}>
                <h3 {...stylex.props(styles.resultTitle)}>{video.title}</h3>
                <p {...stylex.props(styles.channel)}>{video.channelTitle}</p>
                {video.description && <p {...stylex.props(styles.description)}>{video.description}</p>}
              </div>
              <div {...stylex.props(styles.actions)}>
                <a href={getVideoUrl(video)} target="_blank" rel="noopener noreferrer" {...stylex.props(styles.openLink)}>Abrir en YouTube</a>
                <button type="button" onClick={() => onPlayNow(video)} {...stylex.props(styles.queueButton)}>Reproducir ahora</button>
                <button type="button" onClick={() => onAddToQueue(video)} {...stylex.props(styles.queueButton)}>Añadir a cola</button>
                <button
                  type="button"
                  disabled
                  title="No hay un proveedor de descargas autorizado y compatible configurado."
                  aria-label={`Descarga no disponible para ${video.title}`}
                  {...stylex.props(styles.downloadButton)}
                >
                  Descarga no disponible
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <p {...stylex.props(styles.disclaimer)}>
        La búsqueda envía tus palabras clave a Google y solo recupera metadatos públicos. Respeta los derechos y las condiciones del contenido en YouTube.
      </p>
    </section>
  );
}

const styles = stylex.create({
  section: { display: 'flex', flexDirection: 'column', gap: '16px' },
  heading: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '20px' },
  eyebrow: { color: colors.accent, fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '1.2px' },
  title: { margin: '7px 0 0', fontFamily: 'Manrope, sans-serif', fontSize: '26px', letterSpacing: '-.7px' },
  subtitle: { margin: '7px 0 0', color: colors.textMuted, fontSize: '12px', lineHeight: 1.6 },
  notice: { padding: '11px 13px', border: `1px solid ${colors.border}`, borderRadius: '8px', backgroundColor: colors.surface, color: colors.textMuted, fontSize: '11px', lineHeight: 1.6 },
  searchForm: { display: 'flex', flexDirection: 'column', gap: '7px', padding: '16px', border: `1px solid ${colors.border}`, borderRadius: '11px', backgroundColor: colors.surface },
  label: { color: colors.textMuted, fontSize: '10px', fontWeight: 600 },
  searchRow: { display: 'flex', gap: '9px', '@media (max-width: 480px)': { flexDirection: 'column' } },
  input: { minWidth: 0, height: '42px', flex: 1, paddingInline: '12px', border: `1px solid ${colors.border}`, borderRadius: '7px', outlineColor: colors.accent, backgroundColor: colors.background, color: colors.text, font: 'inherit', fontSize: '12px', ':disabled': { opacity: .6 } },
  searchButton: { minWidth: '94px', paddingInline: '16px', border: 0, borderRadius: '7px', backgroundColor: colors.accent, color: colors.background, fontSize: '11px', fontWeight: 700, cursor: 'pointer', ':disabled': { opacity: .45, cursor: 'default' } },
  error: { margin: 0, padding: '11px 13px', border: '1px solid #553538', borderRadius: '8px', backgroundColor: '#2a1e21', color: '#ffaaaa', fontSize: '11px', lineHeight: 1.6 },
  empty: { margin: 0, padding: '20px', color: colors.textMuted, textAlign: 'center', fontSize: '12px' },
  results: { display: 'flex', flexDirection: 'column', gap: '10px' },
  resultCard: { display: 'grid', gridTemplateColumns: '160px minmax(0, 1fr) auto', alignItems: 'center', gap: '14px', padding: '12px', border: `1px solid ${colors.border}`, borderRadius: '9px', backgroundColor: colors.surface, '@media (max-width: 760px)': { gridTemplateColumns: '120px minmax(0, 1fr)' }, '@media (max-width: 480px)': { gridTemplateColumns: '1fr' } },
  thumbnail: { width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: '6px', backgroundColor: colors.background },
  thumbnailPlaceholder: { width: '100%', aspectRatio: '16 / 9', display: 'grid', placeItems: 'center', borderRadius: '6px', backgroundColor: colors.surfaceRaised, color: colors.accent },
  resultInfo: { minWidth: 0, alignSelf: 'stretch', display: 'flex', flexDirection: 'column', gap: '5px' },
  resultTitle: { display: '-webkit-box', overflow: 'hidden', margin: 0, color: colors.text, fontSize: '12px', lineHeight: 1.5, fontWeight: 650, WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 },
  channel: { margin: 0, color: colors.accent, fontSize: '10px' },
  description: { display: '-webkit-box', overflow: 'hidden', margin: 0, color: colors.textSubtle, fontSize: '10px', lineHeight: 1.5, WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 },
  actions: { display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '7px', '@media (max-width: 760px)': { gridColumn: '2', gridRow: '2' }, '@media (max-width: 480px)': { gridColumn: '1', gridRow: 'auto' } },
  openLink: { padding: '8px 10px', borderRadius: '6px', backgroundColor: colors.accent, color: colors.background, textAlign: 'center', textDecoration: 'none', whiteSpace: 'nowrap', fontSize: '10px', fontWeight: 700 },
  queueButton: { padding: '8px 10px', border: `1px solid ${colors.border}`, borderRadius: '6px', backgroundColor: colors.surfaceRaised, color: colors.text, whiteSpace: 'nowrap', fontSize: '10px', fontWeight: 600, cursor: 'pointer' },
  downloadButton: { padding: '8px 10px', border: `1px solid ${colors.border}`, borderRadius: '6px', backgroundColor: 'transparent', color: colors.textSubtle, whiteSpace: 'nowrap', fontSize: '9px', cursor: 'not-allowed', opacity: .65 },
  disclaimer: { margin: 0, color: colors.textSubtle, fontSize: '10px', lineHeight: 1.6 },
});
