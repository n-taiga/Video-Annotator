import React from 'react'
import type { ComponentProps } from 'react'
import { ReferenceVideoOverlay } from '../../video'

type FloatingReferenceOverlayProps = ComponentProps<typeof ReferenceVideoOverlay>

export default function FloatingReferenceOverlay(props: FloatingReferenceOverlayProps) {
  return <ReferenceVideoOverlay {...props} />
}
