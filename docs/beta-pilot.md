# PWANova closed-beta pilot plan

These are **goals for the next stage**, not results already achieved. Nothing here has been sent, invited or run yet — this is a plan plus draft copy, ready for the account owner to approve and send.

## Pilot goals

1. **10 real apps**, added or ownership-claimed by their actual developer (not imported/scraped — see "Do not" in the project brief).
2. **2 real launch-board integrations**, with a board owner who has agreed to try the Partner Kit (`/partners`, the embed generator, `/api/badge/[slug]` or the iframe, and `/api/public/apps/by-domain`).
3. **Phone check** of the core flows on real hardware (not just the emulated mobile viewport used during development — see the checklist below).
4. **A written log of every failure**, with cause, for each of the above — this file's job after the pilot runs is to hold that log, not just the plan.

## Before inviting anyone

- [ ] Run `npm run verify:supabase` against local Supabase; separately authorize any staging checks and get a clean pass (see `docs/beta-audit.md`, "Not verified").
- [ ] Confirm Google/GitHub OAuth (or at least email magic-link) actually completes end to end on that project.
- [ ] Make yourself admin (`update public.profiles set role = 'admin' where username = '…'`) and confirm `/admin` loads.
- [ ] Confirm the mandatory moderation queue is staffed; submission approval is database-enforced.
- [ ] Leave `SHOW_DEMO_DATA=false` and `ALLOW_INDEXING=false` for the whole pilot — nobody outside the invited group should be finding this via search, and no fabricated data should ever be visible.
- [ ] Run `supabase/unseed.sql` if the target project ever had `supabase/seed.sql` loaded into it.

## Developer invitation (draft — do not send without approval)

> Subject: An early look at PWANova, for your app specifically
>
> Hi {name},
>
> I'm building PWANova — a discovery and trust layer for web apps that already live outside the traditional app stores. {App name} looked like a strong fit, so I wanted to ask before anything else: would you be open to being one of the first ~10 developers to add it?
>
> What that involves:
> 1. Paste your app's URL at {beta URL}/ship — it reads your title, icon and manifest automatically.
> 2. Verify you own the domain (one file at `/.well-known/pwanova-verification.txt` — a few minutes).
> 3. After separate publication approval, you'll show up in search and categories, collect real ratings and reviews, and can reply to them as the verified owner.
>
> This is a closed beta — not indexed by search engines yet — so it's low-stakes to try, and I'd genuinely like your honest reaction, especially anything that's confusing or broken.
>
> Would you be up for it?

## Launch-board invitation (draft — do not send without approval)

> Subject: Would {board name} want ratings/verification/install-guidance, without building it?
>
> Hi {name},
>
> PWANova is a discovery and trust layer for web apps — ratings, reviews, ownership verification, install guidance and a small public API. It's built to sit *next to* launch boards, not compete with them: your page, your brand and your upvotes stay exactly where they are.
>
> I'd like to ask you to be one of two boards trying it early: a badge next to a listing (either a JS-free `<img>` or a small iframe — {beta URL}/partners has both, live, with a copy-paste generator) and, if useful, a lookup against our public API by domain.
>
> Takes a few minutes to try, no commitment, and I'd like your honest read on whether it's actually useful before building anything further (a partner dashboard, bulk import, revenue share) on top of it.

## Manual checklist (do on real hardware, not just the emulator)

Emulated mobile viewports (used throughout development) are not proof a real device behaves the same — Safari's install flow, `visualViewport` behaviour with the keyboard open, and safe-area insets are the most likely places for a real iPhone to disagree with an emulator.

- [ ] iPhone Safari: open an app page, tap Install → confirm the Add-to-Home-Screen steps shown match what Safari actually does, and that "Tap Share" points at Safari's toolbar (not PWANova's own UI).
- [ ] iPhone Safari: add PWANova itself to the home screen; confirm it opens standalone (no browser chrome) and the bottom tab bar clears the home indicator (safe-area inset).
- [ ] Android Chrome: open an app page, tap Install; if `beforeinstallprompt` doesn't fire for PWANova itself, confirm the fallback menu-based steps are accurate for current Chrome.
- [ ] Android Chrome: confirm tapping Install on an app page never triggers a prompt to install **PWANova** (the exact bug fixed in `docs/beta-audit.md`, row P0-3) — this is the one item worth deliberately trying to break.
- [ ] On both: open the keyboard on the review textarea; confirm the submit button stays reachable and nothing is clipped.
- [ ] On both: rotate the device mid-review-draft; confirm the draft isn't lost.
- [ ] On both: background the browser mid-claim-verification and return; confirm the claim page still reflects the real state (not a stale cached one).
- [ ] Confirm no horizontal scroll on any of: home, explore, an app page, `/ship`, `/dashboard`, `/admin` (as admin).

## Failure log

_(empty — fill in as the pilot runs)_

| Date | Who | What they tried | What happened | Root cause | Status |
|---|---|---|---|---|---|
| | | | | | |
