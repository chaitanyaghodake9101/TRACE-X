export type UserRole = 'admin' | 'senior_investigator' | 'investigator' | 'auditor';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone_number?: string;
  badge_number?: string;
  station?: string;
  is_active: boolean;
  has_completed_tour: boolean;
  created_at: string;
  updated_at: string;
  created_cases_count?: number;
  assigned_cases_count?: number;
}

export type CaseStatus = 'open' | 'under_investigation' | 'closed' | 'archived';
export type CasePriority = 'low' | 'medium' | 'high' | 'critical';

export interface Case {
  id: string;
  case_number: string;
  title: string;
  description?: string;
  status: CaseStatus;
  priority: CasePriority;
  created_by: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  creator?: User;
  assignee?: User;
  evidence_count?: number;
  entity_count?: number;
  hypothesis_count?: number;
  action_count?: number;
}

export type EvidenceSourceType = 'fir' | 'cdr' | 'financial_records' | 'cctv' | 'witness_statement' | 'anonymous_tip' | 'other';
export type IntegrityStatus = 'verified' | 'compromised' | 'unverified';

export interface CustodyEvent {
  id: string;
  evidence_id: string;
  event_type: 'uploaded' | 'accessed' | 'downloaded' | 'verified' | 'flagged_compromised' | 'exported' | 'simulated_tamper';
  performed_by: string;
  hash_at_event: string;
  notes?: string;
  timestamp: string;
  performer?: User;
}

export interface EvidenceQualityScore {
  id: string;
  evidence_id: string;
  source_reliability_score: number;
  temporal_freshness_score: number;
  cross_corroboration_score: number;
  data_quality_score: number;
  integrity_score: number;
  overall_quality_score: number;
  explanation_json: Record<string, any>;
  calculated_at: string;
}

export interface Evidence {
  id: string;
  case_id: string;
  title: string;
  description?: string;
  source_type: EvidenceSourceType;
  file_path?: string;
  extracted_text?: string;
  metadata_json: Record<string, any>;
  uploaded_by: string;
  sha256_hash: string;
  integrity_status: IntegrityStatus;
  event_timestamp?: string;
  created_at: string;
  updated_at: string;
  quality_score?: EvidenceQualityScore;
  custody_events?: CustodyEvent[];
}

export interface EvidenceIntegrity {
  id: string;
  case_id: string;
  title: string;
  sha256_hash: string;
  current_recomputed_hash: string;
  integrity_status: IntegrityStatus;
  is_valid: boolean;
  last_verified_at?: string;
  custody_chain: CustodyEvent[];
}

export type EntityType = 'person' | 'phone' | 'vehicle' | 'location' | 'organization' | 'event' | 'evidence' | 'other';

export interface Entity {
  id: string;
  case_id: string;
  name: string;
  entity_type: EntityType;
  canonical_name?: string;
  confidence_score: number;
  attributes_json: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  quality_score?: number;
  integrity_status?: IntegrityStatus;
  linked_evidence_ids?: string[];
  linked_evidence_titles?: string[];
  properties: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  weight: number;
  confidence: number;
  linked_evidence_ids?: string[];
  linked_evidence_titles?: string[];
  properties: Record<string, any>;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface KeyInfluencer {
  entity_id: string;
  name: string;
  canonical_name: string;
  entity_type: string;
  confidence_score: number;
  total_connections: number;
  in_degree: number;
  out_degree: number;
  importance_score: number;
  rank_label: string;
}

export interface PatternAlert {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  evidence_type: string;
  recommendation: string;
}

export type HypothesisStatus = 'active' | 'supported' | 'refuted' | 'archived';
export type HypothesisType = 'working' | 'alternative' | 'baseline' | 'null';
export type HypothesisRelationType = 'supports' | 'contradicts' | 'neutral' | 'inconclusive';

export interface HypothesisScore {
  id: string;
  hypothesis_id: string;
  raw_score: number;
  normalized_score: number;
  confidence_level?: string;
  supporting_count?: number;
  contradicting_count?: number;
  supporting_weight_sum?: number;
  contradicting_weight_sum?: number;
  calculated_at: string;
}

export interface EvidenceHypothesis {
  id: string;
  hypothesis_id: string;
  evidence_id: string;
  relationship_type: HypothesisRelationType;
  relationship_strength: number;
  rationale?: string;
  linked_by?: string;
  created_at: string;
  evidence?: Evidence;
}

export interface Hypothesis {
  id: string;
  case_id: string;
  title: string;
  description?: string;
  status: HypothesisStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  creator?: User;
  score?: HypothesisScore;
  evidence_links?: EvidenceHypothesis[];
}

export type ActionType = 'obtain_cdr' | 'interview_witness' | 'obtain_financial_records' | 'cctv_review' | 'forensic_analysis' | 're_verify_evidence' | 'other';
export type ActionStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface ActionOutcome {
  id: string;
  action_id: string;
  outcome_notes?: string;
  produced_new_evidence: boolean;
  evidence_id?: string;
  effectiveness_score: number;
  logged_by: string;
  created_at: string;
}

export interface InvestigativeAction {
  id: string;
  case_id: string;
  title: string;
  description?: string;
  action_type: ActionType;
  status: ActionStatus;
  base_gain: number;
  gap_multiplier: number;
  hypothesis_multiplier: number;
  feasibility_multiplier: number;
  expected_information_gain: number;
  priority_rank: number;
  target_entity_id?: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  target_entity?: Entity;
  assignee?: User;
  outcome?: ActionOutcome;
}

// --- ADMIN & COMPLIANCE TYPES ---

export interface OfficerActivityItem {
  id: string;
  timestamp: string;
  source: 'audit_log' | 'custody_event';
  action_type: string;
  resource_type: string;
  resource_id?: string;
  case_id?: string;
  case_title?: string;
  details?: Record<string, any>;
}

export interface PasswordResetResponse {
  user_id: string;
  email: string;
  reset_token: string;
  reset_url: string;
  expires_at: string;
  message: string;
}

export interface BulkActionResponse {
  action: string;
  affected_count: number;
  success: boolean;
  message: string;
}

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latency_ms?: number;
  details?: Record<string, any>;
}

export interface SystemHealthData {
  status: 'healthy' | 'degraded' | 'down';
  timestamp: string;
  components: ComponentHealth[];
  uptime_seconds: number;
  total_users: number;
  total_cases: number;
  total_evidence: number;
}

export interface TamperingAnalyticsData {
  total_evidence_count: number;
  verified_count: number;
  compromised_count: number;
  unverified_count: number;
  tamper_rate_percentage: number;
  recent_compromised_items: Array<{
    evidence_id: string;
    title: string;
    source_type: string;
    case_id: string;
    case_number: string;
    sha256_hash: string;
    updated_at: string;
  }>;
}

// --- HELP & ONBOARDING TYPES ---

export interface FAQItem {
  id: string;
  question: string;
  category: string;
  answer: string;
  tags: string[];
}

export interface KnowledgeArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  reading_time: string;
  summary: string;
  content_markdown: string;
}

export interface VideoTutorial {
  id: string;
  title: string;
  duration: string;
  description: string;
  category: string;
  embed_url: string;
  thumbnail_icon: string;
}

// --- INVESTIGATION INTELLIGENCE SUITE TYPES ---

export interface SimulationEvidenceOverride {
  id: string;
  branch_id: string;
  evidence_id?: string;
  is_excluded: boolean;
  overridden_quality_score?: number;
  overridden_reliability?: number;
  is_hypothetical: boolean;
  hypothetical_title?: string;
  hypothetical_source_type?: string;
  notes?: string;
  created_at: string;
}

export interface SimulationHypothesisDelta {
  id: string;
  hypothesis_id: string;
  hypothesis_title?: string;
  original_normalized_score: number;
  simulated_normalized_score: number;
  delta_score: number;
  original_confidence_level: string;
  simulated_confidence_level: string;
  diagnostic_rationale?: string;
  calculated_at: string;
}

export interface SimulationBranch {
  id: string;
  case_id: string;
  name: string;
  description?: string;
  created_by: string;
  status: 'active' | 'archived' | 'submitted_review';
  created_at: string;
  updated_at: string;
  evidence_overrides?: SimulationEvidenceOverride[];
  hypothesis_deltas?: SimulationHypothesisDelta[];
}

export interface SimulationBranchComparison {
  branch_id: string;
  branch_name: string;
  case_id: string;
  total_overrides: number;
  hypothesis_deltas: SimulationHypothesisDelta[];
  significant_shifts: Array<{
    hypothesis_id: string;
    hypothesis_title: string;
    delta: number;
    direction: 'increased' | 'decreased';
    original_score: number;
    simulated_score: number;
  }>;
  summary: string;
}

export interface SimulationReviewRequest {
  id: string;
  branch_id: string;
  case_id: string;
  requested_by: string;
  status: 'pending' | 'approved' | 'rejected';
  review_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface ResilienceNodeMetric {
  id: string;
  entity_id: string;
  entity_name: string;
  entity_type: string;
  baseline_betweenness: number;
  stress_betweenness: number;
  centrality_shift_percent: number;
  stability_classification: 'STABLE' | 'SENSITIVE' | 'FRAGILE';
  is_single_point_of_failure: number;
  disruption_impact_score: number;
  explanation?: string;
}

export interface ResilienceTestRun {
  id: string;
  case_id: string;
  test_type: string;
  parameters_json: Record<string, any>;
  created_by: string;
  total_nodes_evaluated: number;
  baseline_density: number;
  stress_density: number;
  density_delta: number;
  fragmentation_index: number;
  fragile_node_count: number;
  sensitive_node_count: number;
  stable_node_count: number;
  summary_report_json: Record<string, any>;
  created_at: string;
  node_metrics?: ResilienceNodeMetric[];
}

export interface ResilienceMonteCarloRun {
  id: string;
  case_id: string;
  seed: number;
  iterations: number;
  perturbation_rate: number;
  mean_fragmentation: number;
  critical_bridges_json: Array<{
    entity_id: string;
    entity_name: string;
    criticality_score: number;
  }>;
  results_summary_json: Record<string, any>;
  created_at: string;
}

export interface ReviewPriorityScore {
  id: string;
  evidence_id: string;
  evidence_title?: string;
  evidence_source_type?: string;
  case_id: string;
  temporal_urgency_score: number;
  integrity_urgency_score: number;
  volatility_score: number;
  downstream_impact_score: number;
  corroboration_deficit_score: number;
  composite_urgency_score: number;
  suggested_review_tier: 'P0_CRITICAL' | 'P1_HIGH' | 'P2_ROUTINE';
  explanation_json: Record<string, any>;
  calculated_at: string;
}

export interface ReviewActionLog {
  id: string;
  task_id: string;
  action_taken: string;
  notes?: string;
  performed_by: string;
  performer_name?: string;
  created_at: string;
}

export interface ReviewTask {
  id: string;
  case_id: string;
  evidence_id: string;
  evidence_title?: string;
  title: string;
  description?: string;
  priority: 'P0' | 'P1' | 'P2';
  status: 'pending' | 'in_review' | 'reverified' | 'deferred' | 'closed';
  assigned_to?: string;
  assignee_name?: string;
  due_date?: string;
  created_at: string;
  resolved_at?: string;
  action_logs?: ReviewActionLog[];
}

export interface DisagreementSignal {
  id: string;
  case_id: string;
  dimension: 'nlp_vs_graph' | 'evidence_vs_hypothesis' | 'majority_vs_minority' | 'integrity_vs_reliance' | 'ai_vs_human';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  primary_entity_id?: string;
  primary_evidence_id?: string;
  primary_hypothesis_id?: string;
  signals_payload: Record<string, any>;
  recommended_reconciliation?: string;
  is_resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
  contestations?: InvestigatorContestation[];
}

export interface MinorityEvidenceItem {
  id: string;
  case_id: string;
  evidence_id: string;
  evidence_title?: string;
  hypothesis_id?: string;
  hypothesis_title?: string;
  outlier_category: string;
  diagnostic_significance: number;
  contradiction_target: string;
  summary_rationale: string;
  detected_at: string;
}

export interface InvestigatorContestation {
  id: string;
  signal_id: string;
  officer_id: string;
  officer_name?: string;
  contest_action: 'override_confidence' | 'dismiss_signal' | 'affirm_anomaly';
  justification: string;
  adjusted_confidence?: number;
  created_at: string;
}

export interface DisagreementScanSummary {
  case_id: string;
  total_signals: number;
  critical_signals: number;
  high_signals: number;
  minority_evidence_count: number;
  signals: DisagreementSignal[];
  minority_evidence: MinorityEvidenceItem[];
}

// --- Extended Officer Management ---
export interface OfficerProfile {
  id: string;
  user_id: string;
  designation?: string;
  district?: string;
  state?: string;
  rank?: string;
  department?: string;
  created_at: string;
  updated_at: string;
}

export interface EnhancedOfficer extends User {
  profile?: OfficerProfile;
}

export interface CaseMembership {
  id: string;
  case_id: string;
  user_id: string;
  case_title?: string;
  case_number?: string;
  assignment_role: string;
  is_active: boolean;
  assigned_by?: string;
  assigned_at: string;
}

export interface OfficerHistory {
  status_history: Array<{
    id: string;
    previous_status: boolean;
    new_status: boolean;
    reason?: string;
    changed_by?: string;
    changed_at: string;
  }>;
  role_history: Array<{
    id: string;
    previous_role: string;
    new_role: string;
    reason?: string;
    changed_by?: string;
    changed_at: string;
  }>;
  case_memberships: CaseMembership[];
}

// --- Content CMS ---
export interface ContentPageVersion {
  id: string;
  page_id: string;
  version_number: number;
  title: string;
  summary?: string;
  body_markdown: string;
  status: 'draft' | 'published' | 'archived';
  created_by?: string;
  created_at: string;
  change_summary?: string;
}

export interface ContentPage {
  id: string;
  slug: string;
  title: string;
  summary?: string;
  body_markdown: string;
  status: 'draft' | 'published' | 'archived';
  current_version: number;
  author_id?: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
  versions?: ContentPageVersion[];
}

export interface PublicContentPage {
  slug: string;
  title: string;
  summary?: string;
  body_markdown: string;
  version: number;
  published_at?: string;
  is_fallback: boolean;
}

// --- Tutorials ---
export interface TutorialStepItem {
  step_number: number;
  title: string;
  detail: string;
  hint?: string;
}

export interface TutorialProgress {
  id: string;
  tutorial_id: string;
  user_id: string;
  completed: boolean;
  last_step_index: number;
  completed_at?: string;
  updated_at: string;
}

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  category: string;
  video_url?: string;
  youtube_id?: string;
  duration_minutes: number;
  order_index: number;
  is_published: boolean;
  steps_json: TutorialStepItem[];
  created_at: string;
  updated_at: string;
  user_progress?: TutorialProgress;
}

// --- Theme & Branding ---
export interface ThemeVersion {
  id: string;
  theme_id: string;
  version_number: number;
  config_json: Record<string, any>;
  change_notes?: string;
  created_by?: string;
  created_at: string;
}

export interface ThemeConfiguration {
  id: string;
  name: string;
  primary_color: string;
  accent_color: string;
  background_mode: string;
  font_family: string;
  border_radius: string;
  is_active: boolean;
  logo_url?: string;
  custom_css_vars: Record<string, string>;
  created_at: string;
  updated_at: string;
  versions?: ThemeVersion[];
}

export interface UserThemePreference {
  user_id: string;
  theme_id?: string;
  mode_override?: string;
  custom_overrides_json: Record<string, any>;
  active_theme?: ThemeConfiguration;
}

// --- Feature Flags ---
export interface FeatureFlag {
  key: string;
  name: string;
  description?: string;
  is_enabled: boolean;
  category: string;
  updated_at: string;
  updated_by?: string;
}


