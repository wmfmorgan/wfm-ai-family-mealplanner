# Investigation: ai-proxy-400-netlify

## Summary
- **Issue:** 400 Bad Request at `ai-proxy` edge function after Netlify deployment.
- **Context:** Works locally (potentially using `VITE_AI_PROXY_URL`), fails on Netlify (using `supabase.functions.invoke`).
- **Endpoint:** `https://mqrqszanaotdpiwazriw.supabase.co/functions/v1/ai-proxy`

## Potential Causes
1. **Invalid Provider:** `provider` value sent from frontend is not 'gemini' or 'grok'.
2. **Unsupported Model:** The model requested (e.g., one of the fake ones like `gemini-3.1-pro`) is not supported by the provider, leading to a 400 from the provider.
3. **Missing System Prompt / Format:** Some providers might reject `response_format: { type: 'json_object' }` if not configured correctly.
4. **Environment Variables:** `SUPABASE_URL` or `SUPABASE_ANON_KEY` might be missing or incorrect in the Edge Function environment (though this would likely cause 500 or 401).
5. **Payload Mismatch:** `req.json()` failing to parse or missing required fields.

## Clues
- `activeProvider` defaults to `grok` in `MealPlanner.tsx` and `Settings.tsx`.
- `Settings.tsx` contains some clearly "fake" models like `gemini-3.1-pro` and `grok-4.20`.
- Local development might be bypassing the Edge Function if `VITE_AI_PROXY_URL` is set to a different mock server.

## Next Steps
1. Verify what `VITE_AI_PROXY_URL` is set to in local `.env`.
2. Check if the "fake" models are being selected by default or by the user.
3. Inspect `ai-proxy` logs if possible (via a test call or by adding more logging to the function).
4. Test the edge function manually with a `curl` command to see the exact error body.
