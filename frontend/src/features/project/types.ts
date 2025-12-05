import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react'

export type SaveStatus = {
	status: 'idle' | 'saving' | 'success' | 'error'
	message?: string
}

export interface UseProjectDataResult {
	scenarioId: string
	setScenarioId: Dispatch<SetStateAction<string>>
	userClearedScenario: boolean
	metadataOptions: string[]
	scenarioSelectRef: RefObject<HTMLDivElement>
	scenarioDropdownOpen: boolean
	setScenarioDropdownOpen: Dispatch<SetStateAction<boolean>>
	videoOptions: string[]
	selectedVideoFile: string
	handleScenarioClear: () => void
	handleScenarioSelect: (scenario: string) => void
	handleSelectVideo: (file: string) => void
	referenceVideoFiles: string[]
	setReferenceVideoFiles: Dispatch<SetStateAction<string[]>>
	referenceVisibility: Record<string, boolean>
	setReferenceVisibility: Dispatch<SetStateAction<Record<string, boolean>>>
	showReference: boolean
	setShowReference: Dispatch<SetStateAction<boolean>>
	swapRefFile: string | null
	setSwapRefFile: Dispatch<SetStateAction<string | null>>
	setRestrictToMetadata: Dispatch<SetStateAction<boolean>>
	userSelectedScenarioRef: MutableRefObject<boolean>
	userSelectedVideoRef: MutableRefObject<boolean>
}
