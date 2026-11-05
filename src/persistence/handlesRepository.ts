import type { LibraryKind } from '../features/library/library.types';

const databaseName = 'stage-library';
const storeName = 'folders';
const databaseVersion = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir la base local.'));
    request.onblocked = () => reject(new Error('La base local está bloqueada por otra pestaña.'));
  });
}

export async function loadDirectoryHandles(): Promise<Partial<Record<LibraryKind, FileSystemDirectoryHandle>>> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(storeName, 'readonly').objectStore(storeName).openCursor();
      const handles: Partial<Record<LibraryKind, FileSystemDirectoryHandle>> = {};
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(handles);
          return;
        }
        const key = cursor.key;
        if ((key === 'music' || key === 'karaoke') && isDirectoryHandle(cursor.value)) {
          handles[key] = cursor.value;
        }
        cursor.continue();
      };
      request.onerror = () => reject(request.error ?? new Error('No se pudieron leer las carpetas guardadas.'));
    });
  } finally {
    database.close();
  }
}

export async function saveDirectoryHandle(
  kind: LibraryKind,
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite');
      transaction.objectStore(storeName).put(handle, kind);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('No se pudo guardar el permiso de carpeta.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Se canceló el guardado de la carpeta.'));
    });
  } finally {
    database.close();
  }
}

function isDirectoryHandle(value: unknown): value is FileSystemDirectoryHandle {
  return typeof value === 'object'
    && value !== null
    && 'kind' in value
    && value.kind === 'directory'
    && 'queryPermission' in value;
}
