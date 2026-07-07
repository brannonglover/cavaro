# Cavaro Design Task Roadmap

Use this file as the working checklist for Cursor. Do not ask Cursor to build the entire app at once. Complete one task, review it, then move to the next.

---

## How to Use This in Cursor

1. Save this file in your project as:
   `/docs/CAVARO_DESIGN_TASKS.md`

2. Keep the design reference image in:
   `/design/cavaro-design-reference.png`

3. Tell Cursor:
   > Read `/docs/CAVARO_DESIGN_TASKS.md` and `/docs/CAVARO_PRODUCT_SPEC.md`. Start with Task 001 only. Do not continue to the next task until I approve it.

4. After each task, run the app and compare it to the design reference.

---

# Phase 0 — Design Foundation

## Task 001 — Create Cavaro Theme Tokens

Create a shared theme file for Cavaro.

Suggested file:
`src/theme/cavaroTheme.ts`

Include:

```ts
export const colors = {
  background: "#0D0B09",
  surface: "#17120E",
  surfaceLight: "#211912",
  surfaceElevated: "#241B13",
  gold: "#C8A45D",
  goldMuted: "#8F7440",
  text: "#F5EFE7",
  textMuted: "#A79C8E",
  border: "#2C241A",
  success: "#7E9F6D",
  danger: "#B85C4A",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
};
```

Acceptance criteria:
- Theme file exists.
- Colors are exported.
- Spacing is exported.
- Border radius values are exported.
- No screen UI should be changed yet.

---

## Task 002 — Create Base Screen Layout

Create reusable layout components.

Suggested files:
- `src/components/layout/CavaroScreen.tsx`
- `src/components/layout/CavaroSection.tsx`

`CavaroScreen` should:
- Use safe area.
- Use the Cavaro background color.
- Support scrollable content.
- Add default horizontal padding.
- Support optional bottom padding for tab navigation.

`CavaroSection` should:
- Provide consistent vertical spacing.
- Accept title and optional right action text.

Acceptance criteria:
- Layout components exist.
- They use theme tokens.
- They are reusable.
- No individual app screen should be redesigned yet.

---

## Task 003 — Create Typography Components

Create reusable text components.

Suggested file:
`src/components/ui/CavaroText.tsx`

Variants:
- `hero`
- `title`
- `sectionTitle`
- `body`
- `caption`
- `label`
- `metric`

Acceptance criteria:
- Text colors come from theme.
- Headings feel premium and spacious.
- Body text remains readable.
- Components can be reused across all screens.

---

## Task 004 — Create Premium Card Component

Create a reusable premium card.

Suggested file:
`src/components/ui/PremiumCard.tsx`

Features:
- Dark elevated background.
- Soft gold/brown border.
- Rounded corners.
- Optional pressable behavior.
- Optional padding override.
- Optional children.

Acceptance criteria:
- Card matches Cavaro luxury direction.
- Uses theme tokens.
- No hard white borders.
- No pure black card backgrounds.

---

## Task 005 — Create Gold Button Library

Create reusable buttons.

Suggested file:
`src/components/ui/CavaroButton.tsx`

Variants:
- `primary`
- `secondary`
- `ghost`
- `icon`
- `floating`

Acceptance criteria:
- Primary button uses warm gold.
- Secondary button uses transparent background with gold border.
- Ghost button uses text-only styling.
- Floating button is round with a gold fill.

---

## Task 006 — Create Badge / Chip Components

Create reusable badges.

Suggested file:
`src/components/ui/CavaroBadge.tsx`

Variants:
- `default`
- `gold`
- `success`
- `warning`
- `danger`
- `muted`

Use cases:
- Excellent Match
- Good Match
- Mixed Experience
- Needs Another Chance
- Cellared
- Favorite
- New

Acceptance criteria:
- Badges are compact.
- Corners are rounded.
- Colors are warm and muted.
- No bright neon colors.

---

## Task 007 — Create Bottom Navigation Style

Create or update the app bottom navigation.

Tabs:
- Home
- Humidors
- Collection
- My Taste
- Journal

Style:
- Dark raised background.
- Gold active icon and label.
- Muted inactive icons.
- Rounded visual feel.
- Icons inspired by the design reference.

Acceptance criteria:
- All five tabs exist.
- Active tab is clearly gold.
- Inactive tabs are muted.
- Navigation feels consistent with the Facebook cover / design board direction.

---

# Phase 1 — Home Screen

## Task 010 — Home Header

Build only the Home header.

Content:
- Cavaro logo or wordmark
- Greeting such as “Good Evening, Brannon”
- Notification icon

Acceptance criteria:
- Header uses Cavaro spacing.
- Does not look crowded.
- Uses premium typography.

---

## Task 011 — Smoke Recommendation Hero Card

Build the large recommendation card.

Content:
- Section label: Smoke Recommendation
- Cigar name
- Match score
- Short reason
- View Details action
- Background cigar image or dark placeholder

Acceptance criteria:
- Card feels like a hero.
- Gold accents are used sparingly.
- It should be the visual anchor of the Home screen.

---

## Task 012 — At a Glance Stats Row

Build stats row.

Stats:
- In Humidors
- Cellared
- Smoked
- Brands

Acceptance criteria:
- Uses reusable stat cards.
- Four stats fit cleanly.
- Text is readable on mobile.

---

## Task 013 — Recently Added Carousel

Build horizontal carousel.

Each card shows:
- Cigar image
- Name
- Brand
- Small chevron or action

Acceptance criteria:
- Cards are compact.
- Horizontal scrolling works.
- Empty state exists.

---

## Task 014 — Recently Smoked Card

Build recently smoked section.

Content:
- Cigar name
- Date smoked
- Rating
- Small cigar image

Acceptance criteria:
- Uses `PremiumCard`.
- Rating is visually distinct.
- Section has “See All”.

---

## Task 015 — Humidor Conditions Summary

Build conditions summary.

Content:
- Humidor name
- Humidity
- Temperature
- Small progress indicator

Acceptance criteria:
- Shows one or more humidors.
- Humidity range is visually clear.
- Uses muted green only for healthy range.

---

## Task 016 — Assemble Home Screen

Combine Tasks 010–015.

Acceptance criteria:
- Home screen matches the design reference direction.
- No section feels cramped.
- Bottom nav remains visible.
- Scroll behavior works.

---

# Phase 2 — Humidors Screen

## Task 020 — Humidors Header

Build header.

Content:
- Title: My Humidors
- Add button

Acceptance criteria:
- Clear title.
- Gold add button.
- Consistent spacing.

---

## Task 021 — Humidor List Card

Build reusable humidor card.

Content:
- Humidor name
- Total cigars
- Humidity
- Temperature
- Optional image
- Chevron

Acceptance criteria:
- Reusable component exists.
- Works with or without image.
- Tap target is accessible.

---

## Task 022 — Total Inventory Card

Build total inventory summary.

Content:
- Total cigars
- Number of humidors
- Optional value

Acceptance criteria:
- Simple and readable.
- Does not overpower humidor cards.

---

## Task 023 — Humidors Assembly

Combine header, humidor cards, and total inventory.

Acceptance criteria:
- This screen represents current inventory only.
- It should not include lifetime collection stats.

---

# Phase 3 — Collection Screen

## Task 030 — Collection Hero

Build lifetime stats hero.

Content:
- Title: My Collection
- Subtitle: Lifetime Journey
- Cigars Smoked
- Different Cigars
- Brands
- Countries
- Since date

Acceptance criteria:
- Clearly different from Humidors.
- Focuses on lifetime history.
- Uses large premium metrics.

---

## Task 031 — Favorite Brands Section

Build favorite brands section.

Content:
- Brand logo/avatar
- Brand name
- Count or average rating

Acceptance criteria:
- Horizontal layout.
- Looks premium.
- Empty state exists.

---

## Task 032 — Highest Rated Section

Build highest rated cigar section.

Content:
- Cigar card
- Rating
- Stars
- Small image

Acceptance criteria:
- Uses reusable cigar card.
- Rating is clear.
- Section has See All.

---

## Task 033 — Most Smoked Section

Build most smoked list.

Content:
- Cigar name
- Count smoked
- Small icon/image

Acceptance criteria:
- Compact list.
- Easy to scan.

---

## Task 034 — Collection Assembly

Combine collection sections.

Acceptance criteria:
- Collection does not show current inventory as the primary focus.
- It tells the user’s cigar journey.

---

# Phase 4 — My Taste Screen

## Task 040 — Taste Header

Build header.

Content:
- Title: My Taste
- Subtitle: Based on X reviews

Acceptance criteria:
- Premium and simple.
- Review count is clear.

---

## Task 041 — Palate Profile Card

Build palate profile card.

Content:
- Taste wheel placeholder or radar chart placeholder
- Preferred strength
- Preferred wrapper
- Favorite flavors

Acceptance criteria:
- Does not need final chart math yet.
- Should visually communicate “your cigar DNA.”

---

## Task 042 — You Love Chips

Build “You Love” section.

Example chips:
- Chocolate
- Espresso
- Cedar
- Black Pepper
- Leather
- Long Finish

Acceptance criteria:
- Uses `CavaroBadge`.
- Chips wrap correctly.

---

## Task 043 — Usually Not Your Style Chips

Build “Usually Not Your Style” section.

Example chips:
- Floral
- Mild
- Sweet
- Connecticut
- Short Finish

Acceptance criteria:
- Avoid harsh language.
- Do not use “Avoid” as the main label.
- Uses muted warning/danger style.

---

## Task 044 — Top Match For You Card

Build recommendation card.

Content:
- Cigar name
- Match score
- Reasons
- Action

Acceptance criteria:
- Recommendation feels advisory, not absolute.
- Shows why the match exists.

---

## Task 045 — My Taste Assembly

Combine My Taste screen.

Acceptance criteria:
- Helps user decide what to buy next.
- Does not tell user to avoid a cigar from one bad review.
- Uses confidence-style language.

---

# Phase 5 — Journal Screen

## Task 050 — Journal Header

Build Journal header.

Content:
- Title: My Journal
- Add button

Acceptance criteria:
- Consistent with Humidors header.

---

## Task 051 — Journal Filters

Build filter pills.

Filters:
- All
- Reviews
- Favorites

Acceptance criteria:
- Active filter is gold.
- Inactive filters are muted.

---

## Task 052 — Journal Timeline Card

Build review timeline card.

Content:
- Date
- Cigar image
- Cigar name
- Rating
- Star row
- Optional would buy again

Acceptance criteria:
- Works in a vertical timeline.
- Uses reusable components.

---

## Task 053 — Journal Summary Footer

Build summary.

Content:
- Average rating
- Would buy again percentage

Acceptance criteria:
- Simple and useful.
- Not visually overwhelming.

---

## Task 054 — Journal Assembly

Combine Journal screen.

Acceptance criteria:
- Journal feels like smoking history, not inventory.
- Easy to scan past reviews.

---

# Phase 6 — Cellaring

## Task 060 — Cellaring Data Model

Add cellaring support.

Fields:
- cigarId
- quantity
- startedAt
- targetMonths
- targetDate
- notes

Acceptance criteria:
- Does not automatically cellar every cigar.
- User must intentionally start cellaring.

---

## Task 061 — Cellaring Progress Component

Build progress card.

Content:
- Cigar name
- Months elapsed
- Target months
- Progress bar
- Ready date

Acceptance criteria:
- Uses gold progress bar.
- Clear “ready” state.

---

## Task 062 — Start Cellaring Flow

Build start cellaring action.

Options:
- 6 months
- 12 months
- 18 months
- 24 months
- Custom

Acceptance criteria:
- User can start cellaring from a humidor item.
- Target is saved.

---

# Phase 7 — Polish

## Task 070 — Empty States

Create empty states for:
- No humidors
- No collection history
- No journal entries
- No taste profile yet
- No cellared cigars

Acceptance criteria:
- Helpful, warm copy.
- Clear primary action.

---

## Task 071 — Loading States

Create skeleton/loading states.

Acceptance criteria:
- Uses dark shimmer or subtle placeholders.
- No bright gray blocks.

---

## Task 072 — Haptics

Add haptics for:
- Add cigar
- Mark smoked
- Favorite
- Start cellaring

Acceptance criteria:
- Haptics are subtle.
- Do not overuse.

---

## Task 073 — Animation Pass

Add subtle animations:
- Card press scale
- Fade in sections
- Bottom nav active state
- Progress bar fill

Acceptance criteria:
- Smooth and premium.
- No bouncy/cartoon effects.

---

# Cursor Rule

After every task, stop and ask for review.

Do not continue to the next task without approval.
