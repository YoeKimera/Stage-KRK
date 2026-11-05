import { useCallback, useRef, useState, type ReactNode } from 'react';
import * as stylex from '@stylexjs/stylex';
import { colors, space } from './styles/tokens.stylex';
import { LibraryExplorer } from './features/library/LibraryExplorer';
import { PlaybackDashboard } from './components/PlaybackDashboard';
import { usePlaybackController } from './features/audio/usePlaybackController';
import { SecondaryDisplay } from './features/display/SecondaryDisplay';
import { useSecondaryDisplay } from './features/display/useSecondaryDisplay';
import { YouTubeSearchPanel } from './features/youtube/YouTubeSearchPanel';

type IconName =
  | 'audio'
  | 'chevron'
  | 'display'
  | 'folder'
  | 'headphones'
  | 'info'
  | 'music'
  | 'play'
  | 'queue'
  | 'settings'
  | 'spark'
  | 'video';

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };

  const paths: Record<IconName, ReactNode> = {
    audio: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    display: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
    folder: <><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>,
    headphones: <><path d="M3 14v-3a9 9 0 0 1 18 0v3" /><path d="M5 14h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2Zm12 0h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2Z" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
    music: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
    play: <path d="m8 5 12 7-12 7z" fill="currentColor" stroke="none" />,
    queue: <><path d="M4 6h16M4 12h10M4 18h10" /><path d="m18 16 3 2-3 2z" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.5.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.8l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.5-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.5.9l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1-.1 1.7Z" transform="translate(-1 -1)" /></>,
    spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" /></>,
    video: <><rect x="3" y="5" width="13" height="14" rx="2" /><path d="m16 10 5-3v10l-5-3z" /></>,
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function App() {
  return new URLSearchParams(window.location.search).get('display') === '1'
    ? <SecondaryDisplay />
    : <MainApp />;
}

function MainApp() {
  const [activeTab, setActiveTab] = useState<'overview' | 'library' | 'queue' | 'youtube'>('overview');
  const [folderStatus, setFolderStatus] = useState('Sin conectar');
  const backgroundImageInput = useRef<HTMLInputElement>(null);
  const handleFolderStatusChange = useCallback((status: string) => setFolderStatus(status), []);
  const playback = usePlaybackController();
  const secondaryDisplay = useSecondaryDisplay(playback);

  const playKaraoke = useCallback((media: Parameters<typeof playback.playNow>[0]) => {
    setActiveTab('overview');
    playback.playNow(media);
  }, [playback.playNow]);
  const playYouTube = useCallback((video: Parameters<typeof playback.playYouTubeNow>[0]) => {
    setActiveTab('overview');
    playback.playYouTubeNow(video);
  }, [playback.playYouTubeNow]);

  const tabs = [
    { id: 'overview' as const, label: 'Consola', icon: 'audio' as const },
    { id: 'library' as const, label: 'Biblioteca', icon: 'folder' as const },
    { id: 'queue' as const, label: 'Cola', icon: 'queue' as const },
    { id: 'youtube' as const, label: 'YouTube', icon: 'video' as const },
  ];

  return (
    <div {...stylex.props(styles.app)}>
      <header {...stylex.props(styles.topbar)}>
        <div {...stylex.props(styles.topbarInner)}>
          <a {...stylex.props(styles.brand)} href="#" aria-label="Stage, inicio">
            <span {...stylex.props(styles.brandMark)}><Icon name="spark" size={21} /></span>
            <span {...stylex.props(styles.brandName)}>stage<span {...stylex.props(styles.brandDot)}>.</span></span>
            <span {...stylex.props(styles.brandDivider)} />
            <span {...stylex.props(styles.brandCaption)}>KARAOKE CONSOLE</span>
          </a>

          <nav {...stylex.props(styles.nav)} aria-label="Secciones principales">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                data-library-tab={tab.id === 'library' ? true : undefined}
                {...stylex.props(styles.navButton, activeTab === tab.id && styles.navButtonActive)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon name={tab.icon} size={16} />
                {tab.label}
                {tab.id === 'queue' && <span {...stylex.props(styles.navCount)}>{playback.queue.length}</span>}
              </button>
            ))}
          </nav>

          <div {...stylex.props(styles.topbarRight)}>
            <span {...stylex.props(styles.demoPill)}><span {...stylex.props(styles.demoDot)} />MODO LOCAL</span>
            <button type="button" {...stylex.props(styles.iconButton)} disabled aria-label="Configuración disponible próximamente" title="Disponible próximamente">
              <Icon name="settings" size={18} />
            </button>
            <span {...stylex.props(styles.avatar)}>S</span>
          </div>
        </div>
      </header>

      <main {...stylex.props(styles.main)}>
        <section {...stylex.props(styles.pageHeading)}>
          <div>
            <p {...stylex.props(styles.eyebrow)}>MODO CABINA · SESIÓN LOCAL</p>
            <h1 {...stylex.props(styles.pageTitle)}>
              {activeTab === 'overview'
                ? 'Tu escenario, listo.'
                : activeTab === 'library'
                  ? 'Biblioteca'
                  : activeTab === 'queue' ? 'Cola de reproducción' : 'Búsqueda en YouTube'}
            </h1>
            <p {...stylex.props(styles.pageSubtitle)}>
              {activeTab === 'overview'
                ? 'Todo en orden para que la noche siga sonando.'
                : activeTab === 'library'
                  ? 'Explora música y videos en las carpetas que autorizas.'
                  : activeTab === 'queue'
                    ? 'Organiza las próximas canciones de la sesión.'
                    : 'Busca videos y consulta sus metadatos públicos.'}
            </p>
          </div>
          <div {...stylex.props(styles.headingActions)}>
            <div {...stylex.props(styles.folderStatus)}>
              <span {...stylex.props(styles.statusIcon)}><Icon name="folder" size={16} /></span>
              <span {...stylex.props(styles.folderStatusText)}>
                <strong {...stylex.props(styles.folderStatusName)}>Carpetas locales</strong>
                <small {...stylex.props(styles.folderStatusState)}>{folderStatus}</small>
              </span>
              <span {...stylex.props(styles.statusDot, folderStatus.includes('activa') || folderStatus.includes('activas') ? styles.statusDotActive : null)} />
            </div>
            <input
              ref={backgroundImageInput}
              type="file"
              accept="image/*"
              hidden
              aria-label="Seleccionar imagen para la segunda pantalla"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) secondaryDisplay.chooseBackgroundImage(file);
                event.currentTarget.value = '';
              }}
            />
            <button
              type="button"
              {...stylex.props(styles.secondaryButton)}
              onClick={() => backgroundImageInput.current?.click()}
              title={secondaryDisplay.backgroundImageName ?? 'Elegir imagen de fondo para la segunda pantalla'}
              aria-label={secondaryDisplay.backgroundImageName
                ? `Cambiar imagen de fondo: ${secondaryDisplay.backgroundImageName}`
                : 'Elegir imagen de fondo para la segunda pantalla'}
            >
              {secondaryDisplay.backgroundImageName ? 'Cambiar fondo' : 'Imagen de fondo'}
            </button>
            {secondaryDisplay.backgroundImageName && (
              <button
                type="button"
                {...stylex.props(styles.removeBackgroundImageButton)}
                onClick={() => secondaryDisplay.chooseBackgroundImage(undefined)}
                aria-label="Quitar imagen de fondo de la segunda pantalla"
                title="Quitar imagen de fondo"
              >
                ×
              </button>
            )}
            <button
              type="button"
              {...stylex.props(styles.secondaryButton, secondaryDisplay.connected && styles.secondaryButtonConnected)}
              disabled={!secondaryDisplay.supported}
              onClick={secondaryDisplay.open}
              aria-label={secondaryDisplay.connected ? 'Enfocar segunda pantalla conectada' : 'Abrir segunda pantalla'}
              title={secondaryDisplay.connected ? 'Segunda pantalla conectada' : 'Abrir la pantalla de video en otra ventana'}
            >
              <Icon name="display" size={16} />
              {secondaryDisplay.connected ? 'Pantalla conectada' : secondaryDisplay.opened ? 'Conectando…' : 'Segunda pantalla'}
            </button>
          </div>
        </section>

        {secondaryDisplay.error && <p role="alert" {...stylex.props(styles.displayError)}>{secondaryDisplay.error}</p>}

        {activeTab === 'youtube' && <YouTubeSearchPanel onPlayNow={playYouTube} onAddToQueue={playback.addYouTubeToQueue} />}

        <div hidden={activeTab === 'library' || activeTab === 'youtube'}>
          <PlaybackDashboard
            controller={playback}
            view={activeTab === 'queue' ? 'queue' : 'overview'}
            onOpenLibrary={() => setActiveTab('library')}
          />
        </div>

        <div hidden={activeTab === 'queue' || activeTab === 'youtube'}>
          <LibraryExplorer
            compact={activeTab !== 'library'}
            onStatusChange={handleFolderStatusChange}
            onOpenLibrary={() => setActiveTab('library')}
            onPlayKaraoke={playKaraoke}
            onQueueKaraoke={playback.addToQueue}
            onAddBackground={playback.addToBackground}
          />
        </div>

        <footer {...stylex.props(styles.footer)}>
          <span {...stylex.props(styles.footerBrand)}><span {...stylex.props(styles.footerMark)}><Icon name="spark" size={13} /></span> STAGE <span {...stylex.props(styles.footerDivider)} /> KARAOKE CONSOLE</span>
          <span>Los archivos permanecen en tu dispositivo.</span>
        </footer>
      </main>
    </div>
  );
}

const styles = stylex.create({
  app: { minHeight: '100vh', backgroundColor: colors.background, color: colors.text },
  topbar: { height: space.headerHeight, borderBottom: `1px solid ${colors.border}`, backgroundColor: 'rgba(16, 17, 22, 0.94)', '@media (max-width: 760px)': { height: 'auto' } },
  topbarInner: { maxWidth: space.pageMax, height: '100%', marginInline: 'auto', paddingInline: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '28px', '@media (max-width: 1050px)': { paddingInline: '24px', gap: '14px' }, '@media (max-width: 760px)': { display: 'grid', gridTemplateColumns: '1fr auto', height: 'auto', padding: '12px 16px', gap: '12px' } },
  brand: { display: 'flex', alignItems: 'center', gap: '11px', color: colors.text, textDecoration: 'none', minWidth: '250px', '@media (max-width: 1050px)': { minWidth: '205px', gap: '8px' }, '@media (max-width: 760px)': { minWidth: 0 } },
  brandMark: { width: '34px', height: '34px', borderRadius: '11px', display: 'grid', placeItems: 'center', color: colors.background, backgroundColor: colors.accent },
  brandName: { fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '22px', letterSpacing: '-1.5px' },
  brandDot: { color: colors.accent },
  brandDivider: { height: '20px', width: '1px', backgroundColor: colors.border, marginInline: '4px' },
  brandCaption: { fontFamily: 'DM Mono, monospace', color: colors.textSubtle, fontSize: '9px', letterSpacing: '1.1px' },
  nav: { display: 'flex', alignItems: 'center', gap: '5px', height: '100%', '@media (max-width: 760px)': { gridColumn: '1 / -1', height: '38px', justifyContent: 'space-between' } },
  navButton: { height: '38px', paddingInline: '14px', display: 'flex', alignItems: 'center', gap: '9px', border: '1px solid transparent', borderRadius: '8px', backgroundColor: 'transparent', color: colors.textMuted, fontSize: '13px', fontWeight: 600, cursor: 'pointer', ':hover': { backgroundColor: colors.surfaceHover, color: colors.text }, '@media (max-width: 760px)': { flex: 1, justifyContent: 'center', paddingInline: '8px', fontSize: '11px' } },
  navButtonActive: { backgroundColor: 'rgba(195, 243, 107, .08)', borderColor: 'transparent', color: colors.accent },
  navCount: { minWidth: '20px', height: '20px', display: 'grid', placeItems: 'center', borderRadius: '6px', backgroundColor: colors.surfaceHover, color: colors.textMuted, fontFamily: 'DM Mono, monospace', fontSize: '10px' },
  topbarRight: { minWidth: '250px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '14px', '@media (max-width: 1050px)': { minWidth: '205px', gap: '8px' }, '@media (max-width: 760px)': { minWidth: 0, gap: '8px' } },
  demoPill: { display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 10px', border: `1px solid ${colors.border}`, borderRadius: '20px', color: colors.textMuted, fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '.5px' },
  demoDot: { width: '6px', height: '6px', borderRadius: '50%', backgroundColor: colors.amber },
  iconButton: { width: '35px', height: '35px', display: 'grid', placeItems: 'center', border: `1px solid ${colors.border}`, borderRadius: '9px', backgroundColor: colors.surface, color: colors.textMuted, opacity: .48 },
  avatar: { width: '33px', height: '33px', display: 'grid', placeItems: 'center', borderRadius: '50%', backgroundColor: '#373a45', color: colors.text, fontSize: '12px', fontWeight: 700 },
  main: { maxWidth: space.pageMax, marginInline: 'auto', padding: '40px 40px 25px', '@media (max-width: 1050px)': { padding: '30px 24px 22px' }, '@media (max-width: 760px)': { padding: '25px 16px 20px' } },
  pageHeading: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '25px', marginBottom: '25px', '@media (max-width: 760px)': { flexDirection: 'column', alignItems: 'stretch', gap: '18px' } },
  eyebrow: { margin: '0 0 10px', color: colors.accent, fontFamily: 'DM Mono, monospace', fontSize: '10px', letterSpacing: '1.5px' },
  pageTitle: { margin: 0, fontFamily: 'Manrope, sans-serif', fontSize: '34px', fontWeight: 700, letterSpacing: '-1.4px', lineHeight: 1.2, '@media (max-width: 760px)': { fontSize: '29px' } },
  pageSubtitle: { margin: '8px 0 0', color: colors.textMuted, fontSize: '14px' },
  headingActions: { display: 'flex', alignItems: 'center', gap: '10px', '@media (max-width: 760px)': { width: '100%' } },
  folderStatus: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', border: `1px solid ${colors.border}`, borderRadius: '9px', backgroundColor: colors.surface, '@media (max-width: 760px)': { flex: 1 } },
  folderStatusText: { display: 'flex', flexDirection: 'column', gap: '2px' },
  folderStatusName: { color: colors.text, fontSize: '10px', fontWeight: 600 },
  folderStatusState: { color: colors.textMuted, fontSize: '9px' },
  statusIcon: { color: colors.textMuted, display: 'grid', placeItems: 'center' },
  statusDot: { width: '6px', height: '6px', borderRadius: '50%', backgroundColor: colors.textSubtle, marginLeft: '5px' },
  statusDotActive: { backgroundColor: colors.accent },
  secondaryButton: { height: '39px', display: 'flex', alignItems: 'center', gap: '8px', paddingInline: '12px', border: 0, borderRadius: '9px', backgroundColor: 'transparent', color: colors.textMuted, fontSize: '12px', cursor: 'pointer', ':hover': { backgroundColor: colors.surfaceHover, color: colors.text }, ':disabled': { opacity: .48, cursor: 'default' } },
  secondaryButtonConnected: { color: colors.accent },
  removeBackgroundImageButton: { width: '34px', height: '39px', border: 0, borderRadius: '9px', backgroundColor: 'transparent', color: colors.textMuted, fontSize: '18px', cursor: 'pointer', ':hover': { backgroundColor: 'rgba(255, 119, 119, .1)', color: colors.danger } },
  displayError: { margin: '-8px 0 16px', padding: '9px 12px', border: '1px solid #553538', borderRadius: '7px', backgroundColor: '#2a1e21', color: '#ffaaaa', fontSize: '11px', lineHeight: 1.5 },
  dashboardGrid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.65fr) minmax(310px, .85fr)', gap: '18px', '@media (max-width: 1000px)': { gridTemplateColumns: 'minmax(0, 1.35fr) minmax(270px, .9fr)', gap: '13px' }, '@media (max-width: 760px)': { gridTemplateColumns: 'minmax(0, 1fr)' } },
  queueOnly: { gridTemplateColumns: 'minmax(0, 1fr)' },
  queueSideColumn: { maxWidth: '600px' },
  playerCard: { minWidth: 0, padding: '19px', border: `1px solid ${colors.border}`, borderRadius: '13px', backgroundColor: colors.surface, overflow: 'hidden' },
  cardTopline: { height: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  sectionLabel: { color: colors.textSubtle, fontFamily: 'DM Mono, monospace', fontSize: '9px', fontWeight: 500, letterSpacing: '1.1px' },
  liveIndicator: { display: 'inline-block', width: '6px', height: '6px', marginRight: '7px', borderRadius: '50%', backgroundColor: colors.textSubtle, verticalAlign: '1px' },
  sourceTag: { display: 'flex', alignItems: 'center', gap: '6px', color: colors.blue, fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '.6px' },
  playerVisual: { height: '218px', position: 'relative', display: 'grid', placeItems: 'center', marginTop: '3px', overflow: 'hidden', border: `1px solid ${colors.border}`, borderRadius: '9px', background: 'radial-gradient(ellipse at 50% 52%, #252a33 0%, #1c1e25 39%, #17191f 76%)' },
  visualGlow: { position: 'absolute', width: '190px', height: '190px', borderRadius: '50%', backgroundColor: '#a8d75c', opacity: .055, filter: 'blur(35px)' },
  visualRing: { position: 'absolute', border: '1px solid rgba(195, 243, 107, .11)', borderRadius: '50%' },
  ringOuter: { width: '180px', height: '180px' },
  ringMiddle: { width: '137px', height: '137px', borderColor: 'rgba(195, 243, 107, .16)' },
  visualDisc: { width: '88px', height: '88px', display: 'grid', placeItems: 'center', border: '1px solid rgba(195, 243, 107, .28)', borderRadius: '50%', background: 'linear-gradient(145deg, #30363a, #202329)', color: colors.accent },
  visualNote: { position: 'absolute', color: colors.accent, fontFamily: 'Manrope, sans-serif', opacity: .65 },
  noteOne: { top: '59px', left: 'calc(50% - 112px)', fontSize: '20px' },
  noteTwo: { top: '106px', right: 'calc(50% - 129px)', fontSize: '26px' },
  noteThree: { bottom: '48px', left: 'calc(50% - 89px)', fontSize: '15px' },
  visualLabel: { position: 'absolute', bottom: '17px', color: colors.textSubtle, fontFamily: 'DM Mono, monospace', fontSize: '8px', letterSpacing: '1.8px' },
  visualCorner: { position: 'absolute', top: '13px', width: '10px', height: '10px', borderTop: `1px solid ${colors.textSubtle}`, opacity: .55 },
  cornerLeft: { left: '13px', borderLeft: `1px solid ${colors.textSubtle}` },
  cornerRight: { right: '13px', borderRight: `1px solid ${colors.textSubtle}` },
  trackInfo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px', padding: '19px 2px 16px', '@media (max-width: 480px)': { alignItems: 'flex-start', flexDirection: 'column' } },
  trackOverline: { color: colors.textSubtle, fontFamily: 'DM Mono, monospace', fontSize: '8px', letterSpacing: '.9px' },
  trackTitle: { margin: '5px 0 3px', fontFamily: 'Manrope, sans-serif', fontSize: '17px', fontWeight: 700, letterSpacing: '-.3px' },
  trackSubtitle: { margin: 0, color: colors.textMuted, fontSize: '11px' },
  primaryButton: { height: '38px', display: 'flex', alignItems: 'center', gap: '8px', paddingInline: '12px', border: 0, borderRadius: '8px', backgroundColor: colors.accent, color: '#171a13', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', opacity: .48 },
  progressArea: { paddingInline: '2px' },
  progressTrack: { height: '3px', borderRadius: '3px', backgroundColor: colors.surfaceHover },
  progressFill: { display: 'block', width: '0%', height: '100%', borderRadius: '3px', backgroundColor: colors.accent },
  timeRow: { display: 'flex', justifyContent: 'space-between', marginTop: '7px', color: colors.textSubtle, fontFamily: 'DM Mono, monospace', fontSize: '9px' },
  playerControls: { minHeight: '51px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center', borderTop: `1px solid ${colors.border}`, marginTop: '7px', '@media (max-width: 480px)': { gridTemplateColumns: '1fr 1fr', paddingTop: '7px', rowGap: '8px' } },
  controlHint: { maxWidth: '185px', color: colors.textSubtle, fontSize: '9px', lineHeight: 1.5, '@media (max-width: 480px)': { gridColumn: '1 / -1', maxWidth: 'none', textAlign: 'center' } },
  transportControls: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px' },
  transportButton: { border: 0, background: 'transparent', color: colors.textSubtle, fontSize: '12px', opacity: .45 },
  playButton: { width: '37px', height: '37px', display: 'grid', placeItems: 'center', border: 0, borderRadius: '50%', backgroundColor: colors.accent, color: colors.background, opacity: .5 },
  masterVolume: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '9px', color: colors.textSubtle, fontFamily: 'DM Mono, monospace', fontSize: '9px', '@media (max-width: 480px)': { display: 'none' } },
  volumeTrack: { width: '61px', height: '3px', borderRadius: '2px', backgroundColor: colors.surfaceHover },
  volumeFill: { display: 'block', width: '0%', height: '100%', borderRadius: '2px', backgroundColor: colors.textSubtle },
  sideColumn: { display: 'flex', flexDirection: 'column', gap: '18px' },
  queueCard: { flex: 1, minHeight: '299px', display: 'flex', flexDirection: 'column', padding: '19px', border: `1px solid ${colors.border}`, borderRadius: '13px', backgroundColor: colors.surface },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  queueTitle: { margin: '7px 0 0', fontFamily: 'Manrope, sans-serif', fontSize: '18px', letterSpacing: '-.5px' },
  queueTotal: { marginLeft: '5px', color: colors.textSubtle, fontFamily: 'DM Mono, monospace', fontSize: '11px', fontWeight: 400 },
  subtleIconButton: { width: '29px', height: '29px', border: `1px solid ${colors.border}`, borderRadius: '7px', backgroundColor: colors.surfaceRaised, color: colors.textMuted, fontSize: '17px', lineHeight: 1, opacity: .5 },
  emptyQueue: { flex: 1, minHeight: '155px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '7px', textAlign: 'center' },
  emptyQueueIcon: { width: '42px', height: '42px', display: 'grid', placeItems: 'center', marginBottom: '5px', border: `1px solid ${colors.border}`, borderRadius: '12px', color: colors.textSubtle, backgroundColor: colors.surfaceRaised },
  emptyQueueTitle: { color: colors.text, fontSize: '12px', fontWeight: 600 },
  emptyQueueCopy: { maxWidth: '190px', color: colors.textSubtle, fontSize: '10px', lineHeight: 1.5 },
  addQueueButton: { height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: `1px dashed #3b3e47`, borderRadius: '7px', backgroundColor: 'transparent', color: colors.textMuted, fontSize: '10px', opacity: .5 },
  addQueuePlus: { fontSize: '16px', lineHeight: 1, color: colors.textMuted },
  backgroundCard: { padding: '17px 19px 13px', border: `1px solid ${colors.border}`, borderRadius: '13px', backgroundColor: colors.surface },
  backgroundHeader: { display: 'flex', alignItems: 'center', gap: '10px' },
  backgroundIcon: { width: '34px', height: '34px', display: 'grid', placeItems: 'center', border: '1px solid #34343b', borderRadius: '9px', color: colors.amber, backgroundColor: '#25231f' },
  backgroundTitle: { margin: '4px 0 0', fontFamily: 'Manrope, sans-serif', fontSize: '13px', fontWeight: 700 },
  offPill: { marginLeft: 'auto', padding: '5px 7px', border: `1px solid ${colors.border}`, borderRadius: '5px', color: colors.textSubtle, fontFamily: 'DM Mono, monospace', fontSize: '8px', letterSpacing: '.5px' },
  backgroundEmpty: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', paddingBlock: '17px 14px', color: colors.textSubtle, fontSize: '10px' },
  textButton: { display: 'flex', alignItems: 'center', gap: '3px', border: 0, background: 'transparent', color: colors.textMuted, fontSize: '9px', opacity: .55 },
  backgroundFooter: { display: 'flex', justifyContent: 'space-between', paddingTop: '10px', borderTop: `1px solid ${colors.border}`, color: colors.textSubtle, fontSize: '9px' },
  fadeStatus: { display: 'flex', alignItems: 'center', gap: '6px' },
  miniDot: { display: 'inline-block', width: '5px', height: '5px', marginRight: '4px', borderRadius: '50%', backgroundColor: colors.textSubtle, verticalAlign: '1px' },
  monoLabel: { fontFamily: 'DM Mono, monospace', fontSize: '8px', letterSpacing: '.6px' },
  librarySection: { marginTop: '30px' },
  libraryHeading: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '13px' },
  libraryTitle: { margin: '5px 0 0', fontFamily: 'Manrope, sans-serif', fontSize: '18px', letterSpacing: '-.5px' },
  viewAllButton: { display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 0', border: 0, background: 'transparent', color: colors.textMuted, fontSize: '10px', opacity: .55 },
  libraryEmpty: { display: 'flex', alignItems: 'center', gap: '13px', minHeight: '75px', padding: '15px 17px', border: `1px solid ${colors.border}`, borderRadius: '11px', backgroundColor: colors.surface },
  libraryEmptyIcon: { width: '40px', height: '40px', flex: '0 0 auto', display: 'grid', placeItems: 'center', border: `1px solid ${colors.border}`, borderRadius: '10px', color: colors.textMuted, backgroundColor: colors.surfaceRaised },
  libraryEmptyTitle: { color: colors.text, fontSize: '11px', fontWeight: 600 },
  libraryEmptyCopy: { maxWidth: '600px', margin: '5px 0 0', color: colors.textSubtle, fontSize: '10px', lineHeight: 1.5 },
  localOnlyBadge: { marginLeft: 'auto', padding: '6px 8px', border: `1px solid ${colors.border}`, borderRadius: '5px', color: colors.textSubtle, fontFamily: 'DM Mono, monospace', fontSize: '8px', letterSpacing: '.7px', whiteSpace: 'nowrap' },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '28px', paddingTop: '15px', borderTop: `1px solid ${colors.border}`, color: colors.textSubtle, fontFamily: 'DM Mono, monospace', fontSize: '8px', letterSpacing: '.4px', '@media (max-width: 480px)': { gap: '12px', alignItems: 'flex-start', flexDirection: 'column' } },
  footerBrand: { display: 'flex', alignItems: 'center', gap: '6px' },
  footerMark: { display: 'inline-flex', color: colors.accent, verticalAlign: '-3px' },
  footerDivider: { display: 'inline-block', height: '11px', width: '1px', marginInline: '4px', backgroundColor: colors.border, verticalAlign: '-2px' },
});

export default App;
