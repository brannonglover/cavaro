# Analytics

Cavaro uses [PostHog](https://posthog.com) for product analytics. Events are sent via PostHog's capture API (no SDK required).

## Setup

1. Create a free account at [posthog.com](https://posthog.com)
2. Create a project and copy your **Project API Key** (starts with `phc_`)
3. Add to your environment:
   - **Local dev**: `EXPO_PUBLIC_POSTHOG_KEY=phc_xxx` in `.env.development` or `.env.development.local`
   - **EAS builds**: `EXPO_PUBLIC_POSTHOG_KEY` must be in the `preview` and `production` `env` blocks in `eas.json` (Expo inlines `EXPO_PUBLIC_*` at build time). Rebuild after changing it — existing TestFlight/App Store binaries will not pick it up.
   - **Host**: default is `https://us.i.posthog.com`. If your PostHog dashboard is at `eu.posthog.com`, set `EXPO_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com`.

If the key is not set, analytics are disabled (no-op). The app works normally without it.

## Verify events are arriving

1. In PostHog, open **Activity** (live events), not Insights.
2. Local: restart Metro (`npx expo start -c`) so the env var is inlined, then navigate in the app. You should see `screen_view` immediately.
3. TestFlight/App Store: ship a **new EAS build** after the key is in `eas.json`.
4. Confirm the project region matches the host (US vs EU). Wrong region looks like “no events.”

## What's tracked

### Screen views (automatic)
- Tab navigation: Favorites, Dislikes, Cavaro, Search, TasteSearch
- Stack screens: CavaroList, AddCigar, EditCigar, Landing, Login, Signup

### Feature events
| Event | Properties |
|------|------------|
| `cigar_added` | `cigar` (Brand Line Name), `brand`, `name`, `line`, `length`, `quantity`, `source` (catalog/custom/quick_add) |
| `cigar_edited` | — |
| `cigar_favorited` | — |
| `cigar_unfavorited` | — |
| `cigar_disliked` | — |
| `cigar_smoked` | — |
| `personal_notes_saved` | — |
| `strength_profile_saved` | — |
| `taste_search_opened` | `source` (home/home_empty/my_taste) |
| `search_performed` | `keyword_count`, `has_results`, `search_type` (taste/cigar) |
| `add_from_search` | `brand`, `name` |
| `quick_add_from_search` | `brand`, `name`, `incremented`, `humidor_count` |
| `taste_analyzed` | `has_result`, `correlates` |
| `landing_cta` | `action` (get_started/subscribe/already_have_account/restore_subscription) |
| `login_success` | `method` (apple/email), `device_knew_user` (apple only) |
| `login_failed` | `error`, `method` (apple, when the Apple flow failed) |
| `signup_success` | `tier`, `method` (apple/email), `device_knew_user` (apple only) |
| `signup_failed` | `reason` (missing_name/missing_fields/password_too_short/duplicate_account/error), `error` (when reason=error) |
| `signup_abandoned` | `tier` |

### Add Cigar funnel

The Add Cigar screen used to report only `screen_view` (`screen: AddCigar`) and
`cigar_added`, which made abandonment, validation friction, catalog problems and
real save failures indistinguishable. These events close that gap. There is
deliberately **no** `add_cigar_viewed` — `screen_view` already covers arrival.

| Event | Fires when |
|------|------------|
| `add_cigar_catalog_loaded` | Catalog rows become available. `source` says where from: `cache`, `api`, `api_refresh`, `cache_after_error` |
| `add_cigar_catalog_failed` | API failed **and** the local cache was empty, so the picker has nothing |
| `add_cigar_brand_selected` | A brand is chosen (once per distinct value) |
| `add_cigar_name_selected` | A cigar name is chosen (once per distinct value) |
| `add_cigar_size_selected` | A size is chosen (once per distinct value) |
| `add_cigar_attempted` | Add is pressed, before validation |
| `add_cigar_validation_failed` | The attempt was rejected: `missing_fields`, `invalid_size_format`, or `free_tier_limit` |
| `add_cigar_save_failed` | The save threw. `error_category` only — never the raw message |
| `custom_cigar_opened` | The manual form is opened. `source`: `header`, `catalog_footer`, `catalog_unavailable` |
| `add_cigar_abandoned` | The screen loses focus without a completed save. `progress_stage` says how far they got |

Shared properties: `is_guest`, `entry_point` (`direct` or `search_prefill`),
`add_method` (`catalog` or `custom`), plus `catalog_item_count` on load/attempt.

All property values are fixed low-cardinality tokens produced by
`lib/addCigarValidation.js`. Raw error messages are never sent, because they can
contain file paths, SQL fragments or user-entered text. `missing_fields` is a
comma-joined subset of `brand,name,size`.

`add_cigar_abandoned` is suppressed after a successful save — the save sets a
completion flag that the blur handler checks — so navigating away having added a
cigar is not counted as abandonment. Verify this first if abandonment ever looks
implausibly high.

Funnel to build in PostHog: `screen_view` (AddCigar) → `add_cigar_brand_selected`
→ `add_cigar_name_selected` → `add_cigar_size_selected` → `add_cigar_attempted`
→ `cigar_added`. `add_cigar_validation_failed` and `add_cigar_save_failed`
explain the gap between the last two steps.

Logic is unit-tested by `node scripts/verify-addcigar-logic.js`.

### Guest onboarding funnel
| Event | Properties |
|------|------------|
| `onboarding_viewed` | — |
| `explore_as_guest` | — |
| `existing_user_signin_selected` | — |
| `guest_first_cigar_added` | `cigar_count` |
| `guest_signup_prompt_viewed` | `cigar_count` |
| `guest_signup_method_selected` | `method` (apple/email), `cigar_count` |
| `guest_signup_dismissed` | `cigar_count` |
| `guest_data_migration_started` | `cigar_count` |
| `guest_data_migration_completed` | — |
| `guest_data_migration_failed` | `error` |

## Authentication methods

Sign in with Apple is the primary path on iOS (`lib/appleAuth.js`, surfaced by
`components/AppleSignInButton.js`); email/password is the fallback. Google is not
implemented and its buttons were removed — do not re-add a button before the
provider works, as non-functional auth UI risks an App Review rejection under
Guideline 2.1.

Apple sign-in and sign-up are the same call: Apple does not distinguish them and
Supabase creates the user on first token exchange. Distinguishing them is a
labelling problem only — nothing functional branches on it. Guest migration is
driven by the persisted guest-mode flag (`cavaro_guest_mode`, read through
`isGuestRef`), never by whether a sign-in looks new.

For the label, `signInWithApple` uses persisted state rather than server
timestamps: `lib/authState.js` records which Supabase user ids have completed
auth on this device. A recorded id is conclusively returning; an unrecorded one
is labelled by the UI the user came from (`intent: 'signup'` for the signup
screen and guest prompt, `'signin'` for the login screen). The `device_knew_user`
property carries the raw signal so the ambiguous case — a returning user on a
fresh install, who has no local record — can be filtered out in analysis.

### Nonce and token validation

The native request sends Apple the SHA-256 hash of a random nonce, which Apple
copies verbatim into the identity token's `nonce` claim. The RAW nonce goes to
`signInWithIdToken`, and Supabase hashes it and compares against the claim, so a
token replayed without the matching raw nonce is rejected. Token authenticity is
Supabase's responsibility: it verifies the signature against Apple's JWKS plus
issuer, audience (the bundle identifier registered as a Client ID on the
provider) and expiry before issuing a session.

`isAppleAuthAvailable()` reports device/OS capability only. It does **not** check
the entitlement, the App ID capability, or the Supabase provider — all three can
be wrong while it still returns true, with the failure landing on `signInAsync`.
That case is mapped to `APPLE_NOT_CONFIGURED` with an actionable message.

### Guest migration safety

`hydrateUserData` sets a persisted `cavaro_migration_pending` flag before a guest
migration and clears it only after confirming, by identity triple, that the
server holds every local cigar. While the flag is set, `wipeLocalUserData` is
skipped on sign-out — local rows are the only copy and must not be deleted
before persistence is confirmed. A stale flag from an earlier failure is
re-confirmed and cleared on the next successful sync.

Cigar identity is `(brand, name, length)` trimmed, matched exactly
(`lib/cigarIdentity.js`). `node scripts/verify-migration-logic.js` exercises the
duplicate, near-miss-spelling, partial-push and incomplete-row cases.

Apple returns the display name and email **only on the first authorization** for
a given Apple ID + app pair. `lib/appleAuth.js` persists the name into
`user_metadata.first_name` immediately for that reason; there is no way to ask
again short of the user revoking access in iOS Settings. Users who choose Hide
My Email arrive as `…@privaterelay.appleid.com`, which is what lands in the
PostHog `email` person property.

`guest_signup_method_selected` fires on method choice. For Apple it fires after
the sheet succeeds, so cancels and failures show up as `login_failed`
(`method: apple`) rather than as a method selection.

## Catalog loading

The ~1MB / ~1200-row catalog is fetched through a single shared entry point,
`syncCatalogCache()` in `lib/catalogSync.js`. It is deduplicated (concurrent
callers share one request) and rate limited (`CATALOG_TTL_MS`, 5 minutes).

**No screen may await it before rendering.** Home, Collection and Add Cigar read
the local cache with `getCachedCatalogRows()` first and let the refresh land in
the background. Home previously did `await syncCatalogCache()` inside
`getHomeDashboard()`, which blocked the entire first-run screen on the download —
with a 20s catalog the dashboard showed a bare "Loading..." the whole time.

Writes are upsert-first, delete-last within one transaction. At every point the
table holds every current row, so a reader that interleaves can only ever see
extra stale rows, never a catalog missing entries. Deletions are scoped to brands
present in the response, because `server/scripts/import*Catalog.js` delete and
re-insert a brand's rows — a re-import that drops a vitola really does remove it
upstream. A response that omits a brand never deletes that brand's cached rows.
Reconciliation logic is unit-tested by `node scripts/verify-catalog-sync-logic.js`.

## Known instrumentation fixes

**`cigar` breakdown key deduped.** `trackCigarAdded` built the key as brand +
line + name, so catalog rows that repeat a value produced `"Arturo Fuente Don
Carlos Don Carlos"`. Segments are now deduped case-insensitively
(`buildCigarKey` in `lib/addCigarValidation.js`). This changes the key for
affected cigars, so trends spanning the fix will show the old and new spellings
as separate series — the new one is correct.

**Selection events no longer re-fire on return.** Navigating back to Add Cigar
does not unmount it, so the previous brand/name/size are still in state. The
per-visit tracker used to be cleared on focus, which meant re-picking the same
value emitted a second `add_cigar_*_selected`. It is now seeded from the current
selection instead.

**`guest_first_cigar_added` is misnamed** (pre-existing, unchanged): it fires on
every guest add, not just the first. Filter on `cigar_count = 1` for the first.


`onboarding_viewed` previously fired twice for any guest who tapped Explore:
once on `Welcome` mount and again from the `onExplore` callback in
`navigation/AuthStack.js`. The callback no longer tracks, so first-step counts in
any onboarding funnel were inflated before this fix — treat pre-fix
`onboarding_viewed` totals as roughly double for users who got past Welcome.

## User identification

Each device is assigned a persistent anonymous ID (UUID v4) on first launch, stored in `AsyncStorage`. Pre-auth events (screen views on Landing/Login/Signup, `landing_cta`, etc.) are tracked under this device ID so each person gets their own PostHog profile even before signing in.

When a user signs in (Supabase), `setUserId` sends a PostHog `$identify` event that merges the anonymous device profile into the authenticated user profile (`user.id`). This means:

- Pre-login activity is attributed to the correct user retroactively.
- Each device has its own anonymous profile (no more shared "anonymous" bucket).
- PostHog's person merge handles the join automatically.

`initAnalytics()` is called during `AuthProvider` startup (before `setUserId`) to ensure the anonymous ID is available before any events fire.

## Most popular cigars

In PostHog, create a **Trends** insight:

1. Event: `cigar_added`
2. Breakdown by: `cigar` (or `brand` for brand-level)
3. Date range: last 7 or 30 days
4. Optional: formula/property sum on `quantity` if you want sticks added, not unique add-actions

Search “add to Cavaro” clicks are `add_from_search` and fire before the cigar is actually saved. Use `cigar_added` for inventory popularity.

## Taste Profile add paths

The Taste Profile screen has two ways to add a cigar, and they track differently:

- The bottom **Add to collection** button opens the prefilled Add Cigar form. It fires `add_from_search` on tap; `cigar_added` (`source: catalog`) only follows if the user completes the form.
- The header **plus** is a one-tap quick add straight into a humidor. It fires `quick_add_from_search` plus `cigar_added` (`source: quick_add`) together, after the write succeeds.

`incremented` on `quick_add_from_search` distinguishes topping up a cigar the user already stores from adding a new one; `humidor_count` shows how often the humidor picker had to appear.
