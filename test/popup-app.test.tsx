// @vitest-environment jsdom

import { Theme } from '@radix-ui/themes'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { App } from '../src/popup/App'
import type {
  EnabledMutationResult,
  PopupApi,
  PopupLoadState,
  ReadyPopupState,
} from '../src/popup/popup-controller'

const readyState: ReadyPopupState = {
  kind: 'ready',
  tab: { id: 7, url: 'https://example.com/article' },
  hostname: 'example.com',
  enabled: false,
  features: {
    textSelection: true,
    contextMenu: true,
    copyPaste: true,
    cursor: true,
  },
  detectionResults: {
    cssRestrictions: { userSelect: true, pointerEvents: false, cursor: false },
    jsRestrictions: { contextmenu: true, selectstart: false, copy: false },
  },
  detectionUnavailable: false,
  advancedExpanded: false,
}

function createApi(overrides: Partial<PopupApi> = {}): PopupApi {
  return {
    load: vi.fn(async () => readyState),
    setEnabled: vi.fn(async (_tab, _hostname, enabled) => ({
      enabled,
      permissionDenied: false,
      detectionResults: readyState.detectionResults,
    })),
    setFeatures: vi.fn(async () => ({ detectionResults: readyState.detectionResults })),
    setAdvancedExpanded: vi.fn(async () => undefined),
    ...overrides,
  }
}

function renderApp(api: PopupApi) {
  return render(
    <Theme accentColor="grass" grayColor="slate">
      <App api={api} />
    </Theme>,
  )
}

describe('popup application', () => {
  it('exposes a labeled switch and keyboard-operable advanced options', async () => {
    const user = userEvent.setup()
    renderApp(createApi())

    expect(await screen.findByRole('switch', { name: 'Enable for this site' })).toBeVisible()

    const advanced = screen.getByRole('button', { name: 'Advanced Options' })
    advanced.focus()
    await user.keyboard('{Enter}')

    expect(advanced).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('checkbox', { name: 'Enable text selection' })).toBeVisible()
  })

  it('keeps the requested switch state visible while saving', async () => {
    let finish: (() => void) | undefined
    const api = createApi({
      setEnabled: vi.fn(
        (): Promise<EnabledMutationResult> =>
          new Promise((resolve) => {
            finish = () =>
              resolve({
                enabled: true,
                permissionDenied: false,
                detectionResults: readyState.detectionResults,
              })
          }),
      ),
    })
    const user = userEvent.setup()
    renderApp(api)

    const toggle = await screen.findByRole('switch', { name: 'Enable for this site' })
    await user.click(toggle)

    expect(toggle).toBeChecked()
    expect(toggle).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Saving…')

    finish?.()
    await waitFor(() => expect(toggle).not.toBeDisabled())
    expect(screen.getByRole('status')).toHaveTextContent('Enabled for this site')
  })

  it('rolls back a feature toggle when saving fails', async () => {
    const api = createApi({
      setFeatures: vi.fn(async () => {
        throw new Error('simulated storage failure')
      }),
    })
    const user = userEvent.setup()
    renderApp(api)

    await user.click(await screen.findByRole('button', { name: 'Advanced Options' }))
    const feature = screen.getByRole('checkbox', { name: 'Enable text selection' })
    await user.click(feature)

    await waitFor(() => expect(feature).toBeChecked())
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save feature settings')
  })

  it('disables the primary action on unsupported pages', async () => {
    renderApp(
      createApi({
        load: vi.fn(
          async (): Promise<PopupLoadState> => ({
            kind: 'unsupported',
            siteName: 'Unsupported page',
            message: 'Not available on this page',
          }),
        ),
      }),
    )

    expect(await screen.findByText('Unsupported page')).toBeVisible()
    expect(screen.getByRole('switch', { name: 'Enable for this site' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Not available on this page')
  })
})
