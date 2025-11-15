export type User = {
    id: string | null,
    email: string | null,
    name: string | null,
    roles: string[],
    starterCompleted: boolean,
    isAuthenticated: boolean
    loading: boolean,
    error: string | null,
}

export interface UserState {
  user: User;
  setUser: (userData: Partial<User>) => void;
  setRoles: (roles: string[]) => void;
  setStarter: (completed: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (msg: string | null) => void;
  reset: () => void;
}