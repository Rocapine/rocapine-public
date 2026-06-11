import { setProperty } from "@/services/analytics/analytics.service";
import { AnalyticsEvent } from "@/services/analytics/types";
import { Platform } from "react-native";
import {
  Adjust,
  AdjustAppStoreSubscription,
  AdjustAttribution,
  AdjustConfig,
  AdjustEvent,
  AdjustPlayStoreSubscription,
} from "react-native-adjust";
import Purchases from "react-native-purchases";
import { revenueCatApiKey } from "./revenuecat.provider";

const adjustEventTokens: Record<string, string> = {
  onboarding_completed: process.env.EXPO_PUBLIC_ADJUST_TOKEN_ONBOARDING_COMPLETED || "",
  app_opened: process.env.EXPO_PUBLIC_ADJUST_TOKEN_APP_OPENED || "",
  user_converted: process.env.EXPO_PUBLIC_ADJUST_TOKEN_USER_CONVERTED || "",
  trial_started: process.env.EXPO_PUBLIC_ADJUST_TOKEN_TRIAL_STARTED || "",
  direct_subscription: process.env.EXPO_PUBLIC_ADJUST_TOKEN_DIRECT_SUBSCRIPTION || "",
};

export const trackEvent = async (event: AnalyticsEvent) => {
  const adjustEvent = adjustEventTokens[event.name];
  if (adjustEvent) {
    const adjustEventObj = new AdjustEvent(adjustEvent);
    Adjust.trackEvent(adjustEventObj);
  }
};

export const initialize = async () => {
  const adjustConfig = new AdjustConfig(
    process.env.EXPO_PUBLIC_ADJUST_APP_TOKEN || "",
    __DEV__ ? AdjustConfig.EnvironmentSandbox : AdjustConfig.EnvironmentProduction,
  );
  adjustConfig.setFbAppId(process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || "");
  adjustConfig.setAttributionCallback(setAttributionProperties);
  adjustConfig.enableCostDataInAttribution();
  __DEV__ && adjustConfig.setLogLevel(AdjustConfig.LogLevelWarn);
  Adjust.addGlobalCallbackParameter("status", "3");
  Adjust.initSdk(adjustConfig);
  const hasRevenueCat = Boolean(revenueCatApiKey());
  Adjust.getAdid((adjustId) => {
    if (adjustId && hasRevenueCat) {
      Purchases.setAdjustID(adjustId);
    }
  });
};

const setAttributionProperties = (attribution: AdjustAttribution) => {
  setProperty({
    key: "adjust_attribution",
    value: JSON.stringify(attribution),
  });
  setProperty({
    key: "adjust_tracker_token",
    value: attribution.trackerToken,
  });
  setProperty({
    key: "adjust_tracker_name",
    value: attribution.trackerName,
  });
  setProperty({
    key: "adjust_network",
    value: attribution.network,
  });
  setProperty({
    key: "adjust_click_label",
    value: attribution.clickLabel,
  });
  setProperty({
    key: "adjust_cost_type",
    value: attribution.costType,
  });
  setProperty({
    key: "adjust_cost_amount",
    value: attribution.costAmount,
  });
  setProperty({
    key: "adjust_cost_currency",
    value: attribution.costCurrency,
  });
};

/**
 * Tracks a purchase event for both iOS (App Store) and Android (Google Play) using Adjust.
 *
 * For iOS: requires price, currency, transactionId.
 * For Android: requires price, currency, sku, orderId, signature, purchaseToken.
 *
 * @param params - Platform-specific purchase parameters
 */
export function trackPlatformPurchase(params: {
  price: number;
  currency: string;
  // iOS
  transactionId?: string;
  // Android
  sku?: string;
  orderId?: string;
  signature?: string;
  purchaseToken?: string;
}) {
  console.info("trackPlatformPurchase", params);
  // Always cast price to string for Adjust constructors
  const priceStr = String(params.price);
  if (Platform.OS === "ios") {
    const { currency, transactionId } = params;
    if (!transactionId) {
      console.warn("trackPlatformPurchase: transactionId is required for iOS purchases");
      return;
    }
    try {
      console.info("trackPlatformPurchase: iOS", {
        priceStr,
        currency,
        transactionId,
      });
      const subscription = new AdjustAppStoreSubscription(priceStr, currency, transactionId);
      Adjust.trackAppStoreSubscription(subscription);
    } catch (error) {
      console.error("An error occured while tracking App Store subscription", error);
    }
  } else if (Platform.OS === "android") {
    const { price, currency, sku, orderId, signature, purchaseToken } = params;
    if (!sku || !orderId || !signature || !purchaseToken) {
      console.warn(
        "trackPlatformPurchase: sku, orderId, signature, and purchaseToken are required for Android purchases",
      );
      return;
    }
    try {
      console.info("trackPlatformPurchase: Android", {
        price,
        currency,
        sku,
        orderId,
        signature,
        purchaseToken,
      });
      const subscription = new AdjustPlayStoreSubscription(
        price,
        currency,
        sku,
        orderId,
        signature,
        purchaseToken,
      );
      Adjust.trackPlayStoreSubscription(subscription);
    } catch (error) {
      console.error("An error occured while tracking Play Store subscription", error);
    }
  } else {
    console.warn("trackPlatformPurchase: Unsupported platform");
  }
}
