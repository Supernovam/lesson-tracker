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
- **Sign-in**: Google OAuth with an email allow-list and HTTP-only cookie sessions

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `DATABASE_URL`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `ALLOWED_EMAILS`. See **Google OAuth** below.

## Scripts

| Command        | Description                |
|----------------|----------------------------|
| `npm run dev`  | Start dev server           |
| `npm run build`| Production build           |
| `npm run preview` | Preview production build |
| `npm run test` | Run unit tests (Vitest)    |
| `npm run test:watch` | Run tests in watch mode |

## Project structure

- `src/components/` – `LessonForm`, `LessonTable`, `LoginScreen`
- `src/hooks/` – `useLessonStorage` (API read/write and in-memory state), `useAuth`
- `src/types/` – `Lesson`, `LessonFormData`, validation result types
- `src/utils/` – `validation.ts`, `format.ts` (and their tests)

## Design

Clean, minimal UI: generous spacing, light borders, Inter font, and a responsive layout so the form and table work on small and large screens.

## Google OAuth (local)

Create an OAuth **Web application** client in [Google Auth Platform](https://console.cloud.google.com/auth/clients).

Authorized JavaScript origins (local):

- `http://localhost:5173`

Authorized redirect URIs (local):

- `http://localhost:5173/auth/google/callback`

Copy Client ID and Client secret into `.env`. Only Google accounts listed in `ALLOWED_EMAILS` can sign in after Google succeeds.

### Local development notes

- Leave `VITE_API_BASE` blank to use the Vite dev proxy for `/api/*` and `/auth/*`.
- If you want to test against the deployed backend locally, set `VITE_API_BASE` in `.env`.
