export interface User {
  id: number;
  username: string;
  email: string;
  role: 'citizen' | 'researcher' | 'admin';
  organization?: string;
  bio?: string;
  location?: string;
  date_joined: string;
}

export interface Observation {
  id: number;
  user: User;
  image: string;
  latitude: number;
  longitude: number;
  location_name?: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected' | 'processing';
  coverage_estimate?: number;
  water_body_type?: string;
  weather_conditions?: string;
  captured_at: string;
  created_at: string;
  updated_at: string;
  qc_score?: QualityControlScore;
  segmentation?: SegmentationResult;
}

export interface QualityControlScore {
  id: number;
  observation: number;
  reviewer: User;
  image_quality: number;
  species_visibility: number;
  location_accuracy: number;
  metadata_completeness: number;
  overall_score: number;
  comments?: string;
  automated_flags: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SegmentationResult {
  id: number;
  observation: number;
  segmented_image: string;
  coverage_percentage: number;
  confidence_score: number;
  model_version: string;
  processing_metadata: Record<string, any>;
  created_at: string;
}

export interface ObservationStats {
  total_observations: number;
  pending_qc: number;
  approved: number;
  rejected: number;
  processing: number;
}