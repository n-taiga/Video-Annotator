import type { ComponentProps } from 'react'
import SideMenu from '../components/SideMenu'
import type { UseUiFeatureResult } from '../hooks/useUiFeature'

export type SideMenuComponentProps = ComponentProps<typeof SideMenu>

export interface BuildSideMenuPropsArgs {
  ui: UseUiFeatureResult
}

export function buildSideMenuProps({ ui }: BuildSideMenuPropsArgs): SideMenuComponentProps {
  return {
    open: ui.state.sideOpen,
    onClose: () => ui.actions.setSideOpen(false),
    title: 'Menu',
  }
}
