import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import * as stylex from '@stylexjs/stylex';
import { colors } from '../../styles/tokens.stylex';
import { loadDirectoryHandles, saveDirectoryHandle } from '../../persistence/handlesRepository';
import { createMediaFile, listDirectory } from './fileIndex';
import type {
  DirectoryLevel,
  DirectoryListing,
  FolderAccess,
  LibraryKind,
  LibraryMediaFile,
  MediaKind,
  PermissionState,
} from './library.types';

interface LibraryExplorerProps {
  compact: boolean;
  onStatusChange: (status: string) => void;
  onOpenLibrary: () => void;
  onPlayKaraoke: (media: LibraryMediaFile) => void;
  onQueueKaraoke: (media: LibraryMediaFile) => void;
  onAddBackground: (media: LibraryMediaFile) => void;
}

type MediaFilter = 'all' | MediaKind;

const initialFolders: Record<LibraryKind, FolderAccess> = {
  music: { permission: 'prompt' },
  karaoke: { permission: 'prompt' },
};

function getErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'El navegador no concedió acceso a esta carpeta. Puedes volver a intentarlo.';
  }
  if (error instanceof DOMException && error.name === 'SecurityError') {
    return 'El acceso a archivos locales requiere HTTPS o localhost y una acción directa del usuario.';
  }
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error inesperado al acceder a la carpeta.';
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function permissionText(permission: PermissionState): string {
  if (permission === 'granted') return 'Acceso disponible';
  if (permission === 'denied') return 'Permiso denegado';
  return 'Necesita autorización';
}

function FolderIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>;
}

function MediaIcon({ kind }: { kind: MediaKind }) {
  return kind === 'audio'
    ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
    : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="13" height="14" rx="2" /><path d="m16 10 5-3v10l-5-3z" /></svg>;
}

export function LibraryExplorer({
  compact,
  onStatusChange,
  onOpenLibrary,
  onPlayKaraoke,
  onQueueKaraoke,
  onAddBackground,
}: LibraryExplorerProps) {
  const [folders, setFolders] = useState(initialFolders);
  const [activeKind, setActiveKind] = useState<LibraryKind>('karaoke');
  const [levels, setLevels] = useState<Record<LibraryKind, DirectoryLevel[]>>({ music: [], karaoke: [] });
  const [listing, setListing] = useState<DirectoryListing>({ directories: [], files: [] });
  const [fallbackFiles, setFallbackFiles] = useState<Record<LibraryKind, LibraryMediaFile[]>>({ music: [], karaoke: [] });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<MediaFilter>('all');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isListing, setIsListing] = useState(false);
  const [fallbackSelection, setFallbackSelection] = useState<LibraryKind>('karaoke');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const root = folders[activeKind];
  const currentLevel = levels[activeKind].at(-1);
  const isFallback = !root.handle && fallbackFiles[activeKind].length > 0;

  useEffect(() => {
    fileInputRef.current?.setAttribute('webkitdirectory', '');
    fileInputRef.current?.setAttribute('directory', '');
    let active = true;

    void loadDirectoryHandles()
      .then(async (handles) => {
        const restored: Partial<Record<LibraryKind, FolderAccess>> = {};
        for (const kind of ['music', 'karaoke'] as const) {
          const handle = handles[kind];
          if (!handle) continue;
          const permission = await handle.queryPermission({ mode: 'read' });
          restored[kind] = { handle, name: handle.name, permission };
        }
        if (!active) return;
        setFolders((previous) => ({ ...previous, ...restored }));
        const firstSaved = (['karaoke', 'music'] as const).find((kind) => restored[kind] !== undefined);
        const firstGranted = (['karaoke', 'music'] as const).find(
          (kind) => restored[kind]?.permission === 'granted',
        );
        const firstAvailable = firstGranted ?? firstSaved;
        if (firstAvailable) {
          const selected = restored[firstAvailable];
          const handle = selected?.handle;
          if (selected && handle) {
            setActiveKind(firstAvailable);
            setLevels((previous) => ({
              ...previous,
              [firstAvailable]: [{ name: selected.name ?? handle.name, handle }],
            }));
          }
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(`No se pudieron recuperar las carpetas guardadas: ${getErrorMessage(loadError)}`);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const activeCount = (['music', 'karaoke'] as const).filter(
      (kind) => folders[kind].permission === 'granted' && Boolean(folders[kind].name),
    ).length;
    const selectedCount = (['music', 'karaoke'] as const).filter((kind) => Boolean(folders[kind].name)).length;
    const status = activeCount > 0
      ? `${activeCount} ${activeCount === 1 ? 'carpeta activa' : 'carpetas activas'}`
      : selectedCount > 0 ? 'Permiso pendiente' : 'Sin conectar';
    onStatusChange(status);
  }, [folders, onStatusChange]);

  useEffect(() => {
    if (!root.handle || root.permission !== 'granted' || !currentLevel) {
      setListing({ directories: [], files: [] });
      return;
    }

    let active = true;
    setIsListing(true);
    setError('');
    void listDirectory(currentLevel.handle, levels[activeKind]
      .slice(1)
      .map((level) => level.name)
      .join('/'))
      .then((result) => {
        if (active) setListing(result);
      })
      .catch((listError: unknown) => {
        if (active) setError(`No se pudo leer “${currentLevel.name}”: ${getErrorMessage(listError)}`);
      })
      .finally(() => {
        if (active) setIsListing(false);
      });

    return () => {
      active = false;
    };
  }, [activeKind, currentLevel, levels, root.handle, root.permission]);

  const sourceFiles = isFallback ? fallbackFiles[activeKind] : listing.files;
  const visibleFiles = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return sourceFiles.filter((file) => {
      const matchesFilter = filter === 'all' || file.kind === filter;
      const matchesSearch = !query
        || file.name.toLocaleLowerCase().includes(query)
        || file.relativePath.toLocaleLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [filter, search, sourceFiles]);

  async function selectDirectory(kind: LibraryKind) {
    setError('');
    setNotice('');
    setActiveKind(kind);

    const picker = window.showDirectoryPicker;
    if (typeof picker !== 'function') {
      setFallbackSelection(kind);
      fileInputRef.current?.click();
      return;
    }

    try {
      const handle = await picker({ mode: 'read' });
      setFolders((previous) => ({
        ...previous,
        [kind]: { handle, name: handle.name, permission: 'granted' },
      }));
      setFallbackFiles((previous) => ({ ...previous, [kind]: [] }));
      setLevels((previous) => ({
        ...previous,
        [kind]: [{ name: handle.name, handle }],
      }));

      try {
        await saveDirectoryHandle(kind, handle);
        setNotice(`“${handle.name}” quedó guardada para futuras sesiones.`);
      } catch (saveError: unknown) {
        setNotice(`“${handle.name}” está disponible en esta sesión, pero el navegador no pudo guardar su acceso: ${getErrorMessage(saveError)}`);
      }
    } catch (pickerError: unknown) {
      if (pickerError instanceof DOMException && pickerError.name === 'AbortError') return;
      setError(`No se pudo seleccionar la carpeta: ${getErrorMessage(pickerError)}`);
    }
  }

  function importFallbackFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    if (!selected.length) return;

    const files = selected
      .map((file) => createMediaFile(file, file.webkitRelativePath || file.name))
      .filter((file): file is LibraryMediaFile => file !== undefined);
    const expectedKind: MediaKind = fallbackSelection === 'music' ? 'audio' : 'video';
    const compatible = files.filter((file) => file.kind === expectedKind);

    if (!compatible.length) {
      setError(`No se encontraron archivos ${expectedKind === 'audio' ? 'de audio' : 'de video'} compatibles en la carpeta seleccionada.`);
      return;
    }

    setFallbackFiles((previous) => ({ ...previous, [fallbackSelection]: compatible }));
    setFolders((previous) => ({
      ...previous,
      [fallbackSelection]: {
        name: selected[0].webkitRelativePath.split('/')[0] || selected[0].name,
        permission: 'granted',
      },
    }));
    setLevels((previous) => ({ ...previous, [fallbackSelection]: [] }));
    setActiveKind(fallbackSelection);
    setError('');
    setNotice('Modo compatible: los archivos solo estarán disponibles mientras esta pestaña permanezca abierta.');
  }

  async function requestFolderPermission(kind: LibraryKind) {
    const handle = folders[kind].handle;
    if (!handle) return;
    setError('');
    try {
      const permission = await handle.requestPermission({ mode: 'read' });
      setFolders((previous) => ({
        ...previous,
        [kind]: { ...previous[kind], permission },
      }));
      if (permission === 'granted') {
        setActiveKind(kind);
        setLevels((previous) => ({
          ...previous,
          [kind]: [{ name: handle.name, handle }],
        }));
      } else {
        setError(`El navegador no concedió acceso a “${handle.name}”.`);
      }
    } catch (permissionError: unknown) {
      setError(`No se pudo renovar el permiso de carpeta: ${getErrorMessage(permissionError)}`);
    }
  }

  function openDirectory(name: string, handle: FileSystemDirectoryHandle) {
    setLevels((previous) => ({
      ...previous,
      [activeKind]: [...previous[activeKind], { name, handle }],
    }));
    setSearch('');
  }

  function navigateToLevel(index: number) {
    setLevels((previous) => ({
      ...previous,
      [activeKind]: previous[activeKind].slice(0, index + 1),
    }));
    setSearch('');
  }

  function folderLabel(kind: LibraryKind): string {
    const folder = folders[kind];
    if (!folder.name) return 'Sin seleccionar';
    return folder.permission === 'granted' ? folder.name : permissionText(folder.permission);
  }

  const displayedFiles = compact ? visibleFiles.slice(0, 4) : visibleFiles;

  return (
    <section {...stylex.props(styles.section, compact && styles.compact)}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={importFallbackFiles}
        {...stylex.props(styles.hiddenInput)}
        aria-label="Seleccionar carpeta local"
      />

      <div {...stylex.props(styles.heading)}>
        <div>
          <div {...stylex.props(styles.eyebrow)}>TU COLECCIÓN</div>
          <h2 {...stylex.props(styles.title)}>{compact ? 'Biblioteca local' : 'Explora tus archivos'}</h2>
        </div>
        {!compact && <span {...stylex.props(styles.localBadge)}>100% LOCAL</span>}
      </div>

      <div {...stylex.props(styles.folderGrid)}>
        <article {...stylex.props(styles.folderCard)}>
          <span {...stylex.props(styles.folderIcon, styles.musicIcon)}><MediaIcon kind="audio" /></span>
          <span {...stylex.props(styles.folderInfo)}>
            <strong {...stylex.props(styles.folderName)}>Música de fondo</strong>
            <small {...stylex.props(styles.folderState)} title={folderLabel('music')}>{folderLabel('music')}</small>
          </span>
          <button type="button" {...stylex.props(styles.chooseButton)} onClick={() => void selectDirectory('music')} aria-label="Elegir carpeta de música">
            <FolderIcon /> <span>{folders.music.name ? 'Cambiar' : 'Elegir carpeta'}</span>
          </button>
        </article>
        <article {...stylex.props(styles.folderCard)}>
          <span {...stylex.props(styles.folderIcon, styles.karaokeIcon)}><MediaIcon kind="video" /></span>
          <span {...stylex.props(styles.folderInfo)}>
            <strong {...stylex.props(styles.folderName)}>Videos de karaoke</strong>
            <small {...stylex.props(styles.folderState)} title={folderLabel('karaoke')}>{folderLabel('karaoke')}</small>
          </span>
          <button type="button" {...stylex.props(styles.chooseButton)} onClick={() => void selectDirectory('karaoke')} aria-label="Elegir carpeta de karaoke">
            <FolderIcon /> <span>{folders.karaoke.name ? 'Cambiar' : 'Elegir carpeta'}</span>
          </button>
        </article>
      </div>

      {!compact && (
        <>
          <div {...stylex.props(styles.explorerToolbar)}>
            <div {...stylex.props(styles.kindTabs)} aria-label="Carpeta activa">
              <button type="button" {...stylex.props(styles.kindTab, activeKind === 'karaoke' && styles.kindTabActive)} onClick={() => setActiveKind('karaoke')}>
                Videos <span {...stylex.props(styles.kindCount)}>{folders.karaoke.name ? (fallbackFiles.karaoke.length || (activeKind === 'karaoke' ? listing.files.length : '•')) : '—'}</span>
              </button>
              <button type="button" {...stylex.props(styles.kindTab, activeKind === 'music' && styles.kindTabActive)} onClick={() => setActiveKind('music')}>
                Audio <span {...stylex.props(styles.kindCount)}>{folders.music.name ? (fallbackFiles.music.length || (activeKind === 'music' ? listing.files.length : '•')) : '—'}</span>
              </button>
            </div>
            <label {...stylex.props(styles.searchBox)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
              <input {...stylex.props(styles.searchInput)} value={search} onChange={(event) => setSearch(event.currentTarget.value)} placeholder="Buscar en esta carpeta" aria-label="Buscar archivos" />
              {search && <button {...stylex.props(styles.clearSearch)} type="button" onClick={() => setSearch('')} aria-label="Limpiar búsqueda">×</button>}
            </label>
          </div>

          <div {...stylex.props(styles.breadcrumbs)}>
            {isFallback
              ? <span>{folders[activeKind].name}</span>
              : levels[activeKind].map((level, index) => (
                <span key={`${level.name}-${index}`} {...stylex.props(styles.breadcrumbItem)}>
                  {index > 0 && <span {...stylex.props(styles.breadcrumbSlash)}>/</span>}
                  <button {...stylex.props(styles.breadcrumbButton)} type="button" onClick={() => navigateToLevel(index)} disabled={index === levels[activeKind].length - 1}>{level.name}</button>
                </span>
              ))}
            {root.handle && root.permission !== 'granted' && (
              <button type="button" {...stylex.props(styles.permissionButton)} onClick={() => void requestFolderPermission(activeKind)}>
                Autorizar acceso
              </button>
            )}
          </div>

          <div {...stylex.props(styles.filterRow)}>
            <span>{isListing || isLoading ? 'Leyendo biblioteca…' : `${visibleFiles.length} ${visibleFiles.length === 1 ? 'archivo' : 'archivos'}`}</span>
            <div aria-label="Filtrar por tipo">
              {(['all', 'audio', 'video'] as const).map((value) => (
                <button key={value} type="button" {...stylex.props(styles.filterButton, filter === value && styles.filterButtonActive)} onClick={() => setFilter(value)}>
                  {value === 'all' ? 'Todos' : value === 'audio' ? 'Audio' : 'Video'}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {error && <div role="alert" {...stylex.props(styles.message, styles.errorMessage)}>{error}</div>}
      {notice && <div role="status" {...stylex.props(styles.message, styles.noticeMessage)}>{notice}</div>}

      {!compact && root.handle && root.permission !== 'granted' && !error && (
        <div {...stylex.props(styles.permissionNotice)}>
          <span>El navegador requiere permiso para volver a abrir esta carpeta.</span>
          <button type="button" {...stylex.props(styles.permissionAction)} onClick={() => void requestFolderPermission(activeKind)}>Conceder permiso</button>
        </div>
      )}

      {compact ? (
        <div {...stylex.props(styles.compactSummary)}>
          <span {...stylex.props(styles.compactFolderIcon)}><FolderIcon /></span>
          <span {...stylex.props(styles.compactSummaryText)}>
            <strong {...stylex.props(styles.compactSummaryTitle)}>{folders.music.name || folders.karaoke.name ? 'Carpetas listas para explorar' : 'Tu biblioteca empieza con una carpeta'}</strong>
            <small {...stylex.props(styles.compactSummaryCopy)}>{folders.music.name || folders.karaoke.name
              ? `${folders.music.name ? 'Música conectada' : 'Música sin conectar'} · ${folders.karaoke.name ? 'Karaoke conectado' : 'Karaoke sin conectar'}`
              : 'Elige una carpeta para indexar música o videos. El acceso siempre queda bajo tu control.'}</small>
          </span>
          <button type="button" {...stylex.props(styles.openLibraryButton)} onClick={onOpenLibrary}>
            Abrir biblioteca <span {...stylex.props(styles.openLibraryArrow)}>›</span>
          </button>
        </div>
      ) : (
        <div {...stylex.props(styles.fileList)}>
          {isLoading ? (
            <div {...stylex.props(styles.emptyState)}>Recuperando carpetas guardadas…</div>
          ) : !root.name ? (
            <div {...stylex.props(styles.emptyState)}>
              <span {...stylex.props(styles.emptyIcon)}><FolderIcon /></span>
              <strong {...stylex.props(styles.emptyStateTitle)}>Selecciona una carpeta para empezar</strong>
              <span>La biblioteca solo lee las carpetas que autorizas aquí.</span>
            </div>
          ) : root.permission !== 'granted' && !isFallback ? (
            <div {...stylex.props(styles.emptyState)}>
              <span {...stylex.props(styles.emptyIcon)}><FolderIcon /></span>
              <strong {...stylex.props(styles.emptyStateTitle)}>La carpeta necesita autorización</strong>
              <span>Concede acceso para volver a leer sus archivos.</span>
            </div>
          ) : (
            <>
              {listing.directories.map((directory) => (
                <button key={directory.name} type="button" {...stylex.props(styles.fileRow, styles.directoryRow)} onClick={() => openDirectory(directory.name, directory.handle)}>
                  <span {...stylex.props(styles.fileIcon, styles.directoryIcon)}><FolderIcon /></span>
                  <span {...stylex.props(styles.fileText)}><strong {...stylex.props(styles.fileName)}>{directory.name}</strong><small {...stylex.props(styles.filePath)}>Carpeta</small></span>
                  <span {...stylex.props(styles.openDirectory)}>Abrir <span {...stylex.props(styles.openArrow)}>›</span></span>
                </button>
              ))}
              {displayedFiles.filter((file) => filter === 'all' || file.kind === filter).map((file) => (
                <div key={file.id} {...stylex.props(styles.fileRow)}>
                  <span {...stylex.props(styles.fileIcon, file.kind === 'audio' ? styles.audioFileIcon : styles.videoFileIcon)}><MediaIcon kind={file.kind} /></span>
                  <span {...stylex.props(styles.fileText)}>
                    <strong {...stylex.props(styles.fileName)} title={file.name}>{file.name}</strong>
                    <small {...stylex.props(styles.filePath)} title={file.relativePath}>{file.relativePath}</small>
                  </span>
                  <span {...stylex.props(styles.fileType)}>{file.kind === 'audio' ? 'AUDIO' : 'VIDEO'}</span>
                  <span {...stylex.props(styles.fileSize)}>{formatSize(file.size)}</span>
                  <span {...stylex.props(styles.fileActions)}>
                    {file.kind === 'video' ? (
                      <>
                        <button type="button" {...stylex.props(styles.fileAction, styles.playFileAction)} onClick={() => onPlayKaraoke(file)} aria-label={`Reproducir ahora ${file.name}`}>Reproducir</button>
                        <button type="button" {...stylex.props(styles.fileAction)} onClick={() => onQueueKaraoke(file)} aria-label={`Agregar ${file.name} a la cola`}>+ Cola</button>
                      </>
                    ) : (
                      <button type="button" {...stylex.props(styles.fileAction)} onClick={() => onAddBackground(file)} aria-label={`Agregar ${file.name} a música de fondo`}>+ Ambiente</button>
                    )}
                  </span>
                </div>
              ))}
              {!isListing && listing.directories.length === 0 && visibleFiles.length === 0 && (
                <div {...stylex.props(styles.emptyState)}>
                  {search
                    ? <>No hay coincidencias para “{search}”.</>
                    : <>No se encontraron archivos compatibles en esta carpeta.</>}
                </div>
              )}
              {compact && visibleFiles.length > displayedFiles.length && (
                <div {...stylex.props(styles.moreFiles)}>Y {visibleFiles.length - displayedFiles.length} archivos más</div>
              )}
            </>
          )}
        </div>
      )}

      <p {...stylex.props(styles.formats)}>
        Formatos compatibles: MP3, WAV, FLAC, OGG, M4A, AAC, OPUS · MP4, WEBM, OGV, M4V, MOV. La reproducción depende de los códecs del navegador.
      </p>
    </section>
  );
}

const styles = stylex.create({
  section: { marginTop: '30px', padding: '20px', border: `1px solid ${colors.border}`, borderRadius: '13px', backgroundColor: colors.surface },
  compact: { padding: 0, border: 0, backgroundColor: 'transparent' },
  hiddenInput: { display: 'none' },
  heading: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' },
  eyebrow: { color: colors.textSubtle, fontFamily: 'DM Mono, monospace', fontSize: '9px', letterSpacing: '1.1px' },
  title: { margin: '5px 0 0', fontFamily: 'Manrope, sans-serif', fontSize: '18px', letterSpacing: '-.5px' },
  localBadge: { padding: '6px 8px', border: `1px solid ${colors.border}`, borderRadius: '5px', color: colors.textSubtle, fontFamily: 'DM Mono, monospace', fontSize: '8px', letterSpacing: '.7px' },
  folderGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px', '@media (max-width: 760px)': { gridTemplateColumns: 'minmax(0, 1fr)' } },
  folderCard: { minWidth: 0, display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', border: `1px solid ${colors.border}`, borderRadius: '9px', backgroundColor: colors.surfaceRaised },
  folderIcon: { width: '34px', height: '34px', flex: '0 0 auto', display: 'grid', placeItems: 'center', borderRadius: '9px' },
  musicIcon: { color: colors.amber, backgroundColor: '#29251e' },
  karaokeIcon: { color: colors.blue, backgroundColor: '#222432' },
  folderInfo: { minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' },
  folderName: { overflow: 'hidden', color: colors.text, fontSize: '11px', fontWeight: 600, textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  folderState: { overflow: 'hidden', color: colors.textSubtle, fontSize: '9px', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  chooseButton: { minHeight: '32px', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 9px', border: `1px solid ${colors.border}`, borderRadius: '7px', backgroundColor: colors.surface, color: colors.textMuted, fontSize: '9px', cursor: 'pointer', ':hover': { borderColor: colors.accentDark, color: colors.text } },
  explorerToolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginTop: '20px', '@media (max-width: 560px)': { alignItems: 'stretch', flexDirection: 'column' } },
  kindTabs: { display: 'flex', gap: '5px' },
  kindTab: { height: '33px', display: 'flex', alignItems: 'center', gap: '7px', paddingInline: '10px', border: '1px solid transparent', borderRadius: '7px', backgroundColor: 'transparent', color: colors.textMuted, fontSize: '10px', cursor: 'pointer' },
  kindTabActive: { borderColor: colors.border, backgroundColor: colors.surfaceRaised, color: colors.text },
  kindCount: { color: colors.textSubtle, fontFamily: 'DM Mono, monospace', fontSize: '9px' },
  searchBox: { minWidth: '210px', height: '34px', display: 'flex', alignItems: 'center', gap: '8px', paddingInline: '10px', border: `1px solid ${colors.border}`, borderRadius: '7px', color: colors.textSubtle, backgroundColor: colors.background, '@media (max-width: 560px)': { width: '100%' } },
  searchInput: { width: '100%', minWidth: 0, border: 0, outline: 'none', background: 'transparent', color: colors.text, font: 'inherit', fontSize: '10px' },
  clearSearch: { border: 0, background: 'transparent', color: colors.textMuted, fontSize: '16px', cursor: 'pointer' },
  breadcrumbs: { minHeight: '37px', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '9px', padding: '0 2px', overflowX: 'auto', color: colors.textMuted, fontSize: '10px', whiteSpace: 'nowrap' },
  breadcrumbItem: { display: 'inline-flex', alignItems: 'center', gap: '6px' },
  breadcrumbSlash: { color: colors.textSubtle },
  breadcrumbButton: { maxWidth: '180px', overflow: 'hidden', border: 0, background: 'transparent', color: colors.textMuted, fontSize: '10px', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', ':disabled': { color: colors.text, cursor: 'default' } },
  permissionButton: { marginLeft: 'auto', padding: '6px 9px', border: `1px solid ${colors.border}`, borderRadius: '6px', backgroundColor: colors.surfaceRaised, color: colors.accent, fontSize: '9px', cursor: 'pointer' },
  filterRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '2px 0 8px', color: colors.textSubtle, fontFamily: 'DM Mono, monospace', fontSize: '9px' },
  filterButton: { padding: '5px 8px', border: '1px solid transparent', borderRadius: '5px', background: 'transparent', color: colors.textSubtle, fontSize: '9px', cursor: 'pointer' },
  filterButtonActive: { borderColor: colors.border, backgroundColor: colors.surfaceRaised, color: colors.text },
  message: { marginTop: '10px', padding: '10px 12px', borderRadius: '7px', fontSize: '10px', lineHeight: 1.5 },
  errorMessage: { border: '1px solid #553538', backgroundColor: '#2a1e21', color: '#ffaaaa' },
  noticeMessage: { border: '1px solid #3b4731', backgroundColor: '#20271d', color: '#c4e79a' },
  permissionNotice: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginTop: '10px', padding: '12px', border: `1px solid ${colors.border}`, borderRadius: '8px', color: colors.textMuted, fontSize: '10px' },
  permissionAction: { padding: '6px 9px', border: 0, borderRadius: '6px', backgroundColor: colors.accent, color: colors.background, fontSize: '9px', fontWeight: 700, cursor: 'pointer' },
  fileList: { minHeight: '125px', border: `1px solid ${colors.border}`, borderRadius: '8px', overflow: 'hidden', backgroundColor: colors.background },
  emptyState: { minHeight: '125px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '7px', padding: '20px', color: colors.textSubtle, textAlign: 'center', fontSize: '10px' },
  emptyStateTitle: { color: colors.textMuted, fontSize: '11px', fontWeight: 600 },
  emptyIcon: { width: '34px', height: '34px', display: 'grid', placeItems: 'center', marginBottom: '3px', border: `1px solid ${colors.border}`, borderRadius: '9px', color: colors.textMuted },
  fileRow: { width: '100%', minHeight: '52px', display: 'flex', alignItems: 'center', gap: '11px', padding: '8px 12px', border: 0, borderBottom: `1px solid ${colors.border}`, backgroundColor: 'transparent', textAlign: 'left', ':last-child': { borderBottom: 0 }, ':hover': { backgroundColor: colors.surfaceRaised }, '@media (max-width: 560px)': { gap: '7px', paddingInline: '8px' } },
  directoryRow: { cursor: 'pointer' },
  fileIcon: { width: '32px', height: '32px', flex: '0 0 auto', display: 'grid', placeItems: 'center', borderRadius: '8px' },
  directoryIcon: { color: colors.amber, backgroundColor: '#29251e' },
  audioFileIcon: { color: colors.amber, backgroundColor: '#29251e' },
  videoFileIcon: { color: colors.blue, backgroundColor: '#222432' },
  fileText: { minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' },
  fileName: { overflow: 'hidden', color: colors.text, fontSize: '10px', fontWeight: 500, textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  filePath: { overflow: 'hidden', color: colors.textSubtle, fontSize: '9px', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  fileType: { color: colors.textSubtle, fontFamily: 'DM Mono, monospace', fontSize: '8px', letterSpacing: '.4px', '@media (max-width: 560px)': { display: 'none' } },
  fileSize: { width: '60px', color: colors.textSubtle, fontFamily: 'DM Mono, monospace', fontSize: '9px', textAlign: 'right', '@media (max-width: 560px)': { display: 'none' } },
  fileActions: { display: 'flex', alignItems: 'center', gap: '5px', marginLeft: '5px', '@media (max-width: 560px)': { gap: '3px', marginLeft: 0 } },
  fileAction: { minHeight: '27px', paddingInline: '8px', border: `1px solid ${colors.border}`, borderRadius: '6px', backgroundColor: colors.surfaceRaised, color: colors.textMuted, fontSize: '8px', whiteSpace: 'nowrap', cursor: 'pointer', ':hover': { borderColor: colors.accentDark, color: colors.text }, '@media (max-width: 560px)': { paddingInline: '5px', fontSize: '7px' } },
  playFileAction: { borderColor: '#566b36', color: colors.accent },
  openDirectory: { color: colors.textMuted, fontSize: '9px' },
  openArrow: { marginLeft: '3px', fontSize: '14px' },
  moreFiles: { padding: '9px', color: colors.textSubtle, textAlign: 'center', fontSize: '9px' },
  formats: { margin: '12px 0 0', color: colors.textSubtle, fontSize: '9px', lineHeight: 1.5 },
  compactSummary: { display: 'flex', alignItems: 'center', gap: '13px', minHeight: '75px', padding: '15px 17px', border: `1px solid ${colors.border}`, borderRadius: '11px', backgroundColor: colors.surface },
  compactFolderIcon: { width: '40px', height: '40px', flex: '0 0 auto', display: 'grid', placeItems: 'center', border: `1px solid ${colors.border}`, borderRadius: '10px', color: colors.textMuted, backgroundColor: colors.surfaceRaised },
  compactSummaryText: { minWidth: 0, flex: 1 },
  compactSummaryTitle: { color: colors.text, fontSize: '11px', fontWeight: 600 },
  compactSummaryCopy: { display: 'block', maxWidth: '600px', marginTop: '5px', color: colors.textSubtle, fontSize: '10px', lineHeight: 1.5 },
  openLibraryButton: { display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto', padding: '7px 9px', border: `1px solid ${colors.border}`, borderRadius: '6px', backgroundColor: colors.surfaceRaised, color: colors.textMuted, fontSize: '9px', whiteSpace: 'nowrap', cursor: 'pointer' },
  openLibraryArrow: { fontSize: '15px' },
});
