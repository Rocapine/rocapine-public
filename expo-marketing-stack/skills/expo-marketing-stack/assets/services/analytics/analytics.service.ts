import type { StoreTransaction, TransactionProductIdentifier } from "expo-superwall";
import { Platform } from "react-native";
import * as adjust from "./providers/adjust.provider";
import * as amplitude from "./providers/amplitude.provider";
import * as facebook from "./providers/facebook.provider";
import * as revenuecat from "./providers/revenuecat.provider";
import * as superwall from "./providers/superwall.provider";
import * as tiktok from "./providers/tiktok.provider";
import { trackingTransparency } from "./providers/trackingTransparency";
import { setAppNameUserProperty } from "./tracking-plan";
import type { AnalyticsEvent, AnalyticsProperty } from "./types";

export const initialize = async () => {
  await trackingTransparency();

  await Promise.all([
    amplitude.initialize(),
    revenuecat.initialize(),
    adjust.initialize(),
    facebook.initialize(),
    tiktok.initialize(),
  ]);

  await Promise.all([amplitude.postInitialize(), revenuecat.postInitialize()]);

  await setAppNameUserProperty();
};

export const identify = async (email: string) => {
  await amplitude.identify(email);
  await tiktok.identify(email);
};

export const setProperty = async (property: AnalyticsProperty): Promise<void> => {
  await amplitude.setProperty(property);
  await superwall.setUserAttributes({ [property.key]: property.value });
};

export const captureEvent = async (event: AnalyticsEvent): Promise<void> => {
  await amplitude.captureEvent(event);
  await facebook.trackEvent(event);
  await adjust.trackEvent(event);
  await tiktok.trackEvent(event);
};

export const trackPurchase = async (
  product: TransactionProductIdentifier,
  transaction: StoreTransaction,
) => {
  const properties = {
    ltv: product.hasFreeTrial ? product.price * 0.2 : product.price,
    currency: product.currencyCode!,
    transactionId: transaction.originalTransactionIdentifier ?? "",
    isTrial: product.hasFreeTrial,
    planFrequency: product.period,
    country: product.regionCode!,
    platform: Platform.OS,
    sku: product.productIdentifier,
  };

  try {
    adjust.trackPlatformPurchase({
      price: product.price,
      currency: product.currencyCode!,
      transactionId: transaction.originalTransactionIdentifier || undefined,
      sku: product.productIdentifier,
      orderId: transaction.storeTransactionId || undefined,
      signature: transaction.signature ?? undefined,
      purchaseToken: transaction.purchaseToken ?? undefined,
    });
  } catch (err) {
    console.error(err);
  }

  try {
    facebook.trackPurchase(properties);
  } catch (err) {
    console.error(err);
  }

  try {
    tiktok.trackPurchase(properties);
  } catch (err) {
    console.error(err);
  }
};
