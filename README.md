# Cavaro

| Path | What | Deploys to |
|------|------|------------|
| `apps/mobile` | Expo / React Native app (iOS + Android) | EAS — run `eas` commands from `apps/mobile` |
| `apps/web` | Next.js marketing site (formerly the `cavaroapp` repo) | Vercel — project root directory `apps/web` |
| `apps/server` | Express API | Railway — service root directory `apps/server` |
| `docs/` | Product and design docs | — |
| `tmp/` | Local catalog-pipeline downloads (gitignored, used by `apps/server/scripts`) | — |

Each app keeps its own `package.json`, lockfile and `node_modules` (no npm workspaces), so
installs and native builds behave exactly as they did in the separate repos.

```bash
npm run install:all   # install all three apps
npm run mobile        # Expo dev server
npm run ios           # build + run iOS
npm run web           # Next.js dev server
npm run server:dev    # API with nodemon
```

Versioning: the app version lives in `apps/mobile/app.config.js`; `npm run version:sync`
stamps it into `apps/server/package.json` and the native iOS/Android projects.

`.easignore` must stay at the repo root — EAS uploads the whole repository and reads it from there.
