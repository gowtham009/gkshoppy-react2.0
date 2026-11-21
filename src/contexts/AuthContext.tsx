import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import {
  AuthSession,
  clearSession,
  confirmSignUp as confirmCognitoSignUp,
  getCurrentSession,
  getUserFromSession,
  signIn as signInWithCognito,
  signUp as signUpWithCognito,
} from '../lib/auth';
import { apiRequest } from '../lib/api';
import { AuthenticatedUser, User } from '../types';

interface AuthContextValue {
  session: AuthSession | null;
  user: AuthenticatedUser | null;
  profile: User | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const currentSession = await getCurrentSession();
        if (!active) return;
        if (!currentSession) {
          setLoading(false);
          return;
        }
        setSession(currentSession);
        setUser(getUserFromSession(currentSession));
        await fetchProfile();
      } catch (error: unknown) {
        if (active) {
          clearSession();
          setSession(null);
          setUser(null);
          setProfile(null);
          console.error('Unable to restore the Cognito session:', error);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  async function fetchProfile() {
    const result = await apiRequest<User>('/profile');
    setProfile(result);
  }

  async function signUp(email: string, password: string, username: string) {
    await signUpWithCognito(email, password, username);
  }

  async function confirmSignUp(email: string, code: string) {
    await confirmCognitoSignUp(email, code);
  }

  async function signIn(email: string, password: string) {
    const newSession = await signInWithCognito(email, password);
    setSession(newSession);
    setUser(getUserFromSession(newSession));
    await fetchProfile();
  }

  async function signOut() {
    clearSession();
    setSession(null);
    setUser(null);
    setProfile(null);
  }

  async function refreshProfile() {
    await fetchProfile();
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        signUp,
        confirmSignUp,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
