---
name: expo-marketing-stack
description: 'Use this skill to install or wire ANY part of the Rocapine marketing/analytics stack into an Expo / React Native app: Superwall (paywalls), RevenueCat (subscriptions), Amplitude (analytics), Adjust (attribution), Facebook SDK, and TikTok ads events. Trigger it — in any language — whenever the user asks to set up purchase/trial/conversion tracking, paywall + tracking integration, ATT permission, attribution, or marketing/analytics SDKs in an Expo app, even if they name only ONE service or a specific package (e.g. expo-superwall, react-native-purchases, react-native-fbsdk-next, react-native-adjust, expo-tiktok-ads-events), or just say "add the usual tracking plan" / "track purchases like our other apps". Also use it before launches when someone needs the standard tracking wired up. Do NOT use it for non-Expo platforms (Flutter, native, web/Next.js), ad campaign creation, renaming/documenting existing events, EAS build configuration alone, debugging an installed stack, or TikTok alone (tiktok-ads-service).'
user-invocable: true
---

# Expo Marketing Stack

Installs Rocapine's opinionated analytics stack into an Expo project. The stack is a
multi-provider orchestrator: app code calls **tracking-plan helpers**, which fan events out to
**Amplitude** (primary events), **Adjust** (attribution), **Facebook** and **TikTok**
(ad-platform conversions), while **RevenueCat** manages subscriptions and **Superwall** manages
the paywall UI. Working source files are bundled in `assets/` next to this SKILL.md — copy them,
don't rewrite them.

## Architecture you are installing

```
app code ──► services/analytics/tracking-plan.ts   (the ONLY public API for events)
                      │
                      ▼
             services/analytics/analytics.service.ts   (orchestrator)
                      │ fans out to
                      ▼
   providers/: amplitude · adjust · facebook · tiktok · revenuecat · superwall
                      ▲
   hooks/useSuperwallAnalytics.ts  (Superwall events → conversion tracking)
   stores/: analytics.store · subscription.store     (persisted Zustand state)
   components/Provider.tsx                            (SuperwallProvider wrapper)
```

Two invariants make this stack work — preserve them when adapting to the target app:

1. App code never calls `captureEvent` or a provider directly. It calls helpers from
   `tracking-plan.ts`. This keeps event names/properties consistent across all Rocapine apps so
   dashboards are comparable.
2. `subscription_status` and `isPremium` are synced reactively (RevenueCat `customerInfo`
   listener and Superwall events). Never set them manually from app code.

## Step 0 — Inspect the target project before touching anything

Read the project's `package.json`, `app.json`/`app.config.ts`, `tsconfig.json`, and the root
layout (`app/_layout.tsx` or equivalent). Determine:

- **Expo SDK presence.** This stack requires Expo (it uses `expo-superwall`,
  `expo-tracking-transparency`, config plugins). Bare React Native without Expo modules is out of
  scope — tell the user instead of improvising.
- **Dev client, not Expo Go.** These are native SDKs; the app must build a dev client
  (`expo run:ios` / `eas build`). If the project uses Expo Go, warn the user that a native
  rebuild is required after installation.
- **Path alias.** The bundled files import via `@/...`. If `tsconfig.json` lacks an `@/*` alias,
  either add one (`"paths": { "@/*": ["./*"] }` — preferred) or rewrite imports to relative
  paths.
- **Source layout.** If the project keeps code under `src/`, place the copied folders under
  `src/` and keep the alias consistent.
- **Existing conflicts.** If the project already has any of these SDKs initialized elsewhere
  (e.g. an existing `Purchases.configure` call or Amplitude init), plan to remove/merge the old
  init — double initialization causes subtle bugs (duplicate events, listener leaks).
- **Expo Router vs React Navigation.** Wiring below assumes Expo Router. With React Navigation,
  the same pieces apply but page-view tracking hooks into `NavigationContainer`'s
  `onStateChange` instead of `usePathname`.

## Step 1 — Install dependencies

Use `npx expo install` so versions match the project's SDK:

```bash
npx expo install @amplitude/analytics-react-native react-native-adjust \
  react-native-fbsdk-next react-native-purchases expo-superwall \
  expo-tiktok-ads-events expo-tracking-transparency expo-constants \
  @react-native-async-storage/async-storage zustand
```

`@tanstack/react-query` is part of `Provider.tsx`; install it too unless the project already has
it. If any package has no expo-managed version, `expo install` falls back to latest — that's
fine. For reference, the versions known to work together on Expo SDK 55 are listed in
[references/wiring.md](references/wiring.md).

## Step 2 — Copy the stack files

Copy from this skill's `assets/` directory (under the skill base directory shown when this skill
loaded) into the project root (or `src/`):

| From `assets/`                       | Purpose                                              |
| ------------------------------------ | ---------------------------------------------------- |
| `services/analytics/` (whole folder) | Orchestrator, tracking plan, types, all 7 providers  |
| `hooks/useSuperwallAnalytics.ts`     | Superwall events → conversion tracking + store sync  |
| `hooks/usePaywall.ts`                | Convenience wrapper around Superwall placements      |
| `stores/analytics.store.ts`          | Page-view counters + onboarding timer (internal)     |
| `stores/subscription.store.ts`       | `isPremium`, `subscriptionStatus`, `everHadTrial`    |
| `components/Provider.tsx`            | QueryClient + SuperwallProvider + GestureHandlerRoot |

Copy files **verbatim**, then adapt only what the target requires (alias, `src/` prefix, merging
into an existing Provider). If the project already composes providers, graft `SuperwallProvider`
into the existing tree rather than duplicating it — the Superwall SDK must be configured exactly
once, above any component that calls `usePaywall`.

If the project already has a `stores/user.store.ts`-style onboarding store, leave it alone —
nothing in the stack depends on it.

## Step 3 — Config plugins and env vars

Follow [references/wiring.md](references/wiring.md) for the exact blocks. Summary:

1. **app config**: add the `expo-tracking-transparency` plugin, the conditional
   `react-native-fbsdk-next` plugin (only included when `EXPO_PUBLIC_FACEBOOK_APP_ID` is set —
   a config plugin with an empty appID breaks the native build), and the iOS
   `NSAdvertisingAttributionReportEndpoint` infoPlist entry for SKAN. If the project uses static
   `app.json`, convert to dynamic `app.config.ts` so the Facebook plugin can stay conditional.
2. **.env / .env.example**: add all `EXPO_PUBLIC_*` keys (Superwall, RevenueCat, Amplitude,
   Facebook, Adjust app token + 5 Adjust event tokens, 4 TikTok vars). Leave values empty in
   `.env.example`; every provider no-ops gracefully when its key is missing, so the app builds
   and runs before the marketing team fills the tokens in.

## Step 4 — Wire the root layout

In the root layout (Expo Router: `app/_layout.tsx`):

1. Call `initialize()` from `analytics.service.ts` once at module load (top level, wrapped in
   try/catch — see wiring.md). It requests ATT permission first, then inits all providers in
   parallel. Don't await it in a component; it must not block first render.
2. Wrap the tree in the copied `Provider`.
3. Inside a component under `Provider`: `useEffect` on `usePathname()` → `trackPageView(pathname)`,
   and mount `useSuperwallAnalytics()` exactly once.

## Step 5 — Verify

1. `npx tsc --noEmit` — must pass. Fix import-path issues from Step 2 before anything else.
2. `npx expo-doctor` — config plugins sane.
3. Remind the user: native SDKs were added, so a **new dev client build** is required
   (`expo run:ios` / `expo run:android` or EAS build). JS-only reload is not enough.
4. If the project builds in CI/EAS, check that the new env vars are added to EAS secrets or the
   build profile — `EXPO_PUBLIC_*` vars are baked in at build time.

## Step 6 — Document the tracking plan in the target repo

Append the contents of [references/claude-md-snippet.md](references/claude-md-snippet.md) to the
project's `CLAUDE.md` (create it if absent). This documents the events, the helpers, and the
"never call captureEvent directly" rule for future sessions. Then tell the user which
integration calls remain **for them** (or you, if onboarding screens exist) to place: the
onboarding helpers (`trackOnboardingStarted`, `trackOnboardingStepViewed/Completed`,
`trackOnboardingCompleted`) and the core-feature helpers (`trackCoreFeatureStarted/Completed`)
must be called from the app's own screens — the skill cannot guess where those are.

## Behavior notes (read before debugging)

- **Dev mode**: Amplitude tracking is fully disabled under `__DEV__`; Adjust runs in sandbox;
  Superwall runs with relaxed transaction checks; TikTok init passes `__DEV__` as debug flag.
  "No events in Amplitude" during development is expected, not a bug.
- **Trial LTV heuristic**: `trackPurchase` reports `price * 0.2` as LTV for free trials —
  intentional (expected trial→paid conversion), keep it.
- **Adjust event tokens**: Adjust only receives the 5 events that have a token env var
  (`onboarding_completed`, `app_opened`, `user_converted`, `trial_started`,
  `direct_subscription`). Unmapped events are skipped silently.
- **TikTok**: only `onboarding_completed`, `trial_started`, `direct_subscription` map to TikTok
  standard events; everything else is ignored by design.
- **`trial_started` / `direct_subscription`** fire alongside `user_converted` on every purchase —
  they exist so Adjust/Facebook/TikTok can route attribution through platform-specific tokens.
  Don't "deduplicate" them.
