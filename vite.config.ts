// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    plugins: [{
      name: 'vite7-start-build-compatibility',
      enforce: 'post',
      configResolved(config) {
        // Current Start emits Vite 8's option name; Vite 7 still reads rollupOptions.
        for (const environment of Object.values(config.environments)) {
          const build = environment.build as typeof environment.build & { rolldownOptions?: typeof environment.build.rollupOptions };
          if (build.rolldownOptions) build.rollupOptions = { ...build.rollupOptions, ...build.rolldownOptions };
        }
      },
    }],
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
