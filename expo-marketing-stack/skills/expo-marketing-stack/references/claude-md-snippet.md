# Snippet to append to the target project's CLAUDE.md

Append everything below the `---` line to the target repo's `CLAUDE.md` (create the file if it
doesn't exist). It keeps future Claude sessions aligned with the tracking plan.

---

## Analytics (Rocapine marketing stack)

Multi-provider orchestrator in `services/analytics/analytics.service.ts` fanning out to
Amplitude (primary events), Adjust (attribution), Facebook + TikTok (ad conversions),
RevenueCat (subscriptions, linked to Amplitude IDs), and Superwall (paywall + user attributes).
All providers init in parallel from the root layout; Amplitude tracking is disabled in dev via
`__DEV__` guards, and Adjust runs in sandbox mode in dev.

**Rule: app code never calls `captureEvent` or providers directly — always use the helpers in
`services/analytics/tracking-plan.ts`.**

### Events

| Event                       | Trigger                                             | Properties                                    | Helper                                 |
| --------------------------- | --------------------------------------------------- | --------------------------------------------- | -------------------------------------- |
| `onboarding_started`        | First onboarding screen is shown                    | —                                             | `trackOnboardingStarted()`             |
| `onboarding_step_viewed`    | Onboarding step screen mounts                       | `step_index`, `step_title`                    | `trackOnboardingStepViewed(...)`       |
| `onboarding_step_completed` | User completes a step (answer or "Continue")        | `step_index`, `step_title`, `answer`          | `trackOnboardingStepCompleted(...)`    |
| `onboarding_completed`      | Last CTA before paywall                             | `total_time_s`                                | `trackOnboardingCompleted()`           |
| `paywall_viewed`            | Superwall reports the paywall was shown             | —                                             | auto-wired (`useSuperwallAnalytics`)   |
| `user_converted`            | Superwall `transactionComplete` (once per purchase) | `plan`, `price`                               | auto-wired                             |
| `trial_started`             | `transactionComplete` with `hasFreeTrial=true`      | `plan`, `price`                               | auto-wired                             |
| `direct_subscription`       | `transactionComplete` with `hasFreeTrial=false`     | `plan`, `price`                               | auto-wired                             |
| `page_view/{name}`          | Route change (auto-wired in root layout)            | `count`                                       | `trackPageView(pathname)` (auto-wired) |
| `core_feature_started`      | User starts the app's core feature loop             | `source`                                      | `trackCoreFeatureStarted(source)`      |
| `core_feature_completed`    | User completes the core feature loop                | `feature_value?`, `feature_value_additional?` | `trackCoreFeatureCompleted({...})`     |

`trial_started` and `direct_subscription` fire alongside `user_converted` on every purchase —
they exist so Adjust, Facebook, and TikTok can route attribution through platform-specific
tokens. Don't deduplicate them.

### User properties

| Property              | Values                                                | How it's set                                            |
| --------------------- | ----------------------------------------------------- | ------------------------------------------------------- |
| `app_name`            | App display name                                      | Auto — `setAppNameUserProperty()` after Amplitude init  |
| `subscription_status` | `free` / `active_trial` / `churned_trial` / `premium` | Auto — RevenueCat listener → `syncSubscriptionStatus()` |

Don't set these manually. `isPremium` / `subscriptionStatus` live in
`stores/subscription.store.ts` and are kept reactive by RevenueCat/Superwall listeners.

### Onboarding integration recipe

1. First onboarding screen mount → `trackOnboardingStarted()`.
2. Each step screen on mount → `trackOnboardingStepViewed(stepIndex, stepTitle)`.
3. Each step on Next/answer → `trackOnboardingStepCompleted(stepIndex, stepTitle, answer)`.
4. Final CTA → `trackOnboardingCompleted()` immediately before `showPaywall(...)`.
5. After paywall completes → mark onboarding done in your user store, then navigate home.

`step_index` is 0-based. `step_title` is a short stable identifier (e.g. `"Goal"`), not
user-facing copy that changes between A/B tests.
