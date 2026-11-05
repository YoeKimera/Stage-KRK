import * as stylex from '@stylexjs/stylex';
import { colors } from '../styles/tokens.stylex';
import type { PlaybackController } from '../features/audio/usePlaybackController';
import type { QueueItem } from '../features/queue/queue.types';
import { YouTubeEmbed } from '../features/youtube/YouTubeEmbed';

interface PlaybackDashboardProps {
  controller: PlaybackController;
  view: 'overview' | 'queue';
  onOpenLibrary: () => void;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remaining}`;
}

function QueuePanel({ controller, expanded }: { controller: PlaybackController; expanded: boolean }) {
  const items = expanded ? controller.queue : controller.queue.slice(0, 3);

  return (
    <article {...stylex.props(styles.queueCard)}>
      <div {...stylex.props(styles.cardHeader)}>
        <div>
          <div {...stylex.props(styles.sectionLabel)}>SIGUIENTES EN ESCENA</div>
          <h2 {...stylex.props(styles.queueTitle)}>La cola <span {...stylex.props(styles.queueTotal)}>{controller.queue.length.toString().padStart(2, '0')}</span></h2>
        </div>
        <div {...stylex.props(styles.queueHeaderActions)}>
          <label
            title={controller.autoAdvanceQueue
              ? 'Al terminar una pista, inicia la siguiente automáticamente.'
              : 'Al terminar una pista, la música de fondo sigue hasta que avances manualmente.'}
            {...stylex.props(styles.autoAdvanceControl)}
          >
            <span>Auto siguiente</span>
            <input
              type="checkbox"
              checked={controller.autoAdvanceQueue}
              onChange={(event) => controller.setAutoAdvanceQueue(event.currentTarget.checked)}
              aria-label="Reproducir siguiente automáticamente"
              {...stylex.props(styles.autoAdvanceCheckbox)}
            />
          </label>
          {controller.queue.length > 0 && (
            <button type="button" {...stylex.props(styles.clearButton)} onClick={controller.clearQueue}>Vaciar</button>
          )}
        </div>
      </div>
      {controller.queue.length === 0 ? (
        <div {...stylex.props(styles.emptyQueue)}>
          <span {...stylex.props(styles.emptyQueueIcon)}><QueueIcon /></span>
          <strong {...stylex.props(styles.emptyQueueTitle)}>La cola está vacía</strong>
          <span {...stylex.props(styles.emptyQueueCopy)}>Agrega videos desde la biblioteca para programar las siguientes canciones.</span>
        </div>
      ) : (
        <div {...stylex.props(styles.queueList)}>
          {items.map((item, index) => (
            <QueueRow
              key={item.queueId}
              item={item}
              index={index}
              total={controller.queue.length}
              onMove={controller.moveQueueItem}
              onRemove={controller.removeFromQueue}
            />
          ))}
          {!expanded && controller.queue.length > items.length && (
            <span {...stylex.props(styles.moreQueue)}>+ {controller.queue.length - items.length} canciones en espera</span>
          )}
        </div>
      )}
      <button type="button" {...stylex.props(styles.addQueueButton)} onClick={() => void controller.playNext()} disabled={controller.queue.length === 0}>
        <PlayIcon /> Reproducir siguiente
      </button>
    </article>
  );
}

function QueueRow({
  item,
  index,
  total,
  onMove,
  onRemove,
}: {
  item: QueueItem;
  index: number;
  total: number;
  onMove: PlaybackController['moveQueueItem'];
  onRemove: PlaybackController['removeFromQueue'];
}) {
  return (
    <div {...stylex.props(styles.queueRow)}>
      <span {...stylex.props(styles.queuePosition)}>{(index + 1).toString().padStart(2, '0')}</span>
      <span {...stylex.props(styles.queueItemText)}>
        <strong {...stylex.props(styles.queueItemName)} title={item.track.kind === 'local' ? item.track.media.name : item.track.video.title}>
          {item.track.kind === 'local' ? item.track.media.name : item.track.video.title}
        </strong>
        <small {...stylex.props(styles.queueItemPath)} title={item.track.kind === 'local' ? item.track.media.relativePath : item.track.video.channelTitle}>
          {item.track.kind === 'local' ? item.track.media.relativePath : `YouTube · ${item.track.video.channelTitle}`}
        </small>
      </span>
      <span {...stylex.props(styles.queueActions)}>
        <button {...stylex.props(styles.queueActionButton)} type="button" aria-label={`Subir ${item.track.kind === 'local' ? item.track.media.name : item.track.video.title}`} onClick={() => onMove(item.queueId, -1)} disabled={index === 0}>↑</button>
        <button {...stylex.props(styles.queueActionButton)} type="button" aria-label={`Bajar ${item.track.kind === 'local' ? item.track.media.name : item.track.video.title}`} onClick={() => onMove(item.queueId, 1)} disabled={index === total - 1}>↓</button>
        <button {...stylex.props(styles.queueActionButton)} type="button" aria-label={`Quitar ${item.track.kind === 'local' ? item.track.media.name : item.track.video.title} de la cola`} onClick={() => onRemove(item.queueId)}>×</button>
      </span>
    </div>
  );
}

function BackgroundPanel({ controller, hidden }: { controller: PlaybackController; hidden: boolean }) {
  const currentIndex = controller.backgroundPlaylist.findIndex((media) => media.id === controller.currentBackground?.id);

  return (
    <article hidden={hidden} {...stylex.props(styles.backgroundCard, hidden && styles.backgroundHidden)}>
      <audio
        ref={controller.audioElement}
        onEnded={controller.handleBackgroundEnded}
        onError={(event) => {
          if (controller.currentBackground && event.currentTarget.currentSrc) {
            controller.setError(`No se pudo leer “${controller.currentBackground.name}”. El archivo podría estar dañado o usar un códec no compatible.`);
          }
        }}
        preload="metadata"
        aria-label="Reproductor de música de fondo"
        {...stylex.props(styles.hiddenMedia)}
      />
      <div {...stylex.props(styles.backgroundHeader)}>
        <span {...stylex.props(styles.backgroundIcon)}><MusicIcon /></span>
        <div><span {...stylex.props(styles.sectionLabel)}>AMBIENTE</span><h2 {...stylex.props(styles.backgroundTitle)}>Música de fondo</h2></div>
        <span {...stylex.props(styles.offPill, controller.backgroundStatus === 'playing' && styles.onPill)}>
          {controller.backgroundStatus === 'playing' ? 'SONANDO' : controller.backgroundStatus === 'loading' ? 'CARGANDO' : controller.backgroundPlaylist.length ? 'EN PAUSA' : 'APAGADA'}
        </span>
      </div>
      {controller.backgroundPlaylist.length === 0 ? (
        <div {...stylex.props(styles.backgroundEmpty)}>
          <span>No hay playlist configurada</span>
          <span>Agrega canciones desde la carpeta de música.</span>
        </div>
      ) : (
        <>
          <div {...stylex.props(styles.backgroundTrack)}>
            <span {...stylex.props(styles.trackWave)}><MusicIcon /></span>
            <span {...stylex.props(styles.backgroundTrackText)}>
              <strong {...stylex.props(styles.backgroundTrackName)} title={controller.currentBackground?.name}>{controller.currentBackground?.name ?? controller.backgroundPlaylist[0].name}</strong>
              <small {...stylex.props(styles.backgroundTrackStatus)}>{controller.backgroundPlaylist.length} {controller.backgroundPlaylist.length === 1 ? 'pista' : 'pistas'} · {currentIndex < 0 ? 'lista preparada' : `${currentIndex + 1} de ${controller.backgroundPlaylist.length}`}</small>
            </span>
            <button type="button" {...stylex.props(styles.smallPlayButton)} onClick={controller.toggleBackgroundPlayback} disabled={Boolean(controller.currentVideo || controller.currentYouTubeVideo)} aria-label={controller.backgroundStatus === 'playing' ? 'Pausar música de fondo' : 'Reproducir música de fondo'}>
              {controller.backgroundStatus === 'playing' ? <PauseIcon /> : <PlayIcon />}
            </button>
          </div>
          <div {...stylex.props(styles.backgroundPlaylist)}>
            {controller.backgroundPlaylist.map((media, index) => (
              <div key={media.id} {...stylex.props(styles.backgroundItem, controller.currentBackground?.id === media.id && styles.backgroundItemActive)}>
                <span>{(index + 1).toString().padStart(2, '0')}</span>
                <strong {...stylex.props(styles.backgroundItemName)} title={media.name}>{media.name}</strong>
                <button {...stylex.props(styles.removeBackgroundButton)} type="button" aria-label={`Quitar ${media.name} de música de fondo`} onClick={() => controller.removeBackgroundItem(media.id)}>×</button>
              </div>
            ))}
          </div>
        </>
      )}
      <div {...stylex.props(styles.backgroundControls)}>
        <label {...stylex.props(styles.loopControl)}>
          <input {...stylex.props(styles.loopCheckbox)} type="checkbox" checked={controller.backgroundLoop} onChange={(event) => controller.setBackgroundLoop(event.currentTarget.checked)} />
          Repetir playlist
        </label>
        <label {...stylex.props(styles.levelControl)}>
          <span>Volumen</span>
          <input {...stylex.props(styles.levelRange)} type="range" min="0" max="1" step="0.01" value={controller.backgroundVolume} aria-label="Volumen de música de fondo" onChange={(event) => controller.setBackgroundLevel(Number(event.currentTarget.value))} />
        </label>
        <label {...stylex.props(styles.levelControl)}>
          <span>Master</span>
          <input {...stylex.props(styles.levelRange)} type="range" min="0" max="1" step="0.01" value={controller.masterVolume} aria-label="Volumen maestro" onChange={(event) => controller.setMasterLevel(Number(event.currentTarget.value))} />
        </label>
      </div>
      <div {...stylex.props(styles.fadeSettings)}>
        <label {...stylex.props(styles.fadeControl)}>
          <span {...stylex.props(styles.fadeHeading)}><span>Fade salida</span><output>{(controller.fadeOutDuration / 1000).toFixed(1)} s</output></span>
          <input {...stylex.props(styles.fadeRange)} type="range" min="0" max="5000" step="100" value={controller.fadeOutDuration} aria-label="Duración del fade de salida" onChange={(event) => controller.setFadeOutDuration(Number(event.currentTarget.value))} />
        </label>
        <label {...stylex.props(styles.fadeControl)}>
          <span {...stylex.props(styles.fadeHeading)}><span>Fade entrada</span><output>{(controller.fadeInDuration / 1000).toFixed(1)} s</output></span>
          <input {...stylex.props(styles.fadeRange)} type="range" min="0" max="5000" step="100" value={controller.fadeInDuration} aria-label="Duración del fade de entrada" onChange={(event) => controller.setFadeInDuration(Number(event.currentTarget.value))} />
        </label>
      </div>
    </article>
  );
}

function QueueIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h10" /><path d="m18 16 3 2-3 2z" /></svg>;
}

function MusicIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>;
}

function PlayIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m8 5 12 7-12 7z" /></svg>;
}

function PauseIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zm7 0h4v14h-4z" /></svg>;
}

export function PlaybackDashboard({ controller, view, onOpenLibrary }: PlaybackDashboardProps) {
  const { currentVideo, currentYouTubeVideo, videoStatus, currentTime, duration } = controller;
  const hasCurrentTrack = Boolean(currentVideo || currentYouTubeVideo);
  const expandedQueue = view === 'queue';
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
    {expandedQueue && controller.error && <div role="alert" {...stylex.props(styles.queueError)}>{controller.error}</div>}
    <section {...stylex.props(styles.dashboardGrid, expandedQueue && styles.expandedGrid)} aria-label="Panel de reproducción">
        <article {...stylex.props(styles.playerCard, expandedQueue && styles.playerCardHidden)}>
          <div {...stylex.props(styles.cardTopline)}>
            <div {...stylex.props(styles.sectionLabel)}><span {...stylex.props(styles.liveIndicator, videoStatus === 'playing' && styles.liveIndicatorActive)} /> REPRODUCIENDO AHORA</div>
            <span {...stylex.props(styles.sourceTag)}><span {...stylex.props(styles.sourceDot)} /> {videoStatus === 'playing' ? 'KARAOKE' : videoStatus === 'loading' ? 'CARGANDO' : 'EN ESPERA'}</span>
          </div>

          <div {...stylex.props(styles.playerVisual, hasCurrentTrack && styles.videoVisual)}>
            <video
              ref={controller.videoElement}
              hidden={!currentVideo}
              onTimeUpdate={(event) => controller.updateVideoTime(event.currentTarget.currentTime)}
              onLoadedMetadata={(event) => controller.updateVideoDuration(event.currentTarget.duration)}
              onDurationChange={(event) => controller.updateVideoDuration(event.currentTarget.duration)}
              onEnded={controller.handleVideoEnded}
              onError={(event) => {
                if (currentVideo && event.currentTarget.currentSrc) controller.setError(`No se pudo reproducir “${currentVideo.name}”. Comprueba que el archivo no esté dañado y que use un códec compatible.`);
              }}
              playsInline
              preload="metadata"
              {...stylex.props(styles.videoElement)}
            />
            {currentYouTubeVideo && (
              <YouTubeEmbed
                videoId={currentYouTubeVideo.id}
                active
                volume={controller.videoVolume * controller.masterVolume}
                onPlayer={controller.handleYouTubePlayer}
                onStatus={controller.handleYouTubeStatus}
                onTime={(time, videoDuration) => {
                  controller.updateVideoTime(time);
                  controller.updateVideoDuration(videoDuration);
                }}
                onEnded={controller.handleYouTubeEnded}
                onError={controller.handleYouTubeError}
                onAutoplayBlocked={controller.handleYouTubeAutoplayBlocked}
              />
            )}
            {!hasCurrentTrack && (
              <>
                <div {...stylex.props(styles.visualGlow)} />
                <div {...stylex.props(styles.visualRing, styles.ringOuter)} />
                <div {...stylex.props(styles.visualRing, styles.ringMiddle)} />
                <div {...stylex.props(styles.visualDisc)}><span>♪</span></div>
                <span {...stylex.props(styles.visualNote, styles.noteOne)}>♪</span>
                <span {...stylex.props(styles.visualNote, styles.noteTwo)}>♫</span>
                <span {...stylex.props(styles.visualNote, styles.noteThree)}>♪</span>
                <span {...stylex.props(styles.visualLabel)}>TU ESCENARIO</span>
              </>
            )}
          </div>

          <div {...stylex.props(styles.trackInfo)}>
            <div {...stylex.props(styles.trackDescription)}>
              <span {...stylex.props(styles.trackOverline)}>{hasCurrentTrack ? currentYouTubeVideo ? 'VIDEO DE YOUTUBE' : 'VIDEO DE KARAOKE' : 'SIN PISTA SELECCIONADA'}</span>
              <h2 {...stylex.props(styles.trackTitle)}>{currentVideo?.name ?? currentYouTubeVideo?.title ?? 'Elige la primera canción'}</h2>
              <p {...stylex.props(styles.trackSubtitle)}>{currentVideo?.relativePath ?? (currentYouTubeVideo ? `YouTube · ${currentYouTubeVideo.channelTitle}` : videoStatus === 'idle' ? 'Conecta tu biblioteca para empezar la sesión.' : videoStatus === 'loading' ? 'Preparando el archivo local…' : 'Reproducción local')}</p>
            </div>
            {!hasCurrentTrack && <button type="button" {...stylex.props(styles.primaryButton)} onClick={onOpenLibrary}><FolderIcon /> Explorar biblioteca</button>}
          </div>

          {controller.error && <div role="alert" {...stylex.props(styles.playbackError)}>{controller.error}</div>}

          <div {...stylex.props(styles.progressArea)}>
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={Math.min(currentTime, duration || 0)}
              aria-label="Posición del video"
              onChange={(event) => controller.seekVideo(Number(event.currentTarget.value))}
              disabled={!hasCurrentTrack || duration === 0}
              style={{ '--progress': `${progress}%` } as import('react').CSSProperties}
              {...stylex.props(styles.progressInput)}
            />
            <div {...stylex.props(styles.timeRow)}><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
          </div>

          <div {...stylex.props(styles.playerControls)}>
            <span {...stylex.props(styles.controlHint)}>{hasCurrentTrack ? videoStatus === 'loading' ? 'Cargando pista…' : 'Karaoke con prioridad sobre música de fondo' : 'Selecciona un video en tu biblioteca o YouTube'}</span>
            <div {...stylex.props(styles.transportControls)}>
              <button type="button" {...stylex.props(styles.transportButton)} onClick={controller.playPrevious} disabled={controller.historyLength === 0} aria-label="Canción anterior">|◀</button>
              <button type="button" {...stylex.props(styles.transportButton)} onClick={() => controller.seekVideo(0)} disabled={!hasCurrentTrack} aria-label="Reiniciar video">↺</button>
              <button type="button" {...stylex.props(styles.playButton)} onClick={hasCurrentTrack ? controller.toggleVideoPlayback : onOpenLibrary} disabled={videoStatus === 'loading'} aria-label={videoStatus === 'playing' ? 'Pausar' : 'Reproducir'}>
                {videoStatus === 'playing' ? <PauseIcon /> : <PlayIcon />}
              </button>
              <button type="button" {...stylex.props(styles.transportButton)} onClick={() => void controller.playNext()} disabled={!hasCurrentTrack && controller.queue.length === 0} aria-label="Siguiente video">|▶</button>
              <button type="button" {...stylex.props(styles.transportButton)} onClick={controller.stopVideo} disabled={!hasCurrentTrack} aria-label="Detener">■</button>
            </div>
            <label {...stylex.props(styles.volumeControl)}>
              <VolumeIcon />
              <input {...stylex.props(styles.volumeRange)} type="range" min="0" max="1" step="0.01" value={controller.videoVolume} aria-label="Volumen de karaoke" onChange={(event) => controller.setVideoLevel(Number(event.currentTarget.value))} />
            </label>
          </div>
        </article>

      <aside {...stylex.props(styles.sideColumn, expandedQueue && styles.queueSideColumn)}>
        <QueuePanel controller={controller} expanded={expandedQueue} />
        <BackgroundPanel controller={controller} hidden={expandedQueue} />
      </aside>
    </section>
    </>
  );
}

function FolderIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>;
}

function VolumeIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7m3-10a9 9 0 0 1 0 13" /></svg>;
}

const styles = stylex.create({
  dashboardGrid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.65fr) minmax(310px, .85fr)', gap: '18px', '@media (max-width: 1000px)': { gridTemplateColumns: 'minmax(0, 1.35fr) minmax(270px, .9fr)', gap: '13px' }, '@media (max-width: 760px)': { gridTemplateColumns: 'minmax(0, 1fr)' } },
  expandedGrid: { gridTemplateColumns: 'minmax(0, 1fr)' },
  queueError: { marginBottom: '14px', padding: '10px 12px', border: '1px solid #553538', borderRadius: '8px', backgroundColor: '#2a1e21', color: '#ffaaaa', fontSize: '10px', lineHeight: 1.5 },
  queueSideColumn: { maxWidth: '760px' },
  playerCard: { minWidth: 0, padding: '19px', border: `1px solid ${colors.border}`, borderRadius: '13px', backgroundColor: colors.surface, overflow: 'hidden' },
  playerCardHidden: { display: 'none' },
  cardTopline: { height: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  sectionLabel: { color: colors.textSubtle, fontFamily: 'DM Mono, monospace', fontSize: '9px', fontWeight: 500, letterSpacing: '1.1px' },
  liveIndicator: { display: 'inline-block', width: '6px', height: '6px', marginRight: '7px', borderRadius: '50%', backgroundColor: colors.textSubtle, verticalAlign: '1px' },
  liveIndicatorActive: { backgroundColor: colors.accent },
  sourceTag: { display: 'flex', alignItems: 'center', gap: '6px', color: colors.blue, fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '.6px' },
  sourceDot: { width: '5px', height: '5px', borderRadius: '50%', backgroundColor: colors.blue },
  playerVisual: { height: '218px', position: 'relative', display: 'grid', placeItems: 'center', marginTop: '3px', overflow: 'hidden', border: `1px solid ${colors.border}`, borderRadius: '9px', background: 'radial-gradient(ellipse at 50% 52%, #252a33 0%, #1c1e25 39%, #17191f 76%)' },
  videoVisual: { backgroundColor: '#08090b' },
  videoElement: { width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#08090b' },
  visualGlow: { position: 'absolute', width: '190px', height: '190px', borderRadius: '50%', backgroundColor: '#a8d75c', opacity: .055, filter: 'blur(35px)' },
  visualRing: { position: 'absolute', border: '1px solid rgba(195, 243, 107, .11)', borderRadius: '50%' },
  ringOuter: { width: '180px', height: '180px' },
  ringMiddle: { width: '137px', height: '137px', borderColor: 'rgba(195, 243, 107, .16)' },
  visualDisc: { width: '88px', height: '88px', display: 'grid', placeItems: 'center', border: '1px solid rgba(195, 243, 107, .28)', borderRadius: '50%', background: 'linear-gradient(145deg, #30363a, #202329)', color: colors.accent, fontSize: '37px' },
  visualNote: { position: 'absolute', color: colors.accent, fontFamily: 'Manrope, sans-serif', opacity: .65 },
  noteOne: { top: '59px', left: 'calc(50% - 112px)', fontSize: '20px' },
  noteTwo: { top: '106px', right: 'calc(50% - 129px)', fontSize: '26px' },
  noteThree: { bottom: '48px', left: 'calc(50% - 89px)', fontSize: '15px' },
  visualLabel: { position: 'absolute', bottom: '17px', color: colors.textSubtle, fontFamily: 'DM Mono, monospace', fontSize: '8px', letterSpacing: '1.8px' },
  trackInfo: { minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px', padding: '19px 2px 16px', '@media (max-width: 480px)': { alignItems: 'flex-start', flexDirection: 'column' } },
  trackDescription: { minWidth: 0, flex: 1 },
  trackOverline: { color: colors.textSubtle, fontFamily: 'DM Mono, monospace', fontSize: '8px', letterSpacing: '.9px' },
  trackTitle: { overflow: 'hidden', margin: '5px 0 3px', fontFamily: 'Manrope, sans-serif', fontSize: '17px', fontWeight: 700, letterSpacing: '-.3px', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  trackSubtitle: { overflow: 'hidden', margin: 0, color: colors.textMuted, fontSize: '11px', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  primaryButton: { height: '38px', display: 'flex', alignItems: 'center', gap: '8px', paddingInline: '12px', border: 0, borderRadius: '8px', backgroundColor: colors.accent, color: '#171a13', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer' },
  playbackError: { margin: '0 2px 12px', padding: '9px 11px', border: '1px solid #553538', borderRadius: '7px', backgroundColor: '#2a1e21', color: '#ffaaaa', fontSize: '10px', lineHeight: 1.5 },
  progressArea: { paddingInline: '2px' },
  progressInput: { width: '100%', height: '4px', display: 'block', margin: 0, borderRadius: '3px', appearance: 'none', background: `linear-gradient(to right, ${colors.accent} var(--progress), ${colors.surfaceHover} var(--progress))`, cursor: 'pointer', ':disabled': { cursor: 'default' }, '::-webkit-slider-thumb': { width: '10px', height: '10px', appearance: 'none', borderRadius: '50%', backgroundColor: colors.accent }, '::-moz-range-thumb': { width: '10px', height: '10px', border: 0, borderRadius: '50%', backgroundColor: colors.accent } },
  timeRow: { display: 'flex', justifyContent: 'space-between', marginTop: '7px', color: colors.textSubtle, fontFamily: 'DM Mono, monospace', fontSize: '9px' },
  playerControls: { minHeight: '51px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center', borderTop: `1px solid ${colors.border}`, marginTop: '7px', '@media (max-width: 480px)': { gridTemplateColumns: '1fr 1fr', paddingTop: '7px', rowGap: '8px' } },
  controlHint: { maxWidth: '185px', color: colors.textSubtle, fontSize: '9px', lineHeight: 1.5, '@media (max-width: 480px)': { gridColumn: '1 / -1', maxWidth: 'none', textAlign: 'center' } },
  transportControls: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '13px' },
  transportButton: { minWidth: '24px', minHeight: '28px', border: 0, background: 'transparent', color: colors.textMuted, fontSize: '13px', cursor: 'pointer', ':disabled': { color: colors.textSubtle, cursor: 'default', opacity: .4 } },
  playButton: { width: '37px', height: '37px', display: 'grid', placeItems: 'center', border: 0, borderRadius: '50%', backgroundColor: colors.accent, color: colors.background, cursor: 'pointer', ':disabled': { opacity: .5, cursor: 'default' } },
  volumeControl: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', color: colors.textSubtle },
  volumeRange: { width: '62px', height: '3px', accentColor: colors.accent, cursor: 'pointer' },
  sideColumn: { display: 'flex', flexDirection: 'column', gap: '18px' },
  queueCard: { minHeight: '250px', display: 'flex', flexDirection: 'column', padding: '19px', border: `1px solid ${colors.border}`, borderRadius: '13px', backgroundColor: colors.surface },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  queueTitle: { margin: '7px 0 0', fontFamily: 'Manrope, sans-serif', fontSize: '18px', letterSpacing: '-.5px' },
  queueTotal: { marginLeft: '5px', color: colors.textSubtle, fontFamily: 'DM Mono, monospace', fontSize: '11px', fontWeight: 400 },
  queueHeaderActions: { display: 'flex', alignItems: 'center', gap: '8px' },
  autoAdvanceControl: { display: 'flex', alignItems: 'center', gap: '6px', color: colors.textMuted, fontSize: '9px', whiteSpace: 'nowrap', cursor: 'pointer' },
  autoAdvanceCheckbox: { width: '13px', height: '13px', margin: 0, accentColor: colors.accent, cursor: 'pointer' },
  clearButton: { padding: '6px 8px', border: 0, borderRadius: '6px', backgroundColor: 'transparent', color: colors.textMuted, fontSize: '9px', cursor: 'pointer', ':hover': { backgroundColor: colors.surfaceHover, color: colors.text } },
  emptyQueue: { flex: 1, minHeight: '145px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '7px', textAlign: 'center' },
  emptyQueueIcon: { width: '42px', height: '42px', display: 'grid', placeItems: 'center', marginBottom: '5px', border: `1px solid ${colors.border}`, borderRadius: '12px', color: colors.textSubtle, backgroundColor: colors.surfaceRaised },
  emptyQueueTitle: { color: colors.text, fontSize: '12px', fontWeight: 600 },
  emptyQueueCopy: { maxWidth: '210px', color: colors.textSubtle, fontSize: '10px', lineHeight: 1.5 },
  queueList: { maxHeight: '300px', overflowY: 'auto', marginBlock: '12px' },
  queueRow: { minWidth: 0, minHeight: '49px', display: 'flex', alignItems: 'center', gap: '9px', borderBottom: `1px solid ${colors.border}` },
  queuePosition: { color: colors.textSubtle, fontFamily: 'DM Mono, monospace', fontSize: '9px' },
  queueItemText: { minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' },
  queueItemName: { overflow: 'hidden', color: colors.text, fontSize: '10px', fontWeight: 500, textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  queueItemPath: { overflow: 'hidden', color: colors.textSubtle, fontSize: '8px', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  queueActions: { display: 'flex', gap: '2px' },
  queueActionButton: { width: '25px', height: '25px', border: 0, borderRadius: '5px', background: 'transparent', color: colors.textMuted, fontSize: '14px', cursor: 'pointer', ':disabled': { color: colors.textSubtle, opacity: .35, cursor: 'default' }, ':hover': { backgroundColor: colors.surfaceHover } },
  moreQueue: { display: 'block', padding: '9px', color: colors.textSubtle, textAlign: 'center', fontSize: '9px' },
  addQueueButton: { height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: 0, borderRadius: '8px', backgroundColor: 'transparent', color: colors.accent, fontSize: '10px', cursor: 'pointer', ':hover': { backgroundColor: 'rgba(195, 243, 107, .08)' }, ':disabled': { color: colors.textSubtle, cursor: 'default' } },
  backgroundCard: { padding: '17px 19px 13px', border: `1px solid ${colors.border}`, borderRadius: '13px', backgroundColor: colors.surface },
  backgroundHidden: { display: 'none' },
  backgroundHeader: { display: 'flex', alignItems: 'center', gap: '10px' },
  backgroundIcon: { width: '34px', height: '34px', display: 'grid', placeItems: 'center', border: '1px solid #34343b', borderRadius: '9px', color: colors.amber, backgroundColor: '#25231f' },
  backgroundTitle: { margin: '4px 0 0', fontFamily: 'Manrope, sans-serif', fontSize: '13px', fontWeight: 700 },
  offPill: { marginLeft: 'auto', padding: '5px 7px', border: `1px solid ${colors.border}`, borderRadius: '5px', color: colors.textSubtle, fontFamily: 'DM Mono, monospace', fontSize: '8px', letterSpacing: '.5px' },
  onPill: { borderColor: '#485537', color: colors.accent },
  backgroundEmpty: { display: 'flex', flexDirection: 'column', gap: '6px', paddingBlock: '17px 14px', color: colors.textSubtle, fontSize: '10px' },
  backgroundTrack: { display: 'flex', alignItems: 'center', gap: '9px', paddingBlock: '13px 10px' },
  trackWave: { width: '29px', height: '29px', display: 'grid', placeItems: 'center', borderRadius: '7px', backgroundColor: '#25231f', color: colors.amber },
  backgroundTrackText: { minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' },
  backgroundTrackName: { overflow: 'hidden', color: colors.text, fontSize: '9px', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  backgroundTrackStatus: { color: colors.textSubtle, fontSize: '8px' },
  smallPlayButton: { width: '29px', height: '29px', display: 'grid', placeItems: 'center', border: 0, borderRadius: '50%', backgroundColor: 'transparent', color: colors.accent, cursor: 'pointer', ':hover': { backgroundColor: 'rgba(195, 243, 107, .1)' }, ':disabled': { opacity: .4, cursor: 'default' } },
  backgroundPlaylist: { maxHeight: '105px', overflowY: 'auto' },
  backgroundItem: { display: 'flex', alignItems: 'center', gap: '8px', minHeight: '29px', color: colors.textSubtle, fontFamily: 'DM Mono, monospace', fontSize: '8px' },
  backgroundItemActive: { color: colors.accent },
  backgroundItemName: { minWidth: 0, flex: 1, overflow: 'hidden', fontFamily: 'DM Sans, sans-serif', fontSize: '9px', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  removeBackgroundButton: { width: '23px', height: '23px', border: 0, background: 'transparent', color: colors.textSubtle, fontSize: '14px', cursor: 'pointer' },
  backgroundControls: { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '9px', paddingTop: '10px', borderTop: `1px solid ${colors.border}`, color: colors.textSubtle, fontSize: '9px' },
  loopControl: { display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' },
  loopCheckbox: { width: '12px', height: '12px', margin: 0, accentColor: colors.accent },
  levelControl: { display: 'flex', alignItems: 'center', gap: '6px' },
  levelRange: { width: '55px', height: '3px', accentColor: colors.accent, cursor: 'pointer' },
  fadeSettings: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '10px' },
  fadeControl: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px', color: colors.textSubtle, fontSize: '8px' },
  fadeHeading: { display: 'flex', justifyContent: 'space-between', gap: '5px' },
  fadeRange: { width: '100%', height: '3px', accentColor: colors.accent, cursor: 'pointer' },
  hiddenMedia: { display: 'none' },
});
