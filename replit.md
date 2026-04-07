# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Fuel Subsidy Dashboard

- **Color scheme**: Pakistan official flag green (#01411C) + white + gold (#C9A84C)
- **API routes**: `/api/fuel/summary`, `/api/fuel/province-overview`, `/api/fuel/vehicle-breakdown`, `/api/fuel/recd-from-eto`, `/api/fuel/upload`, `/api/fuel/fetch-from-url`
- **Data file**: `artifacts/api-server/data/fuel-subsidy.xlsx`
- **Remote data sync**: POST `/api/fuel/fetch-from-url` supports Google Drive, SharePoint, OneDrive, and direct URL shared links (no OAuth needed)

### Integration Notes
- **SharePoint** (`connector:ccfg_sharepoint_01K4E4GP3G31BE5PGVY2CNTDDK`): User dismissed OAuth flow. Currently supports SharePoint via shared URL download link. To enable full OAuth, re-run proposeIntegration with the SharePoint connector.
- **Google Drive** (`connector:ccfg_google-drive_0F6D7EF5E22543468DB221F94F`): User dismissed OAuth flow. Currently supports Google Drive via shared URL (converts to direct download link). To enable full OAuth, re-run proposeIntegration with the Google Drive connector.

## Netlify Deployment

The project is fully configured for Netlify deployment. Key files:

| File | Purpose |
|------|---------|
| `netlify.toml` | Build config, function settings, SPA redirect |
| `netlify/functions/api.ts` | Serverless function handling all `/api/*` routes |
| `artifacts/fuel-dashboard/vite.netlify.config.ts` | Vite config without Replit-specific PORT/BASE_PATH |

### How It Works
- **Frontend**: Built with `build:netlify` script (no PORT/BASE_PATH env vars needed), output to `dist/public/`
- **Backend**: Single Netlify Function (`api.ts`) intercepts all `/api/*` routes via `config.path`
- **Data reading**: Priority chain — Netlify Blobs → `/tmp` warm cache → embedded base64 (always available)
- **Data writing**: File uploads and URL fetches write to `/tmp` immediately and Netlify Blobs for cross-invocation persistence
- **Excel bundling**: `netlify/generate-initial-data.mjs` converts the Excel to base64 at build time → writes `netlify/functions/initial-data.ts` → esbuild bundles it into the function (no runtime filesystem path needed)

### Netlify Build Command (auto-configured in netlify.toml)
```
pnpm install && pnpm --filter @workspace/api-spec run codegen && node netlify/generate-initial-data.mjs && pnpm --filter @workspace/fuel-dashboard run build:netlify
```

### When the Excel file is updated
Run `node netlify/generate-initial-data.mjs` locally to regenerate `netlify/functions/initial-data.ts`, then commit and push — Netlify redeploys automatically.

### Deploy Steps
1. Push repo to GitHub
2. Connect repo to Netlify (auto-detects `netlify.toml`)
3. Netlify builds and deploys automatically
