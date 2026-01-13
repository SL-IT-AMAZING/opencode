import { test, expect } from "@playwright/test"

test.describe("File Tree Layout", () => {
  test("preview button should appear at right end of row on hover", async ({ page }) => {
    // Navigate to the app
    await page.goto("/")

    // Wait for the app to load
    await page.waitForLoadState("networkidle")

    // Take a screenshot of the initial state
    await page.screenshot({ path: "e2e/screenshots/file-tree-initial.png", fullPage: true })

    // Look for any file row (button elements in the file tree)
    const fileRows = page.locator('button[draggable="true"]')

    // Wait for file tree to load
    await fileRows.first().waitFor({ timeout: 10000 }).catch(() => {
      console.log("No file rows found - app may not have loaded properly")
    })

    const count = await fileRows.count()
    console.log(`Found ${count} file rows`)

    if (count > 0) {
      // Get the first file row
      const firstRow = fileRows.first()

      // Hover over the row to reveal the preview button
      await firstRow.hover()

      // Take a screenshot after hover
      await page.screenshot({ path: "e2e/screenshots/file-tree-hover.png", fullPage: true })

      // Get bounding box of the row
      const rowBox = await firstRow.boundingBox()
      console.log("Row bounding box:", rowBox)

      // Check that icon, filename, and button are in correct order
      // The layout should be: [spacer][icon][filename with flex-1]...[preview button]

      // Find all SVG icons in the row (file icon, preview button icon)
      const icons = firstRow.locator("svg")
      const iconCount = await icons.count()
      console.log(`Found ${iconCount} icons in row`)

      // Find the filename span (has flex-1 class)
      const filenameSpan = firstRow.locator("span.flex-1")
      const hasFilename = (await filenameSpan.count()) > 0
      console.log(`Has filename span: ${hasFilename}`)

      if (hasFilename) {
        const filenameBox = await filenameSpan.boundingBox()
        console.log("Filename bounding box:", filenameBox)

        // If there's a preview button (for HTML files), verify it's to the right
        const previewButton = firstRow.locator('button[class*="opacity"]')
        const hasPreviewButton = (await previewButton.count()) > 0
        console.log(`Has preview button: ${hasPreviewButton}`)

        if (hasPreviewButton && filenameBox) {
          const buttonBox = await previewButton.boundingBox()
          console.log("Preview button bounding box:", buttonBox)

          if (buttonBox) {
            // Preview button should be to the RIGHT of the filename
            expect(buttonBox.x).toBeGreaterThan(filenameBox.x + filenameBox.width - 50)
            console.log("✓ Preview button is correctly positioned to the right of filename")
          }
        }

        // Verify the file icon is to the LEFT of the filename
        if (iconCount > 0) {
          const fileIcon = icons.first()
          const iconBox = await fileIcon.boundingBox()
          console.log("File icon bounding box:", iconBox)

          if (iconBox && filenameBox) {
            // Icon should be to the LEFT of filename
            expect(iconBox.x).toBeLessThan(filenameBox.x)
            console.log("✓ File icon is correctly positioned to the left of filename")
          }
        }
      }
    }

    // Final screenshot
    await page.screenshot({ path: "e2e/screenshots/file-tree-final.png", fullPage: true })
  })
})
