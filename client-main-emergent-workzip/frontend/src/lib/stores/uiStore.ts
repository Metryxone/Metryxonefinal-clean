import { create } from 'zustand';

type TabId =
  | 'dashboard' | 'profile' | 'skills' | 'resume'
  | 'jobs' | 'interview' | 'learning' | 'pathways'
  | 'mentors' | 'goals' | 'assessment'
  | 'future-map' | 'development' | 'visibility'
  | 'fresher-hub';

interface UIState {
  activeTab:    TabId;
  sidebarOpen:  boolean;
  showWizard:   boolean;
  toasts:       { id: string; message: string; type: 'success' | 'error' | 'info' }[];

  setTab:        (tab: TabId) => void;
  setSidebar:    (open: boolean) => void;
  toggleSidebar: () => void;
  setShowWizard: (show: boolean) => void;
  addToast:      (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast:   (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeTab:   'dashboard',
  sidebarOpen:  true,
  showWizard:   false,
  toasts:       [],

  setTab:        (tab)   => set({ activeTab: tab }),
  setSidebar:    (open)  => set({ sidebarOpen: open }),
  toggleSidebar: ()      => set(s => ({ sidebarOpen: !s.sidebarOpen })),
  setShowWizard: (show)  => set({ showWizard: show }),

  addToast: (message, type = 'info') => {
    const id = `toast-${Date.now()}`;
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 4000);
  },

  removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));
