# Chorus

Everyone signs the card. This one, they hear.

Phase 1: the contributor page only. Someone taps a link, holds a button, talks,
lets go, types a first name. The clip lands in a private Supabase bucket.

Full brief: [docs/superpowers/specs/2026-10-07-chorus-brief.md](docs/superpowers/specs/2026-10-07-chorus-brief.md).

## Run it locally

```bash
npm install
npm run dev
```

Without Supabase keys the app runs in demo mode: `/c/demo` shows a sample
chorus and "Send" pretends to upload (it logs to the browser console instead).

## Connect Supabase

1. Create a Supabase project.
2. In the SQL editor, run `supabase/migrations/0001_phase1.sql`. It creates the
   `choruses` and `clips` tables, row-level security, and the private `clips`
   storage bucket with an anonymous-upload-only policy.
3. Create a chorus by hand. `supabase/seed.sql` has an example row to edit.
4. Copy `.env.example` to `.env.local` and fill in the project URL and the
   anon / publishable key from Project Settings -> API.
5. `npm run dev`, then open `/c/<slug>` on your phone.

## What's in here

- `app/c/[slug]/page.tsx` loads the chorus by slug on the server.
- `components/recorder.tsx` is the whole contributor experience: hold-to-record,
  listen back, first name, send, thank you. Handles no-MediaRecorder browsers
  and denied microphones.
- `lib/audio.ts` picks a recording mime type the device supports (iOS gives
  `audio/mp4`, Chrome gives `audio/webm`), maps it to a file extension, and
  formats times and dates. Tested in `lib/audio.test.ts`.
- `lib/upload.ts` uploads the blob to Storage under `<chorus_id>/<uuid>.<ext>`
  and inserts the `clips` row.

## Checks

```bash
npm test
npm run lint
npm run typecheck
```

## Before the first real run

Test on a real iPhone (Safari) and a real Android phone (Chrome). Pay attention
to: the first press that triggers the microphone permission sheet, long-press
not opening a context menu, and the listen-back playing on both.
