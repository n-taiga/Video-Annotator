/**
 * API Module - Re-exports all API functions for backward compatibility
 */

// Base utilities
export { API_BASE_URL, buildApiUrl } from './base'

// Annotations
export { saveAnnotation, loadAnnotation } from './annotations'

// Videos
export { fetchVideos } from './videos'

// Metadata
export { fetchMetadata, fetchMetadataItem } from './metadata'

// Labels
export {
  fetchActionLabels,
  updateActionLabels,
  fetchObjectLabels,
  updateObjectLabels,
  type LabelDictionary,
  type ActionLabelDictionary,
} from './labels'

// Prediction
export {
  predictWithMultipart,
  isMultipartResult,
  type PredictionMetadata,
  type ObjectMaskResult,
  type MultipartPredictionResult,
  type PredictPayload,
  type FrameResult,
  type PredictOptions,
} from './prediction'
