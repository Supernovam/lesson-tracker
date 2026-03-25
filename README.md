# Lesson Tracker

A minimal MVP for logging student lessons and viewing them in a chronological list. Data is stored in Neon Postgres.

## Tech stack

- **React 18** + **TypeScript** (Vite)
- **Node + Express** API (Postgres persistence)
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **Vitest** + **Testing Library** for unit tests

## Features

- **Log a lesson**: student name, date (default today), duration in minutes (default 120), optional comment
- **Validation**: required name and date, duration must be a positive integer (1–9999)
- **Lesson history**: table of all lessons, ordered by date (oldest first), with delete action
- **Persistence**: all entries saved in Neon Postgres

## Setup

```bash
npm install
```

## Scripts

| Command        | Description                |
|----------------|----------------------------|
| `npm run dev`  | Start dev server           |
| `npm run build`| Production build           |
| `npm run preview` | Preview production build |
| `npm run test` | Run unit tests (Vitest)    |
| `npm run test:watch` | Run tests in watch mode |

## Project structure

- `src/components/` – `LessonForm`, `LessonTable`
- `src/hooks/` – `useLessonStorage` (API read/write and in-memory state)
- `src/types/` – `Lesson`, `LessonFormData`, validation result types
- `src/utils/` – `validation.ts`, `format.ts` (and their tests)

## Design

Clean, minimal UI: generous spacing, light borders, Inter font, and a responsive layout so the form and table work on small and large screens.

## Production Deployment (Neon + Render + GitHub Pages)

### Backend (Render)

Render runs the Express API from `server/index.js`. Set these environment variables in your Render service:

- `NODE_ENV=production`
- `DATABASE_URL` (your Neon Postgres connection string; pooled connection string recommended)
- `PORT` (optional; defaults to `3001`)
- `CORS_ORIGINS` (comma-separated origins, scheme+host only; no path)
  - your GitHub Pages origin (example: `https://supernovam.github.io`)
  - your Render API origin (example: `https://lesson-tracker-api-xxxxx.onrender.com`)

Optional (advanced):

- `PG_POOL_MAX`
- `PG_CONNECTION_TIMEOUT_MS`

Start command: `npm start`

The API initializes the `lessons` table automatically on startup with retries (idempotent `CREATE TABLE IF NOT EXISTS`).

### Frontend (GitHub Pages)

Your GitHub Pages build uses the workflow in `.github/workflows/static.yml`. Configure this repo secret:

- `VITE_API_BASE` = your Render API origin (example: `https://lesson-tracker-api-xxxxx.onrender.com`)

This makes the production build call the Render backend instead of attempting same-origin `/lesson-tracker/api/*`.

### Local development notes

- Leave `VITE_API_BASE` blank to use the Vite dev proxy for `/api/*`.
- If you want to test against the deployed backend locally, set `VITE_API_BASE` in `.env`.
