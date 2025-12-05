import type { ComponentProps } from 'react'
import { ReferenceVideoOverlay } from '../../video'
import type { UseProjectFeatureResult } from '../../project/hooks/useProjectFeature'
import type { UseVideoFeatureResult } from '../../video/hooks/useVideoFeature'

export type ReferenceOverlayComponentProps = ComponentProps<typeof ReferenceVideoOverlay>

export interface BuildReferenceOverlayPropsArgs {
  project: UseProjectFeatureResult
  video: UseVideoFeatureResult
}

export function buildReferenceOverlayProps({ project, video }: BuildReferenceOverlayPropsArgs): ReferenceOverlayComponentProps {
  return {
    scenarioId: project.state.scenarioId,
    referenceVideoFiles: project.state.referenceVideoFiles,
    showReference: project.state.showReference,
    referenceVisibility: project.state.referenceVisibility,
    pipTop: video.player.pipTop,
    pipRight: video.player.pipRight,
    pipWidth: video.player.pipWidth,
    pipHeight: video.player.pipHeight,
    getSourceForFile: video.media.getSourceForFile,
    swapRefFile: project.state.swapRefFile,
    videoSource: video.media.videoSource,
    mainVideoRef: video.player.mainVideoRef,
    referenceVideoRefs: video.player.referenceVideoRefs,
    startPipDrag: video.player.startPipDrag,
    setSwapRefFile: project.actions.setSwapRefFile,
  }
}
