import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { fetchVideos, saveAnnotation, buildApiUrl, loadAnnotation, fetchActionLabels, updateActionLabels, fetchObjectLabels, updateObjectLabels } from './api'
import type { ActionLabelDictionary } from './api'
import LabelTimeline from './components/LabelTimeline'
import VideoPanel from './components/VideoPanel'
import PreviewPanel from './components/PreviewPanel'
import TimelineSection from './components/TimelineSection'
import ActionTable from './components/ActionTable'
import WaveformTimeline from './components/WaveformTimeline'
import { ensureLabelColors, getLabelColor, LabelColorMap } from './utils/colors'
import { mergeActions } from './utils/actions'
import SideMenu from './components/SideMenu'
import ConfigurationPanel from './components/ConfigurationPanel'
import { cloneLabelDictionary } from './utils/labelConfig'

type SaveStatus = {
  status: 'idle' | 'saving' | 'success' | 'error'
  message?: string
}

type ContextMenuState =
  | { open: false }
  | { open: true; x: number; y: number; type: 'interaction'; targetIndex: number }
  | { open: true; x: number; y: number; type: 'selection' }

interface Interaction {
  start_time: number
  end_time: number
  start_frame: number
  end_frame: number
  action_label: string
  contact: boolean
}

interface DragRange {
  start: number | null
  end: number | null
}

const DEFAULT_VIDEO_FPS = 30

type FpsSource = 'detected' | 'assumed'

type DurationDisplay = {
  primary: string
  secondary?: string
}

function buildDurationDisplay(seconds: number | null): DurationDisplay {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) {
    return { primary: '–' }
  }
  if (seconds < 60) {
    return { primary: `${seconds.toFixed(2)} s` }
  }
  const totalSeconds = Math.floor(seconds)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  const primary =
    hours > 0
      ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      : `${minutes}:${secs.toString().padStart(2, '0')}`
  const secondary = `${seconds.toFixed(2)} s`
  return { primary, secondary }
}

function tryExtractFrameRate(video: HTMLVideoElement): number | null {
  const anyVideo = video as any
  try {
    const tracks = anyVideo?.videoTracks
    if (tracks && tracks.length > 0) {
      const track = tracks[0]
      const direct = typeof track?.frameRate === 'number' ? track.frameRate : undefined
      const settingsFrameRate = typeof track?.getSettings === 'function' ? track.getSettings()?.frameRate : undefined
      const frameRate = direct ?? settingsFrameRate
      if (typeof frameRate === 'number' && Number.isFinite(frameRate) && frameRate > 0) {
        return frameRate
      }
    }
  } catch (_err) {
    // Ignore unsupported track APIs
  }

  try {
    const getQuality = (anyVideo as HTMLVideoElement).getVideoPlaybackQuality
    if (typeof getQuality === 'function') {
      const quality = getQuality.call(video)
      const totalFrames = quality?.totalVideoFrames
      const currentTime = video.currentTime
      if (typeof totalFrames === 'number' && totalFrames > 0 && currentTime > 1) {
        const approx = totalFrames / currentTime
        if (Number.isFinite(approx) && approx > 0) {
          return approx
        }
      }
    }
  } catch (_err) {
    // Ignore browsers without playback quality metrics
  }

  return null
}

function formatFpsValue(value: number | null): string {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return '–'
  }
  const rounded = Math.round(value * 100) / 100
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(2)
}

export default function App() {
  const initialLabelDictionary = useMemo(() => cloneLabelDictionary(), [])
  const initialActionList = useMemo(() => Object.keys(initialLabelDictionary), [initialLabelDictionary])

  const [scenarioId, setScenarioId] = useState('scene_001')
  const [videoId, setVideoId] = useState('vid_001')
  const [taskLabel, setTaskLabel] = useState('make coffee')
  const [environment, setEnvironment] = useState('kitchen')
  const [objectName, setObjectName] = useState('cup')
  const baseActionsRef = useRef<string[]>(initialActionList)
  const [actions, setActions] = useState<string[]>(initialActionList)
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [videoOptions, setVideoOptions] = useState<string[]>([])
  const [selectedVideoFile, setSelectedVideoFile] = useState('vid_001.mp4')
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ open: false })
  const [selectionMenuAction, setSelectionMenuAction] = useState(initialActionList[0] ?? '')
  const interactionMenuRef = useRef<HTMLDivElement | null>(null)
  const selectionMenuRef = useRef<HTMLDivElement | null>(null)

  const mainVideoRef = useRef<HTMLVideoElement | null>(null)
  const leftVideoRef = useRef<HTMLVideoElement | null>(null)
  const rightVideoRef = useRef<HTMLVideoElement | null>(null)

  const timelineRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const xScaleRef = useRef<d3.ScaleLinear<number, number> | null>(null)
  const brushRef = useRef<d3.BrushBehavior<unknown> | null>(null)
  const brushGroupRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null)
  const timeLineSelectionRef = useRef<d3.Selection<SVGLineElement, unknown, null, undefined> | null>(null)
  const scrubActiveRef = useRef(false)
  const hoverTimerRef = useRef<number | null>(null)
  const selectionMenuHideTimerRef = useRef<number | null>(null)
  const hoverTooltipTimerRef = useRef<number | null>(null)
  const configMenuRef = useRef<HTMLDivElement | null>(null)
  const customSelectRef = useRef<HTMLDivElement | null>(null)

  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const currentTimeRef = useRef(0)
  const [dragRange, setDragRange] = useState<DragRange>({ start: null, end: null })
  const [selectedAction, setSelectedAction] = useState(initialActionList[0] ?? '')
  const [contact, setContact] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ status: 'idle' })
  const [hoverInfo, setHoverInfo] = useState<{ visible: boolean; x: number; y: number; label: string; color: string; index: number | null }>({ visible: false, x: 0, y: 0, label: '', color: '#94a3b8', index: null })
  // Undo/Redo stacks for interactions
  const [undoStack, setUndoStack] = useState<Interaction[][]>([])
  const [redoStack, setRedoStack] = useState<Interaction[][]>([])
  // Audio controls for main video
  const [volume, setVolume] = useState(1) // 0.0 - 1.0
  const [muted, setMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [sideOpen, setSideOpen] = useState(false)
  const [activeScreen, setActiveScreen] = useState<'annotation' | 'configuration'>('annotation')
  const [videoDetails, setVideoDetails] = useState<{ width: number | null; height: number | null; fps: number | null; fpsSource: FpsSource }>({
    width: null,
    height: null,
    fps: null,
    fpsSource: 'assumed'
  })
  const [labelColors, setLabelColors] = useState<LabelColorMap>(() => ensureLabelColors(initialActionList, initialLabelDictionary))
  const [loadingActionLabels, setLoadingActionLabels] = useState(true)
  const [savingActionLabels, setSavingActionLabels] = useState(false)
  const [actionLabelError, setActionLabelError] = useState<string | null>(null)
  const [objectOptions, setObjectOptions] = useState<string[]>([])
  const [loadingObjectLabels, setLoadingObjectLabels] = useState(true)
  const [savingObjectLabels, setSavingObjectLabels] = useState(false)
  const [objectLabelError, setObjectLabelError] = useState<string | null>(null)
  const [newObjectName, setNewObjectName] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [addingNewObject, setAddingNewObject] = useState(false)

  const applyActionLabelDictionary = useCallback((dictionary: ActionLabelDictionary) => {
    let sanitized = cloneLabelDictionary(dictionary)
    if (Object.keys(sanitized).length === 0) {
      sanitized = cloneLabelDictionary(initialLabelDictionary)
    }
    const actionList = Object.keys(sanitized)
  baseActionsRef.current = actionList
    setActions(actionList)
    setLabelColors(() => ensureLabelColors(actionList, sanitized))
    setSelectedAction(prev => (actionList.includes(prev) ? prev : actionList[0] ?? ''))
    setSelectionMenuAction(prev => (actionList.includes(prev) ? prev : actionList[0] ?? ''))
    return { sanitized, actionList }
  }, [initialLabelDictionary])

  const loadActionLabels = useCallback(async () => {
    setLoadingActionLabels(true)
    try {
      const remote = await fetchActionLabels()
      const { sanitized } = applyActionLabelDictionary(remote)
      setActionLabelError(null)
      return sanitized
    } catch (err) {
      console.error('Failed to load action labels', err)
      const message = err instanceof Error ? err.message : 'Failed to load action labels.'
      setActionLabelError(message)
      throw err
    } finally {
      setLoadingActionLabels(false)
    }
  }, [applyActionLabelDictionary])

  const loadObjectLabels = useCallback(async () => {
    setLoadingObjectLabels(true)
    try {
      const remote = await fetchObjectLabels()
      const opts = Object.keys(remote)
      setObjectOptions(opts)
      // Ensure current objectName remains if present, else pick first
      setObjectName(prev => (opts.includes(prev) ? prev : opts[0] ?? prev))
      setObjectLabelError(null)
      return remote
    } catch (err) {
      console.error('Failed to load object labels', err)
      const message = err instanceof Error ? err.message : 'Failed to load object labels.'
      setObjectLabelError(message)
      throw err
    } finally {
      setLoadingObjectLabels(false)
    }
  }, [])

  const persistActionLabels = useCallback(async (next: ActionLabelDictionary, options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent)
    if (!silent) setSavingActionLabels(true)
    try {
      const updated = await updateActionLabels(next)
      const { sanitized } = applyActionLabelDictionary(updated)
      setActionLabelError(null)
      return sanitized
    } catch (err) {
      console.error('Failed to update action labels', err)
      const message = err instanceof Error ? err.message : 'Failed to update action labels.'
      setActionLabelError(message)
      throw err
    } finally {
      if (!silent) setSavingActionLabels(false)
    }
  }, [applyActionLabelDictionary])

  const reloadActionLabels = useCallback(() => {
    void loadActionLabels().catch(() => undefined)
  }, [loadActionLabels])

  useEffect(() => {
    void loadActionLabels().catch(() => undefined)
    void loadObjectLabels().catch(() => undefined)
  }, [loadActionLabels])

  // Close dropdown when clicking outside custom select
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!dropdownOpen) return
      const node = customSelectRef.current
      if (!node) return
      if (e.target instanceof Node && node.contains(e.target)) return
      setDropdownOpen(false)
      setAddingNewObject(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [dropdownOpen])

  useEffect(() => {
    setSaveStatus({ status: 'idle' })
  }, [])

  const startDisplay = dragRange.start !== null ? `${dragRange.start.toFixed(2)}s` : '-'
  const endDisplay = dragRange.end !== null ? `${dragRange.end.toFixed(2)}s` : '-'
  const lengthDisplay =
    dragRange.start !== null && dragRange.end !== null
      ? `${(dragRange.end - dragRange.start).toFixed(2)}s`
      : '-'
  const videoSource = selectedVideoFile ? buildApiUrl(`/video/${encodeURIComponent(selectedVideoFile)}`) : ''
  const durationDisplay = buildDurationDisplay(Number.isFinite(duration) && duration > 0 ? duration : null)
  const resolutionDisplay =
    videoDetails.width !== null && videoDetails.height !== null
      ? `${videoDetails.width} × ${videoDetails.height}`
      : '–'
  const fpsValueText = formatFpsValue(videoDetails.fps)
  const fpsDisplayPrimary = fpsValueText === '–' ? '–' : `${fpsValueText} fps`
  const fpsDisplaySecondary =
    fpsValueText === '–'
      ? undefined
      : videoDetails.fpsSource === 'assumed'
        ? `　Assumed default (${DEFAULT_VIDEO_FPS} fps)`
        : undefined
  const interactionCount = interactions.length

  // Collect all interactions that overlap the current time so VideoPanel can show multiple labels
  const activeInteractions = useMemo(() => {
    if (!Number.isFinite(currentTime)) return [] as Interaction[]
    return interactions.filter(interaction => interaction.start_time <= currentTime && currentTime <= interaction.end_time)
  }, [interactions, currentTime])

  const activeTimelineLabels = useMemo(() => {
    // Keep label order stable and unique
    const seen = new Set<string>()
    const out: string[] = []
    for (const it of activeInteractions) {
      const label = it.action_label
      if (!seen.has(label)) {
        seen.add(label)
        out.push(label)
      }
    }
    return out
  }, [activeInteractions])

  useEffect(() => {
    currentTimeRef.current = currentTime
  }, [currentTime])

  // Apply volume/mute to main video
  useEffect(() => {
    const v = mainVideoRef.current
    if (!v) return
    v.volume = Math.max(0, Math.min(1, volume))
    v.muted = muted
  }, [volume, muted, selectedVideoFile])

  // Apply playback rate to main video
  useEffect(() => {
    const v = mainVideoRef.current
    if (!v) return
    v.playbackRate = playbackRate
  }, [playbackRate, selectedVideoFile])

  useEffect(() => {
    if (actions.length === 0) {
      setSelectionMenuAction('')
      return
    }
    setSelectionMenuAction(prev => (actions.includes(prev) ? prev : actions[0]))
  }, [actions])

  useEffect(() => {
    setLabelColors(prev => ensureLabelColors(actions, prev))
  }, [actions])

  const switchScreen = (screen: 'annotation' | 'configuration') => {
    setActiveScreen(screen)
    setSideOpen(false)
    if (screen !== 'annotation') {
      setContextMenu({ open: false })
    }
  }

  useEffect(() => {
    if (!brushGroupRef.current || !brushRef.current) return
    const selectionNode = brushGroupRef.current.select<SVGRectElement>('.selection')
    if (selectionNode.empty()) return
    const hasRange = dragRange.start !== null && dragRange.end !== null
    selectionNode.style('cursor', hasRange ? 'pointer' : 'default')

    const node = selectionNode.node()
    if (!node) return

    const clearHoverTimer = () => {
      if (hoverTimerRef.current !== null) {
        window.clearTimeout(hoverTimerRef.current)
        hoverTimerRef.current = null
      }
    }

    const openHoverMenu = () => {
      if (!hasRange) return
      if (actions.length === 0) return
      const rect = node.getBoundingClientRect()
      const fallbackLabel = actions.includes(selectedAction) ? selectedAction : actions[0]
      setSelectionMenuAction(fallbackLabel)
      setContextMenu({
        open: true,
        x: rect.left + rect.width / 2,
        y: Math.max(rect.top - 12, 12),
        type: 'selection'
      })
    }

    const handlePointerEnter = () => {
      if (!hasRange) return
      if (contextMenu.open && contextMenu.type === 'interaction') return
      clearHoverTimer()
      if (selectionMenuHideTimerRef.current !== null) {
        window.clearTimeout(selectionMenuHideTimerRef.current)
        selectionMenuHideTimerRef.current = null
      }
      hoverTimerRef.current = window.setTimeout(() => {
        hoverTimerRef.current = null
        if (contextMenu.open && contextMenu.type === 'selection') return
        openHoverMenu()
      }, 500)
    }

    const handlePointerLeave = () => {
      clearHoverTimer()
      if (selectionMenuHideTimerRef.current !== null) {
        window.clearTimeout(selectionMenuHideTimerRef.current)
      }
      selectionMenuHideTimerRef.current = window.setTimeout(() => {
        if (contextMenu.open && contextMenu.type === 'selection') {
          closeContextMenu()
        }
        selectionMenuHideTimerRef.current = null
      }, 200)
    }

    const handlePointerDown = () => {
      clearHoverTimer()
    }

    selectionNode.on('pointerenter.selection-menu', handlePointerEnter)
    selectionNode.on('pointerleave.selection-menu', handlePointerLeave)
    selectionNode.on('pointerdown.selection-menu', handlePointerDown)

    return () => {
      clearHoverTimer()
      if (selectionMenuHideTimerRef.current !== null) {
        window.clearTimeout(selectionMenuHideTimerRef.current)
        selectionMenuHideTimerRef.current = null
      }
      selectionNode.on('pointerenter.selection-menu', null)
      selectionNode.on('pointerleave.selection-menu', null)
      selectionNode.on('pointerdown.selection-menu', null)
      selectionNode.style('cursor', 'default')
    }
  }, [dragRange, actions, selectedAction, contextMenu])

  const stripExtension = (file: string) => file.replace(/\.[^/.]+$/, '')

  useEffect(() => {
    let cancelled = false

    async function loadVideos() {
      try {
        const files = await fetchVideos()
        if (cancelled) return
        if (files.length === 0) {
          setVideoOptions(selectedVideoFile ? [selectedVideoFile] : [])
          return
        }
        setVideoOptions(files)
        if (!files.includes(selectedVideoFile)) {
          setSelectedVideoFile(files[0])
        }
      } catch (err) {
        console.error('Failed to fetch videos', err)
        if (!cancelled && selectedVideoFile) {
          setVideoOptions([selectedVideoFile])
        }
      }
    }
    loadVideos()
    return () => {
      cancelled = true
    }
  }, [selectedVideoFile])

  useEffect(() => {
    if (!selectedVideoFile) return
    const newId = stripExtension(selectedVideoFile)
    setVideoId(prev => (prev === newId ? prev : newId))
    setInteractions([])
    setUndoStack([])
    setRedoStack([])
    setDragRange({ start: null, end: null })
    setCurrentTime(0)
    setDuration(0)
    const refs = [mainVideoRef.current, leftVideoRef.current, rightVideoRef.current]
    refs.forEach(video => {
      if (!video) return
      video.pause()
      video.currentTime = 0
      video.load()
    })
  }, [selectedVideoFile])

  // Load saved annotation JSON for the selected video if available
  useEffect(() => {
    let cancelled = false
    async function tryLoadAnnotation() {
      try {
        if (!selectedVideoFile) return
        const base = stripExtension(selectedVideoFile)
        const data: any = await loadAnnotation(base)
        // Fallback: if the server returns array-form (new export format),
        // transform it into the legacy object shape the app expects.
        if (Array.isArray(data)) {
          // Helper to merge default actions with incoming actions (preserve order, no dups)
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
          const interactions = data
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

          // Populate form fields if present/derivable
          if (scenarioFromPath) setScenarioId(scenarioFromPath)
          setVideoId(videoIdFromPath)
          if (typeof first.task_label === 'string') setTaskLabel(first.task_label)
          if (typeof first.environment === 'string') setEnvironment(first.environment)
          if (typeof first.object === 'string') setObjectName(first.object)
          if (uniqActions.length > 0) setActions(() => mergeActions(baseActionsRef.current, uniqActions))
          setInteractions(interactions)
          return
        }
        if (cancelled || !data) return
        // Populate form fields if present
        if (typeof data.scenario_id === 'string') setScenarioId(data.scenario_id)
        if (typeof data.video_id === 'string') setVideoId(data.video_id)
        if (typeof data.task_label === 'string') setTaskLabel(data.task_label)
        if (typeof data.environment === 'string') setEnvironment(data.environment)
        if (typeof data.object === 'string') setObjectName(data.object)
        if (Array.isArray(data.actions) && data.actions.length > 0) {
          // Merge defaults with loaded actions so options never shrink
          setActions(() => mergeActions(baseActionsRef.current, data.actions))
        }
        if (Array.isArray(data.interactions)) {
          setInteractions(data.interactions)
        }
      } catch (err: any) {
        // 404 Not Found -> simply means there's no saved annotation yet; ignore quietly
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
  }, [selectedVideoFile])

  useEffect(() => {
    const v = mainVideoRef.current
    if (!v) return
    const refreshVideoMeta = () => {
      setVideoDetails(prev => {
        const width = v.videoWidth || null
        const height = v.videoHeight || null
        const extracted = tryExtractFrameRate(v)
        const fpsSource: FpsSource = extracted ? 'detected' : prev.fps != null ? prev.fpsSource : 'assumed'
        const fallbackFps = prev.fps != null ? prev.fps : DEFAULT_VIDEO_FPS
        const fpsValue = extracted ?? fallbackFps
        const normalizedFps = fpsValue != null && Number.isFinite(fpsValue) ? Math.round(fpsValue * 100) / 100 : null
        if (prev.width === width && prev.height === height && prev.fps === normalizedFps && prev.fpsSource === fpsSource) {
          return prev
        }
        return {
          width,
          height,
          fps: normalizedFps,
          fpsSource
        }
      })
    }

    const onLoaded = () => {
      setDuration(v.duration)
      refreshVideoMeta()
    }
    const onTime = () => {
      setCurrentTime(v.currentTime)
      refreshVideoMeta()
    }
    const onPlay = () => {
      refreshVideoMeta()
    }
    v.addEventListener('loadedmetadata', onLoaded)
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('play', onPlay)
    refreshVideoMeta()
    return () => {
      v.removeEventListener('loadedmetadata', onLoaded)
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('play', onPlay)
    }
  }, [selectedVideoFile])

  useEffect(() => {
    const lv = leftVideoRef.current
    const rv = rightVideoRef.current
    if (lv && dragRange.start !== null) {
      lv.currentTime = dragRange.start
    }
    if (rv && dragRange.end !== null) {
      rv.currentTime = dragRange.end
    }
  }, [dragRange])

  useEffect(() => {
    if (!timelineRef.current || !svgRef.current) return
    const totalWidth = Math.max(1, timelineRef.current.clientWidth)
    const margin = { left: 10, right: 30 }
    const innerWidth = Math.max(1, totalWidth - margin.left - margin.right)
  const height = 120
  // Adjustable display constants for the blue action bars
  const ACTION_BAR_HEIGHT = 18
  const ACTION_BAR_Y = 18 // ensure it stays well above the brush extent (currently starts at y=70)
  const ACTION_BAR_RADIUS = 8
    const svg = d3.select(svgRef.current)
    svg.attr('width', totalWidth).attr('height', height)
    svg.selectAll('*').remove()

    const x = d3
      .scaleLinear()
      .domain([0, Math.max(duration, 1)])
      .range([margin.left, margin.left + innerWidth])
    xScaleRef.current = x

    const axis = d3.axisBottom(x).ticks(8).tickFormat(d => `${d}s`)
    const axisGroup = svg
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${height - 20})`)
      .call(axis as any)
    // Make axis transparent to pointer and prevent text selection feel
    axisGroup.style('pointer-events', 'none')
    axisGroup.selectAll('text').style('user-select', 'none')

    const bars = svg
      .selectAll('.bar')
      .data(interactions)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', (d: Interaction) => x(d.start_time))
      .attr('y', ACTION_BAR_Y)
      .attr('width', (d: Interaction) => Math.max(2, x(d.end_time) - x(d.start_time)))
      .attr('height', ACTION_BAR_HEIGHT)
      .attr('rx', ACTION_BAR_RADIUS)
      .attr('ry', ACTION_BAR_RADIUS)
      .attr('fill', (d: Interaction) => getLabelColor(labelColors, d.action_label, '#2563eb'))
      .attr('opacity', 0.8)
      .on('click', (_, d: Interaction) => {
        const start = Number(d.start_time.toFixed(3))
        const end = Number(d.end_time.toFixed(3))
        setDragRange(prev => {
          if (prev.start === start && prev.end === end) return prev
          return { start, end }
        })
      })
      .on('contextmenu', (event: MouseEvent, d: Interaction) => {
        event.preventDefault()
        event.stopPropagation()
        const index = interactions.indexOf(d)
        if (index === -1) return
        setContextMenu({ open: true, x: event.clientX, y: event.clientY, type: 'interaction', targetIndex: index })
      })
      .on('pointerenter', (event: PointerEvent, d: Interaction) => {
        if (hoverTooltipTimerRef.current !== null) {
          window.clearTimeout(hoverTooltipTimerRef.current)
          hoverTooltipTimerRef.current = null
        }
        const index = interactions.indexOf(d)
        const rect = (event.target as Element).getBoundingClientRect()
        setHoverInfo({
          visible: true,
          x: rect.left + rect.width / 2,
          y: rect.top - 8,
          label: d.action_label,
          color: getLabelColor(labelColors, d.action_label, '#94a3b8'),
          index
        })
      })
      .on('pointerleave', () => {
        if (hoverTooltipTimerRef.current !== null) {
          window.clearTimeout(hoverTooltipTimerRef.current)
        }
        hoverTooltipTimerRef.current = window.setTimeout(() => {
          setHoverInfo(h => ({ ...h, visible: false }))
          hoverTooltipTimerRef.current = null
        }, 150)
      })

    const brush = d3
      .brushX()
      .extent([[margin.left, 70], [margin.left + innerWidth, 94]])
      .handleSize(12)
      .on('brush end', event => {
        if (!event.selection) {
          setDragRange(prev => {
            if (prev.start === null && prev.end === null) return prev
            return { start: null, end: null }
          })
          return
        }
        const [sx, ex] = event.selection as [number, number]
        const start = Number(x.invert(sx).toFixed(3))
        const end = Number(x.invert(ex).toFixed(3))
        if (end - start <= 0) {
          return
        }
        setDragRange(prev => {
          if (prev.start === start && prev.end === end) return prev
          return { start, end }
        })
      })

    brushRef.current = brush
    const brushGroup = svg.append('g').attr('class', 'brush').call(brush)
    brushGroup
      .select('.selection')
      .attr('fill', '#4ade80')
      .attr('fill-opacity', 0.25)
      .attr('stroke', 'none')
      .attr('rx', 4)
      .attr('ry', 4)
    // Make the overlay area visible and indicate it's draggable
    const overlay = brushGroup
      .select<SVGRectElement>('.overlay')
      .attr('fill', 'rgba(255, 255, 255, 0.12)')
      .attr('fill-opacity', 0.7)
      .attr('cursor', 'crosshair')
    // Subtle hover feedback for the interaction area
    overlay
      .on('pointerenter.overlay', () => overlay.attr('fill-opacity', 0.18))
      .on('pointerleave.overlay', () => overlay.attr('fill-opacity', 0.12))
    brushGroup
      .selectAll('.handle')
      .attr('fill', '#22c55e')
      .attr('stroke', '#0f172a')
      .attr('rx', 3)
      .attr('ry', 3)
    brushGroupRef.current = brushGroup

    // Helper text to hint the user before first selection
    const hintY = (80 + 94) / 2 // match current brush extent's midpoint
    const hint = svg
      .append('text')
      .attr('class', 'brush-hint')
      .attr('x', margin.left + innerWidth / 2)
      .attr('y', hintY)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(148, 163, 184, 0.9)')
      .attr('font-size', 12)
      .style('pointer-events', 'none')
      .style('user-select', 'none')
      .text('Drag to select')

    // When a selection is made for the first time, fade out the hint
    brush.on('end.hint', event => {
      if (event.selection && !hint.empty()) {
        hint.transition().duration(300).style('opacity', 0).on('end', () => hint.remove())
      }
    })

    const timeLineX = x(0)
    const timeLine = svg
      .append('line')
      .attr('y1', 6)
      .attr('y2', height - 6)
      .attr('x1', timeLineX)
      .attr('x2', timeLineX)
      .attr('stroke', '#f97316')
      .attr('stroke-width', 6)
      .attr('stroke-linecap', 'round')
      .attr('pointer-events', 'all')
      .style('cursor', 'ew-resize')
    timeLineSelectionRef.current = timeLine

    const domain = x.domain()
    const clampedInitial = Math.max(domain[0], Math.min(domain[1], currentTimeRef.current))
    if (Number.isFinite(clampedInitial)) {
      const initX = x(clampedInitial)
      timeLine.attr('x1', initX).attr('x2', initX)
    }

    const svgNode = svg.node()
    if (svgNode) {
      const seekFromPointer = (event: PointerEvent) => {
        if (!xScaleRef.current) return
        const [px] = d3.pointer(event, svgNode)
        const time = xScaleRef.current.invert(px)
        if (Number.isNaN(time)) return
        seekVideo(time)
      }

      svg.on('pointerdown.scrub', event => {
        const target = event.target as Element
        if (target.closest('.brush')) return
        if (target.classList && target.classList.contains('bar')) return
        const lineNode = timeLineSelectionRef.current ? timeLineSelectionRef.current.node() : null
        if (lineNode && target !== lineNode) return
        scrubActiveRef.current = true
        seekFromPointer(event as PointerEvent)
      })

      svg.on('pointermove.scrub', event => {
        if (!scrubActiveRef.current) return
        const pointerEvent = event as PointerEvent
        if (pointerEvent.buttons === 0) {
          scrubActiveRef.current = false
          return
        }
        seekFromPointer(pointerEvent)
      })

      const endScrub = () => {
        scrubActiveRef.current = false
      }

      svg.on('pointerup.scrub', endScrub)
      svg.on('pointerleave.scrub', endScrub)
    }

    return () => {
      xScaleRef.current = null
      brushRef.current = null
      brushGroupRef.current = null
      timeLineSelectionRef.current = null
      scrubActiveRef.current = false
      svg.on('.scrub', null)
    }
  }, [duration, interactions, labelColors])

  useEffect(() => {
    if (!brushRef.current || !brushGroupRef.current || !xScaleRef.current) return
    if (dragRange.start === null || dragRange.end === null || dragRange.start === dragRange.end) {
      brushGroupRef.current.call(brushRef.current.move as any, null)
      return
    }
    const startX = xScaleRef.current(dragRange.start)
    const endX = xScaleRef.current(dragRange.end)
    brushGroupRef.current.call(brushRef.current.move as any, [startX, endX])
  }, [dragRange])

  useEffect(() => {
    if (!timeLineSelectionRef.current || !xScaleRef.current) return
    const x = xScaleRef.current
    const domain = x.domain()
    const clamped = Math.max(domain[0], Math.min(domain[1], currentTime))
    const cx = x(clamped)
    timeLineSelectionRef.current.attr('x1', cx).attr('x2', cx)
  }, [currentTime])

  useEffect(() => {
    if (!contextMenu.open) return
    const handleClick = () => closeContextMenu()
    const handleEscape = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') closeContextMenu()
    }
    window.addEventListener('click', handleClick)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('click', handleClick)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [contextMenu.open])

  // Keep the selection menu centered over the brush selection while the range moves
  useEffect(() => {
    if (!contextMenu.open || contextMenu.type !== 'selection') return
    if (!brushGroupRef.current) return
    const selectionNode = brushGroupRef.current.select<SVGRectElement>('.selection')
    if (selectionNode.empty()) return
    const node = selectionNode.node()
    if (!node) return
    const rect = node.getBoundingClientRect()
    const newX = rect.left + rect.width / 2
    const newY = Math.max(rect.top - 12, 12)
    if (Math.abs(contextMenu.x - newX) > 0.5 || Math.abs(contextMenu.y - newY) > 0.5) {
      setContextMenu({ open: true, type: 'selection', x: newX, y: newY })
    }
  }, [dragRange, contextMenu])

  useEffect(() => {
    if (!contextMenu.open) return
    if (contextMenu.type !== 'interaction') return
    if (contextMenu.targetIndex >= interactions.length) {
      closeContextMenu()
    }
  }, [interactions, contextMenu])

  useEffect(() => {
    if (!contextMenu.open) return
    if (contextMenu.type !== 'selection') return
    if (dragRange.start === null || dragRange.end === null) {
      closeContextMenu()
    }
  }, [contextMenu, dragRange])

  useEffect(() => {
    if (!contextMenu.open) return
    const menuEl =
      contextMenu.type === 'interaction' ? interactionMenuRef.current : selectionMenuRef.current
    if (!menuEl) return
    menuEl.style.top = `${contextMenu.y}px`
    menuEl.style.left = `${contextMenu.x}px`
  }, [contextMenu])

  function seekVideo(time: number) {
    const video = mainVideoRef.current
    if (!video) return
    const maxDuration = Number.isFinite(duration) && duration > 0 ? duration : video.duration
    if (!Number.isFinite(maxDuration) || maxDuration <= 0) return
    const clamped = Math.max(0, Math.min(maxDuration, time))
    if (Number.isNaN(clamped)) return
    video.currentTime = clamped
    setCurrentTime(clamped)
  }

  function updateInteractionLabel(idx: number, label: string) {
    setInteractions(prev => {
      const next = prev.map((it, i) => (i === idx ? { ...it, action_label: label } : it))
      pushUndo(prev)
      setRedoStack([])
      return next
    })
  }

  function closeContextMenu() {
    setContextMenu({ open: false })
  }

  const normalizeHexColor = useCallback((value: string): string => {
    if (typeof value !== 'string') return '#94A3B8'
    let color = value.trim()
    if (!color) return '#94A3B8'
    if (!color.startsWith('#')) return color
    let hex = color.slice(1).toUpperCase()
    if (hex.length === 3) {
      hex = `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
    }
    if (hex.length !== 6) {
      hex = hex.padEnd(6, '0').slice(0, 6)
    }
    return `#${hex}`
  }, [])

  const handleChangeActionColor = useCallback(async (actionName: string, colorValue: string) => {
    const trimmed = actionName.trim()
    if (!trimmed) return
    if (loadingActionLabels || savingActionLabels) return
    const normalized = normalizeHexColor(colorValue)
    const currentColor = labelColors[trimmed]
    if (currentColor && currentColor.toUpperCase() === normalized.toUpperCase()) {
      return
    }
    const orderedLabels = baseActionsRef.current.length > 0 ? baseActionsRef.current : actions
    const optimisticMap: ActionLabelDictionary = { ...labelColors, [trimmed]: normalized }
    setLabelColors(prev => ensureLabelColors(orderedLabels, optimisticMap))
    const nextDictionary: ActionLabelDictionary = {}
    orderedLabels.forEach(label => {
      const existing = optimisticMap[label] ?? '#94A3B8'
      nextDictionary[label] = existing
    })
    try {
      await persistActionLabels(nextDictionary, { silent: true })
    } catch (err) {
      console.error('Failed to change action label color', err)
      void loadActionLabels().catch(() => undefined)
    }
  }, [actions, labelColors, loadActionLabels, loadingActionLabels, normalizeHexColor, persistActionLabels, savingActionLabels])

  const handleChangeObjectColor = useCallback(async (objectNameParam: string, colorValue: string) => {
    const trimmed = objectNameParam.trim()
    if (!trimmed) return
    if (loadingObjectLabels || savingObjectLabels) return
    const normalized = normalizeHexColor(colorValue)
    // optimistic update: update objectOptions colors not stored locally here; persist via API
    const nextDictionary: ActionLabelDictionary = {}
    objectOptions.forEach(o => {
      nextDictionary[o] = '#94A3B8'
    })
    nextDictionary[trimmed] = normalized
    try {
      setSavingObjectLabels(true)
      await updateObjectLabels(nextDictionary)
      setObjectLabelError(null)
    } catch (err) {
      console.error('Failed to change object label color', err)
      setObjectLabelError(err instanceof Error ? err.message : 'Failed to change object label color')
      void loadObjectLabels().catch(() => undefined)
    } finally {
      setSavingObjectLabels(false)
    }
  }, [loadingObjectLabels, objectOptions, normalizeHexColor, savingObjectLabels])

  const handleAddAction = useCallback(async (): Promise<string | null> => {
    if (loadingActionLabels || savingActionLabels) return null
    const baseName = 'None'
    const ordered = baseActionsRef.current.length > 0 ? [...baseActionsRef.current] : [...actions]
    let candidate = baseName
    let suffix = 2
    while (ordered.includes(candidate)) {
      candidate = `${baseName} ${suffix}`
      suffix += 1
    }

    const prevActionsList = [...actions]
    const prevLabelMap = { ...labelColors }
    const prevBaseActions = [...ordered]

    const nextOrder = [...ordered, candidate]
    const nextColors = { ...labelColors, [candidate]: '#FFFFFF' }

    baseActionsRef.current = nextOrder
    setActions(nextOrder)
    setLabelColors(ensureLabelColors(nextOrder, nextColors))
    setActionLabelError(null)

    const nextDictionary: ActionLabelDictionary = {}
    nextOrder.forEach(label => {
      if (label === candidate) {
        nextDictionary[label] = '#FFFFFF'
      } else {
        const color = labelColors[label] ?? '#94A3B8'
        nextDictionary[label] = color
      }
    })

    try {
      await persistActionLabels(nextDictionary)
      return candidate
    } catch (err) {
      console.error('Failed to add action label', err)
      baseActionsRef.current = prevBaseActions
      setActions(prevActionsList)
      setLabelColors(ensureLabelColors(prevBaseActions, prevLabelMap))
      setActionLabelError(err instanceof Error ? err.message : 'Failed to add action label.')
      return null
    }
  }, [actions, labelColors, loadingActionLabels, persistActionLabels, savingActionLabels])

  // Add a new object label. If rawName is provided, try to use it (if not duplicate).
  const handleAddObject = useCallback(async (rawName?: string): Promise<string | null> => {
    if (loadingObjectLabels || savingObjectLabels) return null
    const baseName = 'Object'
    const ordered = [...objectOptions]
    let candidate: string
    const provided = typeof rawName === 'string' ? rawName.trim() : ''
    if (provided) {
      if (ordered.includes(provided)) {
        // already exists
        return provided
      }
      candidate = provided
    } else {
      candidate = baseName
      let suffix = 2
      while (ordered.includes(candidate)) {
        candidate = `${baseName} ${suffix}`
        suffix += 1
      }
    }

    const prev = [...objectOptions]
    const nextOrder = [...ordered, candidate]
    setObjectOptions(nextOrder)
    try {
      setSavingObjectLabels(true)
      const nextDictionary: ActionLabelDictionary = {}
      nextOrder.forEach(label => {
        nextDictionary[label] = '#94A3B8'
      })
      await updateObjectLabels(nextDictionary)
      setObjectLabelError(null)
      setObjectName(candidate)
      return candidate
    } catch (err) {
      console.error('Failed to add object label', err)
      setObjectOptions(prev)
      setObjectLabelError(err instanceof Error ? err.message : 'Failed to add object label')
      return null
    } finally {
      setSavingObjectLabels(false)
    }
  }, [loadingObjectLabels, objectOptions, savingObjectLabels])

  const handleRenameAction = useCallback(async (previousName: string, rawNextName: string): Promise<boolean> => {
    if (loadingActionLabels || savingActionLabels) return false
    const trimmed = rawNextName.trim()
    const current = previousName.trim()
    if (!current) return false
    if (!trimmed) {
      setActionLabelError('Label name cannot be empty.')
      return false
    }
    if (trimmed === current) {
      return true
    }

    const ordered = baseActionsRef.current.length > 0 ? [...baseActionsRef.current] : [...actions]
    if (!ordered.includes(current)) {
      setActionLabelError('Original label could not be found.')
      return false
    }
    if (ordered.includes(trimmed)) {
      setActionLabelError('A label with that name already exists.')
      return false
    }

    const prevBaseActions = [...ordered]
    const prevActionsList = [...actions]
    const prevLabelMap = { ...labelColors }
    const prevInteractions = interactions.map(item => ({ ...item }))
    const prevUndoStack = undoStack.map(history => history.map(item => ({ ...item })))
    const prevRedoStack = redoStack.map(history => history.map(item => ({ ...item })))
    const prevSelected = selectedAction
    const prevSelectionMenu = selectionMenuAction
    const prevHover = hoverInfo

    const nextOrder = ordered.map(label => (label === current ? trimmed : label))
    const renamedColor = labelColors[current] ?? '#94A3B8'
    const nextDictionary: ActionLabelDictionary = {}
    nextOrder.forEach(label => {
      if (label === trimmed) {
        nextDictionary[label] = renamedColor
      } else {
        const color = labelColors[label] ?? '#94A3B8'
        nextDictionary[label] = color
      }
    })

    baseActionsRef.current = nextOrder
    setActions(nextOrder)
    setLabelColors(prev => {
      const next = { ...prev }
      const stored = next[current]
      delete next[current]
      next[trimmed] = stored ?? renamedColor
      return ensureLabelColors(nextOrder, next)
    })
    setInteractions(prev => prev.map(item => (item.action_label === current ? { ...item, action_label: trimmed } : item)))
    setUndoStack(prev => prev.map(history => history.map(item => (item.action_label === current ? { ...item, action_label: trimmed } : item))))
    setRedoStack(prev => prev.map(history => history.map(item => (item.action_label === current ? { ...item, action_label: trimmed } : item))))
    setSelectedAction(prev => (prev === current ? trimmed : prev))
    setSelectionMenuAction(prev => (prev === current ? trimmed : prev))
    setHoverInfo(prev => (prev.label === current ? { ...prev, label: trimmed, color: renamedColor } : prev))
    setActionLabelError(null)

    try {
      await persistActionLabels(nextDictionary)
      return true
    } catch (err) {
      console.error('Failed to rename action label', err)
      baseActionsRef.current = prevBaseActions
      setActions(prevActionsList)
      setLabelColors(ensureLabelColors(prevBaseActions, prevLabelMap))
      setInteractions(prevInteractions)
      setUndoStack(prevUndoStack)
      setRedoStack(prevRedoStack)
      setSelectedAction(prevSelected)
      setSelectionMenuAction(prevSelectionMenu)
      setHoverInfo(prevHover)
      setActionLabelError(err instanceof Error ? err.message : 'Failed to rename action label.')
      return false
    }
  }, [actions, hoverInfo, interactions, labelColors, loadingActionLabels, persistActionLabels, redoStack, savingActionLabels, selectedAction, selectionMenuAction, undoStack])

  const handleRenameObject = useCallback(async (previousName: string, rawNextName: string): Promise<boolean> => {
    if (loadingObjectLabels || savingObjectLabels) return false
    const trimmed = rawNextName.trim()
    const current = previousName.trim()
    if (!current) return false
    if (!trimmed) return false
    if (trimmed === current) return true
    if (!objectOptions.includes(current)) return false
    if (objectOptions.includes(trimmed)) return false

    const prev = [...objectOptions]
    const nextOrder = prev.map(o => (o === current ? trimmed : o))
    setObjectOptions(nextOrder)
    try {
      const nextDictionary: ActionLabelDictionary = {}
      nextOrder.forEach(label => { nextDictionary[label] = '#94A3B8' })
      await updateObjectLabels(nextDictionary)
      setObjectLabelError(null)
      if (objectName === current) setObjectName(trimmed)
      return true
    } catch (err) {
      console.error('Failed to rename object label', err)
      setObjectOptions(prev)
      setObjectLabelError(err instanceof Error ? err.message : 'Failed to rename object label')
      return false
    }
  }, [loadingObjectLabels, objectName, objectOptions, savingObjectLabels])

  const handleRemoveObject = useCallback(async (name: string) => {
    if (loadingObjectLabels || savingObjectLabels) return
    if (!objectOptions.includes(name)) return
    if (objectOptions.length <= 1) {
      setObjectLabelError('At least one object label must remain.')
      return
    }
    const prev = [...objectOptions]
    const next = prev.filter(o => o !== name)
    try {
      const nextDictionary: ActionLabelDictionary = {}
      next.forEach(label => { nextDictionary[label] = '#94A3B8' })
      await updateObjectLabels(nextDictionary)
      setObjectOptions(next)
      setObjectLabelError(null)
      if (objectName === name) setObjectName(next[0] ?? '')
    } catch (err) {
      console.error('Failed to remove object label', err)
      setObjectLabelError(err instanceof Error ? err.message : 'Failed to remove object label')
    }
  }, [loadingObjectLabels, objectName, objectOptions, savingObjectLabels])

  async function handleRemoveAction(actionName: string) {
    const trimmed = actionName.trim()
    if (!trimmed) return
    if (loadingActionLabels || savingActionLabels) return
    if (!actions.includes(trimmed)) return
    if (actions.length <= 1) {
      setActionLabelError('At least one action label must remain.')
      return
    }
    const nextDictionary: ActionLabelDictionary = {}
    actions.forEach(label => {
      if (label === trimmed) return
      const color = labelColors[label]
      if (typeof color === 'string' && color.trim()) {
        nextDictionary[label] = color
      }
    })
    try {
      await persistActionLabels(nextDictionary)
      setInteractions(prev => prev.filter(interaction => interaction.action_label !== trimmed))
      setUndoStack([])
      setRedoStack([])
      setContextMenu({ open: false })
      setHoverInfo(info => (info.visible && info.label === trimmed ? { ...info, visible: false } : info))
    } catch (err) {
      console.error('Failed to remove action label', err)
    }
  }

  const handleConfigWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const node = configMenuRef.current
    if (!node) return
    const deltaY = event.deltaY
    const deltaX = event.deltaX
    if (deltaY === 0 && deltaX === 0) return

    event.preventDefault()
    event.stopPropagation()

    const maxScrollTop = node.scrollHeight - node.clientHeight
    if (maxScrollTop > 0) {
      node.scrollTop = Math.min(Math.max(node.scrollTop + deltaY, 0), maxScrollTop)
    }
  }

  function addInteraction(labelOverride?: string) {
    if (dragRange.start === null || dragRange.end === null) return
    const actionLabel = labelOverride ?? selectedAction
    if (!actionLabel) return
    const start = Number(dragRange.start.toFixed(3))
    const end = Number(dragRange.end.toFixed(3))
    const fps = 30
    const inter: Interaction = {
      start_time: start,
      end_time: end,
      start_frame: Math.round(start * fps),
      end_frame: Math.round(end * fps),
      action_label: actionLabel,
      contact: contact
    }
    setInteractions(prev => {
      const next = [...prev, inter]
      pushUndo(prev)
      setRedoStack([])
      return next
    })
    setDragRange({ start: null, end: null })
  }

  function removeInteraction(idx: number) {
    setInteractions(prev => {
      const next = prev.filter((_, i) => i !== idx)
      pushUndo(prev)
      setRedoStack([])
      return next
    })
  }

  function cloneInteractions(list: Interaction[]): Interaction[] {
    return list.map(it => ({ ...it }))
  }

  function pushUndo(current: Interaction[]) {
    setUndoStack(stack => [...stack, cloneInteractions(current)])
  }

  function undo() {
    setUndoStack(stack => {
      if (stack.length === 0) return stack
      setInteractions(current => {
        const prev = stack[stack.length - 1]
        setRedoStack(r => [...r, cloneInteractions(current)])
        return cloneInteractions(prev)
      })
      return stack.slice(0, -1)
    })
  }

  function redo() {
    setRedoStack(stack => {
      if (stack.length === 0) return stack
      setInteractions(current => {
        const next = stack[stack.length - 1]
        setUndoStack(u => [...u, cloneInteractions(current)])
        return cloneInteractions(next)
      })
      return stack.slice(0, -1)
    })
  }

  // Optional: Keyboard shortcuts for undo/redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrlOrMeta = e.ctrlKey || e.metaKey
      if (!ctrlOrMeta) return
      if (e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault()
          redo()
        } else {
          e.preventDefault()
          undo()
        }
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function exportJSON() {
  setSaveStatus({ status: 'saving', message: 'Saving…' })
    const payload = {
      scenario_id: scenarioId,
      video_id: videoId,
      video_filename: selectedVideoFile,
      task_label: taskLabel,
      environment: environment,
      object: objectName,
      actions: actions,
      interactions: interactions
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
  }

  useEffect(() => {
    if (saveStatus.status === 'success' || saveStatus.status === 'error') {
      const timer = window.setTimeout(() => setSaveStatus({ status: 'idle' }), 3000)
      return () => window.clearTimeout(timer)
    }
    return
  }, [saveStatus])

  return (
    <div className="app">
      <div className="header">
        {/* Hamburger (top-left) */}
        <button
          className={`icon-button header-hamburger with-tooltip${sideOpen ? ' is-open' : ''}`}
          aria-label="Toggle menu"
          data-tooltip="Menu"
          onClick={() => setSideOpen(prev => !prev)}
          type="button"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="#0b1220" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="title">📽 Video Annotator</div>
        <div className="header-right">
          <button
            className="icon-button with-tooltip"
            aria-label="Undo"
            data-tooltip="Undo (Ctrl/Cmd+Z)"
            onClick={undo}
            disabled={undoStack.length === 0}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5H7l3-3M7 5l3 3M7 5h5a7 7 0 110 14h-2" fill="none" stroke="#0b1220" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            className="icon-button with-tooltip"
            aria-label="Redo"
            data-tooltip="Redo (Ctrl/Cmd+Shift+Z / Ctrl+Y)"
            onClick={redo}
            disabled={redoStack.length === 0}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5h5l-3-3M17 5l-3 3M17 5h-5a7 7 0 100 14h2" fill="none" stroke="#0b1220" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {videoOptions.length > 0 && (
            <label className="video-picker">
              <span>Video</span>
              <select value={selectedVideoFile} onChange={e => setSelectedVideoFile(e.target.value)}>
                {videoOptions.map(file => (
                  <option key={file} value={file}>
                    {file}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {/* Hover tooltip for bars */}
        {hoverInfo.visible && (
          <div
            className="bar-tooltip"
            style={{ position: 'fixed', top: hoverInfo.y, left: hoverInfo.x, transform: 'translate(-50%, -100%)', zIndex: 1200 }}
            onMouseEnter={() => {
              if (hoverTooltipTimerRef.current !== null) {
                window.clearTimeout(hoverTooltipTimerRef.current)
                hoverTooltipTimerRef.current = null
              }
            }}
            onMouseLeave={() => {
              setHoverInfo(h => ({ ...h, visible: false }))
            }}
          >
            <div className="bar-tooltip-content" style={{ background: 'rgba(24,26,29,0.95)', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>
              <span className="bar-tooltip-dot" style={{ width: 10, height: 10, borderRadius: '50%', background: hoverInfo.color }} />
              <span className="bar-tooltip-label" style={{ fontSize: 12, fontWeight: 600, color: '#e6eef8' }}>{hoverInfo.label}</span>
              {hoverInfo.index !== null && (
                <button
                  className="button"
                  onClick={() => {
                    if (hoverInfo.index === null) return
                    removeInteraction(hoverInfo.index)
                    setHoverInfo(h => ({ ...h, visible: false }))
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Side Drawer */}
      <SideMenu open={sideOpen} onClose={() => setSideOpen(false)} title="Menu">
        <div className="side-menu-stack">
          <div className="side-menu-nav">
            <button
              type="button"
              aria-pressed={activeScreen === 'annotation'}
              className={`menu-switch-button${activeScreen === 'annotation' ? ' active' : ''}`}
              onClick={() => switchScreen('annotation')}
            >
              <span className="menu-switch-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="14" rx="2" ry="2" />
                  <path d="M8 9l2 2-2 2" />
                  <path d="M12 13h4" />
                </svg>
              </span>
              <span className="menu-switch-text">Annotation</span>
            </button>
            <button
              type="button"
              aria-pressed={activeScreen === 'configuration'}
              className={`menu-switch-button${activeScreen === 'configuration' ? ' active' : ''}`}
              onClick={() => switchScreen('configuration')}
            >
              <span className="menu-switch-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>
              </span>
              <span className="menu-switch-text">Configuration</span>
            </button>
          </div>

          {videoOptions.length > 0 && (
            <label className="video-picker">
              <span>Video</span>
              <select value={selectedVideoFile} onChange={e => setSelectedVideoFile(e.target.value)}>
                {videoOptions.map(file => (
                  <option key={file} value={file}>
                    {file}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="side-menu-section">
            <div className="side-menu-section-title">Current Video</div>
            <dl className="side-menu-meta-grid">
              <div className="side-menu-meta-row">
                <dt className="side-menu-meta-label">Filename</dt>
                <dd className="side-menu-meta-value">{selectedVideoFile || '–'}</dd>
              </div>
              <div className="side-menu-meta-row">
                <dt className="side-menu-meta-label">Duration</dt>
                <dd className="side-menu-meta-value">
                  {durationDisplay.primary}
                  {durationDisplay.secondary && (
                    <span className="side-menu-meta-secondary">{durationDisplay.secondary}</span>
                  )}
                </dd>
              </div>
              <div className="side-menu-meta-row">
                <dt className="side-menu-meta-label">Resolution</dt>
                <dd className="side-menu-meta-value">{resolutionDisplay}</dd>
              </div>
              <div className="side-menu-meta-row">
                <dt className="side-menu-meta-label">FPS</dt>
                <dd className="side-menu-meta-value">
                  {fpsDisplayPrimary}
                  {fpsDisplaySecondary && (
                    <span className="side-menu-meta-secondary">{fpsDisplaySecondary}</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <div className="side-menu-section">
            <div className="side-menu-section-title">Annotation</div>
            <dl className="side-menu-meta-grid">
              <div className="side-menu-meta-row">
                <dt className="side-menu-meta-label">Labels</dt>
                <dd className="side-menu-meta-value">{actions.length}</dd>
              </div>
              <div className="side-menu-meta-row">
                <dt className="side-menu-meta-label">Interactions</dt>
                <dd className="side-menu-meta-value">{interactionCount}</dd>
              </div>
            </dl>
          </div>
        </div>
      </SideMenu>

      {activeScreen === 'configuration' && (
        <div
          className="config-floating-menu"
          role="dialog"
          aria-label="Configuration panel"
          ref={configMenuRef}
          onWheel={handleConfigWheel}
        >
          <button
            type="button"
            className="config-floating-close"
            aria-label="Close configuration"
            onClick={() => setActiveScreen('annotation')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          </button>
          <ConfigurationPanel
            actions={actions}
            labelColors={labelColors}
            onRemoveAction={handleRemoveAction}
            onChangeColor={handleChangeActionColor}
            onAddAction={handleAddAction}
            onRenameAction={handleRenameAction}
            loading={loadingActionLabels}
            saving={savingActionLabels}
            error={actionLabelError}
            onRetry={reloadActionLabels}
            // object label management
            // @ts-ignore - additional props consumed by extended panel
            objectOptions={objectOptions}
            // @ts-ignore
            onRemoveObject={handleRemoveObject}
            // @ts-ignore
            onChangeObjectColor={handleChangeObjectColor}
            // @ts-ignore
            onAddObject={handleAddObject}
            // @ts-ignore
            onRenameObject={handleRenameObject}
            // @ts-ignore
            loadingObjectLabels={loadingObjectLabels}
            // @ts-ignore
            savingObjectLabels={savingObjectLabels}
            // @ts-ignore
            objectLabelError={objectLabelError}
            // @ts-ignore
            onRetryObject={loadObjectLabels}
          />
        </div>
      )}

      <div className="action-form">
        <label>
          <span>Scenario</span>
          <input className="input" value={scenarioId} onChange={e => setScenarioId(e.target.value)} />
        </label>
        <label>
          <span>Task</span>
          <input className="input" value={taskLabel} onChange={e => setTaskLabel(e.target.value)} />
        </label>
        <label>
          <span>Environment</span>
          <input className="input" value={environment} onChange={e => setEnvironment(e.target.value)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Object</span>
          <div style={{ position: 'relative' }}>
            {/* Custom dropdown: shows selected value, opens list on click. Uses outside-click handler to close. */}
            <div className="custom-select" ref={customSelectRef}>
              <button
                type="button"
                className="input custom-select-trigger"
                onClick={() => setDropdownOpen(prev => !prev)}
                aria-haspopup="listbox"
                aria-expanded={dropdownOpen}
              >
                <span className="custom-select-value">{objectName || '—'}</span>
                <span className="custom-select-caret">▾</span>
              </button>
              {dropdownOpen && (
                <div className="custom-select-list" role="listbox" onMouseDown={e => e.stopPropagation()}>
                  {objectOptions.map(o => (
                    <button
                      key={o}
                      type="button"
                      className={`custom-select-option${o === objectName ? ' is-selected' : ''}`}
                      onClick={() => {
                        setObjectName(o)
                        setDropdownOpen(false)
                      }}
                    >
                      {o}
                    </button>
                  ))}
                  {/* Add row */}
                  {!addingNewObject && (
                    <button
                      type="button"
                      className="custom-select-add"
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => {
                        e.preventDefault()
                        e.stopPropagation()
                        // Ensure dropdown stays open and we enter add-mode immediately
                        setAddingNewObject(true)
                        setDropdownOpen(true)
                        // focus will be handled by the input's autoFocus after render
                      }}
                    >
                      + Add object
                    </button>
                  )}
                  {addingNewObject && (
                    <div className="custom-select-add-row">
                      <input
                        className="input"
                        placeholder="New object"
                        value={newObjectName}
                        onChange={e => setNewObjectName(e.target.value)}
                        onKeyDown={async e => {
                          if (e.key === 'Enter') {
                            const val = newObjectName.trim()
                            if (!val) return
                            const added = await handleAddObject(val)
                            if (typeof added === 'string') {
                              setNewObjectName('')
                              setAddingNewObject(false)
                              setDropdownOpen(false)
                            }
                          } else if (e.key === 'Escape') {
                            setNewObjectName('')
                            setAddingNewObject(false)
                          }
                        }}
                        autoFocus
                        onBlur={() => {
                          // keep editing until Enter or explicit cancel via Escape; blur should close only if not adding
                          // small timeout to allow click handlers to run
                          setTimeout(() => {
                            if (addingNewObject) return
                            setDropdownOpen(false)
                          }, 120)
                        }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="button"
                          type="button"
                          onClick={async () => {
                            const val = newObjectName.trim()
                            if (!val) return
                            const added = await handleAddObject(val)
                            if (typeof added === 'string') {
                              setNewObjectName('')
                              setAddingNewObject(false)
                              setDropdownOpen(false)
                            }
                          }}
                          disabled={loadingObjectLabels || savingObjectLabels}
                        >Add</button>
                        <button
                          className="button"
                          type="button"
                          onClick={() => {
                            setNewObjectName('')
                            setAddingNewObject(false)
                          }}
                        >Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </label>
      </div>

      <div className="main">
        <div className="left-col">
          <PreviewPanel
            title="Start Preview"
            videoKey={`start-${selectedVideoFile}`}
            videoRef={leftVideoRef}
            src={videoSource}
            timeLabel={`Start: ${dragRange.start !== null ? `${dragRange.start.toFixed(2)}s` : '-'}`}
          />
          <PreviewPanel
            title="End Preview"
            videoKey={`end-${selectedVideoFile}`}
            videoRef={rightVideoRef}
            src={videoSource}
            timeLabel={`End: ${dragRange.end !== null ? `${dragRange.end.toFixed(2)}s` : '-'}`}
          />
        </div>
        <div className="center-col">
          <VideoPanel
            videoKey={`main-${selectedVideoFile}`}
            videoRef={mainVideoRef}
            src={videoSource}
            currentTime={currentTime}
            duration={duration}
            volume={volume}
            muted={muted}
            onVolumeChange={setVolume}
            onToggleMute={() => setMuted(m => !m)}
            playbackRate={playbackRate}
            onPlaybackRateChange={setPlaybackRate}
            activeLabels={activeTimelineLabels.length > 0 ? activeTimelineLabels : undefined}
            activeColors={activeTimelineLabels.length > 0 ? activeTimelineLabels.map(l => getLabelColor(labelColors, l, '#94A3B8')) : undefined}
          />

          <TimelineSection
            timelineRef={timelineRef}
            svgRef={svgRef}
            startDisplay={startDisplay}
            endDisplay={endDisplay}
            lengthDisplay={lengthDisplay}
            actions={actions}
            selectedAction={selectedAction}
            onSelectedActionChange={setSelectedAction}
            contact={contact}
            onContactChange={setContact}
            onAddInteraction={() => addInteraction()}
            onExport={exportJSON}
            saveStatus={saveStatus}
          />

          <div className="waveform-block">
            <div className="panel-title">Waveform</div>
            <WaveformTimeline
              audioSrc={videoSource}
              currentTime={currentTime}
              durationOverride={duration}
              onSeek={seekVideo}
              className="waveform-panel"
            />
          </div>

          <LabelTimeline duration={duration} interactions={interactions} labelColors={labelColors} />

          <ActionTable interactions={interactions} onRemove={removeInteraction} />
        </div>
      </div>

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
          onClick={e => e.stopPropagation()}
          onContextMenu={e => e.preventDefault()}
          onMouseEnter={() => {
            if (selectionMenuHideTimerRef.current !== null) {
              window.clearTimeout(selectionMenuHideTimerRef.current)
              selectionMenuHideTimerRef.current = null
            }
          }}
          onMouseLeave={() => {
            if (selectionMenuHideTimerRef.current !== null) {
              window.clearTimeout(selectionMenuHideTimerRef.current)
            }
            selectionMenuHideTimerRef.current = window.setTimeout(() => {
              if (contextMenu.open && contextMenu.type === 'selection') closeContextMenu()
              selectionMenuHideTimerRef.current = null
            }, 500)
          }}
        >
          <div className="context-menu-title">Label</div>
          <div className="selection-menu-row">
            <div className="selection-select">
              <select
                value={selectionMenuAction}
                aria-label="Selection label"
                onChange={e => setSelectionMenuAction(e.target.value)}
                autoFocus
              >
                {actions.map(a => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <label className="timeline-toggle selection-toggle">
              <span className="timeline-toggle-label">Contact</span>
              <input
                className="toggle-checkbox"
                type="checkbox"
                checked={contact}
                onChange={(e)=> setContact(e.target.checked)}
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

      {/* Floating Export button at bottom-left */}
      <div className="fab-export-left">
        <button className="button" onClick={exportJSON} disabled={saveStatus.status === 'saving'}>
          {saveStatus.status === 'saving' ? 'Saving…' : 'Export JSON'}
        </button>
        {saveStatus.status !== 'idle' && (
          <span
            className={`fab-save-status save-status-${saveStatus.status} ${
              saveStatus.status === 'success' || saveStatus.status === 'error' ? 'fade-auto-hide' : ''
            }`}
          >
            {saveStatus.status === 'saving'
              ? 'Saving…'
              : saveStatus.message ?? (saveStatus.status === 'success' ? 'Saved successfully.' : 'Failed to save annotation.')}
          </span>
        )}
      </div>

      {/* Volume controls moved inside VideoPanel next to Play/Pause */}
    </div>
  )
}
