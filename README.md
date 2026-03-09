# Lesson Tracker

A minimal MVP for logging student lessons and viewing them in a chronological list. Data is stored in the browser’s local storage.

## Tech stack

- **React 18** + **TypeScript** (Vite)
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **Vitest** + **Testing Library** for unit tests

## Features

- **Log a lesson**: student name, date (default today), duration in minutes (default 120), optional comment
- **Validation**: required name and date, duration must be a positive integer (1–9999)
- **Lesson history**: table of all lessons, ordered by date (oldest first), with delete action
- **Persistence**: all entries saved in `localStorage` and restored on load

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
- `src/hooks/` – `useLessonStorage` (localStorage read/write and in-memory state)
- `src/types/` – `Lesson`, `LessonFormData`, validation result types
- `src/utils/` – `validation.ts`, `format.ts` (and their tests)

## Design

Clean, minimal UI: generous spacing, light borders, Inter font, and a responsive layout so the form and table work on small and large screens.
