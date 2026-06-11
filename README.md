# rocapine-public

[Rocapine](https://rocapi.ne)'s public [Claude Code](https://docs.claude.com/en/docs/claude-code)
plugin marketplace — tools we build for our own Expo / React Native apps and share openly.

## Add the marketplace

```
/plugin marketplace add Rocapine/rocapine-public
```

Then install any plugin below.

## Plugins

| Plugin                                           | What it does                                                                                                                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`expo-marketing-stack`](./expo-marketing-stack) | Installs and wires an opinionated Expo analytics/marketing stack — Superwall, RevenueCat, Amplitude, Adjust, Facebook, TikTok — plus a shared tracking plan and root-layout wiring. |

```
/plugin install expo-marketing-stack@rocapine-public
```

## Layout

```
.claude-plugin/marketplace.json   # marketplace manifest (lists the plugins below)
expo-marketing-stack/             # a plugin: .claude-plugin/plugin.json + skills/
```

Each plugin folder is self-contained and referenced from `marketplace.json` by a local path.
To add a plugin: drop its folder at the repo root (folder name must equal the plugin's `name`),
add an entry to `marketplace.json`, and bump `metadata.version`.

## License

[MIT](./LICENSE).
