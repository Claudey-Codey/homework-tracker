# Donedey for the web

The same app as the iOS version, rebuilt as a web app you can add to your
iPhone's Home Screen. No Mac, Xcode or Apple account needed, and it doesn't
expire after 7 days.

Built with React + TypeScript + Vite. Everything is stored on the device, in
the browser's IndexedDB, and works offline. With an account (**Account ▸
Create Account…**, signed in with a passkey) it also syncs to the Donedey API
in [`../api/`](../api/README.md), a Cloudflare Worker with a D1 database, so
your other devices see the same assignments, exams, subjects and profile.

## Install it on an iPhone

1. Open the app's web address in **Safari**.
2. Tap **Share ▸ Add to Home Screen ▸ Add**.
3. Open it from the new icon. It runs full-screen like a normal app, and it
   works offline.

Always open it from the Home Screen icon. Safari can clear data for websites
you haven't visited in a while, but Home Screen apps are protected from that.

### Backups, and re-adding the app

Without an account, your data lives only inside the Home Screen app, so
**removing the icon deletes it**. (Signed in, it's in your account too: add
the app again and sign in.) Before you remove it, go to **Account ▸ Settings ▸ Back Up Data…** and
save the file to Files. After adding the app again, use **Restore from
Backup…** in the same place.

iOS reads some settings only when the app is added (such as the status bar
style), so a change to those reaches your phone only after you re-add it.

## Work on it

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
cd web
npm install
npm run dev        # live-reloading dev server, prints a local and a network URL
npm run build      # type-checks, then builds the site into web/dist/
npm run preview    # serves web/dist/ to try the real build (offline mode included)
```

Accounts and sync only show up when the build knows the API's address,
`VITE_API_URL`. Production reads it from `web/.env.production`. To try sync
locally, run the API (see [`api/README.md`](../api/README.md)) and start the
dev server with `VITE_API_URL=http://127.0.0.1:8787 npm run dev`. Passkeys
need `localhost` or https, so the Network URL below can't sign in.

`npm run dev` also prints a **Network** URL. With your phone on the same Wi-Fi,
open it in Safari to try changes on the phone right away.

## Publishing

The app is published to GitHub Pages by the
[`Deploy web app`](../.github/workflows/deploy-web.yml) workflow:

- Every push to `main` that changes something in `web/` builds and deploys it
  automatically.
- To redeploy by hand, go to **Actions ▸ Deploy web app ▸ Run workflow**.
- The repository's **Settings ▸ Pages ▸ Source** must be set to
  **GitHub Actions**, or the deploy step fails.

You can still host it anywhere else: run `npm run build` and upload the
contents of `web/dist/` to any static host (Cloudflare Pages, Netlify…). All
paths are relative, so it works at the root of a domain or in a sub-folder.

## How it maps to the iOS app

| iOS (`Donedey/`)               | Web (`web/src/`)                         |
|--------------------------------|------------------------------------------|
| SwiftData models (`Models/`)   | `db.ts` (IndexedDB via Dexie)            |
| `@AppStorage`                  | `support/settings.ts` (localStorage)     |
| (no iOS counterpart yet)       | `support/sync/*` (account, passkeys, sync) |
| `RootTabView`                  | `App.tsx`                                |
| `NavigationStack`, `.sheet`    | `ui/NavStack.tsx`, `ui/Sheet.tsx`        |
| `Form` / `List` sections       | `ui/List.tsx` + `styles.css`             |
| `Views/Assignments`, `Exams`…  | `views/assignments`, `views/exams`…      |
| `MarkdownTextView` editor      | `views/exams/StudyNoteEditor.tsx` (Tiptap) |
| SF Symbols                     | `ui/icons.tsx` (Lucide + a few hand-drawn) |

Other files:

- `sw/sw.js` is the service worker that makes the app work offline.
  `vite.config.ts` fills in its file list at build time.
- `public/` holds the avatars, sounds, icons and the web app manifest.
- `scripts/` holds the app icon's source (`icon.svg`) and the script that
  renders it to PNGs.

## Not there yet

- **Reminder notifications.** You can add reminders and they're saved, but
  they don't notify you yet. A web app can't schedule a notification by itself
  on iPhone. A small server has to send it at the right time, and that's the
  next piece to build.
- **Google sign-in.** Accounts use passkeys only for now.
