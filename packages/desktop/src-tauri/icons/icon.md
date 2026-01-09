# Icon Size Fix Documentation

## Issue
GitHub Issue #5: macOS Dock icon appears larger than other apps.

## Target
Match Big Sur icon style: ~85% content with padding/shadow.

## Approach History

### Failed Attempts
| Attempt | Method | Result | File Size |
|---------|--------|--------|-----------|
| 1 | ImageMagick 75% scale | Too small, blurry | 443KB |
| 2 | ImageMagick 83% + Lanczos | Still blurry | 535KB |
| 3 | Extract from icns + extent | Blurry | 632KB |
| 4 | User's image copy 2.png | Only 512x512 source | N/A |
| 5 | PIL paste + downscale | Better quality | 933KB |

### Root Cause
- Source icon.png is only 512x512
- ImageMagick operations degrade quality
- Original icon.icns (708KB) was sharp but too large

### Correct Solution (per README.md)
Use [Image2Icon](https://img2icnsapp.com/) app with 'Big Sur Icon' preset:
1. Save source as `app-icon.png` in `packages/desktop`
2. Run `bun tauri icons -o icons/{environment}`
3. Use Image2Icon 'Big Sur Icon' preset to generate `icon.icns`

## Current Status - VERIFIED

### Measurement Results (via PIL analysis)
| Icon | Content % | Padding | Status |
|------|-----------|---------|--------|
| Original (git) | 99.9% | 0px | ❌ Too large |
| Current (Attempt 5) | 85.3% | 75px | ✓ Good |

### Target vs Actual
- **Target**: 80-85% content (Big Sur standard)
- **Actual**: 85.3% content with 75px padding
- **File size**: 933KB (dev), 933KB (prod)

## Files
- `dev/icon.icns` - Development build icon (933KB)
- `prod/icon.icns` - Production build icon (933KB)
- `icon.png` - Source (512x512)

## Verification Method
```python
# PIL script to measure content bounds
from PIL import Image
img = Image.open("icon_512x512@2x.png")
# Scan for non-transparent pixels to find content bounds
# Content at 85.3% = proper Big Sur padding
```

## Remaining Issue
The icon may still appear slightly blurry because the source is only 512x512.
For best quality, use Image2Icon app with 'Big Sur Icon' preset (see README.md).
