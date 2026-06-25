'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AuthModal, type AuthModalOptions } from '@/components/auth/auth-modal';
import { AuthShell, applyAuthDocumentState } from '@/components/auth/auth-shell';
import {
  getSession,
  listDeviceSessions,
  type AuthUser,
  type DeviceSession,
} from '@/lib/auth/session';

interface AuthContextValue {
  user: AuthUser | null;
  deviceSessions: DeviceSession[];
  isLoading: boolean;
  isGuest: boolean;
  openAuthModal: (options?: AuthModalOptions) => void;
  reloadAfterAuth: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [deviceSessions, setDeviceSessions] = useState<DeviceSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [authModal, setAuthModal] = useState<AuthModalOptions & { open: boolean }>({
    open: false,
  });
  const initStartedRef = useRef(false);

  const reloadAfterAuth = useCallback((): void => {
    window.location.reload();
  }, []);

  const openAuthModal = useCallback((options: AuthModalOptions = {}): void => {
    setAuthModal({ open: true, ...options });
  }, []);

  const closeAuthModal = useCallback((): void => {
    setAuthModal((prev) => ({ ...prev, open: false }));
  }, []);

  useEffect(() => {
    if (initStartedRef.current) {
      return;
    }
    initStartedRef.current = true;

    void (async () => {
      try {
        const [sessionUser, sessions] = await Promise.all([
          getSession(),
          listDeviceSessions(),
        ]);
        setUser(sessionUser);
        setDeviceSessions(sessions);
        applyAuthDocumentState(sessionUser);
      } catch {
        setUser(null);
        setDeviceSessions([]);
        applyAuthDocumentState(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    applyAuthDocumentState(user);
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      deviceSessions,
      isLoading,
      isGuest: !user,
      openAuthModal,
      reloadAfterAuth,
    }),
    [user, deviceSessions, isLoading, openAuthModal, reloadAfterAuth],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthShell isGuest={!user && !isLoading} onRequireAuth={() => openAuthModal()} />
      <AuthModal
        open={authModal.open}
        lead={authModal.lead}
        initialUsername={authModal.initialUsername}
        onSuccess={authModal.onSuccess ?? reloadAfterAuth}
        onClose={closeAuthModal}
      />
    </AuthContext.Provider>
  );
}
