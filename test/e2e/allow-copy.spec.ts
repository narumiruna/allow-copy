import type { BrowserContext, Page, Worker } from '@playwright/test'
import { expect, test } from './fixtures'

async function getActiveTabId(page: Page, serviceWorker: Worker): Promise<number> {
  await page.bringToFront()
  return serviceWorker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (typeof tab?.id !== 'number') throw new Error('Active tab is unavailable')
    return tab.id
  })
}

async function openPopup(
  context: BrowserContext,
  extensionId: string,
  popupPath: string,
  tabId: number,
  url: string,
): Promise<Page> {
  const popup = await context.newPage()
  await popup.goto(
    `chrome-extension://${extensionId}/${popupPath}?tabId=${tabId}&url=${encodeURIComponent(url)}`,
  )
  return popup
}

async function selectRestrictedParagraph(page: Page): Promise<string> {
  const paragraph = page.locator('p').last()
  const box = await paragraph.boundingBox()
  if (!box) throw new Error('Could not locate selectable paragraph')

  await page.mouse.move(box.x + 10, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2, { steps: 20 })
  await page.mouse.up()
  return page.evaluate(() => window.getSelection()?.toString() ?? '')
}

async function ensureAdvancedOptionsOpen(popup: Page): Promise<void> {
  const advanced = popup.getByRole('button', { name: 'Advanced Options' })
  if ((await advanced.getAttribute('aria-expanded')) !== 'true') await advanced.click()
}

async function probeInteractionRestrictions(page: Page) {
  return page.evaluate(() => {
    const paragraph = document.querySelector('p')
    if (!paragraph) return null

    const selectEvent = new Event('selectstart', { bubbles: true, cancelable: true })
    const contextEvent = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 2,
    })
    const copyEvent = new Event('copy', { bubbles: true, cancelable: true })

    return {
      selectAllowed: paragraph.dispatchEvent(selectEvent),
      contextAllowed: paragraph.dispatchEvent(contextEvent),
      copyAllowed: paragraph.dispatchEvent(copyEvent),
      bodyUserSelect: getComputedStyle(document.body).userSelect,
      paragraphUserSelect: getComputedStyle(paragraph).userSelect,
    }
  })
}

test('enables the active site and keeps the compiled content function active after reload', async ({
  page,
  context,
  serviceWorker,
  extensionId,
  popupPath,
}) => {
  await page.goto('http://127.0.0.1:4173/test-restriction.html')
  const tabId = await getActiveTabId(page, serviceWorker)
  const popup = await openPopup(context, extensionId, popupPath, tabId, page.url())

  await expect(popup.locator('#siteName')).toHaveText('127.0.0.1')
  const toggle = popup.getByRole('switch', { name: 'Enable for this site' })
  await expect(toggle).not.toBeChecked()
  await expect(popup.locator('#detectedRestrictions')).toContainText(
    'Text selection disabled (CSS)',
  )

  await toggle.click()
  await expect(toggle).toBeChecked()
  await expect(popup.locator('#status')).toContainText('Enabled for this site')

  await page.bringToFront()
  expect((await selectRestrictedParagraph(page)).length).toBeGreaterThan(0)

  await expect
    .poll(() => serviceWorker.evaluate((id) => chrome.action.getBadgeText({ tabId: id }), tabId))
    .toBe('✓')

  await page.reload()
  await page.bringToFront()
  expect((await selectRestrictedParagraph(page)).length).toBeGreaterThan(0)

  const reopenedPopup = await openPopup(context, extensionId, popupPath, tabId, page.url())
  await expect(reopenedPopup.getByRole('switch', { name: 'Enable for this site' })).toBeChecked()
})

test('exposes keyboard-operable labeled Radix controls', async ({
  page,
  context,
  serviceWorker,
  extensionId,
  popupPath,
}) => {
  await page.goto('http://127.0.0.1:4173/test-restriction.html')
  const popup = await openPopup(
    context,
    extensionId,
    popupPath,
    await getActiveTabId(page, serviceWorker),
    page.url(),
  )

  await expect(popup.getByRole('switch', { name: 'Enable for this site' })).toBeVisible()
  const advanced = popup.getByRole('button', { name: 'Advanced Options' })
  await advanced.focus()
  await popup.keyboard.press('Enter')
  await expect(advanced).toHaveAttribute('aria-expanded', 'true')
  await expect(popup.getByRole('checkbox', { name: 'Enable text selection' })).toBeVisible()
  if (process.env.CAPTURE_POPUP_SCREENSHOT === '1') {
    await popup.waitForTimeout(200)
    await popup.setViewportSize({ width: 340, height: 720 })
    await popup.screenshot({ path: 'docs/images/popup-radix.png', fullPage: true })
  }
})

test('applies and persists individual feature changes', async ({
  page,
  context,
  serviceWorker,
  extensionId,
  popupPath,
}) => {
  await page.goto('http://127.0.0.1:4173/test-restriction.html')
  const tabId = await getActiveTabId(page, serviceWorker)
  const popup = await openPopup(context, extensionId, popupPath, tabId, page.url())

  await popup.getByRole('switch', { name: 'Enable for this site' }).click()
  await ensureAdvancedOptionsOpen(popup)
  const textSelection = popup.getByRole('checkbox', { name: 'Enable text selection' })
  await textSelection.click()
  await expect(textSelection).not.toBeChecked()

  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).userSelect))
    .toBe('none')

  const reopenedPopup = await openPopup(context, extensionId, popupPath, tabId, page.url())
  await ensureAdvancedOptionsOpen(reopenedPopup)
  await expect(
    reopenedPopup.getByRole('checkbox', { name: 'Enable text selection' }),
  ).not.toBeChecked()
})

test('restores blocked selection and context menu on the local regression fixture', async ({
  page,
  context,
  serviceWorker,
  extensionId,
  popupPath,
}) => {
  await page.goto('http://127.0.0.1:4173/test/fixtures/blocked-interactions.html')
  const before = await probeInteractionRestrictions(page)
  expect(before).toMatchObject({
    selectAllowed: false,
    contextAllowed: false,
    copyAllowed: false,
    bodyUserSelect: 'none',
    paragraphUserSelect: 'none',
  })

  const popup = await openPopup(
    context,
    extensionId,
    popupPath,
    await getActiveTabId(page, serviceWorker),
    page.url(),
  )
  await popup.getByRole('switch', { name: 'Enable for this site' }).click()

  await page.bringToFront()
  await expect
    .poll(async () => (await probeInteractionRestrictions(page))?.selectAllowed)
    .toBe(true)
  expect(await probeInteractionRestrictions(page)).toMatchObject({
    selectAllowed: true,
    contextAllowed: true,
    copyAllowed: true,
    bodyUserSelect: 'text',
    paragraphUserSelect: 'text',
  })
})

test('rejects a supported URL hint that does not match the target tab', async ({
  page,
  context,
  serviceWorker,
  extensionId,
  popupPath,
}) => {
  await page.goto('http://127.0.0.1:4173/test-restriction.html')
  const popup = await openPopup(
    context,
    extensionId,
    popupPath,
    await getActiveTabId(page, serviceWorker),
    'https://attacker.example/',
  )

  await expect(popup.locator('#siteName')).not.toHaveText('attacker.example')
  await expect(popup.getByRole('switch', { name: 'Enable for this site' })).toBeDisabled()
})

test('disables controls for unsupported pages', async ({
  page,
  context,
  serviceWorker,
  extensionId,
  popupPath,
}) => {
  await page.goto('chrome://extensions/')
  const popup = await openPopup(
    context,
    extensionId,
    popupPath,
    await getActiveTabId(page, serviceWorker),
    page.url(),
  )

  await expect(popup.locator('#siteName')).toHaveText('Unsupported page')
  await expect(popup.getByRole('switch', { name: 'Enable for this site' })).toBeDisabled()
  await expect(popup.locator('#status')).toContainText('Not available on this page')
})
