import { create } from 'zustand';
import { profileService } from '@/lib/services/profileService';

interface ProfileState {
  profile:    any | null;
  loading:    boolean;
  error:      string | null;
  lastFetched:number | null;

  fetchProfile:  (userId: string, email?: string, name?: string) => Promise<void>;
  updateProfile: (p: any) => void;
  setProfile:    (p: any) => void;
  reset:         () => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile:     null,
  loading:     false,
  error:       null,
  lastFetched: null,

  fetchProfile: async (userId, email = '', name = '') => {
    if (!userId) return;
    set({ loading: true, error: null });
    try {
      const result = await profileService.get(userId);
      if (result.success && result.data) {
        set({ profile: result.data, loading: false, lastFetched: Date.now() });
      } else {
        const init = await profileService.init(userId, email, name);
        set({ profile: init.data ?? null, loading: false, lastFetched: Date.now() });
      }
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  updateProfile: (p) => set({ profile: p }),
  setProfile:    (p) => set({ profile: p, lastFetched: Date.now() }),
  reset:         ()  => set({ profile: null, loading: false, error: null, lastFetched: null }),
}));
