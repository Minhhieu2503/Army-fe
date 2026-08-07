import React, { useState, useEffect } from 'react';
import { User, Lock, Mail, Users, KeyRound, ShieldCheck, AlertCircle, Info } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (token: string, user: { username: string; role: string; email?: string }) => void;
  onStudentJoin: (pin: string) => void;
  backendUrl: string;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onStudentJoin, backendUrl }) => {
  const [role, setRole] = useState<'student' | 'presenter'>('student');
  const [presenterMode, setPresenterMode] = useState<'login' | 'register'>('login');

  const [pin, setPin] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedUser, setSavedUser] = useState<any>(null);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) {
      try {
        const parsed = JSON.parse(u);
        if (parsed && parsed.role === 'student') {
          localStorage.removeItem('user');
          localStorage.removeItem('token');
        } else {
          setSavedUser(parsed);
        }
      } catch (e) {}
    }
  }, []);

  // Initialize Google Login Button
  useEffect(() => {
    const initGoogle = () => {
      if (role === 'presenter' && !savedUser && (window as any).google) {
        try {
          const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
          if (!clientId) {
            console.warn('VITE_GOOGLE_CLIENT_ID chưa được cấu hình ở tệp .env');
            return;
          }

          (window as any).google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleCredentialResponse
          });

          const btnParent = document.getElementById('google-signin-btn');
          if (btnParent) {
            (window as any).google.accounts.id.renderButton(
              btnParent,
              {
                type: 'standard',
                theme: 'filled_blue',
                size: 'large',
                text: 'signin_with',
                shape: 'rectangular',
                logo_alignment: 'left',
                width: 320
              }
            );
          }
        } catch (err) {
          console.error('Lỗi khi tải Google Login Button:', err);
        }
      }
    };

    const timer = setTimeout(initGoogle, 150);
    return () => clearTimeout(timer);
  }, [role, presenterMode, savedUser]);

  const handleGoogleCredentialResponse = async (response: any) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await fetch(`${backendUrl}/api/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ idToken: response.credential })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Xác thực Google thất bại');
      }

      if (data.user && data.user.role === 'student') {
        throw new Error('Tài khoản của bạn hiện là Học Viên và chưa được kích hoạt quyền Giảng Viên. Vui lòng liên hệ cán bộ quản lý để nâng cấp.');
      }

      setSuccessMsg('Đăng nhập bằng Google thành công!');
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setSavedUser(data.user);
      
      setTimeout(() => {
        onLoginSuccess(data.token, data.user);
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Đã xảy ra lỗi khi kết nối máy chủ Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!pin.trim()) {
      setErrorMsg('Vui lòng nhập mã PIN lớp học.');
      return;
    }
    onStudentJoin(pin.trim());
  };

  const handlePresenterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!username.trim() || !password) {
      setErrorMsg('Vui lòng điền đầy đủ thông tin bắt buộc.');
      return;
    }

    if (presenterMode === 'register') {
      if (username.trim().length < 3) {
        setErrorMsg('Tên tài khoản phải dài từ 3 ký tự trở lên.');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('Mật khẩu phải dài tối thiểu 6 ký tự.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Mật khẩu xác nhận không khớp.');
        return;
      }
      if (email.trim() && !/\S+@\S+\.\S+/.test(email)) {
        setErrorMsg('Email không hợp lệ.');
        return;
      }
    }

    setLoading(true);

    try {
      const endpoint = presenterMode === 'register' ? 'register' : 'login';
      const bodyPayload = presenterMode === 'register' 
        ? { username: username.trim(), password, email: email.trim() }
        : { username: username.trim(), password };

      const res = await fetch(`${backendUrl}/api/auth/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyPayload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Giao dịch thất bại.');
      }

      if (data.user && data.user.role === 'student') {
        throw new Error(presenterMode === 'register' 
          ? 'Đăng ký thành công! Tài khoản của bạn hiện có vai trò Học Viên. Vui lòng liên hệ cán bộ quản lý để kích hoạt quyền Giảng Viên.'
          : 'Tài khoản của bạn hiện là Học Viên và chưa được kích hoạt quyền Giảng Viên. Vui lòng liên hệ cán bộ quản lý để nâng cấp.');
      }

      setSuccessMsg(data.message);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setSavedUser(data.user);

      setTimeout(() => {
        onLoginSuccess(data.token, data.user);
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Đã xảy ra lỗi kết nối.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
      color: '#ffffff',
      fontFamily: 'system-ui, sans-serif'
    }}>
      {/* Background Military Image Overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: 'url("/vietnam_army_bg.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'brightness(0.3) contrast(1.1)',
        zIndex: -2
      }} />

      {/* Grid Tech Lines Pattern */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: 'radial-gradient(rgba(34, 197, 94, 0.15) 1px, transparent 1px)',
        backgroundSize: '30px 30px',
        zIndex: -1,
        pointerEvents: 'none'
      }} />

      {/* Header Logo */}
      <div style={{ textAlign: 'center', marginBottom: '32px', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '8px' }}>
          <ShieldCheck size={38} style={{ color: 'var(--color-primary, #22c55e)' }} />
          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, margin: 0, letterSpacing: '2px', textShadow: '0 0 10px rgba(34, 197, 94, 0.5)' }}>
            PHÁP LUẬT 3 PHÚT
          </h1>
        </div>
        <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.95rem', letterSpacing: '1px' }}>
          TRƯỜNG SƠN ĐÔNG - TRƯỜNG SƠN TÂY | KỶ CƯƠNG QUÂN ĐỘI
        </p>
      </div>

      {/* Auth Glassmorphism Card */}
      <div 
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '440px',
          borderRadius: '24px',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          background: 'rgba(9, 24, 16, 0.85)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.6), 0 0 20px rgba(34, 197, 94, 0.15)',
          padding: '32px 24px',
          zIndex: 1,
          backdropFilter: 'blur(12px)'
        }}
      >
        {/* Màn hình sẽ chuyển đổi giữa nhập PIN học viên hoặc Đăng nhập giảng viên bên dưới */}

        {/* Error / Success Notifications */}
        {errorMsg && (
          <div style={{
            background: 'rgba(220, 38, 38, 0.2)',
            border: '1px solid #dc2626',
            borderRadius: '10px',
            padding: '12px 16px',
            fontSize: '0.85rem',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            color: '#fca5a5'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div style={{
            background: 'rgba(22, 163, 74, 0.2)',
            border: '1px solid #16a34a',
            borderRadius: '10px',
            padding: '12px 16px',
            fontSize: '0.85rem',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            color: '#86efac'
          }}>
            <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 1. STUDENT VIEW */}
        {role === 'student' && (
          <div>
            <form onSubmit={handleStudentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'rgba(34, 197, 94, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  border: '1px dashed var(--color-primary, #22c55e)'
                }}>
                  <Users size={28} style={{ color: 'var(--color-primary, #22c55e)' }} />
                </div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '1.2rem' }}>Chào Mừng Học Viên</h3>
                <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem', margin: 0 }}>
                  Nhập mã PIN hiển thị trên màn hình máy chiếu lớp học để bắt đầu tham gia trả lời.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase' }}>
                  MÃ PIN PHÒNG HỌC
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: 1234"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} // Numeric only
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    background: 'rgba(0, 0, 0, 0.3)',
                    color: '#ffffff',
                    fontSize: '1.2rem',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    letterSpacing: '8px'
                  }}
                />
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  border: 'none',
                  width: '100%',
                  marginTop: '10px',
                  background: 'var(--color-primary, #22c55e)',
                  color: '#000000',
                  boxShadow: '0 4px 15px rgba(34, 197, 94, 0.3)'
                }}
              >
                VÀO HỌC TẬP TƯƠNG TÁC →
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '24px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '16px' }}>
              <button
                type="button"
                onClick={() => {
                  setRole('presenter');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primary, #22c55e)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  textDecoration: 'underline',
                  fontWeight: 600,
                  transition: 'opacity 0.2s'
                }}
                onMouseOver={(e) => (e.currentTarget.style.opacity = '0.8')}
                onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
              >
                Đăng nhập Giảng viên / Quản trị viên →
              </button>
            </div>
          </div>
        )}

        {/* 2. PRESENTER VIEW */}
        {role === 'presenter' && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {savedUser ? (
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'rgba(34, 197, 94, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  border: '1px solid var(--color-primary, #22c55e)'
                }}>
                  <User size={28} style={{ color: 'var(--color-primary, #22c55e)' }} />
                </div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem' }}>Xin chào, {savedUser.username}!</h3>
                <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem', marginBottom: '24px', lineHeight: '1.5' }}>
                  Bạn đang đăng nhập với vai trò <strong>Giảng viên</strong>.
                </p>

                <button
                  onClick={() => onLoginSuccess(localStorage.getItem('token') || '', savedUser)}
                  className="btn-primary"
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    border: 'none',
                    width: '100%',
                    marginBottom: '12px',
                    background: 'var(--color-primary, #22c55e)',
                    color: '#000000'
                  }}
                >
                  VÀO TRANG QUẢN TRỊ
                </button>

                <button
                  onClick={() => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setSavedUser(null);
                  }}
                  className="btn-secondary"
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    width: '100%',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'transparent',
                    color: '#ffffff'
                  }}
                >
                  ĐĂNG XUẤT TÀI KHOẢN
                </button>
              </div>
            ) : (
              <>
                {/* Login / Register Toggle Header */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginBottom: '24px' }}>
                  <span
                    onClick={() => {
                      setPresenterMode('login');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    style={{
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      color: presenterMode === 'login' ? 'var(--color-primary, #22c55e)' : '#a1a1aa',
                      borderBottom: presenterMode === 'login' ? '2px solid var(--color-primary, #22c55e)' : 'none',
                      paddingBottom: '4px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Đăng Nhập
                  </span>
                  <span
                    onClick={() => {
                      setPresenterMode('register');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    style={{
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      color: presenterMode === 'register' ? 'var(--color-primary, #22c55e)' : '#a1a1aa',
                      borderBottom: presenterMode === 'register' ? '2px solid var(--color-primary, #22c55e)' : 'none',
                      paddingBottom: '4px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Tạo Tài Khoản
                  </span>
                </div>

                {/* Traditional Form */}
                <form onSubmit={handlePresenterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Username field */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.6)' }}>
                      TÊN ĐĂNG NHẬP
                    </label>
                    <div style={{ position: 'relative' }}>
                      <User size={18} style={{ position: 'absolute', left: '14px', top: '14px', color: 'rgba(255,255,255,0.4)' }} />
                      <input
                        type="text"
                        required
                        placeholder="Nhập tài khoản"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        style={{
                          padding: '12px 16px 12px 42px',
                          borderRadius: '10px',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          background: 'rgba(0, 0, 0, 0.3)',
                          color: '#ffffff',
                          fontSize: '0.95rem',
                          width: '100%',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  {/* Email field (only for Register) */}
                  {presenterMode === 'register' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.6)' }}>
                        EMAIL (TÙY CHỌN)
                      </label>
                      <div style={{ position: 'relative' }}>
                        <Mail size={18} style={{ position: 'absolute', left: '14px', top: '14px', color: 'rgba(255,255,255,0.4)' }} />
                        <input
                          type="email"
                          placeholder="email@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          style={{
                            padding: '12px 16px 12px 42px',
                            borderRadius: '10px',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            background: 'rgba(0, 0, 0, 0.3)',
                            color: '#ffffff',
                            fontSize: '0.95rem',
                            width: '100%',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Password field */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.6)' }}>
                      MẬT KHẨU
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={18} style={{ position: 'absolute', left: '14px', top: '14px', color: 'rgba(255,255,255,0.4)' }} />
                      <input
                        type="password"
                        required
                        placeholder="Mật khẩu của bạn"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{
                          padding: '12px 16px 12px 42px',
                          borderRadius: '10px',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          background: 'rgba(0, 0, 0, 0.3)',
                          color: '#ffffff',
                          fontSize: '0.95rem',
                          width: '100%',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  {/* Confirm Password field (only for Register) */}
                  {presenterMode === 'register' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.6)' }}>
                        XÁC NHẬN MẬT KHẨU
                      </label>
                      <div style={{ position: 'relative' }}>
                        <Lock size={18} style={{ position: 'absolute', left: '14px', top: '14px', color: 'rgba(255,255,255,0.4)' }} />
                        <input
                          type="password"
                          required
                          placeholder="Xác nhận lại mật khẩu"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          style={{
                            padding: '12px 16px 12px 42px',
                            borderRadius: '10px',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            background: 'rgba(0, 0, 0, 0.3)',
                            color: '#ffffff',
                            fontSize: '0.95rem',
                            width: '100%',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary"
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      cursor: 'pointer',
                      border: 'none',
                      marginTop: '8px',
                      opacity: loading ? 0.7 : 1,
                      background: 'var(--color-primary, #22c55e)',
                      color: '#000000'
                    }}
                  >
                    {loading ? 'ĐANG XỬ LÝ...' : presenterMode === 'login' ? 'ĐĂNG NHẬP HỆ THỐNG' : 'ĐĂNG KÝ TÀI KHẢN'}
                  </button>
                </form>

                {/* Separator line */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  margin: '24px 0 16px 0',
                  color: 'rgba(255, 255, 255, 0.3)',
                  fontSize: '0.8rem'
                }}>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.15)' }} />
                  <span style={{ padding: '0 12px' }}>HOẶC TIẾP TỤC VỚI</span>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.15)' }} />
                </div>

                {/* Google Sign-in Button Wrapper */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <div id="google-signin-btn" style={{ minHeight: '44px' }} />
                </div>
              </>
            )}

            <div style={{ textAlign: 'center', marginTop: '24px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '16px' }}>
              <button
                type="button"
                onClick={() => {
                  setRole('student');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.5)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  textDecoration: 'underline',
                  fontWeight: 500,
                  transition: 'color 0.2s'
                }}
                onMouseOver={(e) => (e.currentTarget.style.color = 'var(--color-primary, #22c55e)')}
                onMouseOut={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)')}
              >
                ← Quay lại màn hình nhập mã PIN Học viên
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div style={{ 
        marginTop: '32px', 
        fontSize: '0.75rem', 
        color: 'rgba(255, 255, 255, 0.4)', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '6px',
        zIndex: 1
      }}>
        <Info size={14} style={{ color: 'var(--color-primary, #22c55e)' }} />
        <span>Hệ thống tuân thủ các quy tắc bảo mật & mã hóa đầu cuối quân sự.</span>
      </div>
    </div>
  );
};
