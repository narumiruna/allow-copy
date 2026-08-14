import {
  CheckCircledIcon,
  ChevronRightIcon,
  CrossCircledIcon,
  ExclamationTriangleIcon,
  GlobeIcon,
  LightningBoltIcon,
  MagnifyingGlassIcon,
} from '@radix-ui/react-icons'
import {
  Badge,
  Box,
  Button,
  Callout,
  Card,
  Checkbox,
  Flex,
  Heading,
  Separator,
  Switch,
  Text,
} from '@radix-ui/themes'
import { Collapsible } from 'radix-ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import { FEATURE_KEYS, type FeatureKey, type FeatureSettings } from '../types/extension'
import { chromePopupApi, type PopupApi, type PopupLoadState } from './popup-controller'

interface AppProps {
  api?: PopupApi
}

interface StatusMessage {
  tone: 'success' | 'neutral' | 'warning' | 'error'
  text: string
}

const FEATURE_LABELS: Record<FeatureKey, string> = {
  textSelection: 'Enable text selection',
  contextMenu: 'Enable right-click menu',
  copyPaste: 'Enable copy/cut operations',
  cursor: 'Restore cursor styles',
}

const FEATURE_SUMMARIES: Record<FeatureKey, string> = {
  textSelection: 'Text selection restored',
  contextMenu: 'Right-click menu restored',
  copyPaste: 'Copy/cut operations enabled',
  cursor: 'Cursor behavior normalized',
}

function statusForState(
  state: PopupLoadState | null,
  override: StatusMessage | null,
): StatusMessage {
  if (override) return override
  if (!state) return { tone: 'neutral', text: 'Loading current site…' }
  if (state.kind !== 'ready') {
    return { tone: state.kind === 'unsupported' ? 'warning' : 'error', text: state.message }
  }
  return state.enabled
    ? { tone: 'success', text: 'Enabled for this site' }
    : { tone: 'neutral', text: 'Disabled for this site' }
}

function StatusIcon({ tone }: { tone: StatusMessage['tone'] }) {
  if (tone === 'success') return <CheckCircledIcon />
  if (tone === 'warning') return <ExclamationTriangleIcon />
  if (tone === 'error') return <CrossCircledIcon />
  return <CrossCircledIcon />
}

function StatusCallout({ status }: { status: StatusMessage }) {
  const color =
    status.tone === 'success'
      ? 'grass'
      : status.tone === 'warning'
        ? 'amber'
        : status.tone === 'error'
          ? 'red'
          : 'gray'

  return (
    <Callout.Root
      id="status"
      className="status-callout"
      color={color}
      role={status.tone === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      <Callout.Icon>
        <StatusIcon tone={status.tone} />
      </Callout.Icon>
      <Callout.Text>{status.text}</Callout.Text>
    </Callout.Root>
  )
}

function RestrictionList({ state }: { state: Extract<PopupLoadState, { kind: 'ready' }> }) {
  if (state.detectionUnavailable) {
    return (
      <Card id="detectedRestrictions" className="summary-card" variant="surface">
        <Flex gap="2" align="center">
          <ExclamationTriangleIcon className="section-icon warning-icon" />
          <Text size="2" weight="medium">
            Restriction details are unavailable
          </Text>
        </Flex>
      </Card>
    )
  }

  const restrictions: string[] = []
  const results = state.detectionResults
  if (results?.cssRestrictions.userSelect) restrictions.push('Text selection disabled (CSS)')
  if (results?.jsRestrictions.contextmenu) {
    restrictions.push('Right-click menu blocked (JavaScript)')
  }
  if (results?.jsRestrictions.copy || results?.jsRestrictions.selectstart) {
    restrictions.push('Copy/cut operations blocked')
  }
  if (results?.cssRestrictions.cursor) restrictions.push('Mouse cursor restrictions')
  if (results?.cssRestrictions.pointerEvents) {
    restrictions.push('Mouse interaction disabled (CSS)')
  }

  return (
    <Card id="detectedRestrictions" className="summary-card" variant="surface">
      <Flex gap="2" align="center" mb="2">
        <MagnifyingGlassIcon className="section-icon" />
        <Text size="2" weight="bold">
          Detected Restrictions
        </Text>
      </Flex>
      <ul className="summary-list restriction-list">
        {restrictions.length === 0 ? (
          <li>No restrictions detected</li>
        ) : (
          restrictions.map((restriction) => <li key={restriction}>{restriction}</li>)
        )}
      </ul>
    </Card>
  )
}

function FeatureSummary({ enabled, features }: { enabled: boolean; features: FeatureSettings }) {
  const selected = FEATURE_KEYS.filter((key) => features[key])

  return (
    <Card id="enabledFeatures" className="summary-card" variant="surface">
      <Flex gap="2" align="center" mb="2">
        <LightningBoltIcon className="section-icon feature-icon" />
        <Text size="2" weight="bold">
          Configured Features
        </Text>
      </Flex>
      <ul className="summary-list feature-list">
        {!enabled && <li className="muted-list-item">Extension is disabled for this site</li>}
        {selected.map((key) => (
          <li key={key}>{FEATURE_SUMMARIES[key]}</li>
        ))}
        {selected.length === 0 && <li>No features enabled</li>}
      </ul>
    </Card>
  )
}

export function App({ api = chromePopupApi }: AppProps) {
  const [state, setState] = useState<PopupLoadState | null>(null)
  const [busy, setBusy] = useState(false)
  const [statusOverride, setStatusOverride] = useState<StatusMessage | null>(null)
  const mutationInFlight = useRef(false)

  useEffect(() => {
    let active = true
    void api
      .load()
      .then((loaded) => {
        if (active) setState(loaded)
      })
      .catch(() => {
        if (active) {
          setState({
            kind: 'error',
            siteName: 'Unavailable',
            message: 'Could not load this extension',
          })
        }
      })
    return () => {
      active = false
    }
  }, [api])

  const runMutation = useCallback(async (mutation: () => Promise<void>) => {
    if (mutationInFlight.current) return
    mutationInFlight.current = true
    setBusy(true)
    try {
      await mutation()
    } finally {
      mutationInFlight.current = false
      setBusy(false)
    }
  }, [])

  const handleEnabledChange = (nextEnabled: boolean) => {
    if (state?.kind !== 'ready') return
    const previousEnabled = state.enabled
    setState({ ...state, enabled: nextEnabled })
    setStatusOverride({ tone: 'neutral', text: 'Saving…' })

    void runMutation(async () => {
      try {
        const result = await api.setEnabled(state.tab, state.hostname, nextEnabled, state.features)
        setState((current) =>
          current?.kind === 'ready'
            ? {
                ...current,
                enabled: result.enabled,
                detectionResults: result.detectionResults ?? current.detectionResults,
              }
            : current,
        )
        setStatusOverride(
          result.permissionDenied
            ? {
                tone: 'warning',
                text: 'Allow this site in the browser prompt to keep it enabled',
              }
            : null,
        )
      } catch {
        setState((current) =>
          current?.kind === 'ready' ? { ...current, enabled: previousEnabled } : current,
        )
        setStatusOverride({ tone: 'error', text: 'Could not save site setting' })
      }
    })
  }

  const handleFeatureChange = (key: FeatureKey, checked: boolean) => {
    if (state?.kind !== 'ready') return
    const previousFeatures = state.features
    const nextFeatures = { ...previousFeatures, [key]: checked }
    setState({ ...state, features: nextFeatures })
    setStatusOverride({ tone: 'neutral', text: 'Saving…' })

    void runMutation(async () => {
      try {
        const result = await api.setFeatures(
          state.tab,
          state.hostname,
          state.enabled,
          previousFeatures,
          nextFeatures,
        )
        setState((current) =>
          current?.kind === 'ready'
            ? {
                ...current,
                detectionResults: result.detectionResults ?? current.detectionResults,
              }
            : current,
        )
        setStatusOverride(null)
      } catch {
        setState((current) =>
          current?.kind === 'ready' ? { ...current, features: previousFeatures } : current,
        )
        setStatusOverride({ tone: 'error', text: 'Could not save feature settings' })
      }
    })
  }

  const handleExpandedChange = (expanded: boolean) => {
    if (state?.kind !== 'ready') return
    setState({ ...state, advancedExpanded: expanded })
    void api.setAdvancedExpanded(expanded).catch(() => {
      setState((current) =>
        current?.kind === 'ready' ? { ...current, advancedExpanded: !expanded } : current,
      )
      setStatusOverride({ tone: 'error', text: 'Could not save display preference' })
    })
  }

  const readyState = state?.kind === 'ready' ? state : null
  const siteName = state ? (state.kind === 'ready' ? state.hostname : state.siteName) : 'Loading…'
  const status = statusForState(state, statusOverride)

  return (
    <main className="popup-shell">
      <header className="header">
        <Flex align="center" justify="center" gap="2">
          <img src="../images/icon48.png" className="header-icon" alt="" />
          <Heading as="h1" size="4">
            Allow Copy
          </Heading>
        </Flex>
        <Text as="p" size="1" color="gray" mt="1">
          Enable copying and text selection on websites
        </Text>
      </header>

      <Card className="site-card" variant="surface" aria-label="Current site">
        <Flex align="center" justify="center" gap="2">
          <GlobeIcon aria-hidden="true" />
          <Text id="siteName" size="2" weight="bold" className="site-name">
            {siteName}
          </Text>
        </Flex>
      </Card>

      <Card className="primary-card" variant="surface">
        <Flex align="center" justify="between" gap="4">
          <Text as="label" htmlFor="toggleExtension" size="2" weight="bold">
            Enable for this site
          </Text>
          <Switch
            id="toggleExtension"
            size="3"
            checked={readyState?.enabled ?? false}
            disabled={!readyState || busy}
            onCheckedChange={handleEnabledChange}
          />
        </Flex>
      </Card>

      <StatusCallout status={status} />

      {readyState && (
        <>
          <RestrictionList state={readyState} />
          <FeatureSummary enabled={readyState.enabled} features={readyState.features} />

          <Collapsible.Root
            id="advancedOptions"
            open={readyState.advancedExpanded}
            onOpenChange={handleExpandedChange}
          >
            <Collapsible.Trigger asChild>
              <Button
                id="advancedToggle"
                className="advanced-trigger"
                variant="soft"
                color="gray"
                highContrast
                aria-controls="advancedContent"
              >
                <ChevronRightIcon className="advanced-chevron" aria-hidden="true" />
                Advanced Options
              </Button>
            </Collapsible.Trigger>
            <Collapsible.Content id="advancedContent" className="advanced-content">
              <Card mt="2" variant="surface">
                {!readyState.enabled && (
                  <Badge color="gray" mb="2">
                    Will apply when enabled for this site
                  </Badge>
                )}
                <Flex direction="column" gap="1">
                  {FEATURE_KEYS.map((key, index) => (
                    <Box key={key}>
                      {index > 0 && <Separator size="4" />}
                      <label className="feature-control" htmlFor={`feature-${key}`}>
                        <Checkbox
                          id={`feature-${key}`}
                          checked={readyState.features[key]}
                          disabled={busy}
                          onCheckedChange={(checked) => handleFeatureChange(key, checked === true)}
                        />
                        <Text size="2">{FEATURE_LABELS[key]}</Text>
                      </label>
                    </Box>
                  ))}
                </Flex>
              </Card>
            </Collapsible.Content>
          </Collapsible.Root>
        </>
      )}

      <span className="visually-hidden" aria-live="polite">
        {busy ? 'Saving changes' : ''}
      </span>
    </main>
  )
}
