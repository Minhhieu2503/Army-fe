import { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket';
import { AdminDashboard } from './pages/AdminDashboard';
import { PresenterScreen } from './pages/PresenterScreen';
import { StudentMobile } from './pages/StudentMobile';
import { LoginScreen } from './pages/LoginScreen';
import { Laptop, ShieldAlert, Cpu } from 'lucide-react';

function App() {
  const socketReturn = useSocket();
  const { isConnected, error } = socketReturn;

  // Simple state router: 'home' | 'admin' | 'presenter' | 'student'
  const [currentPage, setCurrentPage] = useState<'home' | 'admin' | 'presenter' | 'student'>('home');
  const [activePin, setActivePin] = useState('');
  const [urlPin, setUrlPin] = useState('');

  // Authentication states
  const [token, setToken] = useState<string>(localStorage.getItem('token') || '');
  const [user, setUser] = useState<{ username: string; role: string; email?: string } | null>(
    localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null
  );

  // Handle URL scanning QR code: e.g., http://localhost:5173/?pin=1234
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pinParam = params.get('pin');
    if (pinParam) {
      setUrlPin(pinParam);
      setCurrentPage('student');
    }
  }, []);

  const handleLoginSuccess = (newToken: string, newUser: { username: string; role: string; email?: string }) => {
    setToken(newToken);
    setUser(newUser);
    setCurrentPage('admin');
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentPage('home');
  };

  const handleStudentJoin = (pin: string) => {
    setUrlPin(pin);
    setCurrentPage('student');
  };

  const handleLaunchSession = (pin: string) => {
    setActivePin(pin);
    setCurrentPage('presenter');
  };

  const handleExitToHome = () => {
    // Clear URL parameters if they exist
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    setCurrentPage('home');
    setActivePin('');
    setUrlPin('');
  };

  const handleExitToAdmin = () => {
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    setCurrentPage(token ? 'admin' : 'home');
    setActivePin('');
    setUrlPin('');
  };

  // Determine dynamic backend URL
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const envApiUrl = import.meta.env.VITE_API_URL;
  const backendUrl = envApiUrl 
    ? envApiUrl 
    : (hostname === 'localhost' || hostname === '127.0.0.1'
      ? `${protocol}//localhost:5000`
      : 'https://army-be.onrender.com');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Global Connection Warning Banner */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.95)',
          color: 'white',
          padding: '8px 16px',
          textAlign: 'center',
          fontSize: '0.85rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          zIndex: 9999
        }}>
          <ShieldAlert size={16} />
          {error} | Hãy đảm bảo backend đã chạy bằng lệnh: <code>npm run dev</code>
        </div>
      )}

      {/* RENDER PAGES */}
      {currentPage === 'home' && (
        <LoginScreen 
          onLoginSuccess={handleLoginSuccess}
          onStudentJoin={handleStudentJoin}
          backendUrl={backendUrl}
        />
      )}

      {currentPage === 'admin' && (
        <AdminDashboard 
          onLaunchSession={handleLaunchSession} 
          backendUrl={backendUrl} 
          userRole={user?.role as any || 'presenter'}
          token={token}
          onLogout={handleLogout}
          userName={user?.username || 'Giảng viên'}
        />
      )}

      {currentPage === 'presenter' && (
        <PresenterScreen 
          pin={activePin} 
          socketReturn={socketReturn} 
          onExit={handleExitToAdmin} 
        />
      )}

      {currentPage === 'student' && (
        <StudentMobile 
          socketReturn={socketReturn} 
          urlPin={urlPin} 
          onExit={handleExitToHome} 
          backendUrl={backendUrl}
        />
      )}

    </div>
  );
}

export default App;
