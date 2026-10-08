# Chorus — project brief

Everyone signs the card. This one, they hear.

Chorus is a group voice-message gift. One person (the organizer) starts a Chorus for someone, pastes a link into the group chat, and everyone who loves that person records a short voice note from their phone — no app, no account. The clips are sealed and unlock for the recipient on a chosen date (birthday morning, first anniversary). On the first listen every voice plays in order with no skipping. After that it's a keepsake.

Working name only. Check trademarks/domains before shipping a brand.

## Who's who

- Organizer — starts it, shares the link, nudges people, pays, picks the open date. Usually the busiest person in the friend group; must finish in three steps.
- Contributor — taps a link from a text, holds a button, talks, lets go, types a first name. Must work for a 60-year-old on an old iPhone in under a minute. This screen is seen by ~20× more people than any other. Obsess over it.
- Recipient — gets a text the morning of, sees who recorded (names only), waits for the unlock, listens to everyone, then can replay, save, or record a thank-you to all contributors.

## Product rules (don't break these)

1. Contributors never need an account or an app. Link → hold to record → name → done.
2. Sealed means sealed: nobody, not even the organizer, can play the compiled Chorus before the open time. (Organizer can hear individual clips as they land.)
3. First listen plays every voice in order, no skip. Skip/scrub unlocks after the first full listen.
4. Payment is the last organizer step, after they've watched voices arrive.
5. Copy is warm and plain. No corporate voice, no emoji in UI.

## MVP scope — build in this order

### Phase 1 (now): the contributor page only.

- Route `/c/[slug]` showing "Say something to {name} for {occasion}" and a hold-to-record button.
- Record with the browser MediaRecorder API (test iOS Safari + Android Chrome specifically; iOS needs user-gesture start and may produce audio/mp4 — accept whatever mime the device gives).
- On release: upload the blob to Supabase Storage bucket `clips`, insert a row in `clips` (chorus_id, contributor_name, storage_path, duration_seconds, created_at).
- Name field (first name only), three on-screen prompts for people who freeze: "One memory. What they mean to you. One wish for the year ahead."
- A thank-you state after upload. Allow re-record before submit.
- Chorus rows are created by hand in the Supabase dashboard for now. No organizer UI, no payment, no sealed playback yet — the first real run is stitched and delivered manually.

### Phase 2

Organizer flow (start → share → seal), recipient open screen with countdown, sealed playback with no-skip first listen, scheduled SMS delivery.

### Phase 3

Payment ($24 Chorus / $49 Forever), thank-you recording, keepsake download, printable QR card.

## Stack

- Next.js (App Router), TypeScript, Tailwind
- Supabase: Postgres, Storage (`clips` bucket, private; signed URLs for playback), Auth only for organizers in phase 2
- Vercel for hosting
- Keep it boring. No extra services until a phase needs one.

## Data model (phase 1)

```
choruses: id, slug (unique), recipient_name, occasion, opens_at (timestamptz), created_at
clips:    id, chorus_id → choruses, contributor_name, storage_path, duration_seconds, mime_type, created_at
```

Row-level security: anonymous users may INSERT clips and read a chorus by slug; nobody anonymous may SELECT clips.

## Design

Mockups live on a Claude Design canvas ("Chorus — Open Screen"): recipient screens (Sealed, Playing, After) and organizer screens (Start, Share, Contributor, Seal).

- Ground `#0F0E13`, text `#F4EFE6`, muted `#9A93A8`, secondary `#C9C3D4`, surface `#16141D`, line `#2A2435` / `#3A3547`
- Accent (gold) `#F2B544`, text on accent `#1A1407`
- Display: Fraunces (Google Fonts), regular weight, large and quiet. Body/UI: Manrope.
- Phone-first, 390px design width. Touch targets ≥ 44px. Big round record button (132px). Pill chips for names.

## Definition of done for phase 1

A link texted to a non-technical relative results in a clip in the `clips` bucket with their name attached, on the first try, with no help from you.
