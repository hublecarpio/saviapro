
# Plan: Fix Critical Client Issues

The client reported 4 issues. Here's the root cause analysis and fix plan for each.

## Issues Identified

### Issue 1: "Login works but app doesn't respond"
**Root Cause**: The `AuthProvider` component exists but is **never used** in the app. This means:
- On page refresh, the Supabase session is never re-validated
- The `onAuthStateChange` listener is never set up
- The app relies entirely on persisted localStorage state, which can become stale

**Fix**: Wrap the routes in `App.tsx` with `AuthProvider` so that `initializeAuth()` runs on app mount and the auth state listener is active.

### Issue 2: "App is slow to load, sometimes needs refresh"
**Root Cause**: Same as Issue 1. Without `AuthProvider`, on refresh:
1. Zustand hydrates from localStorage with stale data
2. No session re-validation happens
3. API calls may fail with expired tokens
4. User has to refresh again hoping the session refreshes

**Fix**: Same fix as Issue 1. Additionally, set `loading: true` as the initial persisted state so the app shows a loading spinner until auth is confirmed, preventing flash of incorrect content.

### Issue 3: "Files disappeared when logging out of admin"
**Root Cause**: The `DocumentsList` component loads ALL documents (no user filter). When admin logs out, the realtime subscription may trigger a final reload with no active session, returning empty results and overwriting the list. The debounce fix helps but doesn't fully solve the root issue.

**Fix**: Ensure the realtime subscription is properly cleaned up before logout completes. Add a check in `loadDocuments` to skip loading if there's no active session.

### Issue 4: "Some images are generated with errors"
**Root Cause**: No edge function logs available currently. Need to add better error handling and logging in the chat function for image generation failures.

**Fix**: Add defensive error handling in the Chat UI so that failed image URLs show a fallback/error state instead of broken images.

## Technical Changes

### 1. `src/routes/App.tsx`
- Import and wrap routes with `AuthProvider`
- This activates session initialization and auth state listener on app mount

### 2. `src/store/useUserStore.ts`  
- Change initial `loading` to `true` so the app shows a loading state until auth is confirmed
- This prevents the flash of unauthenticated content on refresh

### 3. `src/providers/AuthProvider.tsx`
- Add a loading state that shows a spinner until auth initialization completes
- Prevent children from rendering until auth state is resolved

### 4. `src/components/DocumentsList.tsx`
- Add session check before loading documents
- Cancel any pending loads on unmount/logout

### 5. Chat image error handling (`src/pages/Chat.tsx`)
- Add `onError` handler to rendered images to show fallback when image generation fails
- Show user-friendly error message instead of broken image icon
