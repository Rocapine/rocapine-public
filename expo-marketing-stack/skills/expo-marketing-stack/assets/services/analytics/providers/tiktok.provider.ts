import TiktokAdsEvents, {
  TikTokIdentify,
  TikTokStandardEvents,
  TikTokStandardEventValue,
} from "expo-tiktok-ads-events";
import { Platform } from "react-native";
import type { AnalyticsEvent, AnalyticsPurchaseEventProperties } from "../types";
import { revenueCatUtils } from "./revenuecat.provider";

const StandardEvents: Record<string, TikTokStandardEventValue> = {
  onboarding_completed: TikTokStandardEvents.complete_tutorial,
  trial_started: TikTokStandardEvents.start_trial,
  direct_subscription: TikTokStandardEvents.subscribe,
};

function convertPropertiesToArray(
  properties: Record<string, any>,
): { key: string; value: string | number }[] {
  return Object.entries(properties)
    .filter(([_, value]) => value != null)
    .map(([key, value]) => ({
      key,
      value: typeof value === "number" ? value : String(value),
    }));
}

export const initialize = async () => {
  const appId = Platform.select({
    ios: process.env.EXPO_PUBLIC_TIKTOK_IOS_APP_ID,
    android: process.env.EXPO_PUBLIC_TIKTOK_ANDROID_APP_ID,
  });
  const ttAppId = process.env.EXPO_PUBLIC_TIKTOK_TT_APP_ID;
  const accessToken = process.env.EXPO_PUBLIC_TIKTOK_ACCESS_TOKEN;
  if (!appId || !ttAppId || !accessToken) return;

  try {
    await TiktokAdsEvents.initializeSdk(accessToken, appId, ttAppId, __DEV__);
  } catch (error) {
    console.error("Failed to initialize TikTok SDK:", error);
  }
};

export const trackEvent = async (event: AnalyticsEvent) => {
  const standardEvent = StandardEvents[event.name];
  if (!standardEvent) return;

  try {
    const propertiesArray = convertPropertiesToArray(event.properties);
    await TiktokAdsEvents.trackTTEvent(
      standardEvent,
      propertiesArray.length > 0 ? propertiesArray : undefined,
    );
  } catch (error) {
    console.error("Failed to track TikTok standard event:", error);
  }
};

export const identify = async (email: string) => {
  try {
    const externalId: string = email || (await revenueCatUtils.getUserId());
    await TikTokIdentify({ externalId, email });
  } catch (error) {
    console.error("Failed to identify user in TikTok:", error);
  }
};

export const trackPurchase = async ({
  ltv,
  currency,
  transactionId,
  isTrial,
  planFrequency,
  country,
  platform,
  sku,
}: AnalyticsPurchaseEventProperties) => {
  try {
    const properties = convertPropertiesToArray({
      currency,
      value: ltv,
      content_id: sku,
      content_type: "subscription",
      content_name: `${isTrial ? "trial" : "direct-sub"}:${planFrequency}`,
      order_id: `subscription-${transactionId}`,
      country,
      platform,
    });

    await TiktokAdsEvents.trackTTEvent(TikTokStandardEvents.subscribe, properties);
  } catch (error) {
    console.error("Failed to track TikTok purchase:", error);
  }
};
