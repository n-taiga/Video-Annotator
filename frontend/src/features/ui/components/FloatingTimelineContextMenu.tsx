import React from 'react'
import type { ComponentProps } from 'react'
import { TimelineContextMenu } from '../../timeline'

type FloatingTimelineContextMenuProps = ComponentProps<typeof TimelineContextMenu>

export default function FloatingTimelineContextMenu(props: FloatingTimelineContextMenuProps) {
  return <TimelineContextMenu {...props} />
}
