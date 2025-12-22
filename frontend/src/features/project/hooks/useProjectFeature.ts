import { useState } from 'react'
import type React from 'react'
import type { RefObject, MutableRefObject } from 'react'
import { useProjectData } from './useProjectData'

export interface ProjectFeatureState {
  scenarioId: string
  userClearedScenario: boolean
  metadataOptions: string[]
  videoOptions: string[]
  selectedVideoFile: string
  restrictToMetadata: boolean
  scenarioDropdownOpen: boolean
  referenceVideoFiles: string[]
  referenceVisibility: Record<string, boolean>
  showReference: boolean
  swapRefFile: string | null
  videoId: string
  taskLabel: string
  environment: string
}

export interface ProjectFeatureRefs {
  scenarioSelectRef: RefObject<HTMLDivElement>
  userSelectedScenarioRef: MutableRefObject<boolean>
  userSelectedVideoRef: MutableRefObject<boolean>
}

export interface ProjectFeatureActions {
  setScenarioId: React.Dispatch<React.SetStateAction<string>>
  setScenarioDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>
  handleScenarioClear: () => void
  handleScenarioSelect: (scenario: string) => void
  handleSelectVideo: (file: string) => void
  setVideoId: React.Dispatch<React.SetStateAction<string>>
  setTaskLabel: React.Dispatch<React.SetStateAction<string>>
  setEnvironment: React.Dispatch<React.SetStateAction<string>>
  setShowReference: React.Dispatch<React.SetStateAction<boolean>>
  setReferenceVisibility: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  setSwapRefFile: React.Dispatch<React.SetStateAction<string | null>>
}

export interface UseProjectFeatureResult {
  state: ProjectFeatureState
  refs: ProjectFeatureRefs
  actions: ProjectFeatureActions
}

export function useProjectFeature(): UseProjectFeatureResult {
  const projectData = useProjectData()
  const [videoId, setVideoId] = useState('')
  const [taskLabel, setTaskLabel] = useState('')
  const [environment, setEnvironment] = useState('')

  return {
    state: {
      scenarioId: projectData.scenarioId,
      userClearedScenario: projectData.userClearedScenario,
      restrictToMetadata: projectData.restrictToMetadata,
      metadataOptions: projectData.metadataOptions,
      videoOptions: projectData.videoOptions,
      selectedVideoFile: projectData.selectedVideoFile,
      scenarioDropdownOpen: projectData.scenarioDropdownOpen,
      referenceVideoFiles: projectData.referenceVideoFiles,
      referenceVisibility: projectData.referenceVisibility,
      showReference: projectData.showReference,
      swapRefFile: projectData.swapRefFile,
      videoId,
      taskLabel,
      environment,
    },
    refs: {
      scenarioSelectRef: projectData.scenarioSelectRef,
      userSelectedScenarioRef: projectData.userSelectedScenarioRef,
      userSelectedVideoRef: projectData.userSelectedVideoRef,
    },
    actions: {
      setScenarioId: projectData.setScenarioId,
      setScenarioDropdownOpen: projectData.setScenarioDropdownOpen,
      handleScenarioClear: projectData.handleScenarioClear,
      handleScenarioSelect: projectData.handleScenarioSelect,
      handleSelectVideo: projectData.handleSelectVideo,
      setVideoId,
      setTaskLabel,
      setEnvironment,
      setShowReference: projectData.setShowReference,
      setReferenceVisibility: projectData.setReferenceVisibility,
      setSwapRefFile: projectData.setSwapRefFile,
    },
  }
}
