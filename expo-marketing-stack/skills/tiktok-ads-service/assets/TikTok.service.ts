// TikTok.service.ts
//
// Reference implementation of a standalone TikTok Ads service for an Expo app, built on
// expo-tiktok-ads-events. Copy it into the host app, then adapt ONLY:
//   - the logger import below → the host app's own logger (or `console`),
//   - STANDARD_EVENT_MAP keys → the host analytics facade's internal event names, if it
//     forwards generic events through `trackEvent`.
// Keep the init guard, the init timeout and the per-platform env vars as they are.

import TiktokAdsEvents, {
  TikTokIdentify,
  TikTokLaunchApp,
  TikTokStandardEvents,
  TikTokStandardEventValue,
  TikTokWaitForConfig,
} from "expo-tiktok-ads-events";
import { Platform } from "react-native";

import { logger } from "@/lib/logger";

type EventProperty = { key: string; value: string | number };

// Map our internal event names to TikTok standard events.
// Events not in this map are no-ops for TikTok — custom events require a unique
// per-call event ID and aren't useful for ads attribution anyway.
const STANDARD_EVENT_MAP: Record<string, TikTokStandardEventValue> = {
  complete_onboarding: TikTokStandardEvents.complete_tutorial,
  start_trial: TikTokStandardEvents.start_trial,
  purchase: TikTokStandardEvents.subscribe,
};

function toEventProperties(properties: Record<string, unknown>): EventProperty[] {
  return Object.entries(properties)
    .filter(([, value]) => value != null && value !== "")
    .map(([key, value]) => ({
      key,
      value: typeof value === "number" ? value : String(value),
    }));
}

class TikTokService {
  private isInitialized = false;
  private isConfigReady = false;
  private isFirstLaunch = true;
  // Cache the in-flight init promise — TikTok's native singleton deadlocks if
  // initializeSdk is called concurrently, so concurrent callers share one.
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.initializeOnce().finally(() => {
      this.initPromise = null;
    });
    return this.initPromise;
  }

  private async initializeOnce(): Promise<void> {
    if (!TiktokAdsEvents || typeof TiktokAdsEvents.initializeSdk !== "function") {
      logger.warn(
        "[TikTok] Native module unavailable — rebuild the dev client to include expo-tiktok-ads-events",
      );
      return;
    }

    // iOS and Android use separate TikTok app records, so the access token and
    // TT app ID also differ per platform — not just the bundle/package ID.
    const accessToken = Platform.select({
      ios: process.env.EXPO_PUBLIC_TIKTOK_IOS_ACCESS_TOKEN,
      android: process.env.EXPO_PUBLIC_TIKTOK_ANDROID_ACCESS_TOKEN,
    });
    const ttAppId = Platform.select({
      ios: process.env.EXPO_PUBLIC_TIKTOK_IOS_TT_APP_ID,
      android: process.env.EXPO_PUBLIC_TIKTOK_ANDROID_TT_APP_ID,
    });
    const appId = Platform.select({
      ios: process.env.EXPO_PUBLIC_TIKTOK_IOS_APP_ID,
      android: process.env.EXPO_PUBLIC_TIKTOK_ANDROID_APP_ID,
    });

    if (!accessToken || !ttAppId || !appId) {
      logger.warn("[TikTok] Missing env vars — skipping initialization");
      return;
    }

    logger.log("[TikTok] Initializing SDK…");
    // TikTok Business iOS SDK 1.6.x sometimes never invokes its
    // initializeSdk completion handler, leaving `await` pending forever. We
    // race against a timeout and proceed regardless — the native SDK queues
    // events internally and flushes them once its config eventually arrives.
    const INIT_TIMEOUT_MS = 5_000;
    let timedOut = false;
    try {
      await Promise.race([
        TiktokAdsEvents.initializeSdk(accessToken, appId, ttAppId, __DEV__),
        new Promise<void>((resolve) =>
          setTimeout(() => {
            timedOut = true;
            resolve();
          }, INIT_TIMEOUT_MS),
        ),
      ]);
    } catch (error) {
      logger.error("[TikTok] Error initializing:", error);
      return;
    }

    this.isInitialized = true;
    if (timedOut) {
      logger.warn(
        `[TikTok] Initialized (native completion handler did not fire within ${INIT_TIMEOUT_MS}ms — events will queue and flush once config arrives)`,
      );
    } else {
      logger.log("[TikTok] Initialized");
    }

    // Wait for remote config in the background; events tracked before this
    // resolves are buffered by the native SDK.
    TikTokWaitForConfig(10_000)
      .then((ready) => {
        this.isConfigReady = ready;
        if (ready) logger.log("[TikTok] Config ready");
        else logger.warn("[TikTok] Config fetch timed out");
      })
      .catch((error) => logger.error("[TikTok] Config wait failed:", error));
  }

  private async trackStandard(
    event: TikTokStandardEventValue,
    properties: Record<string, unknown> = {},
  ) {
    if (!this.isInitialized) return;

    try {
      const eventProperties = toEventProperties(properties);
      await TiktokAdsEvents.trackTTEvent(
        event,
        eventProperties.length > 0 ? eventProperties : undefined,
      );
    } catch (error) {
      logger.error("[TikTok] Error tracking event:", event, error);
    }
  }

  async trackEvent(eventName: string, parameters: Record<string, unknown> = {}) {
    const standardEvent = STANDARD_EVENT_MAP[eventName];
    if (!standardEvent) return;
    await this.trackStandard(standardEvent, parameters);
  }

  async trackAppOpen() {
    if (!this.isInitialized || !this.isFirstLaunch) return;
    // launch_app is meant to fire once per session — TikTok dedupes on its end
    // for install attribution. We only fire on the first open per process.
    try {
      await TikTokLaunchApp();
      this.isFirstLaunch = false;
      logger.log("[TikTok] Tracked launch_app");
    } catch (error) {
      logger.error("[TikTok] Error tracking launch_app:", error);
    }
  }

  async trackAppLaunch() {
    await this.initialize();
    await this.trackAppOpen();
  }

  async trackCompleteOnboarding() {
    await this.trackStandard(TikTokStandardEvents.complete_tutorial);
  }

  async trackStartTrial(price: string, currency: string, productId?: string) {
    await this.trackStandard(TikTokStandardEvents.start_trial, {
      currency,
      value: parseFloat(price),
      content_id: productId,
      content_type: "subscription",
    });
  }

  async trackPurchase(price: string, currency: string, transactionId?: string, productId?: string) {
    await this.trackStandard(TikTokStandardEvents.subscribe, {
      currency,
      value: parseFloat(price),
      content_id: productId,
      content_type: "subscription",
      order_id: transactionId,
    });
  }

  async setUserID(userID: string) {
    if (!this.isInitialized) return;
    try {
      await TikTokIdentify({ externalId: userID });
    } catch (error) {
      logger.error("[TikTok] Error identifying user:", error);
    }
  }

  async setUserData(userData: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
  }) {
    if (!this.isInitialized) return;

    try {
      const externalId = userData.email || userData.phone;
      if (!externalId) return;

      const name = [userData.firstName, userData.lastName].filter(Boolean).join(" ");
      await TikTokIdentify({
        externalId,
        email: userData.email,
        phoneNumber: userData.phone,
        externalUserName: name || undefined,
      });
    } catch (error) {
      logger.error("[TikTok] Error setting user data:", error);
    }
  }

  // Exposed for debugging / cross-platform attribution
  async getAnonymousId(): Promise<string | null> {
    if (!this.isInitialized) return null;
    try {
      return (await TiktokAdsEvents.getAnonymousID()) ?? null;
    } catch (error) {
      logger.error("[TikTok] Error getting anonymous ID:", error);
      return null;
    }
  }

  isReady(): boolean {
    return this.isInitialized && this.isConfigReady;
  }
}

export default new TikTokService();
