# Packaging roadmap

Feel-go-Rythm uses one TypeScript/Babylon.js frontend for every target.

## Current targets

### Web

Workflow: `.github/workflows/ci-web.yml`

The web CI currently:
1. installs dependencies,
2. runs automated tests,
3. builds the Vite production bundle,
4. uploads `modern/dist` as the `feel-go-rythm-web` artifact.

### Windows

Workflow: `.github/workflows/build-windows.yml`

The Windows workflow uses Tauri to build native Windows bundles and uploads MSI/NSIS output as the `feel-go-rythm-windows` artifact.

### Android

Workflow: `.github/workflows/mobile-scaffold.yml`

On every push to `app-packaging`, the Android job:
1. configures Node, Rust, Java, Android SDK and NDK,
2. runs the automated test suite,
3. initializes the generated Tauri Android project,
4. builds a debug APK,
5. uploads APK files as `feel-go-rythm-android-debug`,
6. uploads the generated Android Studio project separately.

The debug APK does not require Google Play signing and is intended for direct device testing.

Store-ready release builds remain available through:
```bash
npm run android:build:apk
npm run android:build:aab
```

The AAB is the preferred Google Play package. Production distribution requires signing credentials.

### iOS

The same mobile workflow includes a macOS job that:
1. configures Node, Rust, Xcode tooling and CocoaPods,
2. runs tests,
3. initializes the generated Tauri iOS project,
4. builds an Apple Silicon iOS Simulator app,
5. uploads the simulator build and generated Xcode project.

The simulator target is deliberately unsigned and intended to prove the iOS build before Apple signing is configured.

A signed device/App Store build will later use:
```bash
npm run ios:build
```

Signed iOS distribution requires an Apple Developer team, certificate/provisioning configuration, and App Store Connect setup.

## Local packaging commands

From the `modern` directory:

```bash
npm install
npm test
npm run build

npm run desktop:build
npm run android:init
npm run android:build:debug-apk
npm run ios:init
npm run ios:build:sim
```

Android commands require the Android SDK/NDK. iOS commands require macOS and Xcode.

## Branch strategy

`master` remains the historical 2014 version.

`modern-rewrite` remains the primary application-development branch.

`app-packaging` is the temporary packaging/CI branch. Once web, Windows, Android and iOS builds are stable, merge the packaging infrastructure back into `modern-rewrite` so all targets continue from one codebase.
