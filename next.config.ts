import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The parent directory (outside this project) has its own stray
  // lockfile; without this Next guesses the wrong workspace root.
  outputFileTracingRoot: import.meta.dirname,
  // embedded-postgres dynamically `import()`s a package per OS/arch; only
  // the current platform's package is actually installed (see NOTES.md).
  // Webpack statically resolves every branch of that dynamic import and
  // fails on the ones we don't have installed unless this package is kept
  // external to the server bundle and left to Node's own module resolution.
  serverExternalPackages: ["embedded-postgres"],
};

export default nextConfig;
