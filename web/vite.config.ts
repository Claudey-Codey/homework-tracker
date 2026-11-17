import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/// Every file under `dir`, as paths relative to it.
function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory()
      ? listFiles(path).map((file) => join(name, file))
      : [name];
  });
}

/// Writes `sw.js` into the build with the full list of files to precache, so
/// the app works offline from the very first visit. The version is a hash of
/// that list — any change to the app produces a new one, which makes phones
/// pick up the update.
function serviceWorker(): Plugin {
  return {
    name: "taskmng-service-worker",
    apply: "build",
    enforce: "post",
    generateBundle(_, bundle) {
      const built = Object.keys(bundle).filter((file) => !file.endsWith(".map"));
      const fromPublic = listFiles("public").map((file) => relative(".", file).split("\\").join("/"));
      const files = ["./", ...[...built, ...fromPublic].map((file) => `./${file}`)];
      const version = createHash("sha256")
        .update(files.join("\n"))
        .update(readFileSync("sw/sw.js"))
        .digest("hex")
        .slice(0, 12);
      const source = readFileSync("sw/sw.js", "utf8")
        .replace("__VERSION__", version)
        .replace("__PRECACHE__", JSON.stringify(files, null, 2));
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}

// `base: "./"` keeps every URL relative, so the build works wherever it's
// hosted — the root of a domain or a sub-path like /taskmng/.
export default defineConfig({
  base: "./",
  plugins: [react(), serviceWorker()],
});
