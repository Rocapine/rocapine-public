# expo-marketing-stack

A Claude Code plugin that installs and wires an opinionated analytics/marketing stack into any
Expo app: **Superwall** (paywall), **RevenueCat** (subscriptions), **Amplitude** (events),
**Adjust** (attribution), **Facebook** and **TikTok** (ad conversions), plus a shared tracking
plan and the root-layout wiring that ties them together.

## Install

```
/plugin marketplace add Rocapine/rocapine-public
/plugin install expo-marketing-stack@rocapine-public
```

## Use

In a target Expo project, ask Claude to _"add the marketing stack"_ (or invoke
`/expo-marketing-stack`). The skill:

- installs the SDK dependencies with `expo install`,
- copies a working reference implementation (bundled under `skills/expo-marketing-stack/assets/`)
  into the project — orchestrator, tracking plan, six providers, hooks, stores, and the provider
  composition,
- wires the root layout (analytics init, page-view tracking, paywall/conversion listener),
- adds the config plugins (tracking transparency, conditional Facebook SDK) and the `EXPO_PUBLIC_*`
  env scaffolding,
- documents the tracking plan in the project's `CLAUDE.md`.

No API keys are required at install time — every provider no-ops until its `EXPO_PUBLIC_*` key is
filled in, so the app builds and runs immediately. A new dev-client build is required afterwards
(native SDKs are added).

## What you get

App code calls **tracking-plan helpers** (`trackOnboardingStarted`, `trackPaywallViewed`,
`trackCoreFeatureCompleted`, …); those fan out to the providers through a single orchestrator, so
event names and properties stay consistent. Subscription state (`isPremium`,
`subscription_status`) is kept reactive by the RevenueCat and Superwall listeners. See
`skills/expo-marketing-stack/SKILL.md` and `references/wiring.md` for the full architecture and
the exact wiring blocks.

## Skills

| Skill                  | Use it when                                                                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `expo-marketing-stack` | Installing the whole stack above into an Expo app.                                                                                                               |
| `tiktok-ads-service`   | The app already has its own analytics layer and only needs TikTok Ads: the `expo-tiktok-ads-events` SDK plus `complete_tutorial`, `start_trial` and `subscribe`. |

For TikTok only, ask Claude to _"set up TikTok ads events"_ (or invoke `/tiktok-ads-service`). It
adds a standalone `TikTokService` (bundled under `skills/tiktok-ads-service/assets/`), six
per-platform `EXPO_PUBLIC_TIKTOK_*` env vars, parallel init next to the app's other analytics
services, and the three funnel calls — then walks you through checking them in TikTok Events
Manager.

## Maintenance

The files under `skills/expo-marketing-stack/assets/` are a snapshot of a production Expo
analytics implementation. When the stack evolves, re-sync the snapshot and bump the version in
both `.claude-plugin/plugin.json` and the marketplace entry.

## License

MIT — see [LICENSE](../LICENSE).
