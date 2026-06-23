import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The shared Zod/types package is a workspace package; transpile it so Next can
  // consume it from the workspace without a separate prebuild step.
  transpilePackages: ['@k21/validation'],
  // Proxy API calls through Next so the browser only ever talks to ONE origin
  // (this host). That means no CORS, and HTTPS only needs to terminate in front
  // of the web app — the API is reached server-side. Target is the Node API.
  async rewrites() {
    const target = process.env.API_PROXY_TARGET || 'http://localhost:4000';
    return [{ source: '/api/:path*', destination: `${target}/api/:path*` }];
  },
  webpack(config) {
    // Resolve @k21/validation to its TypeScript source rather than its built `dist`,
    // so `pnpm --filter @k21/web dev` works even before the package has been built.
    // (transpilePackages above ensures the TS source is compiled by Next.)
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@k21/validation': resolve(
        __dirname,
        '../../packages/validation/src/index.ts',
      ),
    };
    // The validation source uses extension-ful ESM imports (`./common.js`).
    // Map `.js` specifiers to their `.ts` source so webpack can resolve them.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };
    return config;
  },
};

export default nextConfig;
