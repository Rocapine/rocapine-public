---
name: tiktok-ads-service
description: "Use this skill to integrate the TikTok Ads SDK into an existing Expo / React Native app and send the funnel events a TikTok Ads campaign needs. Trigger it — in any language — whenever the user asks to add TikTok ads, the TikTok SDK, TikTok events, TikTok conversion tracking, TikTok attribution, or to prepare an app for a TikTok campaign / TikTok UA; when they name the package expo-tiktok-ads-events or the TikTok Business SDK; or when they mention the TikTok standard events complete_tutorial, start_trial or subscribe (TikTokStandardEvents). Use it when the app already has its own analytics layer and only TikTok is missing. Do NOT use it for installing the whole marketing stack from scratch (use expo-marketing-stack), non-Expo platforms, creating the campaign itself in TikTok Ads Manager, or other ad networks."
user-invocable: true
---

# TikTok Ads Service

Adds a `TikTokService` to an Expo app and wires it into the funnel so a TikTok Ads campaign can
attribute and optimise on it. The working service is bundled at `assets/TikTok.service.ts` next to
this SKILL.md — copy it, don't rewrite it.

## Intent — the three events TikTok must receive

| Funnel moment                                            | TikTok standard event                    | Service method              |
| -------------------------------------------------------- | ---------------------------------------- | --------------------------- |
| Onboarding completed                                     | `TikTokStandardEvents.complete_tutorial` | `trackCompleteOnboarding()` |
| Trial started                                            | `TikTokStandardEvents.start_trial`       | `trackStartTrial(...)`      |
| User converted — **direct subscription AND trial start** | `TikTokStandardEvents.subscribe`         | `trackPurchase(...)`        |

A trial start therefore fires **two** events (`start_trial` + `subscribe`); a direct
subscription fires one (`subscribe`). `subscribe` is the conversion event UA optimises on, so it
must carry `value` and `currency`.

## Step 0 — Inspect the target project

Read `package.json`, `app.json` / `app.config.ts`, `tsconfig.json`, and find:

- **An existing TikTok integration.** Search for `expo-tiktok-ads-events` / `TiktokAdsEvents`. If
  the app was set up with the `expo-marketing-stack` skill it already has
  `services/analytics/providers/tiktok.provider.ts` — extend that provider instead of adding a
  second service (two `initializeSdk` callers deadlock the native singleton).
- **The analytics layer.** The service or orchestrator that initialises Amplitude / Adjust / Meta
  etc. (look for `Promise.allSettled`, `initialize()`, `AnalyticsService`, a `tracking-plan`).
  TikTok is initialised and called from there, not from screens.
- **The logger.** The bundled service imports `logger` from `@/lib/logger`. Find the app's
  logger and its import path; if there is none, use `console`. Also check the `@/*` alias exists.
- **The three call sites:** where onboarding completes, where a trial starts, where a purchase
  succeeds (RevenueCat `purchasePackage`, a Superwall `transactionComplete` / `subscriptionStart`
  handler, a paywall hook…). Note what price, currency, transaction id and product id are
  available at each.

## Step 1 — Install

```bash
npx expo install expo-tiktok-ads-events expo-tracking-transparency
```

It is a native module: Expo Go cannot run it. iOS needs the ATT permission — if the app lacks the
`expo-tracking-transparency` config plugin, add it (see the package README for the plugin block
and the `SKAdNetworkItems` list TikTok attribution needs).

## Step 2 — Copy the service

Copy `assets/TikTok.service.ts` into the app's services folder (next to the other analytics
services, following their file naming). Then adapt only:

1. the `logger` import → the app's logger, mapping its method names too (the service calls
   `logger.log/warn/error`; e.g. `log` → `info`). Keep the `[TikTok]` prefixes;
2. the `STANDARD_EVENT_MAP` keys → the event names the app's analytics facade forwards, if it
   routes generic events through `trackEvent`.

Keep the concurrent-init guard, the 5 s init timeout and the per-platform env vars — each fixes a
real SDK failure (deadlock, hanging completion handler, wrong app record per platform).

## Step 3 — Env vars

Six vars, one set per platform (iOS and Android are separate TikTok app records):

```bash
EXPO_PUBLIC_TIKTOK_IOS_ACCESS_TOKEN=""
EXPO_PUBLIC_TIKTOK_ANDROID_ACCESS_TOKEN=""
EXPO_PUBLIC_TIKTOK_IOS_TT_APP_ID=""
EXPO_PUBLIC_TIKTOK_ANDROID_TT_APP_ID=""
EXPO_PUBLIC_TIKTOK_IOS_APP_ID=""       # App Store numeric id
EXPO_PUBLIC_TIKTOK_ANDROID_APP_ID=""   # Android package name
```

Add them empty to `.env.example` (the service skips init when any is missing). Real values are
set by the team in the **EAS console → Project settings → Environment Variables** — never commit
them. `EXPO_PUBLIC_*` vars are baked in at build time.

## Step 4 — Initialise alongside the other analytics services

In the analytics layer's `initialize`, add TikTok to the existing parallel init so one failing
SDK never blocks the others:

```ts
const results = await Promise.allSettled([
  AdjustService.initialize(),
  AmplitudeService.initialize(),
  TikTokService.initialize(),
  // ...the app's other services
]);
```

If the app requests ATT before initialising analytics, keep TikTok after that request. Call
`TikTokService.trackAppLaunch()` once at app start if you want `launch_app`, and
`setUserID(...)` wherever the app identifies users to its other SDKs.

## Step 5 — Wire the events

Call the service from the same places the app already reports these moments to its other ad
networks — ideally inside the analytics facade's existing helpers, so screens don't change:

- onboarding completed → `TikTokService.trackCompleteOnboarding()`
- trial started → `TikTokService.trackStartTrial(price, currency, productId)` **and**
  `TikTokService.trackPurchase(price, currency, transactionId, productId)`
- direct subscription → `TikTokService.trackPurchase(price, currency, transactionId, productId)`

Pass the price/currency the app already sends to its other networks for the same event; `price`
is a string (the service `parseFloat`s it). Fire only after the purchase is confirmed, not on
paywall tap.

## Step 6 — Verify

1. `npx tsc --noEmit` passes.
2. Rebuild the dev client (`npx expo run:ios` / EAS build) — a JS reload is not enough. On launch
   the logs must show `[TikTok] Initialized`; "Native module unavailable" means the rebuild is
   missing, "Missing env vars" means the build has no TikTok vars.
3. On a **real device** (attribution does not work on a simulator), log
   `await TiktokAdsEvents.getTestEventCode()`, open
   [TikTok Events Manager](https://ads.tiktok.com/events_manager/) → your app → Test Events,
   enter the code, then walk the funnel: complete onboarding, start a sandbox trial, buy a
   subscription. Expect `complete_tutorial`, then `start_trial` + `subscribe` for the trial,
   then `subscribe` alone for the direct subscription, each `subscribe` with `value` and
   `currency`.
4. Tell the user which env vars remain to be filled in EAS.

## Common mistakes

- **Second TikTok init path.** A provider from `expo-marketing-stack` plus this service = two
  concurrent `initializeSdk` calls and a hung app start. One integration per app.
- **Trial only fires `start_trial`.** UA optimises on `subscribe`; trials must fire both.
- **Hard-coding `@/lib/logger`.** Adapt to the host logger, or `tsc` fails.
- **One shared set of credentials.** Access token and TT app id differ per platform.
- **Testing in Expo Go or a simulator.** Native module + attribution need a dev build on device.

## Resources

- [`expo-tiktok-ads-events`](https://github.com/Pixel-Logic-Apps/expo-tiktok-ads-events/)
- [`tiktok-business-ios-sdk`](https://github.com/tiktok/tiktok-business-ios-sdk)
