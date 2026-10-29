import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths, so the build runs from any location: a subfolder on
  // a static host, or a single packed file (see scripts/build-artifact.mjs).
  base: './',
  server: { port: 5173, strictPort: true },
  build: {
    target: 'es2022',
    // The game ships as one chunk, so there is nothing to preload. Without
    // this, Vite injects a polyfill whose only job is to fetch() preload
    // links - dead code here, and the bundle's sole network call.
    modulePreload: { polyfill: false },
  },
});
