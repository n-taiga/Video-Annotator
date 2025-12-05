import React from 'react'
import type { ComponentProps } from 'react'
import { SaveControls } from '../../project'

type FloatingSaveControlsProps = ComponentProps<typeof SaveControls>

export default function FloatingSaveControls(props: FloatingSaveControlsProps) {
  return <SaveControls {...props} />
}
