# CAVARO_HUMIDORS_SCREEN_SPEC.md

## Purpose

The **Humidors** screen represents the user's **current cigar
inventory**.

This screen answers:

> What cigars do I currently have available to smoke?

It should **not** represent lifetime collection history, taste
preferences, or long-term stats. Those belong in **Collection**, **My
Taste**, and **Journal**.

------------------------------------------------------------------------

## Core Design Principle

The Humidors screen should be practical first, premium second.

It should feel refined and luxurious, but it should not behave like a
marketing page. Users will visit this screen repeatedly, so it should be
fast to scan and easy to use.

Avoid oversized hero cards that take up too much space unless they solve
a real usability problem.

------------------------------------------------------------------------

## Screen Behavior

### Single Humidor User

If the user has only one humidor, do **not** show a large featured
humidor hero card.

Instead, show:

1.  Header
2.  Current inventory summary
3.  Inventory filters
4.  Inventory list

The humidor itself is the context, but the cigars are the primary
content.

------------------------------------------------------------------------

### Multiple Humidor User

If the user has more than one humidor, show a compact horizontal humidor
selector.

Examples: - Main Humidor - Travel Humidor - Office Humidor - Cabinet

The selected humidor controls the inventory list below.

There should also be an **All Cigars** option.

------------------------------------------------------------------------

## Header

Title:

``` txt
Humidors
```

Subtitle:

``` txt
Current inventory
```

Right actions: - Message / notes icon - More menu

Do not use a large Cavaro logo on this screen. This is a utility screen.

------------------------------------------------------------------------

## Inventory Summary

Show a compact summary near the top.

For one humidor:

``` txt
Main Humidor

3 Cigars
69% RH
68°F
```

For multiple humidors:

``` txt
All Humidors

78 Cigars
3 Humidors
Avg. 69% RH
Avg. 68°F
```

This should be compact, not a large hero image.

------------------------------------------------------------------------

## Humidor Selector

Only show this if the user has multiple humidors.

Layout: - Horizontal scroll - Compact cards or pill-style selector -
Active humidor uses gold border/fill - Inactive humidors are muted

Each selector item should show: - Humidor name - Cigar count - Optional
humidity/temperature

Example:

``` txt
[All] [Main 48] [Travel 12] [Office 18]
```

Tapping a humidor filters the inventory below.

------------------------------------------------------------------------

## Removed Element: View Humidor Button

Do **not** include a **View Humidor** button on the main Humidors
screen.

Reason: - It is redundant if the screen already shows inventory. - It
creates unnecessary navigation. - It makes the UI feel like a marketing
mockup instead of a daily-use app.

If humidor details are needed, make the humidor selector card itself
tappable or add a secondary details action in the overflow menu.

------------------------------------------------------------------------

## Optional Humidor Details Screen

A Humidor Details screen may exist later, but it is not required for the
main Humidors screen.

If added, it should focus on the physical humidor:

-   Humidor name
-   Humidity
-   Temperature
-   Capacity
-   Created date
-   Notes
-   Material / brand if supplied
-   Cigars stored inside
-   Condition history

Entry points: - Tap selected humidor summary - Long press humidor
selector card - Overflow menu → Humidor Details

Do not place a large "View Humidor" button on the main screen.

------------------------------------------------------------------------

## Inventory Section

Section title:

``` txt
Inventory
```

Subtitle:

``` txt
Available to smoke
```

Filters: - All Cigars - By Humidor - Recently Added - Favorites -
Cellared

Default: - All Cigars if multiple humidors - Current humidor if one
humidor

------------------------------------------------------------------------

## Inventory Card

Each cigar card should be easy to scan.

Content:

Left: - Optional cigar image or small cigar thumbnail

Center: - Cigar name - Brand - Size / vitola - Status icons

Right: - Quantity badge - Chevron or tap affordance

Example:

``` txt
Black Market
Alec Bradley
Size: 6x50 • Toro

[status icons]                         [1]
```

Status icons may include: - Favorite - Cellared - Moved / transfer -
Smoked history - Notes

Do not overcrowd the card. If there are too many statuses, show only the
most important 2--3.

------------------------------------------------------------------------

## Floating Action Button

Use a gold floating action button.

Primary action:

``` txt
Add Cigar
```

Rules: - Should not cover inventory content. - Should sit above the
bottom navigation. - Should include a label only if space allows. - On
tap, opens Add Cigar flow.

------------------------------------------------------------------------

## Bottom Navigation

Tabs:

1.  Home
2.  Humidors
3.  Collection
4.  My Taste
5.  Journal

Active tab: - Humidors

Style: - Dark background - Gold active icon and label - Muted inactive
icons - Rounded top corners or soft elevated bar

------------------------------------------------------------------------

## Interactions

Tap cigar card: - Open cigar details.

Swipe cigar card: - Quick actions: - Smoke - Move - Edit

Long press cigar card: - Multi-select mode.

Tap quantity badge: - Open quantity adjustment sheet.

Tap Add Cigar: - Launch Add Cigar flow.

Tap humidor selector: - Filter inventory.

------------------------------------------------------------------------

## Empty States

### No Humidors

Headline:

``` txt
Create your first humidor
```

Body:

``` txt
Add a humidor to start tracking your cigar inventory.
```

Primary action:

``` txt
Add Humidor
```

------------------------------------------------------------------------

### Humidor Has No Cigars

Headline:

``` txt
Your humidor is waiting
```

Body:

``` txt
Add your first cigar and start building your inventory.
```

Primary action:

``` txt
Add Cigar
```

------------------------------------------------------------------------

## Visual Direction

The screen should feel: - Warm - Premium - Useful - Organized - Calm

Avoid: - Giant decorative hero cards for single-humidor users - Overly
tall empty gaps - Large visual sections that do not help daily use -
Spreadsheet-like rows - Harsh black/white contrast - Bright colors

Use: - Warm black background - Dark brown cards - Muted gold accents -
Soft borders - Generous but not excessive spacing

------------------------------------------------------------------------

## Suggested Layout: Single Humidor

``` txt
Humidors
Current inventory

Main Humidor
3 Cigars • 69% RH • 68°F

Inventory
Available to smoke

[All Cigars] [Recently Added] [Favorites] [Cellared]

[Black Market card]
[Don Pepin Garcia card]
[Aniversario card]

                           [+]
Bottom Nav
```

------------------------------------------------------------------------

## Suggested Layout: Multiple Humidors

``` txt
Humidors
Current inventory

All Humidors
78 Cigars • 3 Humidors • Avg. 69% RH

[All] [Main 48] [Travel 12] [Office 18]

Inventory
Available to smoke

[All Cigars] [Recently Added] [Favorites] [Cellared]

[Black Market card]
[Don Pepin Garcia card]
[Aniversario card]

                           [+]
Bottom Nav
```

------------------------------------------------------------------------

## Cursor Acceptance Criteria

-   Remove the large featured humidor hero card from the main Humidors
    screen.
-   Remove the View Humidor button.
-   If only one humidor exists, prioritize inventory immediately.
-   If multiple humidors exist, show a compact humidor selector.
-   Inventory cards are visible without excessive scrolling.
-   The screen remains premium and aligned with Cavaro's dark/gold
    design system.
-   The Humidors screen represents current inventory only.
-   No lifetime stats should appear here.
-   No taste/recommendation data should dominate this screen.
-   The Add Cigar button is accessible but does not block content.

------------------------------------------------------------------------

## Cursor Implementation Prompt

Read this file together with:

-   `/docs/CAVARO_PRODUCT_SPEC.md`
-   `/docs/CAVARO_DESIGN_TASKS.md`

Update only the Humidors screen.

Goals:

1.  Remove the large featured humidor hero card.
2.  Remove the View Humidor button.
3.  Replace the top area with a compact inventory summary.
4.  Show a humidor selector only when multiple humidors exist.
5.  Move the inventory list higher on the screen.
6.  Keep the design premium, warm, dark, and gold-accented.
7.  Stop after implementation and wait for review.

Do not modify Home, Collection, My Taste, or Journal.
