import { User, UserState } from '@/lib/types';
import { create } from 'zustand';
import { persist } from "zustand/middleware";
const initialUser: User = {
    id: null,
    email: null,
    name: null,
    roles: [],
    starterCompleted: false,
    isAuthenticated: false,
    loading: false,
    error: null,
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: initialUser,

      setUser: (userData) =>
        set((state) => ({
          user: { ...state.user, ...userData, isAuthenticated: true },
        })),

      setRoles: (roles) =>
        set((state) => ({
          user: { ...state.user, roles },
        })),

      setStarter: (completed) =>
        set((state) => ({
          user: { ...state.user, starterCompleted: completed },
        })),

      setLoading: (loading) =>
        set((state) => ({
          user: { ...state.user, loading },
        })),

      setError: (msg) =>
        set((state) => ({
          user: { ...state.user, error: msg },
        })),

      reset: () => set({ user: initialUser }),
    }),
    {
      name: "biex-user",
    }
  )
);