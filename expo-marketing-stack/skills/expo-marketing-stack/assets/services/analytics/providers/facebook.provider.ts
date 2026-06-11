import { AppEventsLogger, Settings } from "react-native-fbsdk-next";
import { AnalyticsEvent, AnalyticsPurchaseEventProperties } from "../types";

let facebookSdkInitialized = false;

export const initialize = () => {
  const appId = (process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || "").trim();
  if (!appId) return;
  Settings.initializeSDK();
  facebookSdkInitialized = true;
};

const StandardEvents = {
  onboarding_completed: AppEventsLogger.AppEvents.CompletedTutorial,
  user_converted: AppEventsLogger.AppEvents.InitiatedCheckout, // We used to track as purchase, now we use the TrackPurchase method instead
  trial_started: AppEventsLogger.AppEvents.StartTrial,
  direct_subscription: AppEventsLogger.AppEvents.Subscribe,
};

export const trackEvent = (event: AnalyticsEvent) => {
  if (!facebookSdkInitialized) return;
  AppEventsLogger.logEvent(event.name, event.properties);
  if (event.name in StandardEvents) {
    const fbEventName = StandardEvents[event.name as keyof typeof StandardEvents];
    AppEventsLogger.logEvent(fbEventName, event.properties);
  }
};

export const trackPurchase = ({
  ltv,
  currency,
  transactionId,
  isTrial,
  planFrequency,
  country,
  platform,
  sku,
}: AnalyticsPurchaseEventProperties) => {
  if (!facebookSdkInitialized) return;
  AppEventsLogger.logPurchase(ltv, currency, {
    event_id: `subscription-${transactionId}`,
    phase: isTrial ? "trial" : "direct-sub",
    plan: planFrequency,
    country,
    platform,
    sku,
  });
};
