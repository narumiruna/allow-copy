export const FEATURE_KEYS = ['textSelection', 'contextMenu', 'copyPaste', 'cursor'] as const

export type FeatureKey = (typeof FEATURE_KEYS)[number]

export type FeatureSettings = Record<FeatureKey, boolean>

export interface SiteConfig {
  enabled: boolean
  features: FeatureSettings
}

export interface CssRestrictions {
  userSelect: boolean
  pointerEvents: boolean
  cursor: boolean
}

export interface JavaScriptRestrictions {
  contextmenu: boolean
  selectstart: boolean
  copy: boolean
}

export interface DetectionResults {
  cssRestrictions: CssRestrictions
  jsRestrictions: JavaScriptRestrictions
}

export interface DetectionInfo {
  detectionResults: DetectionResults
  isEnabled: boolean
  features: FeatureSettings
}

export interface PendingSiteEnable {
  hostname: string
  features: FeatureSettings
}

export interface RequestedTab {
  id: number
  url: string
}
