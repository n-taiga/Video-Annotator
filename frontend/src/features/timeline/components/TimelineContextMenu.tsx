import React from 'react'
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react'
import type { ContextMenuState, Interaction } from '../types'

interface TimelineContextMenuProps {
  contextMenu: ContextMenuState
  actions: string[]
  interactions: Interaction[]
  interactionMenuRef: RefObject<HTMLDivElement>
  selectionMenuRef: RefObject<HTMLDivElement>
  selectionMenuHideTimerRef: MutableRefObject<number | null>
  clearSelectionMenuHideTimer: () => void
  selectionMenuAction: string
  setSelectionMenuAction: Dispatch<SetStateAction<string>>
  selectionDropdownOpen: boolean
  setSelectionDropdownOpen: Dispatch<SetStateAction<boolean>>
  contact: boolean
  setContact: (value: boolean) => void
  setSelectedAction: (value: string) => void
  addInteraction: (labelOverride?: string) => void
  closeContextMenu: () => void
  updateInteractionLabel: (index: number, label: string) => void
  hideDelay: number
}

export default function TimelineContextMenu({
  contextMenu,
  actions,
  interactions,
  interactionMenuRef,
  selectionMenuRef,
  selectionMenuHideTimerRef,
  clearSelectionMenuHideTimer,
  selectionMenuAction,
  setSelectionMenuAction,
  selectionDropdownOpen,
  setSelectionDropdownOpen,
  contact,
  setContact,
  setSelectedAction,
  addInteraction,
  closeContextMenu,
  updateInteractionLabel,
  hideDelay,
}: TimelineContextMenuProps) {
  return (
    <>
      {contextMenu.open && contextMenu.type === 'interaction' && interactions[contextMenu.targetIndex] && (
        <div
          className="context-menu"
          ref={interactionMenuRef}
          onClick={e => e.stopPropagation()}
          onContextMenu={e => e.preventDefault()}
        >
          <div className="context-menu-title">Label</div>
          <select
            value={interactions[contextMenu.targetIndex].action_label}
            aria-label="Interaction label"
            onChange={e => {
              updateInteractionLabel(contextMenu.targetIndex, e.target.value)
              closeContextMenu()
            }}
            autoFocus
          >
            {actions.map(a => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      )}

      {contextMenu.open && contextMenu.type === 'selection' && (
        <div
          className="context-menu context-menu-selection"
          ref={selectionMenuRef}
          tabIndex={0}
          onClick={e => e.stopPropagation()}
          onContextMenu={e => e.preventDefault()}
          onMouseEnter={() => {
            clearSelectionMenuHideTimer()
          }}
          onMouseLeave={() => {
            clearSelectionMenuHideTimer()
            selectionMenuHideTimerRef.current = window.setTimeout(() => {
              if (contextMenu.open && contextMenu.type === 'selection') closeContextMenu()
              selectionMenuHideTimerRef.current = null
            }, hideDelay)
          }}
        >
          <div className="context-menu-title">Label</div>
          <div className="selection-menu-row">
            <div className="selection-select">
              <div className="custom-select custom-select--selection" onMouseDown={e => e.stopPropagation()}>
                <button
                  type="button"
                  className="input custom-select-trigger"
                  aria-haspopup="listbox"
                  aria-expanded={selectionDropdownOpen}
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => {
                    e.stopPropagation()
                    setSelectionDropdownOpen(prev => !prev)
                  }}
                >
                  <span className="custom-select-value">{selectionMenuAction || '—'}</span>
                  <span className="custom-select-caret">▾</span>
                </button>
                {selectionDropdownOpen && (
                  <div className="custom-select-list" role="listbox" onMouseDown={e => e.stopPropagation()}>
                    {actions.map(a => (
                      <button
                        key={a}
                        type="button"
                        className={`custom-select-option${a === selectionMenuAction ? ' is-selected' : ''}`}
                        onMouseDown={e => e.stopPropagation()}
                        onClick={() => {
                          setSelectionMenuAction(a)
                          setSelectionDropdownOpen(false)
                        }}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <label className="timeline-toggle selection-toggle">
              <span className="timeline-toggle-label">Contact</span>
              <input
                className="toggle-checkbox"
                type="checkbox"
                checked={contact}
                onChange={e => setContact(e.target.checked)}
              />
              <span className="toggle-slider" aria-hidden="true"></span>
            </label>
          </div>
          <button
            className="button"
            onClick={() => {
              if (!selectionMenuAction) return
              setSelectedAction(selectionMenuAction)
              addInteraction(selectionMenuAction)
              closeContextMenu()
            }}
            disabled={!selectionMenuAction}
          >
            Add Action
          </button>
        </div>
      )}
    </>
  )
}
