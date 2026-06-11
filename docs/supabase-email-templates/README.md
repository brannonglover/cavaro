# Cavaro Supabase Auth Email Templates

Branded HTML email templates for Supabase Authentication. Matches the Cavaro dark humidor aesthetic (charcoal background, cognac gold accents) used in the app (`theme/colors.js`) and marketing site (`cavaroapp.com`).

## Templates

| File | Supabase template | Subject |
|------|-------------------|---------|
| `confirm-signup.html` | **Confirm signup** | `Confirm your Cavaro account` |
| `reset-password.html` | **Reset password** | `Reset your Cavaro password` |

Subject lines are also saved in `*.subject.txt` for reference.

## Brand reference

| Token | Hex | Usage |
|-------|-----|-------|
| Screen background | `#1a1512` | Email body background |
| Card background | `#252019` | Content card |
| Border | `#3d352d` | Card border, dividers |
| Primary (cognac) | `#c4a574` | CTA buttons, links, accents |
| Cream text | `#ebe4d8` | Headings |
| Muted text | `#b8a99a` | Body copy |
| Subtle text | `#8a7d72` | Footer, secondary copy |

### Logo URL (verified)

Use this exact URL in email templates:

`https://cavaroapp.com/cavaro-logo-wd.png`

This file is hosted in `cavaroapp/public/cavaro-logo-wd.png` (copied from `cavaro/assets/logo-wd.png`) and returns HTTP 200 on production. It is the dark-background logo used in the mobile app (`App.js`, `Landing.js`) and matches the email dark theme.

**Do not use these URLs** for email logos:

| URL | Why |
|-----|-----|
| `https://cavaroapp.com/cavaro-logo-wo.png` | Older white-outline variant; superseded by `cavaro-logo-wd.png` for emails |
| `https://cavaroapp.com/cavaro-wd.png` | File does not exist on the site |
| `https://cavaroapp.com/logo-wd.png` | File does not exist on the site (use `cavaro-logo-wd.png`) |

The mobile app uses local assets named `logo-wd.png` / `logo-wo.png` in `cavaro/assets/`. The hosted equivalent for emails is `cavaro-logo-wd.png`. The marketing site also hosts `cavaro-logo-wo.png` (header) and `cavaro-logo.png` (hero).

## Supabase template variables used

Both templates use:

- `{{ .ConfirmationURL }}` — magic link (signup confirmation or password recovery)
- `{{ .SiteURL }}` — your Supabase project Site URL (should be `https://cavaroapp.com`)
- `{{ .Email }}` — recipient email address

Do not modify these variable names; Supabase replaces them at send time.

## How to apply in Supabase Dashboard

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your Cavaro project.
2. Go to **Authentication** → **Emails** → **Templates**.
3. Ensure **Site URL** under **Authentication** → **URL Configuration** is set to `https://cavaroapp.com` (and redirect URLs include `https://cavaroapp.com/auth/callback`).
4. For each template:
   - Select the template type (**Confirm signup** or **Reset password**).
   - Paste the full HTML from the matching `.html` file into the **Message body** field.
   - Set the **Subject** from the matching `.subject.txt` file.
   - Click **Save**.

### Suggested sender settings

Under **Authentication** → **Emails** → **SMTP Settings** (or your custom SMTP provider):

| Setting | Suggestion |
|---------|------------|
| Sender name | `Cavaro` or `Cavaro Support` |
| Sender email | `support@cavaroapp.com` (or your verified SMTP address) |

If using Supabase's built-in email (not custom SMTP), configure the sender in **Project Settings** → **Auth** as allowed by your plan.

## Testing

1. In **Authentication** → **Users**, create a test user or use the app's sign-up / forgot-password flow.
2. Confirm the email renders correctly on mobile (Gmail, Apple Mail) and desktop (Outlook, Gmail web).
3. Confirm the Cavaro logo appears at the top (not a broken image). If missing, check the `<img src>` in Supabase matches `https://cavaroapp.com/cavaro-logo-wd.png` exactly.
4. Verify the CTA link opens `https://cavaroapp.com/auth/callback` and completes the flow.

## Notes

- Templates use table-based layout and inline styles for broad email client support.
- The preheader text (invisible preview snippet) is included for inbox previews.
- Recovery links are handled by `cavaroapp.com/auth/callback`; users then sign in via the Cavaro app.
