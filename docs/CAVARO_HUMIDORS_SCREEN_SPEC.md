# CAVARO_HUMIDORS_SCREEN_SPEC.md

# Purpose

The **Humidors** screen is the operational heart of Cavaro.

Unlike **My Collection**, this screen represents only cigars that are
currently available to smoke.

Think: - Inventory - Physical humidors - Conditions - Quick actions

Not: - Lifetime history - Statistics - Recommendations

------------------------------------------------------------------------

# Design Goals

The screen should feel like opening a luxury humidor.

Avoid looking like a spreadsheet.

Priorities:

1.  Beautiful
2.  Fast to scan
3.  Inventory focused
4.  Premium
5.  Minimal

------------------------------------------------------------------------

# Screen Layout

## Header

Title: Humidors

Subtitle: Manage your humidors and inventory

Right actions: - Messages - More menu

------------------------------------------------------------------------

## Featured Humidor

The primary humidor should be displayed as a hero card.

Contents:

-   Humidor photo (large)
-   Humidor name
-   Total cigars
-   Humidity
-   Temperature
-   "View Humidor" button

If multiple humidors exist, allow swipe between them.

------------------------------------------------------------------------

## Overview

Display four compact metric cards:

-   Humidors
-   Cigars
-   Average Humidity
-   Average Temperature

Do not make these dominate the screen.

------------------------------------------------------------------------

## Inventory Section

Segmented control:

-   All Cigars
-   By Humidor
-   Recently Added
-   Favorites

Default: All Cigars

------------------------------------------------------------------------

## Inventory Card

Each cigar card should contain:

Left: - Large cigar image

Center: - Name - Brand - Vitola - Size - Status icons: - Cellared -
Move - Aging timer

Right: - Quantity badge - Chevron

Card style: - Premium dark background - Thin gold border - 20px radius -
Soft elevation

------------------------------------------------------------------------

## Floating Action Button

Large circular gold button.

Label:

Add Cigar

Primary action: Launch Add Cigar flow.

------------------------------------------------------------------------

## Bottom Navigation

Tabs:

-   Home
-   Humidors
-   Collection
-   My Taste
-   Journal

Humidors is active.

------------------------------------------------------------------------

# Interaction Rules

Tap cigar: Open cigar details.

Swipe left: Quick actions: - Smoke - Move - Edit

Long press: Multi-select mode.

------------------------------------------------------------------------

# Empty State

If no cigars exist:

Headline: Your humidor is waiting.

Body: Add your first cigar and start building your collection.

Primary button: Add Cigar

------------------------------------------------------------------------

# Cursor Acceptance Criteria

-   Matches premium Cavaro theme.
-   Uses reusable components only.
-   No duplicated styling values.
-   Hero humidor card is visually dominant.
-   Inventory cards are easy to scan.
-   Floating button does not overlap content.
-   Supports future multiple humidors.
-   Responsive on iPhone sizes.
-   Ready for animation and haptics later.

------------------------------------------------------------------------

# Cursor Prompt

Read this specification together with:

-   CAVARO_PRODUCT_SPEC.md
-   CAVARO_DESIGN_TASKS.md

Build ONLY the Humidors screen.

Do not modify Home, Collection, My Taste, or Journal.

Stop after implementation and wait for review.
