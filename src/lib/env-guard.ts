// Normalize AUTH_URL for real deployments — run as a side effect BEFORE anything
// reads AUTH_URL (import this first in env.ts and auth.ts).
//
// AUTH_URL is routinely copied from a local .env (e.g. http://localhost:3010)
// into a hosting provider's env vars, where it silently breaks everything that
// builds an absolute URL: post-login redirects, Auth.js callback/provider URLs,
// and the links baked into invitation / password-reset / notification emails.
//
// When we're running on Vercel but AUTH_URL is missing or still points at
// localhost, replace it with the deployment's real URL. Vercel injects
// VERCEL_PROJECT_PRODUCTION_URL (the stable production domain) and VERCEL_URL
// (this deployment) automatically, so a stray localhost value can never govern
// production — independent of whatever is set in the dashboard. Idempotent and a
// no-op locally (VERCEL is unset), so local dev keeps its localhost AUTH_URL.
const authUrl = process.env.AUTH_URL ?? "";
const isLocalhost = /localhost|127\.0\.0\.1/.test(authUrl);

if (process.env.VERCEL && (authUrl === "" || isLocalhost)) {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (host) process.env.AUTH_URL = `https://${host}`;
}

export {};
