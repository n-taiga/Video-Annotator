import type { ComponentProps } from 'react'
import { SaveControls } from '../../project'
import type { SaveStatus } from '../../project/types'

export type SaveControlsComponentProps = ComponentProps<typeof SaveControls>

export interface BuildSaveControlsPropsArgs {
  saveStatus: SaveStatus
  onSave: () => void | Promise<void>
}

export function buildSaveControlsProps({ saveStatus, onSave }: BuildSaveControlsPropsArgs): SaveControlsComponentProps {
  return {
    saveStatus,
    onSave,
  }
}
