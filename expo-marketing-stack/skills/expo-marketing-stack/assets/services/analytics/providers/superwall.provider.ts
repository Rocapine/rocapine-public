import { useSuperwallStore } from "expo-superwall";

const CONFIG_WAIT_MS = 10_000;
const POLL_MS = 32;

export function superwallPublicApiKey(): string {
  return (process.env.EXPO_PUBLIC_SUPERWALL_API_KEY ?? "").trim();
}

async function waitUntilSuperwallConfigured(): Promise<boolean> {
  if (!superwallPublicApiKey()) return false;

  const start = Date.now();
  while (Date.now() - start < CONFIG_WAIT_MS) {
    const { isConfigured, configurationError } = useSuperwallStore.getState();
    if (isConfigured) return true;
    if (configurationError) return false;

    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  return false;
}

export const identify = async (userId: string): Promise<void> => {
  const configured = await waitUntilSuperwallConfigured();
  if (!configured) return;
  await useSuperwallStore.getState().identify(userId);
};

export const setUserAttributes = async (attributes: Record<string, any>): Promise<void> => {
  if (!useSuperwallStore.getState().isConfigured) return;
  await useSuperwallStore.getState().setUserAttributes(attributes);
};
