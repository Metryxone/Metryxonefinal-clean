function authHeader(): Record<string, string> {
  const t = localStorage.getItem('metryx_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export const competencyService = {
  async getScore(userId: string) {
    try {
      const r = await fetch(`/api/competency/score/${userId}`, { headers: authHeader() });
      return await r.json();
    } catch { return null; }
  },

  async startAssessment(userId: string, role: string, stage: string, industry: string) {
    try {
      const r = await fetch('/api/competency/assessment/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ userId, role, stage, industry }),
      });
      return await r.json();
    } catch { return null; }
  },

  async submitAssessment(userId: string, answers: Record<string, number>, metadata: unknown) {
    try {
      const r = await fetch('/api/competency/assessment/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ userId, answers, metadata }),
      });
      return await r.json();
    } catch { return null; }
  },
};
