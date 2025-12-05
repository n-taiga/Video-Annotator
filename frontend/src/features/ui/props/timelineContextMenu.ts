import type { ComponentProps } from 'react'
import { TimelineContextMenu } from '../../timeline'
import type { UseTimelineFeatureResult } from '../../timeline/hooks/useTimelineFeature'

export type TimelineContextMenuComponentProps = ComponentProps<typeof TimelineContextMenu>

export interface BuildTimelineContextMenuPropsArgs<TClickPoint extends Record<string, unknown>> {
  actions: string[]
  timeline: UseTimelineFeatureResult<TClickPoint>
  selectionMenuHideDelay: number
}

export function buildTimelineContextMenuProps<TClickPoint extends Record<string, unknown>>({ actions, timeline, selectionMenuHideDelay }: BuildTimelineContextMenuPropsArgs<TClickPoint>): TimelineContextMenuComponentProps {
  return {
    contextMenu: timeline.contextMenu.contextMenu,
    actions,
    interactions: timeline.annotations.interactions,
    interactionMenuRef: timeline.contextMenu.interactionMenuRef,
    selectionMenuRef: timeline.contextMenu.selectionMenuRef,
    selectionMenuHideTimerRef: timeline.contextMenu.selectionMenuHideTimerRef,
    clearSelectionMenuHideTimer: timeline.contextMenu.clearSelectionMenuHideTimer,
    selectionMenuAction: timeline.contextMenu.selectionMenuAction,
    setSelectionMenuAction: timeline.contextMenu.setSelectionMenuAction,
    selectionDropdownOpen: timeline.contextMenu.selectionDropdownOpen,
    setSelectionDropdownOpen: timeline.contextMenu.setSelectionDropdownOpen,
    contact: timeline.annotations.contact,
    setContact: timeline.annotations.setContact,
    setSelectedAction: timeline.annotations.setSelectedAction,
    addInteraction: timeline.annotations.addInteraction,
    closeContextMenu: timeline.contextMenu.closeContextMenu,
    updateInteractionLabel: timeline.annotations.updateInteractionLabel,
    hideDelay: selectionMenuHideDelay,
  }
}
