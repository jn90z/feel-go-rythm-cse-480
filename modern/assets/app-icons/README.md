# Feel-go-Rythm app icon assets

This directory contains the canonical FGR app icon extracted from the supplied AppIcons pack.

The supplied pack included:
- Xcode `Assets.xcassets/AppIcon.appiconset` sizes for iPhone, iPad, macOS and watchOS
- an iOS 26 `AppIcon.icon` Icon Composer source
- Android launcher mipmaps for mdpi, hdpi, xhdpi, xxhdpi and xxxhdpi
- an Android adaptive foreground
- App Store and Play Store marketing images

## Project use

`source.png` is the canonical project source image.

Run:

```bash
npm run icons:generate
```

This invokes Tauri's icon generator and rebuilds the platform-specific icon set under `src-tauri/icons/` for Windows, Android, iOS and other supported targets.

The CI workflows run this automatically before native packaging so all generated applications use the selected FGR artwork.

This normalized setup avoids maintaining dozens of duplicate raster files by hand while preserving the same supplied artwork across every target.
