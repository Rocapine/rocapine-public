/**
 * Tracking plan helpers — the ONLY public API for emitting analytics events.
 * See `CLAUDE.md` ("Analytics tracking plan") for the canonical event reference.
 *
 * Rules:
 * - Never call captureEvent / setProperty from analytics.service.ts directly in app code.
 *   Always go through the helpers in this file.
 * - Never invent new event names without first updating CLAUDE.md.
 */

import { useAnalyticsStore } from "@/stores/analytics.store";
import { type SubscriptionStatus, useSubscriptionStore } from "@/stores/subscription.store";
import Constants from "expo-constants";
import type { StoreTransaction, TransactionProductIdentifier } from "expo-superwall";
import type { CustomerInfo } from "react-native-purchases";
import { captureEvent, setProperty, trackPurchase } from "./analytics.service";

// =============================================================================
// User properties
// =============================================================================

/**
 * Sets the `app_name` user property on Amplitude. Read from `Constants.expoConfig?.name`,
 * which the Rocapine CLI populates from the `APP_NAME` env var at bootstrap time.
 *
 * All Rocapine apps share a single Amplitude project; this property is what filters
 * dashboards per app. Called once after Amplitude init.
 */
export async function setAppNameUserProperty(): Promise<void> {
  const name = Constants.expoConfig?.name;
  if (!name) return;
  await setProperty({ key: "app_name", value: name });
}

/**
 * Computes the `subscription_status` user property from a RevenueCat CustomerInfo payload.
 *
 * - No active entitlements + previously had a trial → `churned_trial`
 * - No active entitlements + never had a trial      → `free`
 * - Active entitlement, periodType ∈ {TRIAL, INTRO} → `active_trial`
 * - Active entitlement, periodType ∈ {NORMAL, PREPAID} → `premium`
 *
 * Templates assume a single entitlement; if multiple are active, the first is used.
 */
export function computeSubscriptionStatus(info: CustomerInfo): SubscriptionStatus {
  const active = Object.values(info.entitlements.active);
  if (active.length === 0) {
    return useSubscriptionStore.getState().everHadTrial ? "churned_trial" : "free";
  }
  const periodType = active[0].periodType;
  if (periodType === "TRIAL" || periodType === "INTRO") return "active_trial";
  return "premium";
}

/**
 * Reactive sync called from the RevenueCat customerInfo listener (and once on cold start).
 * Computes the new status, marks `everHadTrial` on first transition into `active_trial`,
 * and only writes / emits the user property when the value changed.
 */
export async function syncSubscriptionStatus(info: CustomerInfo): Promise<void> {
  const next = computeSubscriptionStatus(info);
  const { subscriptionStatus, everHadTrial, actions } = useSubscriptionStore.getState();
  if (next === "active_trial" && !everHadTrial) {
    actions.markEverHadTrial();
  }
  if (subscriptionStatus !== next) {
    actions.setSubscriptionStatus(next);
    await setProperty({ key: "subscription_status", value: next });
  }
}

// =============================================================================
// Plan label
// =============================================================================

export type PlanLabel = "yearly_trial" | "monthly_sub" | "yearly_discount" | string;

/**
 * Maps a Superwall product to a plan label:
 * - yearly + hasFreeTrial → `yearly_trial`
 * - monthly              → `monthly_sub`
 * - yearly (no trial)    → `yearly_discount`
 * - fallback             → raw `period` string (or "unknown" if empty)
 */
export function planLabelFromProduct(product: TransactionProductIdentifier): PlanLabel {
  const period = (product.period || "").toLowerCase();
  const isYearly = period.includes("year") || product.periodYears > 0;
  const isMonthly = period.includes("month") || product.periodMonths > 0;
  if (isYearly && product.hasFreeTrial) return "yearly_trial";
  if (isMonthly) return "monthly_sub";
  if (isYearly) return "yearly_discount";
  return period || "unknown";
}

// =============================================================================
// Page view
// =============================================================================

/**
 * Strips leading/trailing slashes and maps `/` to `home`.
 * Examples: `/home` → `home`, `/onboarding/step/1` → `onboarding/step/1`, `/` → `home`.
 */
export function normalizePagePath(pathname: string): string {
  if (!pathname || pathname === "/") return "home";
  const trimmed = pathname.replace(/^\/+/, "").replace(/\/+$/, "");
  return trimmed || "home";
}

/**
 * Event: `page_view/{name}` — fires on every route change.
 *
 * Property: `count` — total number of times this user has viewed this page (lifetime,
 * persisted across sessions in `useAnalyticsStore`). Starts at 1 on first view.
 */
export async function trackPageView(pathname: string): Promise<void> {
  const name = normalizePagePath(pathname);
  const count = useAnalyticsStore.getState().actions.incrementPageView(name);
  await captureEvent({ name: `page_view/${name}`, properties: { count } });
}

// =============================================================================
// Paywall + conversion
// =============================================================================

/**
 * Event: `paywall_viewed` — no properties.
 * Trigger: Superwall reports the paywall was shown (`onPaywallPresent`).
 */
export async function trackPaywallViewed(): Promise<void> {
  await captureEvent({ name: "paywall_viewed", properties: {} });
}

/**
 * Event: `user_converted` — fires exactly once per purchase.
 *
 * Trigger: Superwall `transactionComplete` event.
 *
 * Properties:
 * - `plan`: heuristic label (`yearly_trial` / `monthly_sub` / `yearly_discount`).
 * - `price`: product price in dollars.
 *
 * Also forwards to `trackPurchase` (Adjust + Facebook conversion tracking) when a
 * transaction is present.
 */
export async function trackUserConverted(
  product: TransactionProductIdentifier,
  transaction?: StoreTransaction,
): Promise<void> {
  await captureEvent({
    name: "user_converted",
    properties: {
      plan: planLabelFromProduct(product),
      price: product.price,
    },
  });
  if (transaction) {
    await trackPurchase(product, transaction);
  }
}

/**
 * Event: `trial_started` — fires alongside `user_converted` when the product has a
 * free trial.
 *
 * Not in the canonical event taxonomy; kept because the Adjust and Facebook providers
 * map this name to platform-specific tokens (StartTrial / Adjust trial token) used for
 * attribution and ad-platform optimization.
 *
 * Properties: `plan`, `price` (same shape as `user_converted` for consistency).
 */
export async function trackTrialStarted(product: TransactionProductIdentifier): Promise<void> {
  await captureEvent({
    name: "trial_started",
    properties: {
      plan: planLabelFromProduct(product),
      price: product.price,
    },
  });
}

/**
 * Event: `direct_subscription` — fires alongside `user_converted` when the product has
 * no free trial (paid conversion straight from the paywall).
 *
 * Same rationale as `trial_started`: routed to Facebook (`Subscribe`) and Adjust for
 * attribution. Not in the canonical event taxonomy.
 *
 * Properties: `plan`, `price`.
 */
export async function trackDirectSubscription(
  product: TransactionProductIdentifier,
): Promise<void> {
  await captureEvent({
    name: "direct_subscription",
    properties: {
      plan: planLabelFromProduct(product),
      price: product.price,
    },
  });
}

// =============================================================================
// Onboarding
// =============================================================================

/**
 * Event: `onboarding_started` — no properties.
 *
 * Trigger: First onboarding screen is shown. Idempotent: re-mounting the screen
 * will NOT reset the timer used for `onboarding_completed.total_time_s`.
 */
export async function trackOnboardingStarted(): Promise<void> {
  useAnalyticsStore.getState().actions.startOnboardingTimer();
  await captureEvent({ name: "onboarding_started", properties: {} });
}

/**
 * Event: `onboarding_step_viewed`.
 *
 * Trigger: An onboarding screen is shown.
 *
 * @param step_index 0-based index of the step in the funnel.
 * @param step_title Human-readable title (e.g. "Carousel", "Goal", "Prepaywall").
 */
export async function trackOnboardingStepViewed(
  step_index: number,
  step_title: string,
): Promise<void> {
  await captureEvent({
    name: "onboarding_step_viewed",
    properties: { step_index, step_title },
  });
}

/**
 * Event: `onboarding_step_completed`.
 *
 * Trigger: User completes the step by answering the question or tapping "Continue".
 *
 * @param step_index 0-based index of the step in the funnel.
 * @param step_title Human-readable title.
 * @param answer The user's answer (string for single-choice, array for multi-choice).
 *               Critical for segmentation dashboards.
 */
export async function trackOnboardingStepCompleted(
  step_index: number,
  step_title: string,
  answer: string | string[],
): Promise<void> {
  await captureEvent({
    name: "onboarding_step_completed",
    properties: { step_index, step_title, answer },
  });
}

/**
 * Event: `onboarding_completed`.
 *
 * Trigger: User clicks the last CTA before the paywall.
 *
 * Property: `total_time_s` — seconds elapsed since `onboarding_started`. 0 if the timer
 * was never started (defensive fallback; should not happen in normal flows).
 */
export async function trackOnboardingCompleted(): Promise<void> {
  const startedAt = useAnalyticsStore.getState().onboardingStartedAt;
  const total_time_s = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
  await captureEvent({
    name: "onboarding_completed",
    properties: { total_time_s },
  });
}

// =============================================================================
// Core feature
// =============================================================================

/**
 * Event: `core_feature_started`.
 *
 * Trigger: User starts interacting with the app's core feature loop (e.g. mood tracking,
 * meal-plan creation). Each app should call this exactly once per session at the moment
 * the user enters the feature.
 *
 * @param source Where the user triggered it (e.g. "home", "nav_bar").
 */
export async function trackCoreFeatureStarted(source: string): Promise<void> {
  await captureEvent({ name: "core_feature_started", properties: { source } });
}

/**
 * Event: `core_feature_completed`.
 *
 * Trigger: User completes the core feature loop.
 *
 * @param feature_value Optional — short value characterizing the outcome (e.g. "Sad",
 *                      "5K plan").
 * @param feature_value_additional Optional — longer free-form context if relevant.
 */
export async function trackCoreFeatureCompleted(
  opts: {
    feature_value?: string | number;
    feature_value_additional?: string | number;
  } = {},
): Promise<void> {
  const properties: Record<string, string | number> = {};
  if (opts.feature_value !== undefined) properties.feature_value = opts.feature_value;
  if (opts.feature_value_additional !== undefined) {
    properties.feature_value_additional = opts.feature_value_additional;
  }
  await captureEvent({ name: "core_feature_completed", properties });
}
