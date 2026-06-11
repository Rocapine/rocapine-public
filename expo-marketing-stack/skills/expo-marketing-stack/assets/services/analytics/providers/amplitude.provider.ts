import * as Amplitude from "@amplitude/analytics-react-native";
import Purchases from "react-native-purchases";
import type { AnalyticsEvent, AnalyticsProperty } from "../types";
import { revenueCatApiKey } from "./revenuecat.provider";

export const initialize = async (): Promise<void> => {
  try {
    await Amplitude.init(process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY || "", undefined, {
      serverZone: "US",
      disableCookies: true,
    });
  } catch (error) {
    console.error(new Error(`Amplitude initialization error: ${error}`));
  }
};

export const postInitialize = async (): Promise<void> => {
  if (!revenueCatApiKey()) return;
  try {
    const amplitudeUserId = await Amplitude.getUserId();
    const amplitudeDeviceId = await Amplitude.getDeviceId();
    Purchases.setAttributes({
      $amplitudeUserId: amplitudeUserId || null,
      $amplitudeDeviceId: amplitudeDeviceId || null,
    });
  } catch (error) {
    console.error(new Error(`Amplitude post initialization error: ${error}`));
  }
};

export const identify = async (email: string): Promise<void> => {
  if (__DEV__) return;

  try {
    if (email) {
      const id = new Amplitude.Identify();
      id.set("email", email);
      await Amplitude.identify(id);
    }
  } catch (error) {
    console.error(new Error(`Amplitude identify error: ${error}`));
  }
};

export const setProperty = async (property: AnalyticsProperty): Promise<void> => {
  if (__DEV__) return;

  try {
    const id = new Amplitude.Identify();
    id.set(property.key, property.value);
    await Amplitude.identify(id);
  } catch (error) {
    console.error(new Error(`Amplitude setProperty error: ${error}`));
  }
};

export const captureEvent = async (event: AnalyticsEvent): Promise<void> => {
  if (__DEV__) return;

  try {
    await Amplitude.track(event.name, event.properties);
  } catch (error) {
    console.error(new Error(`Amplitude capture error: ${error}`));
  }
};
