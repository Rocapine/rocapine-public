import {
  trackDirectSubscription,
  trackPaywallViewed,
  trackTrialStarted,
  trackUserConverted,
} from "@/services/analytics/tracking-plan";
import { useSubscriptionActions } from "@/stores/subscription.store";
import { useSuperwallEvents } from "expo-superwall";

/**
 * Centralizes all global Superwall event tracking and `isPremium` syncing.
 * Mounted once in the root layout — individual screens don't worry about analytics.
 *
 * Tracking-plan events emitted from here:
 * - `paywall_viewed` on `onPaywallPresent`
 * - `user_converted` on `transactionComplete` (with `plan` + `price`)
 * - `trial_started` or `direct_subscription` on `transactionComplete`, based on
 *   `product.hasFreeTrial` — these are routed to Adjust and Facebook for attribution.
 *
 * `user_converted` fires exactly once per purchase. Do NOT add `paywall_dismissed`
 * or `superwall_*` here — they were intentionally removed. The `subscription_status`
 * user property is set reactively from RevenueCat's `customerInfo` listener.
 */
export function useSuperwallAnalytics() {
  const { setIsPremium } = useSubscriptionActions();

  useSuperwallEvents({
    onPaywallPresent: () => {
      trackPaywallViewed();
    },
    onPaywallError: (error) => {
      console.error(new Error(`[Superwall] Error displaying paywall: ${error}`));
    },
    onSubscriptionStatusChange: (newStatus) => {
      setIsPremium(newStatus.status === "ACTIVE");
    },
    onSuperwallEvent: (eventInfo) => {
      if (eventInfo.event.event === "transactionComplete") {
        const { product, transaction } = eventInfo.event;
        trackUserConverted(product, transaction ?? undefined);
        if (product.hasFreeTrial) {
          trackTrialStarted(product);
        } else {
          trackDirectSubscription(product);
        }
      }
    },
  });
}
