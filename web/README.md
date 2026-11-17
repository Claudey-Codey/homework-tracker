# TaskMng for the web

The same app as the iOS version, rebuilt as a web app you can add to your
iPhone's Home Screen. No Mac, Xcode or Apple account needed, and it doesn't
expire after 7 days.

Built with React + TypeScript + Vite. Everything is stored on the device, in
the browser's IndexedDB. There is no server and no account.

## Install it on an iPhone

1. Open the app's web address in **Safari**.
2. Tap **Share ▸ Add to Home Screen ▸ Add**.
3. Open it from the new icon. It runs full-screen like a normal app, and it
   works offline.

Always open it from the Home Screen icon. Safari can clear data for websites
you haven't visited in a while, but Home Screen apps are protected from that.

### Backups, and re-adding the app

Your data lives inside the Home Screen app, so **removing the icon deletes
it**. Before you remove it, go to **Account ▸ Settings ▸ Back Up Data…** and
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

| iOS (`TaskMng/`)               | Web (`web/src/`)                         |
|--------------------------------|------------------------------------------|
| SwiftData models (`Models/`)   | `db.ts` (IndexedDB via Dexie)            |
| `@AppStorage`                  | `support/settings.ts` (localStorage)     |
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
- Data stays on one device. Nothing syncs between your phone and a computer.
