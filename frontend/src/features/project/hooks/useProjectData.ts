import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchMetadata, fetchMetadataItem, fetchVideos } from '../../../api'
import type { UseProjectDataResult } from '../types'

export function useProjectData(): UseProjectDataResult {
  const [scenarioId, setScenarioId] = useState('')
  const [userClearedScenario, setUserClearedScenario] = useState(false)
  const [videoOptions, setVideoOptions] = useState<string[]>([])
  const [metadataOptions, setMetadataOptions] = useState<string[]>([])
  const [restrictToMetadata, setRestrictToMetadata] = useState(false)
  const scenarioSelectRef = useRef<HTMLDivElement | null>(null)
  const [scenarioDropdownOpen, setScenarioDropdownOpen] = useState(false)
  const userSelectedScenarioRef = useRef(false)
  const userSelectedVideoRef = useRef(false)
  const [selectedVideoFile, setSelectedVideoFile] = useState('')
  const [referenceVideoFiles, setReferenceVideoFiles] = useState<string[]>([])
  const [referenceVisibility, setReferenceVisibility] = useState<Record<string, boolean>>({})
  const [showReference, setShowReference] = useState(true)
  const [swapRefFile, setSwapRefFile] = useState<string | null>(null)

  useEffect(() => {
    void fetchMetadata()
      .then(list => {
        if (Array.isArray(list) && list.length > 0) {
          setMetadataOptions(list)
          setScenarioId(prev => {
            if (userClearedScenario) return prev
            return prev && list.includes(prev) ? prev : ''
          })
        }
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!scenarioId) return
    let cancelled = false
    void fetchMetadataItem(scenarioId)
      .then((meta: any) => {
        if (cancelled) return
        if (meta && Array.isArray(meta.target_videos) && meta.target_videos.length > 0) {
          const opts = meta.target_videos.map((p: string) => String(p).replace(/^\//, ''))
          setVideoOptions(opts)
          setSelectedVideoFile(prev => (opts.includes(prev) ? prev : opts[0]))
          const ref = (meta as any).reference_video
          let refArr: string[] = []
          if (typeof ref === 'string' && ref.trim()) {
            refArr = [String(ref).replace(/^\//, '')]
          } else if (Array.isArray(ref) && ref.length > 0) {
            refArr = ref
              .map((p: any) => (typeof p === 'string' ? String(p).replace(/^\/\//, '') : ''))
              .filter((p: string) => p)
          } else {
            refArr = []
          }
          setReferenceVideoFiles(refArr)
          const vis: Record<string, boolean> = {}
          refArr.forEach(f => (vis[f] = true))
          setReferenceVisibility(vis)
          setRestrictToMetadata(true)
        } else {
          setReferenceVideoFiles([])
          setRestrictToMetadata(false)
          void fetchVideos().then(files => setVideoOptions(files)).catch(() => { })
        }
      })
      .catch(() => {
        setRestrictToMetadata(false)
        void fetchVideos().then(files => setVideoOptions(files)).catch(() => { })
      })
    return () => {
      cancelled = true
    }
  }, [scenarioId])

  useEffect(() => {
    let cancelled = false

    async function loadVideos() {
      if (restrictToMetadata) return
      try {
        const files = await fetchVideos()
        if (cancelled) return
        if (files.length === 0) {
          setVideoOptions(selectedVideoFile ? [selectedVideoFile] : [])
          return
        }
        const uniq = Array.from(new Set(files))
        setVideoOptions(uniq)
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
  }, [selectedVideoFile, restrictToMetadata])

  const handleScenarioClear = useCallback(() => {
    setScenarioId('')
    setUserClearedScenario(true)
    setRestrictToMetadata(false)
    void fetchVideos()
      .then(list => {
        if (Array.isArray(list)) {
          setVideoOptions(list)
          setSelectedVideoFile(prev => (list.includes(prev) ? prev : list[0] ?? ''))
        } else {
          setVideoOptions([])
        }
      })
      .catch(() => undefined)
  }, [])

  const handleScenarioSelect = useCallback((scenario: string) => {
    userSelectedScenarioRef.current = true
    setScenarioId(scenario)
    setUserClearedScenario(false)
  }, [])

  const handleSelectVideo = useCallback((file: string) => {
    userSelectedVideoRef.current = true
    setSelectedVideoFile(file)
  }, [])

  return {
    scenarioId,
    setScenarioId,
    userClearedScenario,
    metadataOptions,
    restrictToMetadata,
    scenarioSelectRef,
    scenarioDropdownOpen,
    setScenarioDropdownOpen,
    videoOptions,
    selectedVideoFile,
    handleScenarioClear,
    handleScenarioSelect,
    handleSelectVideo,
    referenceVideoFiles,
    setReferenceVideoFiles,
    referenceVisibility,
    setReferenceVisibility,
    showReference,
    setShowReference,
    swapRefFile,
    setSwapRefFile,
    setRestrictToMetadata,
    userSelectedScenarioRef,
    userSelectedVideoRef,
  }
}
