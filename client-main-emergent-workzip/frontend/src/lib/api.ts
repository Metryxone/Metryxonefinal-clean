import type { LbiCategory, InsertLbiCategory, Child, InsertChild, BehaviouralInsight, ChildExam, User } from "@shared/schema";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = localStorage.getItem('metryx_token');
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers: {
      ...authHeaders(options.headers as Record<string, string> ?? {}),
    },
  });
}

// User API
export async function fetchUser(): Promise<User> {
  const response = await authFetch('/api/user');
  if (!response.ok) throw new Error('Failed to fetch user');
  return response.json();
}

export async function switchRole(newRole: string): Promise<User> {
  const response = await authFetch('/api/user/switch-role', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: newRole }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to switch role');
  }
  return response.json();
}

// Dashboard API
export interface DashboardData {
  children: Child[];
  selectedChild: Child | null;
  stats: {
    totalExams: number;
    completed: number;
    pending: number;
    avgScore: number;
    onTimeRate: number;
  } | null;
  exams: ChildExam[];
  insights: BehaviouralInsight[];
}

export async function fetchDashboard(childId?: string): Promise<DashboardData> {
  const url = childId ? `/api/dashboard?childId=${childId}` : '/api/dashboard';
  const response = await authFetch(url);
  if (!response.ok) throw new Error('Failed to fetch dashboard data');
  return response.json();
}

// Children API
export async function fetchChildren(): Promise<Child[]> {
  const response = await authFetch('/api/children');
  if (!response.ok) throw new Error('Failed to fetch children');
  return response.json();
}

export async function createChild(data: Omit<InsertChild, 'parentId'>): Promise<Child> {
  const response = await authFetch('/api/children', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create child');
  }
  return response.json();
}

export async function updateChild(id: string, data: Partial<Omit<InsertChild, 'parentId'>>): Promise<Child> {
  const response = await authFetch(`/api/children/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update child');
  return response.json();
}

export async function deleteChild(id: string): Promise<void> {
  const response = await authFetch(`/api/children/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete child');
}

// Consent API
export async function updateConsent(childId: string, action: 'grant' | 'revoke'): Promise<{ message: string; child: Child }> {
  const response = await authFetch(`/api/children/${childId}/consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  if (!response.ok) throw new Error('Failed to update consent');
  return response.json();
}

// Lbi Categories API
export async function fetchCategories(): Promise<LbiCategory[]> {
  const response = await authFetch('/api/lbi-categories');
  if (!response.ok) throw new Error('Failed to fetch categories');
  return response.json();
}

export async function createCategory(data: Omit<InsertLbiCategory, 'userId'>): Promise<LbiCategory> {
  const response = await authFetch('/api/lbi-categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create category');
  return response.json();
}

export async function updateCategory(id: string, data: Partial<Omit<InsertLbiCategory, 'userId'>>): Promise<LbiCategory> {
  const response = await authFetch(`/api/lbi-categories/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update category');
  return response.json();
}

export async function deleteCategory(id: string): Promise<void> {
  const response = await authFetch(`/api/lbi-categories/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete category');
}

// Supervised Test API
export interface SupervisedTestSession {
  id: string;
  examId: string;
  parentId: string;
  childId: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
}

export async function startSupervisedTest(examId: string, childId: string): Promise<{ message: string; session: SupervisedTestSession }> {
  const response = await authFetch('/api/supervised-test/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ examId, childId }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to start supervised test');
  }
  return response.json();
}
