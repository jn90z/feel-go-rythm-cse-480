# Packaging roadmap

Feel-go-Rythm uses one TypeScript/Babylon.js frontend for every target.

## Current targets

### Web

GitHub Actions workflow: `.github/workflows/ci-web.yml`

This workflow:

1. installs dependencies,
2. runs automated tests,
3. builds the Vite production bundle,
4. uploads `dist/` as a downloadable workflow artifact.

### Windows

GitHub Actions workflow: `.github/workflows/build-windows.yml`

This workflow builds the Tauri desktop application on a Windows runner and uploads generated MSI/NSIS bundles as workflow artifacts.

### Android

The Tauri configuration is mobile-ready and includes Android SDK 24 as the minimum supported version.

The current mobile workflow validates Android project generation and uploads the generated Android Studio project. Once the generated project is committed and signing is configured, the next workflow step will build APK and AAB artifacts with:

```bash
npm run android:build:apk
npm run android:build:aab
```

Publishing to Google Play requires Android signing credentials.

### iOS

The current mobile workflow validates iOS/Xcode project generation on macOS and uploads the generated Apple project.

The next release stage will build an IPA after Apple signing credentials and an App Store Connect bundle identifier are configured.

iOS packaging requires macOS/Xcode and Apple code signing.

## Branch strategy

`master` remains the historical 2014 version.

`modern-rewrite` remains the primary application-development branch.

`app-packaging` is the temporary packaging/CI branch. Once the build workflows are stable, merge it back into `modern-rewrite` so there is still one application codebase.
