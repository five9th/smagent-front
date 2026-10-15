# SMAgent front

SPA for SMAgent — the social-media agent backend (Spring Boot, see `../smagent`).
Write one post, tailor it per platform, publish to every connected social
account, and keep the full attempt history. AI assistance (providers,
generation) and engagement tracking are stubbed until the backend ships them.

Backend version this project is aligned with: 0.4.0

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

## Deploy (static build + nginx)

```bash
npm run build   # → dist/ — copy its contents to the web root
```

```nginx
server {
    listen 80;
    server_name your.host.name;
    root /var/www/smagent;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8080;   # Spring Boot
        proxy_set_header Host $host;        # keep Origin/Host consistent, or Spring's CORS filter 403s POSTs
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /actuator/ {                   # backend build info for the version display
        proxy_pass http://127.0.0.1:8080;
    }

    location / {
        try_files $uri $uri/ /index.html;   # SPA fallback for client-side routes
    }
}
```

Serving under a subpath (demo VPS layout, `https://<host>/smagent/`):

```bash
npm run build:demo   # same as `build` but with SMAGENT_BASE_PATH=/smagent/
```

Copy `dist/` to `/var/www/smagent` on the VPS and use
[`deploy/nginx-smagent.conf`](deploy/nginx-smagent.conf). It proxies
`/smagent/api/` → the backend with the prefix stripped, so the API stays
same-origin and no CORS changes are needed on the backend. `SMAGENT_BASE_PATH`
only affects asset URLs and the SPA's API base; dev on `/` is unchanged.

Opening `dist/index.html` via `file://` shows the UI but can't log in — the
`SameSite=Lax` session cookie isn't sent from a `file://` origin. Without nginx,
use any static server plus `VITE_API_BASE=http://localhost:8080/api` at build
time and add that origin to the backend's `SMAGENT_CORS_ORIGINS`.
