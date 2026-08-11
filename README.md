# Keyfall

Keyfall is a local-first piano practice player that turns MIDI and MusicXML scores into a falling-notes practice view. It is designed as a focused alternative to video tutorials: choose a bundled piece or import your own score, control playback and looping, and follow upcoming notes on an 88-key keyboard.

## Current capabilities

- A bundled catalog of 12 public-domain classical scores with verified source and license records
- Search by title, composer, and common aliases
- MIDI (`.mid`, `.midi`) and MusicXML (`.musicxml`, `.xml`, `.mxl`) import
- Browser-local library storage with IndexedDB; no account, backend, or telemetry
- Sampled-piano playback with a synthesizer fallback
- Play, pause, seek, skip, mute, speed, and A–B loop controls
- A windowed falling-note waterfall and synchronized 88-key keyboard
- Anticipatory key highlighting and enlarged note labels for upcoming presses
- Responsive desktop and tablet layouts

Web MIDI grading, practice reports, attempt history, and installable offline packaging are planned but are not part of the current build.

## Requirements

- Node.js 22.13 or newer
- npm
- A current Chromium, Firefox, or Safari browser

## Local development

```sh
npm install
npm run dev
```

Vite prints the local address when the development server starts.

To build and preview the production bundle:

```sh
npm run build
npm run preview
```

## Verification

```sh
npm run check
npm run test:e2e
```

`npm run check` runs TypeScript checks, ESLint, repository guardrails, and the unit/component test suite. The Playwright suite covers the principal catalog and player flows at the supported desktop and tablet viewports.

## Architecture

- React 19, TypeScript, Vite, and Tailwind CSS 4 for the application shell and UI
- Tone.js for transport and audio playback
- `@tonejs/midi` and Verovio for score import
- Dexie for browser-local persistence
- Vitest, Testing Library, and Playwright for automated verification

The product requirements and implementation constraints live in [PRD.md](PRD.md), [BUILD_PLAN.md](BUILD_PLAN.md), and the [docs](docs/) directory.

## Data and privacy

Keyfall is local-first. Imported scores and library metadata remain in the browser's local storage. The application has no user accounts, server-side database, analytics, or telemetry.

## Score licensing and attribution

Every bundled score has a recorded source page, license, and SHA-256 checksum in [catalog/LICENCES.md](catalog/LICENCES.md). Those asset licenses apply to their respective score files; they do not grant a license for the application source code.

No separate open-source license has been granted for this repository.
