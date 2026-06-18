function authHeader(): Record<string, string> {
  const t = localStorage.getItem('metryx_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export interface ProfileServiceResult<T> {
  success: boolean;
  data?:   T;
  error?:  string;
}

export const profileService = {
  async get(userId: string): Promise<ProfileServiceResult<any>> {
    try {
      const r = await fetch(`/api/cv/profile/${userId}`, { headers: authHeader() });
      const d = await r.json();
      return d.success ? { success: true, data: d.profile } : { success: false, error: 'Profile not found' };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  async init(userId: string, email: string, name: string): Promise<ProfileServiceResult<any>> {
    try {
      const r = await fetch('/api/cv/init-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ userId, email, name }),
      });
      const d = await r.json();
      return d.success ? { success: true, data: d.profile } : { success: false, error: 'Init failed' };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  async update(userId: string, section: string, data: unknown): Promise<ProfileServiceResult<any>> {
    try {
      const r = await fetch(`/api/cv/profile/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ section, data }),
      });
      const d = await r.json();
      return d.success ? { success: true, data: d.profile } : { success: false, error: d.message };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  async parseCV(file: File): Promise<ProfileServiceResult<any>> {
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await fetch('/api/cv/parse', { method: 'POST', headers: authHeader(), body: form });
      const d = await r.json();
      return d.success !== false ? { success: true, data: d } : { success: false, error: d.message };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },
};
