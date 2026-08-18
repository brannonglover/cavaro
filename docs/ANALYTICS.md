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
- Tab navigation: Favorites, Dislikes, Cavaro, Search, Pairing
- Stack screens: CavaroList, AddCigar, EditCigar, Landing, Login, Signup

### Feature events
| Event | Properties |
|------|------------|
| `cigar_added` | `cigar` (Brand Line Name), `brand`, `name`, `line`, `length`, `quantity`, `source` (catalog/custom) |
| `cigar_edited` | — |
| `cigar_favorited` | — |
| `cigar_unfavorited` | — |
| `cigar_disliked` | — |
| `cigar_smoked` | — |
| `personal_notes_saved` | — |
| `strength_profile_saved` | — |
| `search_performed` | `keyword_count`, `has_results` |
| `add_from_search` | `brand`, `name` |
| `pairing_requested` | `has_result` |
| `landing_cta` | `action` (get_started/subscribe/already_have_account/restore_subscription) |
| `login_success` | — |
| `signup_success` | `tier` |

## User identification

When a user signs in (Supabase), their `user.id` is used as the distinct ID for analytics. Anonymous users are tracked with `distinct_id: 'anonymous'`.

## Most popular cigars

In PostHog, create a **Trends** insight:

1. Event: `cigar_added`
2. Breakdown by: `cigar` (or `brand` for brand-level)
3. Date range: last 7 or 30 days
4. Optional: formula/property sum on `quantity` if you want sticks added, not unique add-actions

Search “add to Cavaro” clicks are `add_from_search` and fire before the cigar is actually saved. Use `cigar_added` for inventory popularity.
