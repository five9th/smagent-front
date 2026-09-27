# SMAgent front

SPA for SMAgent — the social-media agent backend (Spring Boot, see `../smagent`).
Write one post, tailor it per platform, publish to every connected social
account, and keep the full attempt history. AI assistance (providers,
generation) and engagement tracking are stubbed until the backend ships them.

## Dev

```bash
npm install
npm run dev        # http://localhost:5173 (backend expected on :8080)
```

- The app calls same-origin `/api`; Vite's dev server proxies it to the backend
  (`SMAGENT_BACKEND_URL` overrides the target, default `http://localhost:8080`).
- The proxy strips the `Origin` header, so any dev port works. (The backend's
  CORS allowlist only knows `http://localhost:5173` — see
  `smagent.cors.allowed-origins`.)
- Login with the seeded owner account (`SMAGENT_ADMIN_USERNAME` /
  `SMAGENT_ADMIN_PASSWORD` on the backend side).

## Scripts

| Command             | What it does                          |
|---------------------|---------------------------------------|
| `npm run dev`       | Dev server with `/api` proxy          |
| `npm run build`     | Type-check + production build         |
| `npm run typecheck` | `tsc -b` only                         |
| `npm run lint`      | ESLint                                |
| `npm run preview`   | Serve the production build            |

## Structure

```
src/
  api/        typed fetch client + per-resource modules (auth, accounts, posts)
  hooks/      auth & toast providers/contexts, useApiQuery data hook
  components/ AppShell (rail/topbar), UI kit (pills, modal, tiles…), icons
  views/      Login, Dashboard, Posts, PostEditor (composer), Accounts,
              Ai + Inbox (stubs — backend endpoints not implemented yet)
  styles/     design tokens + component styles (ported from the approved
              prototype: premium dark + gold, light theme via ◐ toggle)
```

`VITE_API_BASE` overrides the API base (defaults to same-origin `/api`).
