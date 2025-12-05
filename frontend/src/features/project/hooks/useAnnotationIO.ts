import { useCallback, useEffect, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { loadAnnotation, saveAnnotation } from '../../../api'
import { mergeActions } from '../../../utils/actions'
import type { SaveStatus } from '../types'

interface AnnotationInteraction {
  start_time: number
  end_time: number
  start_frame: number
  end_frame: number
  action_label: string
  contact: boolean
}

export interface UseAnnotationIOInput {
  scenarioId: string
  videoId: string
  selectedVideoFile: string
  taskLabel: string
  environment: string
  objectName: string
  actions: string[]
  interactions: AnnotationInteraction[]
  metadataOptions: string[]
  userClearedScenario: boolean
  setScenarioId: Dispatch<SetStateAction<string>>
  setVideoId: Dispatch<SetStateAction<string>>
  setTaskLabel: Dispatch<SetStateAction<string>>
  setEnvironment: Dispatch<SetStateAction<string>>
  setObjectName: Dispatch<SetStateAction<string>>
  setActions: Dispatch<SetStateAction<string[]>>
  baseActionsRef: MutableRefObject<string[]>
  setInteractions: Dispatch<SetStateAction<AnnotationInteraction[]>>
  userSelectedScenarioRef: MutableRefObject<boolean>
  userSelectedVideoRef: MutableRefObject<boolean>
}

export interface UseAnnotationIOResult {
  saveStatus: SaveStatus
  exportJSON: () => Promise<void>
}

function stripExtension(file: string): string {
  return file.replace(/\.[^/.]+$/, '')
}

export function useAnnotationIO({
  scenarioId,
  videoId,
  selectedVideoFile,
  taskLabel,
  environment,
  objectName,
  actions,
  interactions,
  metadataOptions,
  userClearedScenario,
  setScenarioId,
  setVideoId,
  setTaskLabel,
  setEnvironment,
  setObjectName,
  setActions,
  baseActionsRef,
  setInteractions,
  userSelectedScenarioRef,
  userSelectedVideoRef,
}: UseAnnotationIOInput): UseAnnotationIOResult {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ status: 'idle' })

  const exportJSON = useCallback(async () => {
    setSaveStatus({ status: 'saving', message: 'Saving…' })
    const payload = {
      scenario_id: scenarioId,
      video_id: videoId,
      video_filename: selectedVideoFile,
      task: taskLabel,
      environment,
      object: objectName,
      actions,
      interactions,
    }
    try {
      await saveAnnotation(payload)
      const savedName = `${stripExtension(selectedVideoFile)}.json`
      setSaveStatus({ status: 'success', message: `Saved to annotations/${savedName}` })
    } catch (err) {
      console.error('Failed to save annotation', err)
      const message = err instanceof Error ? err.message : 'Failed to save annotation.'
      setSaveStatus({ status: 'error', message })
    }
  }, [actions, environment, interactions, objectName, scenarioId, selectedVideoFile, taskLabel, videoId])

  useEffect(() => {
    if (saveStatus.status === 'success' || saveStatus.status === 'error') {
      const timer = window.setTimeout(() => setSaveStatus({ status: 'idle' }), 3000)
      return () => window.clearTimeout(timer)
    }
    return
  }, [saveStatus])

  useEffect(() => {
    let cancelled = false
    async function tryLoadAnnotation() {
      try {
        if (!selectedVideoFile) return
        const base = stripExtension(selectedVideoFile)
        const wasUserSelected = Boolean(userSelectedVideoRef.current)
        const data: any = await loadAnnotation(base)
        if (Array.isArray(data)) {
          const mergeActionList = (defaults: string[], incoming: string[]): string[] => {
            const seen = new Set<string>()
            const out: string[] = []
            for (const a of defaults) {
              if (!a) continue
              if (!seen.has(a)) {
                seen.add(a)
                out.push(a)
              }
            }
            for (const a of incoming) {
              if (!a) continue
              if (!seen.has(a)) {
                seen.add(a)
                out.push(a)
              }
            }
            return out
          }
          const first = data[0] ?? {}
          const videoPath: string = typeof first.video_path === 'string' ? first.video_path : ''
          let scenarioFromPath = ''
          let filenameFromPath = ''
          if (videoPath) {
            const parts = videoPath.split('/')
            if (parts.length >= 3 && parts[0] === 'videos') {
              scenarioFromPath = parts[1]
              filenameFromPath = parts[parts.length - 1]
            } else {
              filenameFromPath = parts[parts.length - 1] || ''
            }
          }
          const videoFilename = filenameFromPath || `${base}.mp4`
          const videoIdFromPath = videoFilename.replace(/\.[^/.]+$/, '')

          const uniqActions: string[] = []
          const loadedInteractions = data
            .filter((it: any) => it && typeof it === 'object')
            .map((it: any) => {
              const label = String(it.action_label ?? '')
              if (label && !uniqActions.includes(label)) uniqActions.push(label)
              return {
                start_time: Number(it.start_time ?? 0),
                end_time: Number(it.end_time ?? 0),
                start_frame: Number(it.start_frame ?? 0),
                end_frame: Number(it.end_frame ?? 0),
                action_label: label,
                contact: Boolean(it.contact),
              }
            })

          if (!wasUserSelected) {
            const canApplyScenarioFromPath = Boolean(scenarioFromPath) && !userClearedScenario && !userSelectedScenarioRef.current && (metadataOptions.length === 0 || metadataOptions.includes(scenarioFromPath))
            if (canApplyScenarioFromPath) setScenarioId(scenarioFromPath)
            setVideoId(videoIdFromPath)
          }
          if (typeof first.task === 'string') setTaskLabel(first.task)
          else setTaskLabel('')
          if (typeof first.environment === 'string') setEnvironment(first.environment)
          if (typeof first.object === 'string') setObjectName(first.object)
          if (uniqActions.length > 0) setActions(() => mergeActions(baseActionsRef.current, uniqActions))
          setInteractions(loadedInteractions)

          userSelectedVideoRef.current = false
          userSelectedScenarioRef.current = false
          return
        }
        if (cancelled || !data) return
        if (typeof data.scenario_id === 'string') {
          const incomingScenario = data.scenario_id
          const canApplyIncoming = !userClearedScenario && !wasUserSelected && !userSelectedScenarioRef.current && (metadataOptions.length === 0 || metadataOptions.includes(incomingScenario))
          if (canApplyIncoming) setScenarioId(incomingScenario)
        }
        if (!wasUserSelected) {
          if (typeof data.video_id === 'string') setVideoId(data.video_id)
          else if (typeof data.video_filename === 'string') setVideoId(stripExtension(String(data.video_filename).split('/').pop() || ''))
        }
        userSelectedVideoRef.current = false
        userSelectedScenarioRef.current = false
        if (typeof data.task === 'string') setTaskLabel(data.task)
        else setTaskLabel('')
        if (typeof data.environment === 'string') setEnvironment(data.environment)
        if (typeof data.object === 'string') setObjectName(data.object)
        if (Array.isArray(data.actions) && data.actions.length > 0) {
          setActions(() => mergeActions(baseActionsRef.current, data.actions))
        }
        if (Array.isArray(data.interactions)) {
          setInteractions(data.interactions)
        }
      } catch (err: any) {
        const msg = typeof err?.message === 'string' ? err.message : ''
        if (!/404|Not found/i.test(msg)) {
          console.error('Failed to load annotation', err)
        }
      }
    }
    void tryLoadAnnotation()
    return () => {
      cancelled = true
    }
  }, [selectedVideoFile, metadataOptions, userClearedScenario])

  return { saveStatus, exportJSON }
}
