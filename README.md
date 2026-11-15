# Novel Ariel & Alie

Digital novel reader for **Selamanya Itu Lama Banget**.

## Current project state

The original reader is intentionally preserved in the repository root:

- `index.html` remains the current reader entry point.
- `asset/`, `audio/`, and `icons/` remain in their original locations.
- `manifest.json` and `service-worker.js` remain unchanged.
- Novel chapters, reading behavior, saved notes, favorites, progress, audio, visual effects, and PWA behavior must not be rewritten as part of the tooling bootstrap.

The React/Vite toolchain is being introduced on a separate migration branch. The legacy reader remains the application served by Vite until a deliberate, reviewed React entry-point migration is performed.

## Requirements

- Node.js **20.19+** or **22.12+**
- npm 10+

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm run build
npm run preview
```

Vite listens on `0.0.0.0` so it can be reached from hosted development environments such as Google AI Studio.

## Legacy asset handling

The Vite configuration keeps the existing source folders untouched. During production builds it copies `asset/`, `audio/`, `icons/`, `manifest.json`, and `service-worker.js` into `dist/` at the same relative paths expected by the legacy reader.

Do not move those folders into `public/` as part of the initial setup. Do not replace the root `index.html` until the React reader has feature parity and has been explicitly verified.

## Migration rules

1. Preserve the existing UI, chapter content, chapter order, reading behavior, PWA behavior, and audio/VFX functionality.
2. Treat the old reader as the behavioral reference until the React implementation has passed parity checks.
3. Keep a stable chapter ID independent of display order before changing how chapters are stored.
4. Preserve or explicitly migrate existing browser storage keys; never silently reset notes, favorites, or reading progress.
5. Keep the migration and the future Novel Studio/editor as separate milestones.
6. Do not add backend services or editor dependencies until their architecture and data model are reviewed.
