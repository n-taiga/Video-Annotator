import React from 'react'

export interface AppLayoutProps {
  header: React.ReactNode
  sideMenu: React.ReactNode
  referenceOverlay: React.ReactNode
  configurationMenu: React.ReactNode
  actionForm: React.ReactNode
  mainContent: React.ReactNode
  timelineContextMenu: React.ReactNode
  saveControls: React.ReactNode
}

export default function AppLayout({
  header,
  sideMenu,
  referenceOverlay,
  configurationMenu,
  actionForm,
  mainContent,
  timelineContextMenu,
  saveControls,
}: AppLayoutProps) {
  return (
    <div className="app">
      {header}
      {sideMenu}
      {referenceOverlay}
      {configurationMenu}
      {actionForm}
      {mainContent}
      {timelineContextMenu}
      {saveControls}
    </div>
  )
}
