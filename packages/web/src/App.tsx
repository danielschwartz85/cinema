import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginScreen } from './components/LoginScreen';
import { CinemaPage } from './components/CinemaPage';

function AppContent() {
  const { token, user } = useAuth();
  return token && user ? <CinemaPage /> : <LoginScreen />;
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
