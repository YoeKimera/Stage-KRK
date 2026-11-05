export type LibraryKind = 'music' | 'karaoke';
export type MediaKind = 'audio' | 'video';
export type PermissionState = 'granted' | 'prompt' | 'denied';

export interface LibraryMediaFile {
  id: string;
  name: string;
  kind: MediaKind;
  mimeType: string;
  size: number;
  relativePath: string;
  fileHandle?: FileSystemFileHandle;
  file?: File;
}

export interface DirectoryEntry {
  name: string;
  handle: FileSystemDirectoryHandle;
}

export interface DirectoryListing {
  directories: DirectoryEntry[];
  files: LibraryMediaFile[];
}

export interface FolderAccess {
  handle?: FileSystemDirectoryHandle;
  name?: string;
  permission: PermissionState;
  fallbackFiles?: LibraryMediaFile[];
}

export interface DirectoryLevel {
  name: string;
  handle: FileSystemDirectoryHandle;
}

declare global {
  interface Window {
    showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
  }

  interface FileSystemDirectoryHandle {
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
    queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<'granted' | 'prompt' | 'denied'>;
    requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<'granted' | 'prompt' | 'denied'>;
  }
}
