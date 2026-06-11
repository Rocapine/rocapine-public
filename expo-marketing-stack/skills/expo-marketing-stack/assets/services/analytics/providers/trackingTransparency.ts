import { requestTrackingPermissionsAsync } from "expo-tracking-transparency";

export const trackingTransparency = async () => {
  const { status } = await requestTrackingPermissionsAsync();
  if (status === "granted") {
    console.info("Tracking permission granted");
  }
  return status;
};
