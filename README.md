# After Dark

An Android-first anonymous messaging product and a responsive Next.js web experience, inspired by the approved [visual concepts](design/AFTER_DARK_DESIGN_AND_PRODUCT_PLAN.md).

## Current status

This repository contains an **early, text-only vertical slice**, not the finished product. It has a real Supabase-backed account flow, profile creation, private inbox, public text composition, message management, text replies, reporting, profile editing, web password-reset screens, and web and Android share-card generation (device validation still required). Web and mobile use the same backend. Inbox inserts subscribe to Supabase Realtime with a manual-refresh fallback. There are no mock messages or fake authentication.

The new Supabase project is `bkhldfjqxarnqmcidwog` (`eu-west-2`). Migrations and the `submit-message` Edge Function have been deployed to that project. Email signup is configured without mandatory confirmation. This makes it easier to register with an address the user does not control; account recovery, deliverability, and signup-abuse protection must be addressed before release. The older Flix project remains paused and the unrelated project was not modified.

**Not release-ready:** image and voice uploads, verified native share-card export, push notifications, an administrative moderation interface, a production-grade spam defense, verified end-to-end account recovery, light theme, analytics, accessibility audit, and many other features in the master specification are not yet implemented. The current IP-based submission throttle needs verified trusted-proxy handling, a scheduled expiry cleanup, anti-automation measures and a security review before public launch. No device-to-server end-to-end test, APK installation/device test, push test, hosted web deployment, or password recovery test has been completed in this sandbox. A test-signed APK was built by GitHub Actions.

## Local setup

Requirements: Node.js 22 and npm. Android development also requires Java 17 and the Android SDK. A real Android device or emulator is needed for device testing.

```sh
npm ci
cp .env.example apps/web/.env.local
cp .env.example apps/mobile/.env.local
npm run web
# In another terminal:
npm run start -w @after-dark/mobile
```

The Supabase URL and **publishable** client key in `.env.example` are public application configuration, not service credentials. Set `EXPO_PUBLIC_WEB_URL` to your deployed site's HTTPS origin, with no trailing slash, before building the app. Until then the mobile share action explains that a web address is required. Web links use the current site's origin. Never use the service-role key in either client or commit private credentials.

## Supabase

The migrations in `supabase/migrations` match the deployed migration versions. `profiles` and `messages` have owner-scoped row-level security. Anonymous clients cannot directly read or insert messages. A narrow public profile lookup exposes only public fields; the Edge Function validates submissions and calls a service-role-only delivery function. The function uses an HMAC of the forwarded IP for a per-sender/per-recipient throttle and a per-recipient ceiling; raw IP addresses are not stored in the database. Expired throttle records are deleted during submissions, **not by a scheduled job**, so a retention job is still required. Do not rely on this implementation as sufficient production anti-abuse protection.

The Edge Function requires the server-only `SUBMISSION_HASH_SECRET`, provisioned in Supabase. It is not stored here. To deploy a new instance, provision that secret with a secure random value through Supabase and deploy the function. Migrations should be applied with the Supabase CLI, with the project linked explicitly to the intended project. Never reset or modify unrelated projects.

Message reports can be created only for the owner’s own messages; a database trigger captures the reported text for server-side review. An administrative review interface and abuse-blocking are not yet implemented.

The database-level `supabase/tests/security.sql` runs inside a rolled-back transaction and covers direct anonymous privileges, idempotent text delivery and cross-account inbox isolation. Run only against a disposable test database as a sufficiently privileged role:

```sh
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security.sql
```

A production security review must also test edge network behavior, RLS update/delete boundaries, abuse controls, storage and all other spec scenarios. The hosted project was checked via transactional SQL: anonymous direct inbox access denied, owner isolation, idempotent delivery, and the per-recipient 8-per-hour throttle. These are not substitutes for a real browser/device end-to-end test.

## Web deployment

The Next.js app is in `apps/web`. `npm run build:web` builds it. It requires a host that supports Next.js server routes; static GitHub Pages alone cannot serve the dynamic username routes. To deploy with Vercel, create/link a Vercel project with **Root Directory** `apps/web`, configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from `.env.example` in its production environment, then deploy. Configure the resulting HTTPS domain and recovery redirect URLs in Supabase Auth before implementing/testing recovery.

The connected Vercel account did not contain an After Dark project. The connector cannot perform the initial project deployment because it does not expose required first-deployment settings. Create and initially deploy an After Dark project in Vercel with the repository and `apps/web` root directory, then it can be managed through the connector. An optional manually triggered `.github/workflows/deploy-web.yml` uses a linked Vercel project. Set repository secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` through GitHub's settings, not in the repository or chat. The workflow has not been run; no hosted web URL exists yet. The mobile `AFTER_DARK_WEB_URL` must point to the actual deployed domain.

## Android APK through GitHub Actions

`.github/workflows/android-apk.yml` generates the native Android project and builds a standalone **test-signed release APK**, uploaded as `after-dark-test-apk`. It runs on demand or when mobile files change. In GitHub repository **Settings → Secrets and variables → Actions → Variables**, set:

- `AFTER_DARK_SUPABASE_URL`: `https://bkhldfjqxarnqmcidwog.supabase.co`
- `AFTER_DARK_SUPABASE_PUBLISHABLE_KEY`: the public key from `.env.example`
- `AFTER_DARK_WEB_URL`: the actual deployed HTTPS web origin

The first two values default to the After Dark public project configuration if not set. Without a web URL, an APK can still build, but its share-link and password-recovery actions will ask for the deployed web address. Then run **Build Android APK** in the Actions tab and download its artifact. The workflow succeeded on the working branch; its test APK is available in the [GitHub Actions run](https://github.com/halluyapp/Anonymous-/actions/runs/43876578757). The generated Android project uses the standard debug keystore for this test-signed APK; it is for testing, not Play Store distribution; a production release requires a securely managed release signing key, release configuration and device validation. No signing secrets are included here.

## Notifications

Push notifications are **not implemented** yet. An Expo push token is generated per device after permission is granted. Android push additionally requires Firebase Cloud Messaging configuration and secure FCM v1 credentials. An Expo access token is required only if enhanced push security is enabled; it belongs on a trusted server, never in the app. Production delivery also needs secure device registration, notification preferences, logout cleanup, receipt handling and actual device tests.

## Verification performed

- `npm run typecheck` passed for web and mobile.
- `npm test` passed share-card text-wrapping tests, including paragraphs, emoji and long text.
- `npm run build:web` passed.
- `npx expo export --platform android` successfully produced an Android JavaScript bundle.
- `npx expo prebuild --platform android --no-install` generated an Android project. GitHub Actions assembled and uploaded a test-signed APK; it has not been installed or tested on a device.
- HTTP smoke checks returned 200 for the four local web routes.
- Supabase SQL tests verified RLS enabled, anonymous privilege restrictions, a transactional delivery/retry without duplicates, cross-account read isolation the sender and recipient message throttles, report insertion with a server-side text snapshot and denial of cross-account reporting. Test data was rolled back.
- The sandbox cannot directly connect to the hosted Supabase endpoint; real sign-up, Edge Function HTTP invocation, Android interactions, hosted deployment and full end-to-end delivery remain unverified.

The current test web deployment is https://after-dark-one-xi.vercel.app. The Android build defaults to this address; set the `AFTER_DARK_WEB_URL` GitHub Actions variable to override it if the web domain changes. Email confirmation and custom SMTP must be configured before a public production launch.

## Photo and voice messages (test release)
The public link accepts one re-encoded photo (JPEG/PNG/WebP) or a browser-recorded voice note (up to 45 seconds) per message. Attachments are capped at 2 MiB, stored in a private bucket, and accessed through short-lived URLs by the recipient. Photos and voices can themselves identify the sender, even though the sender's account name is not shared. Do not upload sensitive material during testing.

The web Share Studio can create a WebM video that includes the original voice audio, then save or share it when the browser supports file sharing. Rendering happens in real time; WebM is not accepted by every social app. On Android, voice playback is native, but voice-video creation currently opens the web studio and requires sign-in there; native MP4 export has not been implemented or device-tested. The card editor supports image attachments. Push notifications are not implemented.

This is not production-ready media infrastructure: add automated orphan-object cleanup (including account deletion), enforce server-side transcoding/metadata removal and media validation, implement media retention/moderation for reports, verify trusted proxy IP handling, and test the whole flow across real devices and browsers before launch. Image re-encoding is done by the provided web client, not a server-side guarantee. Email verification is intentionally not required for the test build; auto-confirmed addresses can be impersonated, and password recovery cannot be trusted without verified ownership and configured mail delivery.

### Android media and updates (test build)

The Android app includes an in-app anonymous composer (Home → **Send someone a message**) for text, a re-encoded JPEG, or a microphone recording (45 seconds maximum). You need the recipient's username. The app sends through an anonymous client rather than the signed-in owner's session; the voice or image itself can still identify the sender. Inbox attachments use short-lived signed URLs. The native Share Studio can render an MP4 containing the card and voice track on Android using the device's codecs; availability and correctness vary by device and input format, and this still requires device testing. Exported files and attachments are placed in app cache and best-effort removed; OS or interrupted-process cache cleanup is not guaranteed.

Profile → **App updates** checks signed compatible JS updates if configured and checks for an official Android release. On startup, `expo-updates` can download a compatible JS update for a subsequent launch, and the app checks for a new Android release. A new native binary always needs Android's installation approval; it cannot be silently replaced by a JS update. This repository's current APK workflow builds temporary **test-signed** artifacts, not an upgrade channel. Keys can differ between builds: upgrading a previous test APK may fail and require uninstalling it (which removes local app data). Neither automatic update mechanism is operational without the release infrastructure below.

**To enable signed OTA updates:** operate an Expo Updates protocol-compatible publishing service, keep its signing private key outside the repository, and build with `AFTER_DARK_UPDATES_URL` (HTTPS) and `AFTER_DARK_UPDATES_CERTIFICATE` (path to the public PEM certificate). Both must be present; otherwise OTA is disabled. Configure the service to use key ID `main` and `rsa-v1_5-sha256`, and publish signed updates using the exact runtime fingerprint and platform for each compatible binary. Changing native dependencies/config changes the fingerprint and requires a new APK. The current GitHub workflow sets neither variable, so its test APK has OTA disabled. Do not distribute an unsigned update feed or commit the private key.

**For native releases:** set up secure persistent Android signing (for example a protected CI keystore or Play App Signing), increment `android.versionCode` for every published binary, and use a trusted distribution mechanism. The optional GitHub release check expects a *public, non-prerelease* GitHub release tagged `android-v<versionCode>` with an uploaded asset named `after-dark.apk`. The button opens that official release page rather than silently installing. The current workflow does not sign with a persistent production key or publish these releases. Android verifies the installed app's signing identity; a release signed with a different key cannot upgrade it. Test release checks, signature continuity, download, user approval and installation on real devices before production.
