import { useEffect, useRef, useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { DISPLAY_CHANNEL_PREFIX, type DisplayMessage, type DisplaySnapshot } from './displayChannel';
import { YouTubeEmbed } from '../youtube/YouTubeEmbed';

function isDisplayMessage(value: unknown): value is DisplayMessage {
  return typeof value === 'object' && value !== null && 'type' in value
    && ((value as { type: unknown }).type === 'snapshot'
      || (value as { type: unknown }).type === 'ready'
      || (value as { type: unknown }).type === 'display-error');
}

export function SecondaryDisplay() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const objectUrlRef = useRef<string | undefined>(undefined);
  const sourceIdRef = useRef<string | undefined>(undefined);
  const latestSnapshot = useRef<DisplaySnapshot | undefined>(undefined);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const [title, setTitle] = useState('');
  const [hasVideo, setHasVideo] = useState(false);
  const [hasYouTubeVideo, setHasYouTubeVideo] = useState(false);
  const [youtubeSnapshot, setYouTubeSnapshot] = useState<DisplaySnapshot>();
  const [channelError, setChannelError] = useState('');
  const sessionId = new URLSearchParams(window.location.search).get('displaySession');

  useEffect(() => {
    if (!sessionId || !('BroadcastChannel' in window)) {
      setChannelError('No se pudo conectar con la consola principal. Cierra esta ventana y vuelve a abrirla desde Stage.');
      return;
    }

    const channel = new BroadcastChannel(`${DISPLAY_CHANNEL_PREFIX}${sessionId}`);
    channelRef.current = channel;
    document.title = 'Stage — Segunda pantalla';
    const postError = (message: string) => channel.postMessage({ type: 'display-error', message } satisfies DisplayMessage);
    const synchronizePlayback = (snapshot: DisplaySnapshot) => {
      const video = videoRef.current;
      if (!video || !snapshot.file) return;
      if (!video.paused && snapshot.status !== 'playing') video.pause();
      if (snapshot.status === 'playing' && video.paused) {
        void video.play().catch(() => postError('El navegador bloqueó la reproducción en la segunda pantalla.'));
      }
      if (Number.isFinite(snapshot.currentTime) && Math.abs(video.currentTime - snapshot.currentTime) > 1.5) {
        try {
          video.currentTime = snapshot.currentTime;
        } catch {
          latestSnapshot.current = snapshot;
        }
      }
      if (snapshot.status === 'paused' || snapshot.status === 'idle') video.pause();
    };

    const handleMessage = (event: MessageEvent<unknown>) => {
      if (!isDisplayMessage(event.data)) return;
      if (event.data.type === 'snapshot') {
        latestSnapshot.current = event.data;
        setTitle(event.data.title ?? '');
        const sourceId = event.data.sourceId ?? event.data.mediaId;
        if (event.data.youtubeVideoId) {
          setYouTubeSnapshot(event.data);
          if (sourceId !== sourceIdRef.current) {
            setChannelError('');
            videoRef.current?.pause();
            videoRef.current?.removeAttribute('src');
            videoRef.current?.load();
            if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = undefined;
            sourceIdRef.current = sourceId;
          }
          setHasVideo(false);
          setHasYouTubeVideo(true);
          return;
        }
        setYouTubeSnapshot(undefined);
        if (event.data.file && sourceId !== sourceIdRef.current) {
          setChannelError('');
          setHasYouTubeVideo(false);
          if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
          const url = URL.createObjectURL(event.data.file);
          objectUrlRef.current = url;
          sourceIdRef.current = sourceId;
          setHasVideo(true);
          const video = videoRef.current;
          if (video) {
            video.src = url;
            video.load();
          }
          return;
        }
        if (!event.data.file && sourceId !== sourceIdRef.current) {
          setChannelError('');
          setHasYouTubeVideo(false);
          if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.removeAttribute('src');
            videoRef.current.load();
          }
          if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = undefined;
          sourceIdRef.current = undefined;
          setHasVideo(false);
          return;
        }
        synchronizePlayback(event.data);
      } else if (event.data.type === 'display-error') {
        setChannelError(event.data.message);
      }
    };

    channel.addEventListener('message', handleMessage);
    channel.postMessage({ type: 'ready' } satisfies DisplayMessage);
    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
      channelRef.current = null;
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, [sessionId]);

  const enterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch (error) {
      setChannelError(error instanceof Error ? `No se pudo activar pantalla completa: ${error.message}` : 'No se pudo activar pantalla completa.');
    }
  };
  const reportYouTubeError = (message: string) => {
    setChannelError(message);
    channelRef.current?.postMessage({ type: 'display-error', message } satisfies DisplayMessage);
  };

  return (
    <main {...stylex.props(styles.screen)}>
      <video
        ref={videoRef}
        hidden={!hasVideo}
        muted
        playsInline
        onLoadedMetadata={() => {
          const video = videoRef.current;
          const snapshot = latestSnapshot.current;
          if (!video || !snapshot) return;
          if (Number.isFinite(snapshot.currentTime)) {
            try {
              video.currentTime = Math.min(Math.max(snapshot.currentTime, 0), video.duration || snapshot.currentTime);
            } catch {
              latestSnapshot.current = snapshot;
            }
          }
          if (snapshot.status === 'playing') {
            void video.play().catch(() => setChannelError('El navegador bloqueó la reproducción en la segunda pantalla.'));
          }
        }}
        onError={() => {
          if (videoRef.current?.currentSrc) setChannelError('No se pudo decodificar el video en la segunda pantalla.');
        }}
        {...stylex.props(styles.video, hasVideo && styles.visibleVideo)}
      />
      {hasYouTubeVideo && youtubeSnapshot?.youtubeVideoId && (
        <YouTubeEmbed
          videoId={youtubeSnapshot.youtubeVideoId}
          active
          muted
          volume={0}
          mirrorStatus={youtubeSnapshot.status}
          mirrorTime={youtubeSnapshot.currentTime}
          onError={reportYouTubeError}
          onAutoplayBlocked={() => reportYouTubeError('El navegador bloqueó la reproducción de YouTube en la segunda pantalla.')}
        />
      )}
      {!hasVideo && !hasYouTubeVideo && (
        <div {...stylex.props(styles.waiting)}>
          <span {...stylex.props(styles.brand)}>STAGE</span>
          <span {...stylex.props(styles.note)}>♫</span>
          <h1 {...stylex.props(styles.waitingHeading)}>{title || 'El escenario está listo'}</h1>
          <p {...stylex.props(styles.waitingCopy)}>{title ? 'Preparando el video…' : 'La próxima canción aparecerá aquí.'}</p>
        </div>
      )}
      {hasVideo && title && <div {...stylex.props(styles.title)}>{title}</div>}
      {channelError && <p role="alert" {...stylex.props(styles.error)}>{channelError}</p>}
      <button type="button" onClick={() => void enterFullscreen()} {...stylex.props(styles.fullscreenButton)}>
        Pantalla completa
      </button>
    </main>
  );
}

const styles = stylex.create({
  screen: { width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', backgroundColor: '#08090b', color: '#f5f4f1' },
  video: { width: '100%', height: '100%', display: 'none', objectFit: 'contain', backgroundColor: '#08090b' },
  visibleVideo: { display: 'block' },
  waiting: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '14px', background: 'radial-gradient(ellipse at 50% 50%, #252a33 0%, #17191f 70%)', textAlign: 'center' },
  brand: { color: '#c3f36b', fontFamily: 'DM Mono, monospace', fontSize: '12px', letterSpacing: '5px' },
  note: { color: '#c3f36b', fontSize: '58px', opacity: .8 },
  waitingHeading: { margin: 0, fontFamily: 'Manrope, sans-serif', fontSize: 'clamp(24px, 5vw, 52px)' },
  waitingCopy: { margin: 0, color: '#a5a6ad', fontSize: 'clamp(14px, 2vw, 20px)' },
  title: { position: 'absolute', right: '22px', bottom: '20px', left: '22px', overflow: 'hidden', padding: '12px 16px', borderRadius: '8px', backgroundColor: 'rgba(0, 0, 0, .62)', fontSize: 'clamp(14px, 2vw, 24px)', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  error: { position: 'absolute', top: '16px', left: '16px', maxWidth: 'min(600px, calc(100% - 32px))', padding: '10px 14px', borderRadius: '7px', backgroundColor: '#431f25', color: '#ffb0b0', fontSize: '14px' },
  fullscreenButton: { position: 'absolute', top: '16px', right: '16px', padding: '10px 14px', border: '1px solid rgba(255,255,255,.2)', borderRadius: '7px', backgroundColor: 'rgba(0,0,0,.55)', color: '#fff', cursor: 'pointer' },
});
