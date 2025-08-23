# Rhythm Navigator

A PWA for exploring rhythms across binary, octal, and hexadecimal modes, using shadow-contour isomorphism (Toussaint-style). Built with Vue 3 + TypeScript + Vite + Pinia + Tailwind.

## Quick start

- Install deps: `pnpm i` (or `npm i`)
- Dev server: `pnpm dev`
- Typecheck: `pnpm typecheck`
- Tests: `pnpm test`
- Build: `pnpm build`
- Preview: `pnpm preview`

## Deploy

GitHub Pages is configured via Actions (see `.github/workflows/pages.yml`). On push to `main`, Pages deploys to `https://<owner>.github.io/rhythm-navigator/`.

## Notes

- PWA manifest name: Rhythm Navigator
- Icons: place `public/pwa-192x192.png` and `public/pwa-512x512.png` (optional). The app works without custom icons.