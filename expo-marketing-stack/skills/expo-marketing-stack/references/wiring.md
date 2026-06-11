# Wiring reference

Exact blocks to add to the target project. Adapt names/paths, not structure.

## Known-good dependency versions (Expo SDK 55)

Prefer `npx expo install`; fall back to these if you need to pin manually:

| Package                                     | Version    |
| ------------------------------------------- | ---------- |
| `@amplitude/analytics-react-native`         | `^1.5.56`  |
| `react-native-adjust`                       | `^5.6.0`   |
| `react-native-fbsdk-next`                   | `^13.4.3`  |
| `react-native-purchases`                    | `^9.15.2`  |
| `expo-superwall`                            | `^1.1.4`   |
| `expo-tiktok-ads-events`                    | `^0.1.6`   |
| `expo-tracking-transparency`                | `~55.0.14` |
| `expo-constants`                            | `~55.0.9`  |
| `@react-native-async-storage/async-storage` | `2.2.0`    |
| `zustand`                                   | `^5.0.14`  |
| `@tanstack/react-query`                     | `^5.101.0` |

## app.config.ts

iOS SKAN endpoint (inside `ios.infoPlist`) — **optional**: only set this if you run your own
SKAdNetwork postback aggregation endpoint and want a copy of postbacks sent there. Replace the
placeholder with your endpoint, or omit the whole key to let postbacks flow only to the ad
networks:

```ts
ios: {
  // ...
  infoPlist: {
    // Optional: your own SKAN postback aggregation endpoint
    NSAdvertisingAttributionReportEndpoint: "https://<your-skan-endpoint>",
  },
},
```

Plugins (inside `plugins: [...]`):

```ts
[
  "expo-tracking-transparency",
  {
    userTrackingPermission:
      "This identifier will be used to understand the effectiveness of our marketing campaigns and improve our app experience.",
  },
],
// Facebook plugin MUST stay conditional: with an empty appID the native build fails.
...(process.env.EXPO_PUBLIC_FACEBOOK_APP_ID
  ? [
      [
        "react-native-fbsdk-next",
        {
          appID: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID,
          clientToken: process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN || "",
          displayName: APP_NAME,
          scheme: `fb${process.env.EXPO_PUBLIC_FACEBOOK_APP_ID}`,
          advertiserIDCollectionEnabled: true,
          autoLogAppEventsEnabled: true,
          isAutoInitEnabled: true,
          iosUserTrackingPermission:
            "This identifier will be used to understand the effectiveness of our marketing campaigns and improve our app experience.",
        },
      ] as [string, Record<string, unknown>],
    ]
  : []),
```

If the target uses static `app.json`, convert it to `app.config.ts`
(`import "dotenv/config"` at the top, spread the existing config) so the conditional works.
`expo-tiktok-ads-events`, `react-native-adjust`, `react-native-purchases`, and `expo-superwall`
need no config-plugin entry — autolinking handles them.

## .env.example additions

```bash
# Analytics / marketing stack
EXPO_PUBLIC_SUPERWALL_API_KEY=""
EXPO_PUBLIC_REVENUECAT_API_KEY=""
EXPO_PUBLIC_AMPLITUDE_API_KEY=""
EXPO_PUBLIC_FACEBOOK_APP_ID=""
EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN=""
EXPO_PUBLIC_ADJUST_APP_TOKEN=""
EXPO_PUBLIC_ADJUST_TOKEN_ONBOARDING_COMPLETED=""
EXPO_PUBLIC_ADJUST_TOKEN_APP_OPENED=""
EXPO_PUBLIC_ADJUST_TOKEN_USER_CONVERTED=""
EXPO_PUBLIC_ADJUST_TOKEN_TRIAL_STARTED=""
EXPO_PUBLIC_ADJUST_TOKEN_DIRECT_SUBSCRIPTION=""
EXPO_PUBLIC_TIKTOK_TT_APP_ID=""
EXPO_PUBLIC_TIKTOK_IOS_APP_ID=""
EXPO_PUBLIC_TIKTOK_ANDROID_APP_ID=""
EXPO_PUBLIC_TIKTOK_ACCESS_TOKEN=""
```

Every provider checks its own key and no-ops when empty, so the app runs with all values blank.
TikTok: `EXPO_PUBLIC_TIKTOK_IOS_APP_ID` is the numeric App Store id,
`EXPO_PUBLIC_TIKTOK_TT_APP_ID` is the TikTok Events app id, and the access token comes from
TikTok Events Manager.

## Root layout (Expo Router)

```tsx
import { Provider } from "@/components/Provider";
import { useSuperwallAnalytics } from "@/hooks/useSuperwallAnalytics";
import { initialize } from "@/services/analytics/analytics.service";
import { trackPageView } from "@/services/analytics/tracking-plan";
import { Stack, usePathname } from "expo-router";
import { useEffect } from "react";

// Module-level fire-and-forget: must not block first render, and must run once.
const initializeAnalytics = async () => {
  try {
    await initialize();
  } catch (error) {
    console.error("Failed to initialize analytics:", error);
  }
};
initializeAnalytics();

export default function RootLayout() {
  return (
    <Provider>
      <InnerRootLayout />
    </Provider>
  );
}

function InnerRootLayout() {
  const pathname = usePathname();

  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);

  useSuperwallAnalytics(); // mount exactly once, under <Provider>

  return <Stack screenOptions={{ headerShown: false }} />;
}
```

Merge into the existing layout — keep the target app's existing screens, guards, fonts, etc.
The three things that must end up true: `initialize()` runs once at module load,
`useSuperwallAnalytics()` is mounted once under `Provider`, and route changes call
`trackPageView`.

With React Navigation instead of Expo Router, call `trackPageView(routeName)` from
`<NavigationContainer onStateChange={...}>` using the current route name.

## Provider composition

`components/Provider.tsx` (bundled) composes:

```
QueryClientProvider → SuperwallProvider (EXPO_PUBLIC_SUPERWALL_API_KEY) → GestureHandlerRootView
```

If the app already has a provider tree, insert `SuperwallProvider` (with the same dev options as
the bundled file) into it instead of nesting two trees. `usePaywall` and
`useSuperwallAnalytics` must live below `SuperwallProvider`.

## Showing the paywall

```tsx
const { showPaywall, isReady } = usePaywall({
  onDismiss: () => router.replace("/home"),
});
// ...
await showPaywall("campaign_trigger"); // Superwall placement name
```

Conversion events (`paywall_viewed`, `user_converted`, `trial_started`, `direct_subscription`)
are auto-wired by `useSuperwallAnalytics` — no manual tracking around `showPaywall`.
