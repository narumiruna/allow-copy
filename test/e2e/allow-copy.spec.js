const { test, expect } = require('./fixtures')

async function getActiveTabId(page, serviceWorker) {
  await page.bringToFront()
  return await serviceWorker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    return tab.id
  })
}

async function openPopup(context, extensionId, tabId, url) {
  const popup = await context.newPage()
  await popup.goto(
    `chrome-extension://${extensionId}/popup.html?tabId=${tabId}&url=${encodeURIComponent(url)}`,
  )
  return popup
}

async function selectRestrictedParagraph(page) {
  const paragraph = page.locator('p').nth(2)
  const box = await paragraph.boundingBox()
  if (!box) {
    throw new Error('Could not locate selectable paragraph')
  }

  const startX = box.x + 10
  const endX = box.x + box.width - 10
  const y = box.y + box.height / 2

  await page.mouse.move(startX, y)
  await page.mouse.down()
  await page.mouse.move(endX, y, { steps: 20 })
  await page.mouse.up()

  return await page.evaluate(() => window.getSelection()?.toString() || '')
}

async function probeInteractionRestrictions(page) {
  return await page.evaluate(() => {
    const paragraph = Array.from(document.querySelectorAll('p')).find(
      (element) => (element.innerText || '').trim().length > 60,
    )

    if (!paragraph) {
      return null
    }

    const selectEvent = new Event('selectstart', { bubbles: true, cancelable: true })
    const contextEvent = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 2,
    })

    return {
      selectAllowed: paragraph.dispatchEvent(selectEvent),
      contextAllowed: paragraph.dispatchEvent(contextEvent),
      bodyUserSelect: getComputedStyle(document.body).userSelect,
      paragraphUserSelect: getComputedStyle(paragraph).userSelect,
    }
  })
}

test('enables the extension for the active site and keeps it enabled after reload', async ({
  page,
  context,
  serviceWorker,
  extensionId,
}) => {
  await page.goto('http://127.0.0.1:4173/test-restriction.html')
  const tabId = await getActiveTabId(page, serviceWorker)

  const popup = await openPopup(context, extensionId, tabId, page.url())

  await expect(popup.locator('#siteName')).toHaveText('127.0.0.1')
  await expect(popup.locator('#toggleExtension')).not.toBeChecked()
  await expect(popup.locator('#detectedRestrictions')).toContainText('Text selection disabled (CSS)')

  await popup.locator('.switch').click()
  await expect(popup.locator('#toggleExtension')).toBeChecked()

  await expect(popup.locator('#status')).toHaveText('✓ Enabled for this site')

  await page.bringToFront()
  const selectedText = await selectRestrictedParagraph(page)
  expect(selectedText.length).toBeGreaterThan(0)

  await page.reload()

  await page.bringToFront()
  const selectedTextAfterReload = await selectRestrictedParagraph(page)
  expect(selectedTextAfterReload.length).toBeGreaterThan(0)

  const reopenedPopup = await openPopup(context, extensionId, tabId, page.url())
  await expect(reopenedPopup.locator('#toggleExtension')).toBeChecked()
  await expect(reopenedPopup.locator('#status')).toHaveText('✓ Enabled for this site')
})

test('restores blocked selection and context menu on izaax after enabling the site', async ({
  page,
  context,
  serviceWorker,
  extensionId,
}) => {
  await page.goto('https://www.izaax.net/blog/')
  const tabId = await getActiveTabId(page, serviceWorker)

  const before = await probeInteractionRestrictions(page)
  expect(before).not.toBeNull()
  expect(before.selectAllowed).toBe(false)
  expect(before.contextAllowed).toBe(false)
  expect(before.bodyUserSelect).toBe('none')
  expect(before.paragraphUserSelect).toBe('none')

  const popup = await openPopup(context, extensionId, tabId, page.url())

  await expect(popup.locator('#siteName')).toHaveText('www.izaax.net')
  await expect(popup.locator('#toggleExtension')).not.toBeChecked()

  await popup.locator('.switch').click()
  await expect(popup.locator('#toggleExtension')).toBeChecked()
  await expect(popup.locator('#status')).toHaveText('✓ Enabled for this site')

  await page.bringToFront()
  const afterEnable = await probeInteractionRestrictions(page)
  expect(afterEnable.selectAllowed).toBe(true)
  expect(afterEnable.contextAllowed).toBe(true)
  expect(afterEnable.bodyUserSelect).toBe('text')
  expect(afterEnable.paragraphUserSelect).toBe('text')

  await page.reload()
  await page.bringToFront()

  const afterReload = await probeInteractionRestrictions(page)
  expect(afterReload.selectAllowed).toBe(true)
  expect(afterReload.contextAllowed).toBe(true)
  expect(afterReload.bodyUserSelect).toBe('text')
  expect(afterReload.paragraphUserSelect).toBe('text')

  const reopenedPopup = await openPopup(context, extensionId, tabId, page.url())
  await expect(reopenedPopup.locator('#toggleExtension')).toBeChecked()
  await expect(reopenedPopup.locator('#status')).toHaveText('✓ Enabled for this site')
})
