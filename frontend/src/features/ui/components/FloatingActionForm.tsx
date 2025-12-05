import React from 'react'
import type { ComponentProps } from 'react'
import { ActionForm } from '../../project'

type FloatingActionFormProps = ComponentProps<typeof ActionForm>

export default function FloatingActionForm(props: FloatingActionFormProps) {
  return <ActionForm {...props} />
}
