import { useState } from 'react'
import type React from 'react'

export type UiScreen = 'annotation' | 'configuration'

export interface UiFeatureState {
  sideOpen: boolean
  activeScreen: UiScreen
}

export interface UiFeatureActions {
  setSideOpen: React.Dispatch<React.SetStateAction<boolean>>
  setActiveScreen: React.Dispatch<React.SetStateAction<UiScreen>>
}

export interface UseUiFeatureResult {
  state: UiFeatureState
  actions: UiFeatureActions
}

export function useUiFeature(): UseUiFeatureResult {
  const [sideOpen, setSideOpen] = useState(false)
  const [activeScreen, setActiveScreen] = useState<UiScreen>('annotation')

  return {
    state: {
      sideOpen,
      activeScreen,
    },
    actions: {
      setSideOpen,
      setActiveScreen,
    },
  }
}
