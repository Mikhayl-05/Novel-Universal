import { cp, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The current reader still references its original root-level assets.
 * Copy those folders into dist without moving, renaming, or duplicating
 * them in the source tree. This keeps the legacy reader deployable while
 * the React migration is developed in parallel.
 */
function preserveLegacyStaticAssets() {
  const entries = [
    'asset',
    'audio',
    'icons',
    'manifest.json',
    'service-worker.js',
  ];

  return {
    name: 'preserve-legacy-static-assets',
    apply: 'build',
    async closeBundle() {
      const projectRoot = process.cwd();
      const outputRoot = resolve(projectRoot, 'dist');

      for (const entry of entries) {
        const source = resolve(projectRoot, entry);
        const destination = resolve(outputRoot, entry);

        await mkdir(dirname(destination), { recursive: true });
        await cp(source, destination, { recursive: true, force: true });
      }
    },
  };
}

export default defineConfig({
  // Root base ensures /editor and /chapter/:id resolve bundled JS/CSS and static assets consistently.
  base: '/',
  // The existing reader stores static assets at the repository root.
  publicDir: false,
  plugins: [react(), preserveLegacyStaticAssets()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
