import axios from 'axios';
import {
  Case,
  Evidence,
  GraphData,
  Hypothesis,
  InvestigativeAction,
  EvidenceQualityScore,
  User,
  Entity,
  EvidenceIntegrity,
  CustodyEvent,
  OfficerActivityItem,
  PasswordResetResponse,
  BulkActionResponse,
  SystemHealthData,
  TamperingAnalyticsData,
  FAQItem,
  KnowledgeArticle,
  VideoTutorial,
  KeyInfluencer,
  PatternAlert,
  SimulationBranch,
  SimulationEvidenceOverride,
  SimulationBranchComparison,
  SimulationReviewRequest,
  ResilienceTestRun,
  ResilienceNodeMetric,
  ResilienceMonteCarloRun,
  ReviewPriorityScore,
  ReviewTask,
  ReviewActionLog,
  DisagreementScanSummary,
  InvestigatorContestation,
  EnhancedOfficer,
  CaseMembership,
  OfficerHistory,
  ContentPage,
  PublicContentPage,
  Tutorial,
  TutorialProgress,
  ThemeConfiguration,
  UserThemePreference,
  FeatureFlag
} from '../types';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tracex_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for automatic token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/')) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('tracex_refresh_token');
      if (refreshToken) {
        try {
          const res = await axios.post('/api/v1/auth/refresh', { refresh_token: refreshToken });
          const newAccessToken = res.data.access_token;
          localStorage.setItem('tracex_token', newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        } catch (refreshErr) {
          localStorage.removeItem('tracex_token');
          localStorage.removeItem('tracex_refresh_token');
          localStorage.removeItem('tracex_user');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.data.refresh_token) {
      localStorage.setItem('tracex_refresh_token', res.data.refresh_token);
    }
    return res.data;
  },
  register: async (data: { email: string; password: string; full_name: string; role: string }) => {
    const res = await api.post('/auth/register', data);
    return res.data;
  },
  loginGoogle: async (idToken: string = 'mock-token') => {
    const res = await api.post('/auth/google', { id_token: idToken });
    if (res.data.refresh_token) {
      localStorage.setItem('tracex_refresh_token', res.data.refresh_token);
    }
    return res.data;
  },
  getCurrentUser: async () => {
    const res = await api.get<User>('/auth/me');
    return res.data;
  },
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('tracex_token');
      localStorage.removeItem('tracex_refresh_token');
      localStorage.removeItem('tracex_user');
    }
  },
  forgotPassword: async (email: string) => {
    const res = await api.post('/auth/forgot-password', { email });
    return res.data;
  },
  resetPassword: async (token: string, new_password: string) => {
    const res = await api.post('/auth/reset-password', { token, new_password });
    return res.data;
  },
  verifyEmail: async (token: string) => {
    const res = await api.post('/auth/verify-email', { token });
    return res.data;
  },
  listUsers: async () => {
    const res = await api.get<User[]>('/auth/users');
    return res.data;
  }
};

export const casesApi = {
  list: async (statusFilter?: string, searchQuery?: string) => {
    let url = '/cases/';
    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== 'all') params.append('status_filter', statusFilter);
    if (searchQuery) params.append('search', searchQuery);
    if (params.toString()) url += `?${params.toString()}`;
    const res = await api.get<Case[]>(url);
    return res.data;
  },
  get: async (id: string) => {
    const res = await api.get<Case>(`/cases/${id}`);
    return res.data;
  },
  create: async (data: Partial<Case>) => {
    const res = await api.post<Case>('/cases/', data);
    return res.data;
  },
  update: async (id: string, data: Partial<Case>) => {
    const res = await api.put<Case>(`/cases/${id}`, data);
    return res.data;
  },
  changeStatus: async (id: string, status: string) => {
    const res = await api.patch<Case>(`/cases/${id}/status`, { status });
    return res.data;
  },
  assign: async (id: string, assignedToUserId: string) => {
    const res = await api.patch<Case>(`/cases/${id}/assign`, { assigned_to: assignedToUserId });
    return res.data;
  },
  delete: async (id: string) => {
    const res = await api.delete(`/cases/${id}`);
    return res.data;
  }
};

export const evidenceApi = {
  listByCase: async (caseId: string) => {
    const res = await api.get<Evidence[]>(`/cases/${caseId}/evidence`);
    return res.data;
  },
  create: async (caseId: string, data: any) => {
    const res = await api.post<Evidence>(`/cases/${caseId}/evidence`, data);
    return res.data;
  },
  uploadFile: async (caseId: string, formData: FormData) => {
    const res = await api.post<Evidence>(`/cases/${caseId}/evidence/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },
  uploadCDR: async (caseId: string, formData: FormData) => {
    const res = await api.post<Evidence>(`/cases/${caseId}/evidence/cdr`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },
  uploadFinancial: async (caseId: string, formData: FormData) => {
    const res = await api.post<Evidence>(`/cases/${caseId}/evidence/financial`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },
  get: async (evidenceId: string) => {
    const res = await api.get<Evidence>(`/evidence/${evidenceId}`);
    return res.data;
  },
  delete: async (evidenceId: string) => {
    const res = await api.delete(`/evidence/${evidenceId}`);
    return res.data;
  },
  getQuality: async (evidenceId: string) => {
    const res = await api.get<EvidenceQualityScore>(`/evidence/${evidenceId}/quality`);
    return res.data;
  },
  getCaseQualityScores: async (caseId: string) => {
    const res = await api.get<EvidenceQualityScore[]>(`/cases/${caseId}/evidence-quality`);
    return res.data;
  },
  recalculateQuality: async (caseId: string) => {
    const res = await api.post(`/cases/${caseId}/evidence-quality/recalculate`);
    return res.data;
  },
  getQualitySummary: async (caseId: string) => {
    const res = await api.get(`/cases/${caseId}/evidence-quality/summary`);
    return res.data;
  },
  getIntegrity: async (evidenceId: string) => {
    const res = await api.get<EvidenceIntegrity>(`/evidence/${evidenceId}/integrity`);
    return res.data;
  },
  verify: async (evidenceId: string) => {
    const res = await api.post(`/evidence/${evidenceId}/verify`);
    return res.data;
  },
  simulateTamper: async (evidenceId: string) => {
    const res = await api.post(`/evidence/${evidenceId}/simulate-tamper`);
    return res.data;
  },
  getCustodyChain: async (evidenceId: string) => {
    const res = await api.get<CustodyEvent[]>(`/evidence/${evidenceId}/custody-chain`);
    return res.data;
  }
};

export const entitiesApi = {
  listByCase: async (caseId: string, entityType?: string) => {
    let url = `/cases/${caseId}/entities`;
    if (entityType) url += `?entity_type=${entityType}`;
    const res = await api.get<Entity[]>(url);
    return res.data;
  },
  create: async (caseId: string, data: any) => {
    const res = await api.post<Entity>(`/cases/${caseId}/entities`, data);
    return res.data;
  },
  extractAll: async (caseId: string) => {
    const res = await api.post<Entity[]>(`/cases/${caseId}/extract-entities`);
    return res.data;
  },
  delete: async (entityId: string) => {
    const res = await api.delete(`/entities/${entityId}`);
    return res.data;
  },
  getDuplicateCandidates: async (caseId: string, threshold: number = 0.75) => {
    const res = await api.get(`/cases/${caseId}/entity-resolution/candidates?threshold=${threshold}`);
    return res.data;
  },
  merge: async (caseId: string, primaryEntityId: string, secondaryEntityIds: string[]) => {
    const res = await api.post(`/cases/${caseId}/entity-resolution/merge`, {
      primary_entity_id: primaryEntityId,
      secondary_entity_ids: secondaryEntityIds,
    });
    return res.data;
  },
  autoResolve: async (caseId: string, threshold: number = 0.85) => {
    const res = await api.post(`/cases/${caseId}/entity-resolution/auto-resolve?threshold=${threshold}`);
    return res.data;
  }
};

export const graphApi = {
  getCaseGraph: async (caseId: string, minQualityScore?: number) => {
    let url = `/cases/${caseId}/graph`;
    if (minQualityScore !== undefined) url += `?min_quality_score=${minQualityScore}`;
    const res = await api.get<GraphData>(url);
    return res.data;
  },
  getGraphStats: async (caseId: string) => {
    const res = await api.get(`/cases/${caseId}/graph/stats`);
    return res.data;
  },
  syncCaseGraph: async (caseId: string) => {
    const res = await api.post(`/cases/${caseId}/graph/sync`);
    return res.data;
  },
  getKeyInfluencers: async (caseId: string, limit: number = 10) => {
    const res = await api.get<{ case_id: string; influencers: KeyInfluencer[] }>(
      `/cases/${caseId}/graph/key-influencers?limit=${limit}`
    );
    return res.data;
  },
  getPatterns: async (caseId: string) => {
    const res = await api.get<{ case_id: string; patterns: PatternAlert[] }>(
      `/cases/${caseId}/patterns`
    );
    return res.data;
  }
};

export const hypothesesApi = {
  listByCase: async (caseId: string) => {
    const res = await api.get<Hypothesis[]>(`/cases/${caseId}/hypotheses`);
    return res.data;
  },
  create: async (caseId: string, data: any) => {
    const res = await api.post<Hypothesis>(`/cases/${caseId}/hypotheses`, data);
    return res.data;
  },
  linkEvidence: async (hypothesisId: string, data: any) => {
    const res = await api.post(`/hypotheses/${hypothesisId}/evidence`, data);
    return res.data;
  },
  compare: async (hypothesisId: string, targetId: string) => {
    const res = await api.get(`/hypotheses/${hypothesisId}/compare?target_id=${targetId}`);
    return res.data;
  },
};

export const actionsApi = {
  listByCase: async (caseId: string) => {
    const res = await api.get<InvestigativeAction[]>(`/cases/${caseId}/actions`);
    return res.data;
  },
  create: async (caseId: string, data: any) => {
    const res = await api.post<InvestigativeAction>(`/cases/${caseId}/actions`, data);
    return res.data;
  },
  prioritize: async (caseId: string) => {
    const res = await api.post<InvestigativeAction[]>(`/cases/${caseId}/actions/prioritize`);
    return res.data;
  },
  complete: async (actionId: string, outcome: any) => {
    const res = await api.post<InvestigativeAction>(`/actions/${actionId}/complete`, outcome);
    return res.data;
  },
};

export const reportsApi = {
  downloadPdf: async (caseId: string) => {
    const res = await api.post(`/cases/${caseId}/reports`, {}, { responseType: 'blob' });
    return res.data;
  },
  downloadIntegrityReport: async (caseId: string) => {
    const res = await api.post(`/cases/${caseId}/integrity-report`, {}, { responseType: 'blob' });
    return res.data;
  }
};

export const adminApi = {
  listOfficers: async (search?: string, role?: string, isActive?: boolean) => {
    let url = '/admin/officers';
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (role && role !== 'all') params.append('role', role);
    if (isActive !== undefined) params.append('is_active', String(isActive));
    if (params.toString()) url += `?${params.toString()}`;
    const res = await api.get<User[]>(url);
    return res.data;
  },
  updateOfficer: async (officerId: string, data: any) => {
    const res = await api.put<User>(`/admin/officers/${officerId}`, data);
    return res.data;
  },
  toggleStatus: async (officerId: string, isActive: boolean) => {
    const res = await api.patch<User>(`/admin/officers/${officerId}/status`, { is_active: isActive });
    return res.data;
  },
  forceResetPassword: async (officerId: string) => {
    const res = await api.post<PasswordResetResponse>(`/admin/officers/${officerId}/reset-password`);
    return res.data;
  },
  getOfficerActivity: async (officerId: string) => {
    const res = await api.get<OfficerActivityItem[]>(`/admin/officers/${officerId}/activity`);
    return res.data;
  },
  bulkAction: async (officerIds: string[], action: string, targetCaseId?: string) => {
    const res = await api.post<BulkActionResponse>('/admin/officers/bulk-action', {
      officer_ids: officerIds,
      action,
      target_case_id: targetCaseId
    });
    return res.data;
  },
  getSystemHealth: async () => {
    const res = await api.get<SystemHealthData>('/admin/system-health');
    return res.data;
  },
  getTamperingAnalytics: async () => {
    const res = await api.get<TamperingAnalyticsData>('/admin/tampering-reports');
    return res.data;
  },
  updateConfig: async (configData: any) => {
    const res = await api.put('/admin/config', configData);
    return res.data;
  }
};

export const helpApi = {
  getFAQ: async (search?: string, category?: string) => {
    let url = '/help/faq';
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (category && category !== 'all') params.append('category', category);
    if (params.toString()) url += `?${params.toString()}`;
    const res = await api.get<FAQItem[]>(url);
    return res.data;
  },
  getArticles: async (search?: string, category?: string) => {
    let url = '/help/articles';
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (category && category !== 'all') params.append('category', category);
    if (params.toString()) url += `?${params.toString()}`;
    const res = await api.get<KnowledgeArticle[]>(url);
    return res.data;
  },
  getVideos: async () => {
    const res = await api.get<VideoTutorial[]>('/help/videos');
    return res.data;
  },
  completeTour: async () => {
    const res = await api.post('/help/tour-complete');
    return res.data;
  }
};

export const intelligenceApi = {
  // Counterfactual Investigation Sandbox
  simulations: {
    listBranches: async (caseId: string) => {
      const res = await api.get<SimulationBranch[]>(`/cases/${caseId}/simulations`);
      return res.data;
    },
    createBranch: async (caseId: string, data: { name: string; description?: string }) => {
      const res = await api.post<SimulationBranch>(`/cases/${caseId}/simulations`, data);
      return res.data;
    },
    getBranch: async (branchId: string) => {
      const res = await api.get<SimulationBranch>(`/simulations/${branchId}`);
      return res.data;
    },
    addOverride: async (branchId: string, data: {
      evidence_id?: string;
      is_excluded?: boolean;
      overridden_quality_score?: number;
      overridden_reliability?: number;
      is_hypothetical?: boolean;
      hypothetical_title?: string;
      hypothetical_source_type?: string;
      notes?: string;
    }) => {
      const res = await api.post<SimulationEvidenceOverride>(`/simulations/${branchId}/override`, data);
      return res.data;
    },
    deleteOverride: async (overrideId: string) => {
      const res = await api.delete(`/simulations/override/${overrideId}`);
      return res.data;
    },
    compareBranch: async (branchId: string) => {
      const res = await api.get<SimulationBranchComparison>(`/simulations/${branchId}/compare`);
      return res.data;
    },
    requestReview: async (branchId: string, reviewNotes?: string) => {
      const res = await api.post<SimulationReviewRequest>(`/simulations/${branchId}/request-review`, { review_notes: reviewNotes });
      return res.data;
    }
  },

  // Network Resilience Analyzer
  resilience: {
    runTest: async (caseId: string, data?: {
      test_type?: string;
      target_entity_ids?: string[];
      removal_fraction?: number;
      simulate_compromised_cascade?: boolean;
    }) => {
      const res = await api.post<ResilienceTestRun>(`/cases/${caseId}/resilience/run`, data || {});
      return res.data;
    },
    getLatest: async (caseId: string) => {
      const res = await api.get<ResilienceTestRun>(`/cases/${caseId}/resilience/latest`);
      return res.data;
    },
    getNodeMetrics: async (caseId: string, classification?: string) => {
      let url = `/cases/${caseId}/resilience/node-metrics`;
      if (classification) url += `?classification=${classification}`;
      const res = await api.get<ResilienceNodeMetric[]>(url);
      return res.data;
    },
    runMonteCarlo: async (caseId: string, data?: {
      seed?: number;
      iterations?: number;
      perturbation_rate?: number;
    }) => {
      const res = await api.post<ResilienceMonteCarloRun>(`/cases/${caseId}/resilience/monte-carlo`, data || {});
      return res.data;
    }
  },

  // Evidence Decay & Review Deadline Engine
  reviewPriorities: {
    getPriorities: async (caseId: string) => {
      const res = await api.get<ReviewPriorityScore[]>(`/cases/${caseId}/review-priorities`);
      return res.data;
    },
    recalculatePriorities: async (caseId: string) => {
      const res = await api.post<ReviewPriorityScore[]>(`/cases/${caseId}/review-priorities/recalculate`);
      return res.data;
    }
  },

  reviewTasks: {
    listTasks: async (caseId: string) => {
      const res = await api.get<ReviewTask[]>(`/cases/${caseId}/review-tasks`);
      return res.data;
    },
    createTask: async (caseId: string, data: {
      evidence_id: string;
      title: string;
      description?: string;
      priority?: string;
      assigned_to?: string;
      due_date?: string;
    }) => {
      const res = await api.post<ReviewTask>(`/cases/${caseId}/review-tasks`, data);
      return res.data;
    },
    performAction: async (taskId: string, data: {
      action_taken: string;
      notes?: string;
      new_status?: string;
    }) => {
      const res = await api.post<ReviewActionLog>(`/review-tasks/${taskId}/actions`, data);
      return res.data;
    }
  },

  // AI Disagreement & Minority-Evidence Panel
  disagreements: {
    getDisagreements: async (caseId: string) => {
      const res = await api.get<DisagreementScanSummary>(`/cases/${caseId}/disagreements`);
      return res.data;
    },
    scanDisagreements: async (caseId: string) => {
      const res = await api.post<DisagreementScanSummary>(`/cases/${caseId}/disagreements/scan`);
      return res.data;
    },
    contestSignal: async (signalId: string, data: {
      contest_action: string;
      justification: string;
      adjusted_confidence?: number;
    }) => {
      const res = await api.post<InvestigatorContestation>(`/disagreements/${signalId}/contest`, data);
      return res.data;
    }
  }
};

export const officersExtendedApi = {
  listExtended: async (search?: string, role?: string, isActive?: boolean, district?: string) => {
    let url = '/admin/officers/extended';
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (role && role !== 'all') params.append('role', role);
    if (isActive !== undefined) params.append('is_active', String(isActive));
    if (district && district !== 'all') params.append('district', district);
    if (params.toString()) url += `?${params.toString()}`;
    const res = await api.get<EnhancedOfficer[]>(url);
    return res.data;
  },
  createExtended: async (data: any) => {
    const res = await api.post<EnhancedOfficer>('/admin/officers/create-extended', data);
    return res.data;
  },
  updateProfile: async (officerId: string, data: any) => {
    const res = await api.patch<EnhancedOfficer>(`/admin/officers/${officerId}/profile`, data);
    return res.data;
  },
  getHistory: async (officerId: string) => {
    const res = await api.get<OfficerHistory>(`/admin/officers/${officerId}/history`);
    return res.data;
  },
  assignCase: async (officerId: string, data: { case_id: string; assignment_role: string }) => {
    const res = await api.post<CaseMembership>(`/admin/officers/${officerId}/case-assignments`, data);
    return res.data;
  }
};

export const cmsApi = {
  getPublicPage: async (slug: string) => {
    const res = await api.get<PublicContentPage>(`/content/public/${slug}`);
    return res.data;
  },
  listAdminPages: async (status?: string) => {
    let url = '/admin/content/pages';
    if (status && status !== 'all') url += `?status=${status}`;
    const res = await api.get<ContentPage[]>(url);
    return res.data;
  },
  createPage: async (data: any) => {
    const res = await api.post<ContentPage>('/admin/content/pages', data);
    return res.data;
  },
  getPageDetail: async (id: string) => {
    const res = await api.get<ContentPage>(`/admin/content/pages/${id}`);
    return res.data;
  },
  updatePage: async (id: string, data: any) => {
    const res = await api.put<ContentPage>(`/admin/content/pages/${id}`, data);
    return res.data;
  },
  publishPage: async (id: string) => {
    const res = await api.post<ContentPage>(`/admin/content/pages/${id}/publish`);
    return res.data;
  },
  rollbackPage: async (id: string, versionNumber: number) => {
    const res = await api.post<ContentPage>(`/admin/content/pages/${id}/rollback/${versionNumber}`);
    return res.data;
  }
};

export const tutorialsApi = {
  listPublicTutorials: async (category?: string) => {
    let url = '/tutorials';
    if (category && category !== 'all') url += `?category=${category}`;
    const res = await api.get<Tutorial[]>(url);
    return res.data;
  },
  getTutorialDetail: async (id: string) => {
    const res = await api.get<Tutorial>(`/tutorials/${id}`);
    return res.data;
  },
  updateProgress: async (id: string, data: { last_step_index?: number; completed?: boolean }) => {
    const res = await api.post<TutorialProgress>(`/tutorials/${id}/progress`, data);
    return res.data;
  },
  listAdminTutorials: async (category?: string) => {
    let url = '/admin/tutorials';
    if (category && category !== 'all') url += `?category=${category}`;
    const res = await api.get<Tutorial[]>(url);
    return res.data;
  },
  createTutorial: async (data: any) => {
    const res = await api.post<Tutorial>('/admin/tutorials', data);
    return res.data;
  },
  updateTutorial: async (id: string, data: any) => {
    const res = await api.put<Tutorial>(`/admin/tutorials/${id}`, data);
    return res.data;
  },
  deleteTutorial: async (id: string) => {
    const res = await api.delete(`/admin/tutorials/${id}`);
    return res.data;
  }
};

export const themeApi = {
  getActiveTheme: async () => {
    const res = await api.get<ThemeConfiguration>('/config/theme');
    return res.data;
  },
  listAdminThemes: async () => {
    const res = await api.get<ThemeConfiguration[]>('/admin/config/theme');
    return res.data;
  },
  createTheme: async (data: any) => {
    const res = await api.post<ThemeConfiguration>('/admin/config/theme', data);
    return res.data;
  },
  updateTheme: async (id: string, data: any) => {
    const res = await api.put<ThemeConfiguration>(`/admin/config/theme/${id}`, data);
    return res.data;
  },
  applyTheme: async (id: string) => {
    const res = await api.post<ThemeConfiguration>(`/admin/config/theme/apply/${id}`);
    return res.data;
  },
  rollbackTheme: async (id: string, versionNumber: number) => {
    const res = await api.post<ThemeConfiguration>(`/admin/config/theme/rollback/${id}/${versionNumber}`);
    return res.data;
  },
  getUserPreference: async () => {
    const res = await api.get<UserThemePreference>('/users/me/theme');
    return res.data;
  },
  setUserPreference: async (data: any) => {
    const res = await api.put<UserThemePreference>('/users/me/theme', data);
    return res.data;
  }
};

export const featureFlagsApi = {
  getPublicFlags: async () => {
    const res = await api.get<Record<string, boolean>>('/config/flags');
    return res.data;
  },
  listAdminFlags: async () => {
    const res = await api.get<FeatureFlag[]>('/admin/config/flags');
    return res.data;
  },
  toggleFlag: async (flagKey: string, isEnabled: boolean, description?: string) => {
    const res = await api.patch<FeatureFlag>(`/admin/config/flags/${flagKey}`, {
      is_enabled: isEnabled,
      description
    });
    return res.data;
  }
};

export default api;

