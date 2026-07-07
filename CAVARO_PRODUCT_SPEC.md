# Cavaro Product Design & Engineering Specification

**Product:** Cavaro  
**Category:** Premium cigar collection, humidor inventory, tasting journal, and personal cigar advisor app  
**Primary Goal:** Transform Cavaro from a cigar inventory tracker into a premium cigar companion that helps enthusiasts manage what they own, remember what they have smoked, understand their palate, and choose better cigars in the future.

---

## 1. Product Vision

Cavaro should feel like opening a luxury humidor, not managing a spreadsheet.

The app should combine practical inventory management with a refined collector experience. The current humidor screen answers, “What cigars do I physically have right now?” The new Collection and My Taste experiences should answer deeper questions:

- What cigars have I explored over time?
- What brands, wrappers, strengths, vitolas, and flavor notes do I prefer?
- What should I buy next?
- Which cigars are worth revisiting?
- Which cigars are probably not my style?
- What cigars am I intentionally cellaring?

Cavaro should become the user’s personal cigar profile and buying advisor.

---

## 2. Product Principles

### 2.1 Premium Over Utility

Every screen should feel polished, warm, and intentional. Even functional areas like inventory should have a cigar-lounge feel.

### 2.2 Humidor Is Not Collection

Humidors represent current inventory. My Collection represents lifetime cigar history, preferences, milestones, and personal identity as a collector.

### 2.3 Cellaring Is Intentional

Every cigar is stored, but not every cigar is being aged. A cigar should only become “Cellared” when the user intentionally marks it that way.

### 2.4 One Bad Review Is Not Enough

Cavaro should not tell users to avoid a cigar after one poor experience. It should use confidence-based language such as “Needs Another Chance,” “Mixed Experience,” or “Unlikely Match.”

### 2.5 The App Should Learn

The more the user logs, rates, smokes, buys, and journals, the smarter Cavaro should become.

---

## 3. Target Users

### 3.1 New Enthusiast

Wants to remember what they bought, what they liked, and what to try next. Needs guidance without feeling overwhelmed.

### 3.2 Active Hobbyist

Owns multiple cigars, possibly one or more humidors. Wants inventory, notes, and smarter buying guidance.

### 3.3 Serious Collector

Tracks aging, purchase history, rare cigars, prices, favorites, and long-term collection trends.

---

## 4. Brand Direction

Cavaro should feel:

- Premium
- Warm
- Refined
- Masculine but not aggressive
- Elegant
- Minimal
- Collector-focused
- Knowledgeable
- Sophisticated

Avoid:

- Bright generic app colors
- Spreadsheet-like layouts
- Cheap tobacco-store styling
- Overly playful gamification
- Heavy skeuomorphism

Design inspiration:

- Luxury cigar lounge
- Apple Wallet
- Apple Health trends
- Porsche app
- High-end watch apps
- Premium wine cellar apps

---

## 5. Design System

### 5.1 Color Palette

```ts
export const colors = {
  background: '#0D0B09',
  backgroundElevated: '#120F0B',
  surface: '#17120E',
  surfaceLight: '#211912',
  surfaceWarm: '#2A1E14',
  border: '#2C241A',

  gold: '#C8A45D',
  goldBright: '#D7BA73',
  goldMuted: '#8F7440',

  text: '#F5EFE7',
  textMuted: '#A79C8E',
  textSubtle: '#756B60',

  success: '#7E9F6D',
  warning: '#C49A4A',
  danger: '#B85C4A',

  black: '#050403',
  white: '#FFFFFF',
};
```

### 5.2 Typography

Use the system font for performance and clarity. If custom fonts are added later, use a refined serif for large display headings and a clean sans-serif for body content.

Suggested hierarchy:

```ts
export const typography = {
  display: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
};
```

### 5.3 Spacing

```ts
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};
```

### 5.4 Cards

Cards are the core UI element. They should feel like dark leather panels with subtle borders and soft shadows.

Card rules:

- Background: `surface`
- Border: `border`
- Radius: 20–28px
- Padding: 16–24px
- Use gold for important values only
- Avoid heavy outlines

### 5.5 Buttons

Primary button:

- Gold background
- Dark text
- Rounded pill
- Medium weight label

Secondary button:

- Transparent or dark surface
- Gold text
- Thin gold border or no border

Destructive button:

- Muted red, not bright red

### 5.6 Bottom Navigation

Use the navigation style inspired by the original Cavaro Facebook cover graphic.

Tabs:

1. Home
2. Humidors
3. Collection
4. My Taste
5. Journal

Style:

- Dark elevated background
- Gold active state
- Muted gray inactive state
- Rounded top corners
- Soft top shadow
- Minimal icons
- Labels always visible unless space is tight

Suggested icons:

- Home: house
- Humidors: archive/box
- Collection: grid/library
- My Taste: sparkles/heart/radar
- Journal: notebook/edit

---

## 6. Information Architecture

### 6.1 Home

Dashboard. Shows the most useful daily information.

### 6.2 Humidors

Current inventory. What the user physically has available.

### 6.3 Collection

Lifetime cigar identity. What the user has smoked, collected, rated, and explored over time.

### 6.4 My Taste

Preference engine. What the user likes, dislikes, tends to avoid, and should buy next.

### 6.5 Journal

Smoking history and tasting notes.

### 6.6 Cellaring

Can be a subsection of Home, Humidors, or Collection at first. Later it can become its own screen if it grows.

---

## 7. Data Model

### 7.1 Cigar

A cigar is the master reference record.

```ts
export type CigarStrength = 'Mild' | 'Medium' | 'Medium-Full' | 'Full';

export type Cigar = {
  id: string;
  name: string;
  brand: string;
  line?: string;
  vitola?: string;
  length?: number;
  ringGauge?: number;
  country?: string;
  wrapper?: string;
  binder?: string;
  filler?: string;
  strength?: CigarStrength;
  imageUrl?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
};
```

### 7.2 Humidor

```ts
export type Humidor = {
  id: string;
  userId: string;
  name: string;
  humidity?: number;
  temperature?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};
```

### 7.3 HumidorItem

Represents current inventory.

```ts
export type HumidorItem = {
  id: string;
  userId: string;
  cigarId: string;
  humidorId: string;
  quantity: number;
  storedSince: string;
  purchaseDate?: string;
  purchasePrice?: number;
  purchaseLocation?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};
```

### 7.4 SmokeJournalEntry

Represents one smoked cigar experience.

```ts
export type SmokeJournalEntry = {
  id: string;
  userId: string;
  cigarId: string;
  smokedDate: string;
  rating?: number; // 0-100 or 1-5 depending on app standard
  wouldBuyAgain?: boolean;
  notes?: string;

  likedFlavors: string[];
  dislikedFlavors: string[];

  strengthFeedback?: 'Too Mild' | 'Just Right' | 'Too Strong';
  draw?: 'Tight' | 'Good' | 'Loose';
  burn?: 'Poor' | 'Average' | 'Excellent';
  finish?: 'Short' | 'Medium' | 'Long';

  smokedFromHumidorItemId?: string;
  createdAt: string;
  updatedAt: string;
};
```

### 7.5 CellaredItem

Represents cigars intentionally set aside for aging/cellaring.

```ts
export type CellaredItem = {
  id: string;
  userId: string;
  cigarId: string;
  humidorId?: string;
  quantity: number;
  startedAt: string;
  targetMonths?: number;
  targetDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};
```

### 7.6 FlavorTag

```ts
export type FlavorTag = {
  id: string;
  label: string;
  category?: 'Sweet' | 'Spice' | 'Earth' | 'Wood' | 'Cream' | 'Fruit' | 'Other';
};
```

Suggested starter tags:

- Chocolate
- Coffee
- Espresso
- Cedar
- Leather
- Earth
- Pepper
- Cream
- Nuts
- Cocoa
- Cinnamon
- Vanilla
- Floral
- Fruit
- Toast
- Oak
- Hay
- Sweetness
- Spice

---

## 8. Screen Specifications

## 8.1 Home Screen

### Purpose

A premium dashboard that gives the user a quick snapshot of their cigar world.

### Should Answer

- What should I smoke tonight?
- What is new in my humidor?
- What is ready from my cellar?
- How is my collection trending?

### Main Sections

1. Greeting
2. Cavaro hero summary
3. Recommended Tonight
4. Ready From Cellar
5. Recently Added
6. Recently Smoked
7. Humidor Snapshot

### Example Layout

```txt
Good Evening
Cavaro

148 Cigars Owned
32 In Humidors
18 Cellared
287 Smoked

Recommended Tonight
[Large premium cigar card]

Ready From Cellar
[Cellaring progress card]

Recently Added
[Horizontal cigar cards]

Humidor Snapshot
Main Humidor  | 69% RH | 70°F | 42 Cigars
```

### Empty State

```txt
Welcome to Cavaro
Build your cigar profile by adding your first cigar.
[Add First Cigar]
```

---

## 8.2 Humidors Screen

### Purpose

Manage current inventory.

### Should Answer

- What cigars do I physically have right now?
- Where are they stored?
- How many do I have?
- Which cigars are available to smoke?

### Main Sections

1. Humidor cards
2. Inventory list/grid
3. Search
4. Filters
5. Quantity controls
6. Mark smoked
7. Move between humidors
8. Start cellaring

### Rules

- This screen should not show lifetime stats.
- This screen should not include smoked cigars unless the user is viewing history.
- Quantity changes should update current inventory only.

### Example Layout

```txt
Humidors

Main Humidor
42 Cigars | 69% RH | 70°F

Travel Humidor
8 Cigars

Inventory
[Padron 1964] x4
[Oliva Serie V] x6
[Davidoff Nicaragua] x2
```

---

## 8.3 My Collection Screen

### Purpose

Celebrate the user’s lifetime cigar journey.

### Should Answer

- What have I explored?
- What brands do I return to?
- What countries, wrappers, and vitolas define my journey?
- What are my milestones?

### Main Sections

1. Hero stats
2. Favorite brands
3. Top rated cigars
4. Most smoked cigars
5. Countries explored
6. Wrapper breakdown
7. Vitola preferences
8. Collection milestones
9. Timeline

### Example Layout

```txt
My Collection

1,248 Cigars Smoked
287 Different Cigars
63 Brands
41 Countries

Favorite Brands
Padron | Davidoff | Fuente

Top Rated
[Large cards]

Most Smoked
[List]

Wrapper Breakdown
[Chart-style cards]

Milestones
First 100 Cigars
25 Brands Tried
100 Ratings Logged
```

### Key Rule

My Collection is not the humidor. It should include lifetime history and profile-level stats, not just current inventory.

---

## 8.4 My Taste Screen

### Purpose

Help users understand their palate and buy smarter.

### Should Answer

- What do I consistently like?
- What do I usually not prefer?
- What cigars are likely matches?
- What cigars need another chance?
- Why did I like or dislike something?

### Main Sections

1. Taste summary
2. What You Love
3. Usually Not Your Preference
4. Favorite wrappers
5. Favorite countries
6. Preferred strength
7. Favorite flavors
8. Worth Revisiting
9. Unlikely Matches
10. Buy Next recommendations

### Tone Rules

Avoid harsh language like:

- Avoid this forever
- Bad cigar
- Never buy again

Use advisory language:

- Probably not your profile
- Mixed experience
- Needs another chance
- Unlikely match
- Strong match

### Example Layout

```txt
My Taste

Your Palate
Medium-Full | Maduro | Nicaragua | Chocolate | Coffee | Cedar

What You Love
Maduro wrappers
Nicaraguan tobacco
Toro vitolas
Chocolate notes
Long finish

Usually Not Your Preference
Mild body
Floral notes
Short finish

Worth Revisiting
Liga Privada No. 9
One low rating. Not enough data yet.

Unlikely Matches
Romeo y Julieta Reserva
4 low ratings. Often noted as too mild.
```

---

## 8.5 Journal Screen

### Purpose

Store smoking experiences and tasting notes.

### Should Answer

- What did I smoke?
- When did I smoke it?
- Did I like it?
- Would I buy it again?
- What flavors did I notice?
- How was the construction?

### Main Sections

1. Recent entries
2. Search journal
3. Filters
4. Rating summaries
5. Individual tasting notes

### Review Flow

When marking a cigar as smoked, collect:

1. Rating
2. Would buy again?
3. Liked flavors
4. Disliked flavors
5. Strength feedback
6. Draw
7. Burn
8. Finish
9. Notes

### Example Layout

```txt
Journal

Recently Smoked

Padron 1964
96 | Would Buy Again
Chocolate, Coffee, Cedar

Oliva Serie V
88 | Would Buy Again
Pepper, Earth, Cocoa
```

---

## 8.6 Cellaring Experience

### Purpose

Track cigars intentionally set aside to age.

### Rule

Do not automatically mark every cigar as aging. Every cigar is stored. Only user-selected cigars are cellared.

### Flow

User action:

```txt
Start Cellaring
```

Then choose:

- 6 months
- 12 months
- 18 months
- 24 months
- Custom

### Display

```txt
Cellared

Padron 1926
12 / 18 Months
Ready in 6 Months
```

### Labels

Preferred terms:

- Cellared
- Cellaring
- Ready From Cellar
- Reserve

Avoid overusing:

- Aging Tracker

---

## 9. Recommendation Engine

## 9.1 Taste Profile

Generate a taste profile from journal entries.

```ts
export type TasteProfile = {
  favoriteWrappers: string[];
  dislikedWrappers: string[];
  favoriteCountries: string[];
  dislikedCountries: string[];
  favoriteVitolas: string[];
  dislikedVitolas: string[];
  favoriteFlavors: string[];
  dislikedFlavors: string[];
  preferredStrength?: CigarStrength;
  leastPreferredStrength?: CigarStrength;
  favoriteBrands: string[];
  dislikedBrands: string[];
};
```

## 9.2 Match Levels

```ts
export type MatchLevel =
  | 'Excellent Match'
  | 'Good Match'
  | 'Mixed Experience'
  | 'Needs Another Chance'
  | 'Unlikely Match';
```

## 9.3 Match Score

```ts
export type CigarMatch = {
  cigarId: string;
  score: number;
  level: MatchLevel;
  confidence: number;
  reasons: string[];
};
```

### Suggested Scoring

- Wrapper match: +20
- Country match: +15
- Strength match: +15
- Flavor match: +25
- Brand affinity: +15
- Prior high rating: +20
- Would buy again: +15
- Prior low rating: -20
- Disliked flavor overlap: -20
- Too strong/too mild mismatch: -15

Normalize final score to 0–100.

### Confidence Logic

Low confidence:

- Fewer than 5 journal entries
- Only one review for a cigar
- Missing wrapper/strength/flavor metadata

Medium confidence:

- 5–20 journal entries
- Multiple ratings
- Some structured flavor feedback

High confidence:

- 20+ journal entries
- Repeated patterns across brands/wrappers/flavors
- Multiple cigars in similar categories reviewed

### Decision Rules

#### Excellent Match

- Score 85+
- Confidence medium or high

#### Good Match

- Score 70–84
- Confidence medium or high

#### Mixed Experience

- Ratings vary significantly
- Or score 45–69

#### Needs Another Chance

- One poor rating only
- Low confidence
- No repeated negative pattern

#### Unlikely Match

- Multiple poor ratings, or
- Strong overlap with disliked traits, and
- Confidence medium or high

---

## 10. Empty States

### Home Empty State

```txt
Welcome to Cavaro
Start by adding your first cigar and building your personal cigar profile.
```

### Humidors Empty State

```txt
Your Humidor Is Empty
Add cigars to start tracking what you have available to smoke.
```

### Collection Empty State

```txt
Your Collection Story Starts Here
As you smoke and rate cigars, Cavaro will build your lifetime collection profile.
```

### My Taste Empty State

```txt
Cavaro Is Learning Your Palate
Log a few smoking experiences and your taste profile will begin to appear.
```

### Journal Empty State

```txt
No Journal Entries Yet
Mark a cigar as smoked to capture your first tasting note.
```

---

## 11. Cursor Build Guide

Use this section as implementation prompts inside Cursor.

### Task 1: Add Design Tokens

Create a shared design token file for colors, typography, spacing, border radius, and shadows. Use the Cavaro dark/gold premium palette from this spec.

### Task 2: Build App Shell

Create or update the main app layout to use a bottom tab navigation with five tabs: Home, Humidors, Collection, My Taste, and Journal.

The bottom nav should use a dark elevated background, gold active state, muted inactive state, and rounded top corners.

### Task 3: Create Shared Components

Build reusable components:

- ScreenContainer
- PremiumCard
- SectionHeader
- StatCard
- CigarCard
- GoldButton
- EmptyState
- MatchBadge
- CellaringProgressCard

### Task 4: Update Humidors Screen

Make the Humidors screen represent current inventory only. It should list humidors, show counts, and display current cigar quantities.

Add actions:

- Add cigar
- Mark smoked
- Move cigar
- Start cellaring

### Task 5: Create Journal Data Model

Add a journal entry model with rating, wouldBuyAgain, likedFlavors, dislikedFlavors, strengthFeedback, draw, burn, finish, and notes.

### Task 6: Build Mark Smoked Flow

When a user marks a cigar as smoked, decrease inventory quantity and open a review flow to capture the journal entry.

### Task 7: Build My Collection Screen

Create a My Collection screen that shows lifetime stats, not current inventory.

Show:

- Total smoked
- Unique cigars tried
- Brands tried
- Countries tried
- Favorite brands
- Top rated cigars
- Most smoked cigars
- Wrapper breakdown
- Milestones

### Task 8: Build My Taste Screen

Create a My Taste screen that analyzes journal data.

Show:

- Taste summary
- What You Love
- Usually Not Your Preference
- Worth Revisiting
- Unlikely Matches
- Buy Next recommendations

### Task 9: Add Taste Profile Utilities

Create utility functions:

- getTasteProfile(entries, cigars)
- getCigarMatchScore(cigar, tasteProfile, entries)
- getMatchLevel(score, confidence, history)

### Task 10: Add Cellaring

Add a way to mark a current inventory cigar as Cellared.

User should choose:

- 6 months
- 12 months
- 18 months
- 24 months
- Custom

Show cellaring progress on Home and cigar detail screens.

### Task 11: Add Empty States

Add premium empty states to Home, Humidors, Collection, My Taste, and Journal.

### Task 12: Polish

Add small refinements:

- Haptics on important actions
- Subtle animations
- Smooth card transitions
- Consistent gold accents
- Improved spacing
- Warm premium feel

---

## 12. MVP Scope

The first version should include:

- Bottom navigation
- Humidors screen
- Journal screen
- My Collection stats
- Basic My Taste insights
- Cellaring status

Do not overbuild recommendations at first. Start with explainable rules and simple scoring.

---

## 13. Future Roadmap

### v1.1

- Better cigar detail pages
- Search and filters
- Purchase history
- Wishlist

### v1.2

- Advanced My Taste scoring
- Buy Next recommendations
- Worth Revisiting section

### v2.0

- Barcode scanning
- AI tasting summaries
- Collection valuation
- Shareable collection profile

### v3.0

- Friend activity
- Social recommendations
- Humidor sensor integration
- Apple Watch companion
- Retailer integrations

---

## 14. Final Product Positioning

Cavaro is not just a cigar inventory app.

Cavaro is a premium cigar companion that helps enthusiasts manage their humidors, remember what they smoked, understand their palate, cellar cigars intentionally, and choose better cigars over time.

The core product promise:

> Know your collection. Understand your taste. Choose your next cigar with confidence.
