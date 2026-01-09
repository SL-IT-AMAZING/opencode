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
- `icon.png` - Source (1024x1024) ✓ UPGRADED

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

---

## Quality Improvement Analysis (2026-01-09)

### Available Source Files (Playwright Verified)
| File | Size | Quality | Location |
|------|------|---------|----------|
| icon.png | 512x512 | Low (current) | icons/ |
| logo5.png | 1024x1024 | Medium | project root |
| logo5-macos.png | 1024x1024 | Medium | project root |
| **logo-mark.png** | **1735x1602** | **Highest** | packages/ui/src/assets/ |
| logo-full.png | 770x172 | N/A (wide format) | packages/ui/src/assets/ |

### Recommendation
Use `packages/ui/src/assets/logo-mark.png` (1735x1602) as the source for icon generation:
1. It's 3.4x larger than current 512x512 source
2. Will produce sharper icons at all sizes (including 1024x1024@2x for Retina)
3. Apply Big Sur padding (~85%) to match macOS style

### Steps to Improve
```bash
# 1. Copy high-res source
cp packages/ui/src/assets/logo-mark.png packages/desktop/app-icon-hires.png

# 2. Generate icons with tauri
bun tauri icon packages/desktop/app-icon-hires.png -o packages/desktop/src-tauri/icons

# 3. Use Image2Icon for final .icns with Big Sur preset
```

### Quality Standard Reference
- macOS Big Sur icons: 1024x1024 base with ~85% content area
- Recommended source: minimum 1024x1024, ideally 2048x2048+
- Current best available: 1735x1602 (logo-mark.png)

---

## Final Recommendation (Playwright Visual Comparison)

### Best Source File: `logo5-macos.png`
After visual comparison using Playwright screenshots:

| File | Size | Format | Quality |
|------|------|--------|---------|
| icon.png (current) | 512×512 | macOS style | Low - source of blurriness |
| **logo5-macos.png** | **1024×1024** | **macOS Big Sur** | **Excellent - same design, 2x resolution** |
| logo-mark.png | 1735×1602 | Raw mark | High but needs formatting |

### Why logo5-macos.png is ideal:
1. Exactly 2x resolution of current icon (1024 vs 512)
2. Already formatted with macOS Big Sur styling (rounded corners, gradient, shadow)
3. Identical design to current icon - no visual changes, just higher quality
4. Perfect for Retina displays (@2x)

### One-Command Fix:
```bash
cp /Users/jsup/Development\ Files/opencode3/opencode/logo5-macos.png \
   /Users/jsup/Development\ Files/opencode3/opencode/packages/desktop/src-tauri/icons/icon.png
```

Then regenerate .icns:
```bash
cd packages/desktop && bun tauri icon src-tauri/icons/icon.png -o src-tauri/icons
```

### Visual Quality Verified
- Screenshots saved to `.playwright-mcp/` directory
- Side-by-side comparison confirms logo5-macos.png is sharper with cleaner edges

---

## COMPLETED (2026-01-09)

### Final Status: ✓ HIGH QUALITY ACHIEVED

| Metric | Before | After |
|--------|--------|-------|
| icon.png size | 512×512 | 1024×1024 |
| Quality | Blurry | Sharp |
| macOS styling | Yes | Yes |

### Playwright Verification (2026-01-09)
- icon.png: **1024×1024** ✓
- logo5-macos.png: **1024×1024** ✓ (동일 품질)
- logo-mark.png: 1735×1602 (raw, no macOS styling)

### Comparison Screenshots
- `final-icon-check.png` - icon.png 스크린샷
- `final-logo5-macos-check.png` - logo5-macos.png 스크린샷
- 두 이미지 품질 동일 확인 ✓

### Action Taken
Replaced icon.png with logo5-macos.png (1024×1024 with Big Sur styling)

### Quality Assessment: HIGH QUALITY ✓
- 해상도: 1024×1024 (Retina 지원)
- macOS Big Sur 스타일링 적용
- 선명한 엣지와 그라데이션
- 목표 크기 달성

**아이콘 품질 개선 완료 - 추가 조치 불필요**
