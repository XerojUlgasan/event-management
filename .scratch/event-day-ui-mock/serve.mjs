// Isolated UI draft. Uses installed workspace dependencies; no API or database.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const mockRoot = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(mockRoot, "../..");
const uiRequire = createRequire(path.join(repo, "packages/ui/package.json"));
const webRequire = createRequire(path.join(repo, "apps/web/package.json"));
const { createServer, build } = await import(uiRequire.resolve("vite"));
const { default: tailwindcss } = await import(
  webRequire.resolve("@tailwindcss/vite")
);
const config = {
  configFile: false,
  root: mockRoot,
  publicDir: path.join(repo, "apps/web/public"),
  cacheDir: path.join(mockRoot, "node_modules/.vite"),
  plugins: [tailwindcss()],
  resolve: {
    alias: [
      {
        find: /^react-dom(\/.*)?$/,
        replacement: path.join(repo, "apps/web/node_modules/react-dom") + "$1",
      },
      {
        find: /^react(\/.*)?$/,
        replacement: path.join(repo, "apps/web/node_modules/react") + "$1",
      },
      ...[
        "@event-management/ui/styles.css",
        "@event-management/theme/theme.css",
        "@event-management/contracts/event-days",
        "@event-management/contracts/limits/booking-requests",
        "@event-management/ui",
      ].map((name) => ({ find: name, replacement: webRequire.resolve(name) })),
    ],
    dedupe: ["react", "react-dom"],
  },
  server: {
    host: "127.0.0.1",
    port: 4317,
    strictPort: true,
    fs: { allow: [repo] },
  },
  build: { outDir: path.join(mockRoot, "dist"), emptyOutDir: true },
};
if (process.argv.includes("--build")) await build(config);
else {
  const server = await createServer(config);
  await server.listen();
  server.printUrls();
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, async () => {
      await server.close();
      process.exit(0);
    });
}
