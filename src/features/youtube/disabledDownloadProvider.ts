import type { DownloadProgress, DownloadProvider, DownloadRequest } from './youtube.types';

export const disabledDownloadProvider: DownloadProvider = {
  async isAvailable() {
    return false;
  },
  async download(
    _request: DownloadRequest,
    onProgress: (progress: DownloadProgress) => void,
  ): Promise<Blob> {
    const message = 'Las descargas están desactivadas: no hay un proveedor verificado que cumpla los requisitos de autorización, CORS y despliegue estático.';
    onProgress({ status: 'failed', message });
    throw new Error(message);
  },
};
