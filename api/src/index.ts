import {
  authenticate,
  deleteAccount,
  loginOptions,
  loginVerify,
  registerOptions,
  registerVerify,
  signOut,
} from "./auth";
import { allowedOrigin, HttpError, json, withCors, type Env } from "./http";
import { deleteFile, getFile, pull, push, putFile } from "./sync";

/// The Donedey API. The web app lives on GitHub Pages, so every request is
/// cross-origin: only the origins in ALLOWED_ORIGINS are answered, and
/// sign-in uses a bearer token rather than a cookie (Safari blocks
/// third-party cookies).
///
///   POST   /auth/register/options   { name }                → { challengeId, options }
///   POST   /auth/register/verify    { challengeId, response } → { token, account }
///   POST   /auth/login/options                               → { challengeId, options }
///   POST   /auth/login/verify       { challengeId, response } → { token, account }
///   POST   /auth/signout
///   GET    /account                                          → { account }
///   DELETE /account
///   GET    /sync?since=N                                     → { changes, cursor, more }
///   POST   /sync                    { changes }               → { seq }
///   GET | PUT | DELETE /files/:key
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = allowedOrigin(request, env);
    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: origin ? 204 : 403 }), origin);
    }
    try {
      if (!origin) throw new HttpError(403, "This origin isn't allowed.");
      return withCors(await route(request, env, origin), origin);
    } catch (error) {
      if (error instanceof HttpError) return withCors(json({ error: error.message }, error.status), origin);
      console.error(error);
      return withCors(json({ error: "Something went wrong on the server." }, 500), origin);
    }
  },
} satisfies ExportedHandler<Env>;

async function route(request: Request, env: Env, origin: string): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  const method = request.method;

  if (method === "POST" && path === "/auth/register/options") return registerOptions(request, env, origin);
  if (method === "POST" && path === "/auth/register/verify") return registerVerify(request, env, origin);
  if (method === "POST" && path === "/auth/login/options") return loginOptions(env, origin);
  if (method === "POST" && path === "/auth/login/verify") return loginVerify(request, env, origin);

  // Everything below needs a signed-in account.
  const account = await authenticate(request, env);

  if (method === "POST" && path === "/auth/signout") return signOut(env, account.tokenHash);
  if (method === "GET" && path === "/account") return json({ account: { id: account.id, name: account.name } });
  if (method === "DELETE" && path === "/account") return deleteAccount(env, account);
  if (method === "GET" && path === "/sync") return pull(url, env, account);
  if (method === "POST" && path === "/sync") return push(request, env, account);

  const file = path.match(/^\/files\/([^/]+)$/);
  if (file) {
    const key = decodeURIComponent(file[1]!);
    if (method === "GET") return getFile(key, env, account);
    if (method === "PUT") return putFile(request, key, env, account);
    if (method === "DELETE") return deleteFile(key, env, account);
  }

  throw new HttpError(404, "Not found.");
}
