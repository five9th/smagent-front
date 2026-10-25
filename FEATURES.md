# SMAgent — feature guide

SMAgent is a single-owner social media assistant: you write a post once, tailor it per platform if you like, and publish it to every connected account — with AI help for drafting and a full history of what went where. This guide describes everything the web app can do and how to use it.

The app is designed for one person (the owner). You sign in with a username and password, and everything you see is yours.

---

## Getting around

The left rail has the main sections:

- **Dashboard** — overview and recent activity
- **Posts** — your posts, drafts and published
- **Inbox** — planned engagement tracking (not available yet)
- **AI Assistant** — AI providers, text generation, generation settings
- **Accounts** — your connected social media accounts
- **Demo feedback** — a scratch checklist for notes during demo sessions

The top bar shows the section title, today's date, and one **health dot per connected account** (green = active/verified, amber = unverified, red = invalid) so a broken account is visible from anywhere. On the right side of the top bar:

- **New post** — jump straight into the editor
- **⚙ Admin settings** — override the OAuth app credentials SMAgent uses for Facebook/LinkedIn/X (see below)
- **◐** — switch between dark and light theme (your choice is remembered)

The sidebar footer shows who you're logged in as, a log-out button, and the frontend/backend version numbers.

---

## Dashboard

The landing page after sign-in.

- Four counters: **Drafts**, **Published**, **Active accounts** (verified / total), and **Needs attention** (accounts that are unverified or invalid).
- **Recent publications** — the newest publishing attempts across your published posts, newest first. Each row shows the platform, account, time, and status; failed rows carry the platform's error text, and successful ones link to the live post when the platform reported a URL.
- **Account health** — every account with its status, linking to the Accounts page.
- Short explanations of the core idea (compose once → publish everywhere) and the AI drafting feature. If no accounts are connected yet, a banner points you to Accounts first.

---

## Posts

The list of all your posts, filterable by **All / Drafts / Published** (with counts). Each row shows the title (or a text snippet if untitled), last-updated time, whether it has platform-specific overrides, its number, and its status. Click a row to open the editor.

---

## The post editor

This is the heart of the app. Open it via **New post** or by clicking a post in the list.

### Writing: generic text plus per-platform overrides

- **Generic content** — a title (optional), the main text, and an optional link (e.g. an article or image URL). Every platform gets this by default.
- **Per-platform tabs** (Facebook, Reddit, X, LinkedIn) — tick **Override content for \<platform\>** to give that platform its own text (and optionally its own title and link). Enabling an override pre-fills it with the generic text, trimmed to the platform's character limit if needed, so you start from a tweak rather than a blank page. Fields left empty fall back to the generic ones — only the override *text* is mandatory when an override is on.
- Rules the editor enforces for you: post text is required; an enabled override needs its own text; links must start with `http://` or `https://`; **Reddit always needs a title** (the Reddit tab has its own title field that falls back to the generic title).
- Platform character limits (X 280, Facebook 5000, LinkedIn 3000, Reddit 40000) are shown as **soft limits** — the preview warns when you're over, but nothing is truncated.
- Every text field has a **copy button**.
- A note where image/video support will live: posts are text-only for now.

### Live preview

Below the editor: a post preview styled per platform, with the effective content (overrides resolved exactly as they'll be sent), a character counter with an over-limit warning, and a note of whether you're seeing the generic text or a platform override. Switch the preview between platforms with the letter buttons in its corner.

### Publishing

The **Target accounts** card lists every account with API access. Accounts that are verified (ACTIVE) and can publish are pre-selected; click to toggle. A green **"posted"** pill marks accounts this post already went out on successfully.

**Publish…** opens a confirmation dialog showing exactly which accounts will receive what (generic text or the platform override), and warns about non-active accounts and a missing Reddit title. Each account is published **separately** — if one fails, the others still go through. Afterwards you get a per-account results dialog with status pills, error details, and links to the live posts. If nothing succeeded, the post stays a draft so you can fix and retry.

Publishing **saves the draft first** — what gets sent is exactly what's on screen, never an older saved version.

### Publishing by hand (manual accounts)

An account can be connected as a **manual** option (just a profile link — no API credentials). SMAgent can't post there itself; the **Manual accounts** card lists them, and **Manual publish…** walks you through each one:

1. **Open to post by hand ↗** — saves the draft if needed, opens the platform's composer with the post prefilled where the platform supports it; the post text is copied to your clipboard either way, so it's one paste away. Accounts without a shareable composer show an **Open profile ↗** link instead.
2. Create the post on the platform.
3. **Mark as posted…** — record it, optionally with a link to the created post. It counts in the history exactly like a real publish, and the account flips to a green "posted" pill.

### Publication history

Every published post keeps a full attempt history, newest first: platform, account, time, status, error message (links clickable), and a "by hand" marker for manually recorded posts. Links open the live post.

### Draft lifecycle

- **Save** (explicit button) or let it save itself: a non-empty draft **auto-saves when you switch to another app or browser tab**, when you navigate to another page within the app, and always right before publishing or opening a manual composer. If an autosave fails (e.g. you're offline), the browser warns before closing the tab.
- **Deleting a draft** just removes it — nothing was ever published. **Deleting a published post** removes it from the app but **copies on the platforms stay live** (the app can't un-post yet — there's a disabled "Delete publications" option as a placeholder).
- **Published posts are locked** — the content can't be edited, but you can **Republish…** the same content to accounts, which adds new attempt rows to the history.

### AI generation tab

Next to the Editor tab is **AI Generation** (drafts only). It's the same generator as on the AI Assistant page (below), with two extras:

- **Show draft to AI** — with your consent, the current editor content rides along so the model refines your text instead of writing from scratch.
- Results get **Apply** buttons: apply everything, just the generic text, or one platform variant — straight into the draft. Nothing is ever posted automatically.

---

## AI Assistant

Three tabs. Tab state is preserved when you switch between them.

### Providers

Add one or more AI providers by type — **Anthropic** or **OpenAI-compatible** — with a name, API key, optional custom base URL (with well-known endpoints offered as suggestions, e.g. for OpenRouter), and a default model. Keys are stored encrypted and only ever shown masked. The type can't be changed after creation; the key can be replaced anytime (leave blank to keep).

- **Verify** makes a cheap authenticated call (a models listing) to confirm the key works — nothing is stored, and generation works regardless.
- The default model can be picked from the provider's **live model list** or typed manually; it can be replaced but never cleared. If you skip it when adding a provider, the dialog re-opens to let you pick one from the list.

### Generate

Describe what the post should say and generate:

- **Prompt**, optional **tone** (casual / professional / playful) and **max length**.
- **Provider and model** — with one provider configured it's used automatically; with several you pick. Model suggestions come from the provider's live list; your provider/model choice is remembered for next time.
- **Reasoning effort** — how hard the model thinks: low → max (higher is slower and more thorough; Anthropic-only for now).
- **Variants** — choose which outputs you want: the **Generic** text and/or a dedicated variant per platform (Reddit's variant includes a title). Each variant is rendered in its platform-styled preview with a copy button.

From the AI page, a result isn't saved anywhere yet — **Open in post editor** turns it into a draft (generic + all generated overrides prefilled). From the post editor, results are applied into your draft as described above. A "note from the model" is shown when the model adds one, and token usage is displayed per generation.

AI only generates text — images stay manual for now.

### Settings

Per-platform **style rules** that shape how each generated variant is written (they're part of the AI's instructions — style guidance, not enforced limits; a style that exceeds X's 280 characters simply risks rejection at publish time). Every platform plus the generic style has a built-in default; you can customize any of them, with a per-field **reset** back to the default. Saving replaces the whole set; blanking a field restores its default.

---

## Accounts

All connected social media accounts as cards: platform, name, how it was connected, masked credentials (identifiers like IDs and URLs are shown in full — only secrets are hidden), and a status pill (**ACTIVE** = verified and ready, **UNVERIFIED** = saved but not yet checked, **INVALID** = the platform rejected the credentials).

- **Add account** — pick the platform, then a **login option** for it:
  - **Facebook** — a Page access token (there's also a **Get token with OAuth** button that takes you through Facebook's consent screen and stores the token automatically), or just a profile/page link (manual).
  - **Reddit** — username & password plus an API client ID/secret and target subreddit (manual-only profile link also available). ⚠️ Reddit has closed its free API: a Reddit account can be saved, but connecting or posting won't work until Reddit reopens access.
  - **X** — an access token, ideally obtained via **Get token with OAuth** (the flow also stores a refresh token so the short-lived access token gets renewed automatically), or a profile link (manual).
  - **LinkedIn** — an access token for your member profile, or an organization token + organization ID for a company page (both also available via the OAuth button), or a profile link (manual).
- A display name is optional — **Verify** fills it in from the platform when it can.
- **Verify** checks the credentials against the platform right away: the account turns **active**, or **invalid** with the platform's error message. Newly saved accounts need a verify before they're usable.
- **Edit** — change the display name and/or credentials. Entering credentials **replaces all of them at once** (leave everything blank to keep the current ones), and switching the login option always requires the new credentials — after which the account needs verifying again.
- **Remove** — the account disappears and its credentials are erased. Posts already published through it keep their full history, including which account they went to.
- **Show deleted** — removed accounts can be listed again (read-only, greyed out, credentials gone).

When an OAuth consent flow doesn't complete, the Accounts page shows an error banner explaining what went wrong and how to retry.

---

## Admin settings

The ⚙ button in the top bar opens a dialog for the **OAuth app credentials** SMAgent itself uses when talking to Facebook, LinkedIn, and X during "Get token with OAuth" flows. Normally these come from the server's configuration file; here you can override them at runtime without touching the config or restarting:

- For each of the three platforms: a **Client ID** and **Client secret**, each with a status pill (whether a value is currently in effect — the app can't show whether it comes from an override or from the server config, and values are never displayed again once saved).
- **Saving replaces the whole set**: a filled field stores an override; a field left blank clears any override for it, falling back to the configured value. To override a platform you fill in both its fields; to return a platform to the configured credentials, clear both.

---

## Inbox (planned)

A preview of the coming engagement inbox: one feed of comments and reactions across all your published posts, collected by SMAgent itself — no public server or special platform permissions needed. All controls on this page are inert until the feature ships.

---

## Demo feedback

A simple checklist for noting things to fix/change/add during demo sessions. Add items (Ctrl/Cmd+Enter submits), tick them off, delete them. Counters show total / open / done. Nothing here touches posts or accounts.

---

## Small things worth knowing

- **Errors are polite**: failures show as a short title plus the detail (with platform error links clickable), never a raw wall of JSON. Backend messages surface as toasts.
- **Version display**: the sidebar shows the frontend and backend build versions.
- **Secrets stay secret**: API keys, tokens, and passwords are shown masked everywhere, after being entered once.
- The app works on narrow screens too — the navigation moves to a bottom bar on mobile.
