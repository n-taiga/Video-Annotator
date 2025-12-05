import React from 'react'
import AppHeader from '../components/AppHeader'
import SideMenu from '../components/SideMenu'
import SidePanel from '../components/SidePanel'
import ConfigurationFloatingMenu from '../components/ConfigurationFloatingMenu'
import MainContent from '../components/MainContent'
import type { AppLayoutProps } from '../components/AppLayout'
import FloatingReferenceOverlay from '../components/FloatingReferenceOverlay'
import FloatingTimelineContextMenu from '../components/FloatingTimelineContextMenu'
import FloatingActionForm from '../components/FloatingActionForm'
import FloatingSaveControls from '../components/FloatingSaveControls'

export interface ComposeAppLayoutInput {
  header: React.ComponentProps<typeof AppHeader>
  sideMenu: {
    menu: React.ComponentProps<typeof SideMenu>
    panel: React.ComponentProps<typeof SidePanel>
  }
  referenceOverlay: React.ComponentProps<typeof FloatingReferenceOverlay>
  configurationMenu: React.ComponentProps<typeof ConfigurationFloatingMenu>
  actionForm: React.ComponentProps<typeof FloatingActionForm>
  mainContent: React.ComponentProps<typeof MainContent>
  timelineContextMenu: React.ComponentProps<typeof FloatingTimelineContextMenu>
  saveControls: React.ComponentProps<typeof FloatingSaveControls>
}

export function composeAppLayoutProps({
  header,
  sideMenu,
  referenceOverlay,
  configurationMenu,
  actionForm,
  mainContent,
  timelineContextMenu,
  saveControls,
}: ComposeAppLayoutInput): AppLayoutProps {
  return {
    header: <AppHeader {...header} />,
    sideMenu: (
      <SideMenu {...sideMenu.menu}>
        <SidePanel {...sideMenu.panel} />
      </SideMenu>
    ),
    referenceOverlay: <FloatingReferenceOverlay {...referenceOverlay} />,
    configurationMenu: <ConfigurationFloatingMenu {...configurationMenu} />,
    actionForm: <FloatingActionForm {...actionForm} />,
    mainContent: <MainContent {...mainContent} />,
    timelineContextMenu: <FloatingTimelineContextMenu {...timelineContextMenu} />,
    saveControls: <FloatingSaveControls {...saveControls} />,
  }
}
