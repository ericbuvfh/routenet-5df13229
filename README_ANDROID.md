# Android wrapper for the web music app

## Overview
This project uses Capacitor to package the Vite production build from `dist/`.
Native playback is provided by the Capacitor NativeAudio plugin.

## Files added
- android/ – Android Gradle project
- android/app/src/main/java/com/example/yourapp/MainActivity.kt – Capacitor host
- android/app/src/main/java/com/example/yourapp/MusicService.kt – background playback service
- android/app/src/main/java/com/example/yourapp/NotificationHelper.kt – foreground notification
- android/app/src/main/AndroidManifest.xml – permissions and service declaration
- .github/workflows/android-release.yml – GitHub Actions release workflow

## Build locally
1. Install Node.js 22 and Java 21.
2. Run `npm ci`, `npm run build`, and `npx cap sync android`.
3. From the `android` folder run `./gradlew assembleRelease` for a local build,
  or provide the signing properties shown below.

## Signing release builds
Generate a keystore locally. Do not commit it:

```bash
keytool -genkey -v -keystore android/app/keystore.jks -storetype JKS \
  -keyalg RSA -keysize 2048 -validity 10000 -alias your-alias
```

Then build:

```bash
cd android
./gradlew assembleRelease \
  -Pandroid.injected.signing.store.file=app/keystore.jks \
  -Pandroid.injected.signing.store.password=YOUR_STORE_PASSWORD \
  -Pandroid.injected.signing.key.alias=YOUR_ALIAS \
  -Pandroid.injected.signing.key.password=YOUR_KEY_PASSWORD
```

## GitHub Actions release
Set these repository secrets:
- KEYSTORE_BASE64
- KEYSTORE_PASSWORD
- KEY_ALIAS
- KEY_PASSWORD

Create a tag like:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The workflow builds the web app, syncs Capacitor, and attaches signed APK and
AAB artifacts to the GitHub release.
