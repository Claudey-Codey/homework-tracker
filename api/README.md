# Donedey API

The server behind Donedey accounts: a Cloudflare Worker with

- a **D1** database (`donedey`) for accounts, passkeys, sessions and the
  synced records (subjects, assignments, exams, the profile), and
- an **R2** bucket (`donedey-files`) for attached images and PDFs and the
  profile photo.

The web app on GitHub Pages calls it across origins. Only the origins in
`ALLOWED_ORIGINS` (`wrangler.jsonc`) get an answer.

## How it works

- **Sign-in is passkeys only.** Creating an account makes a passkey on the
  device (Face ID / Touch ID on an iPhone, saved to iCloud Keychain), and
  signing in uses it. A passkey belongs to the web page's host name, so the
  GitHub Pages passkey and a `localhost` one are separate. On success the API
  returns a session token (valid for a year). The app sends it as
  `Authorization: Bearer …`. Only its SHA-256 is stored.
- **Accounts are separate from how you sign in.** `users` is the account, and
  `passkeys` points at it. Google sign-in will add its own table pointing at
  the same `users` row.
- **Sync** stores one JSON document per record in `records`. Every stored
  change takes the account's next `seq`. Devices pull "everything after N"
  and push whole records, so the newest edit to a record wins. A deleted
  record stays as a tombstone so other devices hear about the delete.
- **Files** live in R2 under `<account id>/<file key>`, using the app's own
  keys (`image:<id>`, `avatarPhoto`).

The routes are listed at the top of `src/index.ts`.

## Set it up on Cloudflare (once)

1. The database and the bucket already exist on Cloudflare, as `donedey` (D1)
   and `donedey-files` (R2), and the database's id is in `wrangler.jsonc`
   (`database_id`). To recreate them, for example on another Cloudflare
   account, use the Cloudflare dashboard or:

   ```bash
   cd api
   npm ci
   npx wrangler login
   npx wrangler d1 create donedey
   npx wrangler r2 bucket create donedey-files
   ```

2. If you recreated the database, put its new id in `wrangler.jsonc`
   (`database_id`).
3. Deploy: `npm run deploy` applies the migrations and publishes the Worker.
   It prints the Worker's address, such as
   `https://donedey-api.<your-subdomain>.workers.dev`.
4. Put that address in `web/.env.production` as `VITE_API_URL=…` and push.
   The next web deploy shows Create Account and Sign In on the Account tab.

After that, pushing changes under `api/` to `main` redeploys through the
[`Deploy API`](../.github/workflows/deploy-api.yml) workflow. It needs the
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets.

## Run it locally

```bash
cd api
npm ci
npm run migrate:local   # creates the tables in a local database under .wrangler/
npm run dev             # http://127.0.0.1:8787, with local D1 and R2
```

Then start the web app with `VITE_API_URL=http://127.0.0.1:8787 npm run dev`
in `web/`.

## Changing the database

Add a new numbered file in `migrations/` (never edit one that's been
deployed). `npm run deploy` and the workflow apply it.
