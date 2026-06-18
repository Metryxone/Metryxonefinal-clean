export type DashboardType = 'parent' | 'institute' | 'hr' | 'student';

export const TOUR_KEYS: Record<DashboardType, string> = {
  parent:    'metryx_tour_parent_v1',
  institute: 'metryx_tour_institute_v1',
  hr:        'metryx_tour_hr_v1',
  student:   'metryx_tour_student_v1',
};

export function shouldShowTour(type: DashboardType = 'parent'): boolean {
  try { return !localStorage.getItem(TOUR_KEYS[type]); } catch { return false; }
}
