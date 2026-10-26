/**
 * Vitest stand-in for the `server-only` marker package.
 *
 * Next.js resolves `server-only` to its own empty module; Vite does not, so the
 * unit tests would fail to import any server module. Alias it to this file in
 * `vitest.config.ts`.
 */
export {};
