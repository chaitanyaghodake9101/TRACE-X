import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, Lock, Mail, ArrowRight, Zap, KeyRound, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { authApi } from '../services/api';
import { ThemeToggle } from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark } = useTheme();
  
  const [email, setEmail] = useState('demo.investigator@tracex.gov.in');
  const [password, setPassword] = useState('DemoSecretPass123!');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState<string | null>(null);
  
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>('login');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Read reset token securely from URL fragment (#token=...) to avoid referrer leakage (§4.C.4)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('token=')) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('token');
      const emailParam = params.get('email');
      if (token) {
        setResetToken(token);
        if (emailParam) setEmail(emailParam);
        setMode('reset');
      }
    }
  }, [location]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      setSuccessMsg('');
      const data = await authApi.login(email, password);
      localStorage.setItem('tracex_token', data.access_token);
      localStorage.setItem('tracex_user', JSON.stringify(data.user));
      
      if (data.user?.role === 'admin') {
        navigate('/admin/officers');
      } else {
        navigate('/cases');
      }
    } catch (err: any) {
      try {
        const googleData = await authApi.loginGoogle();
        localStorage.setItem('tracex_token', googleData.access_token);
        localStorage.setItem('tracex_user', JSON.stringify(googleData.user));
        if (googleData.user?.role === 'admin') {
          navigate('/admin/officers');
        } else {
          navigate('/cases');
        }
      } catch (innerErr) {
        setError('Invalid credentials or unauthorized access. Please verify details.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      setSuccessMsg('');
      const res = await authApi.forgotPassword(email);
      setSuccessMsg(res.message || 'If an eligible account exists, reset instructions have been dispatched.');
    } catch (err: any) {
      setSuccessMsg('If an eligible account exists, reset instructions have been dispatched.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      setSuccessMsg('');
      await authApi.resetPassword(resetToken || '', newPassword);
      setSuccessMsg('Passcode successfully updated. Please sign in with your new passcode.');
      setMode('login');
      setPassword(newPassword);
      window.location.hash = '';
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Reset token is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoAccess = async (targetRole: 'investigator' | 'admin' = 'investigator') => {
    try {
      setLoading(true);
      if (targetRole === 'admin') {
        setEmail('admin@tracex.gov.in');
        setPassword('AdminPass123!');
        const data = await authApi.login('admin@tracex.gov.in', 'AdminPass123!');
        localStorage.setItem('tracex_token', data.access_token);
        localStorage.setItem('tracex_user', JSON.stringify(data.user));
        navigate('/admin/officers');
      } else {
        setEmail('inspector.malhotra@delhipolice.gov.in');
        setPassword('InvestigatorPass123!');
        const data = await authApi.login('inspector.malhotra@delhipolice.gov.in', 'InvestigatorPass123!');
        localStorage.setItem('tracex_token', data.access_token);
        localStorage.setItem('tracex_user', JSON.stringify(data.user));
        navigate('/cases');
      }
    } catch (err) {
      // Fallback local storage for offline demo
      if (targetRole === 'admin') {
        localStorage.setItem('tracex_token', 'mock-admin-token');
        localStorage.setItem(
          'tracex_user',
          JSON.stringify({
            id: 'demo-admin-01',
            full_name: 'Director General (Admin)',
            email: 'admin@tracex.gov.in',
            role: 'admin',
            badge_number: 'MHA-DIR-001',
            station: 'Ministry of Home Affairs HQ',
            is_active: true
          })
        );
        navigate('/admin/officers');
      } else {
        localStorage.setItem('tracex_token', 'mock-demo-token-fallback');
        localStorage.setItem(
          'tracex_user',
          JSON.stringify({
            id: 'demo-officer-01',
            full_name: 'Inspector Rajesh Malhotra',
            email: 'inspector.malhotra@delhipolice.gov.in',
            role: 'senior_investigator',
            badge_number: 'DL-POL-8841',
            station: 'Special Cell / Connaught Place PS',
            is_active: true
          })
        );
        navigate('/cases');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col justify-between p-6 transition-colors duration-300 relative ${
      isDark
        ? 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100'
        : 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-slate-200 text-slate-900'
    }`}>
      {/* Top Bar with Back to Welcome & Theme Toggle */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between z-10">
        <button
          onClick={() => navigate('/')}
          className={`inline-flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
            isDark
              ? 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-cyan-400'
              : 'bg-white border-slate-300 text-slate-600 hover:text-cyan-600 shadow-sm'
          }`}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Welcome Screen</span>
        </button>

        <ThemeToggle />
      </div>

      <div className="w-full max-w-md mx-auto space-y-6 my-auto z-10">
        <div className="text-center space-y-3">
          <div className={`inline-flex items-center justify-center p-3.5 rounded-2xl border shadow-xl ${
            isDark
              ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 shadow-cyan-500/10'
              : 'bg-white border-cyan-300 text-cyan-600 shadow-slate-200'
          }`}>
            <Shield className="w-9 h-9" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-400 bg-clip-text text-transparent">
            TRACE-X
          </h1>
          <p className={`text-xs sm:text-sm max-w-xs mx-auto ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Trusted Relationship & Analytical Crime Engine
          </p>
        </div>

        <div className={`backdrop-blur-md border rounded-2xl p-7 sm:p-8 shadow-2xl space-y-6 transition-colors ${
          isDark
            ? 'bg-slate-900/90 border-slate-800 shadow-slate-950'
            : 'bg-white/95 border-slate-200 shadow-slate-300/60'
        }`}>
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-400 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-400 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Official Email</label>
                <div className="relative">
                  <Mail className={`w-4 h-4 absolute left-3 top-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full pl-9 pr-3.5 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:border-cyan-500 border ${
                      isDark
                        ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-600'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Passcode</label>
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setError(''); setSuccessMsg(''); }}
                    className="text-xs text-cyan-500 hover:text-cyan-400 font-semibold"
                  >
                    Forgot Passcode?
                  </button>
                </div>
                <div className="relative">
                  <Lock className={`w-4 h-4 absolute left-3 top-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full pl-9 pr-3.5 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:border-cyan-500 border ${
                      isDark
                        ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-600'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-sm rounded-lg shadow-lg shadow-cyan-500/25 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
              >
                <span>{loading ? 'Authenticating...' : 'Sign In with Secure Credentials'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Enter your registered official email address. A single-use cryptographic token will be dispatched.
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Official Email</label>
                <div className="relative">
                  <Mail className={`w-4 h-4 absolute left-3 top-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full pl-9 pr-3.5 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:border-cyan-500 border ${
                      isDark
                        ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-600'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm rounded-lg shadow-lg shadow-cyan-500/25 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
              >
                <span>{loading ? 'Sending Request...' : 'Send Reset Instructions'}</span>
                <KeyRound className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); }}
                className={`w-full py-2 text-xs text-center hover:underline ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
              >
                Back to Sign In
              </button>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Update passcode for <strong className="text-cyan-500">{email}</strong>.
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>New Passcode</label>
                <input
                  type="password"
                  required
                  placeholder="Min 8 chars"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:border-cyan-500 border ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-600'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Confirm New Passcode</label>
                <input
                  type="password"
                  required
                  placeholder="Re-enter passcode"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:border-cyan-500 border ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-600'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-medium text-sm rounded-lg shadow-lg shadow-cyan-500/25 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
              >
                <span>{loading ? 'Updating...' : 'Set New Passcode'}</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </form>
          )}

          {mode === 'login' && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className={`w-full border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className={`px-2 ${isDark ? 'bg-slate-900 text-slate-500' : 'bg-white text-slate-500'}`}>
                    Evaluation & Demo
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => handleDemoAccess('investigator')}
                  type="button"
                  className={`py-2.5 px-3 border font-medium text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-colors ${
                    isDark
                      ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-200'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Investigator Demo</span>
                </button>

                <button
                  onClick={() => handleDemoAccess('admin')}
                  type="button"
                  className={`py-2.5 px-3 border font-medium text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-colors ${
                    isDark
                      ? 'bg-purple-950/40 hover:bg-purple-900/40 border-purple-800/80 text-purple-300'
                      : 'bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-800'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5 text-purple-400" />
                  <span>Admin Portal Demo</span>
                </button>
              </div>
            </>
          )}
        </div>

        <div className={`text-center text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
          TRACE-X v1.0 • Designed for Law Enforcement Intelligence Analysis (MHA SIH26189)
        </div>
      </div>

      <div className="h-4" />
    </div>
  );
};

export default LoginPage;
