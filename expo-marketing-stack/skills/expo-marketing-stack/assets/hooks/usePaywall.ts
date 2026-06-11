import type { PaywallState, RegisterPlacementArgs, usePlacementCallbacks } from "expo-superwall";
import { usePlacement, useSuperwall } from "expo-superwall";

/**
 * Reusable hook for triggering a Superwall paywall placement.
 * Wraps `usePlacement` with SDK readiness and error handling.
 *
 * Usage:
 * ```tsx
 * const { showPaywall, isReady, state } = usePaywall();
 * // ...
 * await showPaywall("campaign_trigger", () => navigateToFeature());
 * ```
 */
export function usePaywall(callbacks?: usePlacementCallbacks) {
  const isConfigured = useSuperwall((s) => s.isConfigured);
  const { registerPlacement, state } = usePlacement(callbacks);

  const showPaywall = async (
    placement: string,
    feature?: RegisterPlacementArgs["feature"],
    params?: RegisterPlacementArgs["params"],
  ) => {
    try {
      await registerPlacement({ placement, feature, params });
    } catch (error) {
      console.error("[Superwall] registerPlacement failed:", error);
    }
  };

  return {
    showPaywall,
    state,
    isReady: isConfigured && state.status !== "presented",
  };
}

export type { PaywallState };
