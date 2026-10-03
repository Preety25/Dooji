# EAS build preparation (private beta)

Operational notes for the first EAS builds. Does not submit to Apple/Google by itself.

## Profiles (`mobile/eas.json`)

| Profile | Use |
|---------|-----|
| `preview` | Internal distribution; Android APK; EAS environment `preview`; remote `autoIncrement` |
| `production` | Store / TestFlight-shaped binary; EAS environment `production`; remote `autoIncrement` |

`cli.appVersionSource` is `remote` — do not hardcode `ios.buildNumber` / `android.versionCode` in `app.json`.

There is **no** `development` profile and **no** `expo-dev-client` in this pass.

## Client environment variables (not secrets)

Set these in the Expo dashboard / via `eas env:set` for **both** the `preview` and `production` EAS environments so builds fail-closed against the hosted API:

```text
EXPO_PUBLIC_APP_ENV=production
EXPO_PUBLIC_TRANSFORM_MODE=http
EXPO_PUBLIC_TRANSFORM_API_URL=https://dooji-api.onrender.com
```

These are **public** client configuration values (embedded in the app binary). They are not server secrets.

**Never** put `XAI_API_KEY`, `DATABASE_URL`, or other server credentials in mobile env, `eas.json`, or EAS client configuration.

Example (after `eas init`):

```bash
cd mobile
npx eas-cli@latest env:set --name EXPO_PUBLIC_APP_ENV --value production --environment preview --visibility plaintext
npx eas-cli@latest env:set --name EXPO_PUBLIC_TRANSFORM_MODE --value http --environment preview --visibility plaintext
npx eas-cli@latest env:set --name EXPO_PUBLIC_TRANSFORM_API_URL --value https://dooji-api.onrender.com --environment preview --visibility plaintext
# repeat with --environment production
```

## Cleartext / local networking (current state)

In `mobile/app.json` today:

- Android `usesCleartextTraffic: true`
- iOS `NSAppTransportSecurity.NSAllowsLocalNetworking: true`

**Local LAN development** (Expo Go / laptop API over `http://`) may need these enabled.

**Hosted production** uses HTTPS (`https://dooji-api.onrender.com`) and does not require cleartext.

**Before public store builds**, tighten/disable these flags (e.g. via a future dynamic `app.config` keyed off production env). Not changed in this EAS prep pass.

## Manual steps before the first build

1. `cd mobile`
2. `npx eas-cli@latest login`
3. `npx eas-cli@latest init` (or `build:configure`) — creates Expo project and writes `extra.eas.projectId` into app config. Do not invent a project id.
4. Set the three `EXPO_PUBLIC_*` variables for `preview` and `production` (above).
5. First Android preview (when ready): `npx eas-cli@latest build --profile preview --platform android`  
   (Not run as part of this documentation pass.)
