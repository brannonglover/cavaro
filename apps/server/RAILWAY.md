# Deploy Cavaro API to Railway

## 1. Create a Railway project

1. Go to [railway.app](https://railway.app) and sign in (GitHub recommended).
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select your `cavaro` repo.
4. Railway will detect the project. Set **Root Directory** to `server` (so it deploys only the API, not the whole app).

## 2. Configure environment variables

In your Railway project: **Variables** tab → add these (copy from `server/.env`, but use production values where noted):

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | Railway sets this automatically; you can leave it unset |
| `DATABASE_URL` | Your Supabase Postgres connection string |
| `SUPABASE_URL` | `https://srucfmfykauxdnwyyaav.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase Dashboard |
| `STRIPE_SECRET_KEY` | Your Stripe secret key |
| `STRIPE_PRICE_ID` | Your Stripe price ID |
| `STRIPE_WEBHOOK_SECRET` | **New value** – see step 3 below |
| `GMAIL_USER` | Your Gmail address |
| `GMAIL_APP_PASSWORD` | Your Gmail app password |
| `OPENAI_API_KEY` | Your OpenAI API key |

## 3. Stripe webhook (per service)

Each Railway service needs its own webhook endpoint in Stripe. Deploy the service first to get its URL.

1. Deploy once (Railway will give you a URL like `https://your-app.up.railway.app`).
2. In [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks), add an endpoint:
   - **URL:** `https://your-app.up.railway.app/api/subscription/webhook`
   - **Events:** `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - **Important:** Use **Test mode** (toggle in Stripe) for staging; **Live mode** for production.
3. Copy the **Signing secret** (starts with `whsec_`).
4. In Railway **Variables**, set `STRIPE_WEBHOOK_SECRET` to that value.
5. Redeploy so the new variable is picked up.

## 4. Staging vs production (TestFlight vs App Store)

Use two Railway services in the same project:

| Service | Stripe mode | EAS profile | Use case |
|---------|-------------|-------------|----------|
| Staging | Test keys (`sk_test_...`, test price) | `preview` | TestFlight |
| Production | Live keys (`sk_live_...`, live price) | `production` | App Store |

### Staging service setup

1. In your Railway project, click **New** → **GitHub Repo** → select the same repo.
2. Set **Root Directory** to `server`.
3. Add variables (same as production, but use **Stripe test** values):
   - `STRIPE_SECRET_KEY` = `sk_test_...`
   - `STRIPE_PRICE_ID` = test price ID (from Stripe Dashboard, Test mode)
   - `STRIPE_WEBHOOK_SECRET` = from webhook for this staging URL (see below)
4. Deploy and copy the staging URL (e.g. `https://cavaro-staging-xxxx.up.railway.app`).
5. In [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks), switch to **Test mode** (top right), add endpoint:
   - **URL:** `https://YOUR-STAGING-URL/api/subscription/webhook`
   - **Events:** `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy the signing secret → set as `STRIPE_WEBHOOK_SECRET` in the staging service.
6. In `eas.json`, set `preview.env.EXPO_PUBLIC_API_URL` to your staging URL.

### Production service

- Use live Stripe keys and a webhook created in **Live mode**.
- `production.env.EXPO_PUBLIC_API_URL` points to the production Railway URL.

## 5. Point your app at the API

In `eas.json`:

- **preview** (TestFlight): `EXPO_PUBLIC_API_URL` = staging Railway URL
- **production** (App Store): `EXPO_PUBLIC_API_URL` = production Railway URL

## 6. Local development

- **Production start:** `npm start` (used by Railway)
- **Local dev with auto-reload:** `npm run dev`
