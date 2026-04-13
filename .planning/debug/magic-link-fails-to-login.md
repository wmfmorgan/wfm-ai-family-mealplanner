# Debugging: magic-link-fails-to-login

## Symptoms
- Magic links do not log the user in.
- Redirected to `/login` instead of `/planner`.
- Final URL is missing the hash (`#access_token=...`).
- Environment: `netlify dev` at port 8888.

## Hypotheses
1. **Supabase Redirect URL mismatch:** The `site_url` or `additional_redirect_urls` in Supabase config might not match `http://127.0.0.1:8888`.
2. **Netlify Dev Configuration:** `netlify.toml` might be overriding or misdirecting the callback.
3. **Frontend Auth Logic:** `AuthContext.tsx` or the login page might be failing to process the hash before redirecting to `/login`.
4. **Vite/Proxy Issues:** The dev server might be stripping the hash or mishandling the route.

## Investigation Log
- [x] Check `supabase/config.toml` for redirect URLs.
- [x] Check `netlify.toml` for redirect rules.
- [x] Inspect `src/contexts/AuthContext.tsx` for hash processing logic.
- [x] Inspect `src/pages/Auth/Login.tsx` (or equivalent) for redirection logic.
- [x] Check `.env` and local environment variables for `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

### Findings
1. **PKCE Detection Missing:** `AuthContext.tsx` was only checking for hash parameters (`#access_token=...`), but Supabase's PKCE flow (now the default) uses a query parameter (`?code=...`). When a magic link was clicked, the context didn't recognize it was processing auth and set `loading` to `false` too early.
2. **Premature Redirection:** `App.tsx` had an immediate `<Navigate to="/planner" replace />` for the root path (`/`). This caused the browser to navigate to `/planner`, stripping away the `code` parameter before Supabase's `onAuthStateChange` could exchange it for a session.
3. **ProtectedRoute Interaction:** Because `loading` was `false` and `session` was still `null` (since the code was lost), `ProtectedRoute` would then redirect to `/login`, leading to the observed behavior.

## Resolution Plan
- [x] Update `AuthContext.tsx` to detect `code` in search params and keep `loading` true.
- [x] Introduce `HomeRedirect` in `App.tsx` to wait for the loading state before redirecting from the root path.
- [x] Verify that `AuthContext.tsx` correctly handles the PKCE flow.

### Verification Results
- `AuthContext.tsx` now correctly identifies `isProcessingAuth` if `code` is in query params.
- `HomeRedirect` prevents stripping of auth params by waiting for `loading` to be `false`.
