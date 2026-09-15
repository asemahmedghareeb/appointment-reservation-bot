import type {
  DashboardSummary,
  OperationsCaseDetail,
  CaseTimelineItem,
  AttentionItem,
  NotificationDto,
  PaginatedResult,
} from '@visaflow/shared-types';

const API_BASE_URL =
  typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    : process.env.API_URL || 'http://localhost:3001';

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    let errorMessage = `API Error: ${response.status} ${response.statusText}`;
    try {
      const errorBody = await response.json();
      if (errorBody) {
        if (errorBody.error && errorBody.error.message) {
          errorMessage = errorBody.error.message;
        } else if (errorBody.message) {
          errorMessage = Array.isArray(errorBody.message)
            ? errorBody.message.join(', ')
            : errorBody.message;
        }
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  dashboard: {
    getSummary: () => fetchJson<DashboardSummary>('/dashboard/summary'),
  },

  operations: {
    getCaseDetail: (caseId: string) =>
      fetchJson<OperationsCaseDetail>(`/operations/cases/${caseId}`),
    getCaseTimeline: (caseId: string) =>
      fetchJson<CaseTimelineItem[]>(`/operations/cases/${caseId}/timeline`),
    getAttentionList: (limit = 50) =>
      fetchJson<AttentionItem[]>(`/operations/attention?limit=${limit}`),
    getProvidersHealth: () =>
      fetchJson<any>('/operations/providers/health'),
    getQueueHealth: () =>
      fetchJson<any>('/operations/queue/health'),
    getRecoveryCandidates: () =>
      fetchJson<any[]>('/operations/recovery/candidates'),
  },

  bookingCases: {
    list: (params?: {
      page?: number | undefined;
      limit?: number | undefined;
      status?: string | undefined;
      search?: string | undefined;
    } | undefined) => {
      const query = new URLSearchParams();
      if (params?.page) query.set('page', String(params.page));
      if (params?.limit) query.set('limit', String(params.limit));
      if (params?.status) query.set('status', params.status);
      if (params?.search) query.set('search', params.search);
      const qs = query.toString();
      return fetchJson<PaginatedResult<any>>(`/booking-cases${qs ? `?${qs}` : ''}`);
    },
    getById: (id: string) => fetchJson<any>(`/booking-cases/${id}`),
    create: (data: any) =>
      fetchJson<any>('/booking-cases', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    markReady: (id: string) =>
      fetchJson<any>(`/booking-cases/${id}/ready`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    addApplicant: (caseId: string, data: any) =>
      fetchJson<any>(`/booking-cases/${caseId}/applicants`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchJson<void>(`/booking-cases/${id}`, {
        method: 'DELETE',
      }),
  },

  orchestrator: {
    startAutomation: (caseId: string) =>
      fetchJson<any>(`/orchestrator/cases/${caseId}/start`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    resumeAutomation: (caseId: string, solutionData: any) =>
      fetchJson<any>(`/orchestrator/cases/${caseId}/resume`, {
        method: 'POST',
        body: JSON.stringify(solutionData),
      }),
    getSession: (caseId: string) =>
      fetchJson<any>(`/orchestrator/cases/${caseId}/session`),
  },

  notifications: {
    list: (params?: {
      unreadOnly?: boolean | undefined;
      page?: number | undefined;
      limit?: number | undefined;
    } | undefined) => {
      const query = new URLSearchParams();
      if (params?.unreadOnly !== undefined) query.set('unreadOnly', String(params.unreadOnly));
      if (params?.page) query.set('page', String(params.page));
      if (params?.limit) query.set('limit', String(params.limit));
      const qs = query.toString();
      return fetchJson<PaginatedResult<NotificationDto>>(`/notifications${qs ? `?${qs}` : ''}`);
    },

    markAsRead: (id: string) =>
      fetchJson<NotificationDto>(`/notifications/${id}/read`, {
        method: 'PATCH',
      }),
    markAllAsRead: () =>
      fetchJson<{ updatedCount: number }>('/notifications/read-all', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
  },

  providerRoutes: {
    list: (params?: {
      provider?: string | undefined;
      sourceCountry?: string | undefined;
      destinationCountry?: string | undefined;
      applicationCentre?: string | undefined;
      visaCategory?: string | undefined;
      visaSubcategory?: string | undefined;
      enabled?: boolean | undefined;
    }) => {
      const query = new URLSearchParams();
      if (params?.provider) query.set('provider', params.provider);
      if (params?.sourceCountry) query.set('sourceCountry', params.sourceCountry);
      if (params?.destinationCountry) query.set('destinationCountry', params.destinationCountry);
      if (params?.applicationCentre) query.set('applicationCentre', params.applicationCentre);
      if (params?.visaCategory) query.set('visaCategory', params.visaCategory);
      if (params?.visaSubcategory) query.set('visaSubcategory', params.visaSubcategory);
      if (params?.enabled !== undefined) query.set('enabled', String(params.enabled));
      const qs = query.toString();
      return fetchJson<any[]>(`/provider-routes${qs ? `?${qs}` : ''}`);
    },
  },

  clients: {
    list: (params?: { page?: number | undefined; limit?: number | undefined; search?: string | undefined } | undefined) => {
      const query = new URLSearchParams();
      if (params?.page) query.set('page', String(params.page));
      if (params?.limit) query.set('limit', String(params.limit));
      if (params?.search) query.set('search', params.search);
      const qs = query.toString();
      return fetchJson<PaginatedResult<any>>(`/clients${qs ? `?${qs}` : ''}`);
    },
    getById: (id: string) => fetchJson<any>(`/clients/${id}`),
    create: (data: { name: string; email?: string | undefined; phone?: string | undefined }) =>
      fetchJson<any>('/clients', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  applicants: {
    list: (params?: { page?: number | undefined; limit?: number | undefined; search?: string | undefined } | undefined) => {
      const query = new URLSearchParams();
      if (params?.page) query.set('page', String(params.page));
      if (params?.limit) query.set('limit', String(params.limit));
      if (params?.search) query.set('search', params.search);
      const qs = query.toString();
      return fetchJson<PaginatedResult<any>>(`/applicants${qs ? `?${qs}` : ''}`);
    },
    getById: (id: string) => fetchJson<any>(`/applicants/${id}`),
    lookupByPassport: (passportNumber: string) =>
      fetchJson<any>('/applicants/lookup/passport', {
        method: 'POST',
        body: JSON.stringify({ passportNumber }),
      }),
    create: (data: any) =>
      fetchJson<any>('/applicants', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
};
