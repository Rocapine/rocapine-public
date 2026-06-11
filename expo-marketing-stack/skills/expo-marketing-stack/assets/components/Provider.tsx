import { superwallPublicApiKey } from "@/services/analytics/providers/superwall.provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SuperwallProvider } from "expo-superwall";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export const queryClient = new QueryClient();

const superwallApiKey = superwallPublicApiKey();

export function Provider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuperwallProvider
        apiKeys={{ ios: superwallApiKey }}
        options={
          __DEV__
            ? { logging: { level: "warn" }, shouldBypassAppTransactionCheck: true }
            : undefined
        }
        onConfigurationError={(error) => console.error("[Superwall] Config failed:", error)}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>{children}</GestureHandlerRootView>
      </SuperwallProvider>
    </QueryClientProvider>
  );
}
