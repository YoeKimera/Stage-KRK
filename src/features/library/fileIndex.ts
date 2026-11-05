import type { DirectoryListing, LibraryMediaFile, MediaKind } from './library.types';

const audioMimeTypes: Record<string, string> = {
  aac: 'audio/aac',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  oga: 'audio/ogg',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  wav: 'audio/wav',
};

const videoMimeTypes: Record<string, string> = {
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  mp4: 'video/mp4',
  ogv: 'video/ogg',
  webm: 'video/webm',
};

export function getMediaKind(filename: string): MediaKind | undefined {
  const extension = filename.split('.').pop()?.toLowerCase();
  if (!extension) return undefined;
  if (extension in audioMimeTypes) return 'audio';
  if (extension in videoMimeTypes) return 'video';
  return undefined;
}

export function getMediaMimeType(filename: string, browserType = ''): string {
  if (browserType) return browserType;
  const extension = filename.split('.').pop()?.toLowerCase() ?? '';
  return audioMimeTypes[extension] ?? videoMimeTypes[extension] ?? 'application/octet-stream';
}

export function createMediaFile(file: File, relativePath: string): LibraryMediaFile | undefined {
  const kind = getMediaKind(file.name);
  if (!kind) return undefined;

  return {
    id: `file:${relativePath}`,
    name: file.name,
    kind,
    mimeType: getMediaMimeType(file.name, file.type),
    size: file.size,
    relativePath,
    file,
  };
}

export async function listDirectory(
  directory: FileSystemDirectoryHandle,
  parentPath = '',
): Promise<DirectoryListing> {
  const directories: DirectoryListing['directories'] = [];
  const files: LibraryMediaFile[] = [];

  for await (const [name, handle] of directory.entries()) {
    if (isDirectoryHandle(handle)) {
      directories.push({ name, handle });
      continue;
    }
    if (!isFileHandle(handle)) continue;

    const kind = getMediaKind(name);
    if (!kind) continue;

    const file = await handle.getFile();
    const relativePath = parentPath ? `${parentPath}/${name}` : name;
    files.push({
      id: `handle:${relativePath}`,
      name,
      kind,
      mimeType: getMediaMimeType(name, file.type),
      size: file.size,
      relativePath,
      fileHandle: handle,
    });
  }

  directories.sort((left, right) => left.name.localeCompare(right.name));
  files.sort((left, right) => left.name.localeCompare(right.name));
  return { directories, files };
}

function isDirectoryHandle(handle: FileSystemHandle): handle is FileSystemDirectoryHandle {
  return handle.kind === 'directory';
}

function isFileHandle(handle: FileSystemHandle): handle is FileSystemFileHandle {
  return handle.kind === 'file';
}
