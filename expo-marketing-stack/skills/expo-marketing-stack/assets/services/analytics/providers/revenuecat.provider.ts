import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  PURCHASES_ARE_COMPLETED_BY_TYPE,
  STOREKIT_VERSION,
} from "react-native-purchases";
import { syncSubscriptionStatus } from "../tracking-plan";
import { identify } from "./superwall.provider";

export function revenueCatApiKey(): string {
  return (process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? "").trim();
}

export const initialize = async (): Promise<void> => {
  if (Platform.OS === "web") {
    console.info("RevenueCat is not supported on web");
    return;
  }

  const apiKey = revenueCatApiKey();
  if (!apiKey) return;

  Purchases.configure({
    apiKey,
    purchasesAreCompletedBy: {
      type: PURCHASES_ARE_COMPLETED_BY_TYPE.MY_APP,
      storeKitVersion: STOREKIT_VERSION.STOREKIT_2,
    },
  });
  Purchases.addCustomerInfoUpdateListener((info) => {
    syncSubscriptionStatus(info).catch((err) =>
      console.error(new Error(`syncSubscriptionStatus error: ${err}`)),
    );
  });
  Purchases.collectDeviceIdentifiers();
  Purchases.setLogHandler((log, message) => {
    if (log !== LOG_LEVEL.ERROR) return;
    // Ignore configuration errors about missing products/offerings
    // These are expected if offerings aren't configured in the dashboard
    if (message.includes("offerings")) return;

    if (__DEV__ && message.includes("RevenueCat SDK Configuration is not valid")) return;

    console.error(message);
  });
};

export const postInitialize = async (): Promise<void> => {
  const apiKey = revenueCatApiKey();
  if (!apiKey) return;
  const userId = await Purchases.getAppUserID();
  await identify(userId);
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    await syncSubscriptionStatus(customerInfo);
  } catch (err) {
    console.error(new Error(`Initial subscription_status sync error: ${err}`));
  }
};

// RevenueCat-specific utilities
export const revenueCatUtils = {
  async getUserId(): Promise<string> {
    return await Purchases.getAppUserID();
  },

  async login(stripeCustomerId: string): Promise<void> {
    await Purchases.logIn(stripeCustomerId);
  },

  async setAttributes(attributes: Record<string, string>): Promise<void> {
    await Purchases.setAttributes(attributes);
  },

  async setAdjustId(adjustId: string): Promise<void> {
    await Purchases.setAdjustID(adjustId);
  },

  async setAppsFlyerId(appsFlyerId: string): Promise<void> {
    await Purchases.setAppsflyerID(appsFlyerId);
  },
};

// RevenueCat doesn't need these standard analytics methods
export const setProperty = async (): Promise<void> => {};
export const captureEvent = async (): Promise<void> => {};
export const trackPageView = async (): Promise<void> => {};
