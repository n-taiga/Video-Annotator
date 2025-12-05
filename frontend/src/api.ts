/**
 * API Module
 *
 * This file re-exports from /api/* for backward compatibility.
 * New code should import directly from '@/api' or '@/api/*'.
 */

export {
  // Base
  API_BASE_URL,
  buildApiUrl,
  // Annotations
  saveAnnotation,
  loadAnnotation,
  // Videos
  fetchVideos,
  // Metadata
  fetchMetadata,
  fetchMetadataItem,
  // Labels
  fetchActionLabels,
  updateActionLabels,
  fetchObjectLabels,
  updateObjectLabels,
  type LabelDictionary,
  type ActionLabelDictionary,
  // Prediction
  predictWithMultipart,
  isMultipartResult,
  type PredictionMetadata,
  type ObjectMaskResult,
  type MultipartPredictionResult,
  type PredictPayload,
  type FrameResult,
  type PredictOptions,
} from './api/index'