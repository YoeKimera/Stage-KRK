import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import stylex from '@stylexjs/unplugin';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/Stage-KRK/' : '/',
  plugins: [
    stylex.vite({
      useCSSLayers: true,
      dev: process.env.NODE_ENV === 'development',
      runtimeInjection: true,
    }),
    react(),
  ],
});
