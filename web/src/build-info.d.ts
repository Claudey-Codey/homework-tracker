/// Filled in by `define` in vite.config.ts.
declare const __BUILD_COMMIT__: string;
declare const __BUILD_TIME__: string;

interface ImportMetaEnv {
  /// The TaskMng API (the Cloudflare Worker in `api/`). Without it the app
  /// has no accounts and keeps everything on the device.
  readonly VITE_API_URL?: string;
}
