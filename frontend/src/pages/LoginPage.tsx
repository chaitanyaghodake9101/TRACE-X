import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, Lock, Mail, ArrowRight, Zap, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';
import { authApi } from '../services/api';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
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
      navigate('/cases');
    } catch (err: any) {
      try {
        const googleData = await authApi.loginGoogle();
        localStorage.setItem('tracex_token', googleData.access_token);
        localStorage.setItem('tracex_user', JSON.stringify(googleData.user));
        navigate('/cases');
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

  const handleDemoAccess = async () => {
    try {
      setLoading(true);
      const data = await authApi.loginGoogle('mock-demo-token');
      localStorage.setItem('tracex_token', data.access_token);
      localStorage.setItem('tracex_user', JSON.stringify(data.user));
      navigate('/cases');
    } catch (err) {
      setError('Unable to initialize demo session.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-cyan-400 shadow-xl shadow-cyan-500/10">
            <Shield className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-400 bg-clip-text text-transparent">
            TRACE-X
          </h1>
          <p className="text-sm text-slate-400 max-w-xs mx-auto">
            Trusted Relationship & Analytical Crime Engine
          </p>
        </div>

        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
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
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Official Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-medium text-slate-300">Passcode</label>
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setError(''); setSuccessMsg(''); }}
                    className="text-xs text-cyan-400 hover:text-cyan-300"
                  >
                    Forgot Passcode?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
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
              <div className="text-xs text-slate-400 leading-relaxed">
                Enter your registered official email address. A single-use cryptographic token will be dispatched.
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Official Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
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
                className="w-full py-2 text-xs text-slate-400 hover:text-slate-300 text-center"
              >
                Back to Sign In
              </button>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="text-xs text-slate-400 leading-relaxed">
                Update passcode for <strong className="text-cyan-400">{email}</strong>.
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">New Passcode</label>
                <input
                  type="password"
                  required
                  placeholder="Min 8 chars"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Confirm New Passcode</label>
                <input
                  type="password"
                  required
                  placeholder="Re-enter passcode"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
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
                  <div className="w-full border-t border-slate-800"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-slate-900 px-2 text-slate-500">Evaluation & Demo</span>
                </div>
              </div>

              <button
                onClick={handleDemoAccess}
                type="button"
                className="w-full py-2.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-200 font-medium text-sm rounded-lg flex items-center justify-center space-x-2 transition-colors"
              >
                <Zap className="w-4 h-4 text-cyan-400" />
                <span>One-Click Senior Investigator Demo</span>
              </button>
            </>
          )}
        </div>

        <div className="text-center text-xs text-slate-500">
          TRACE-X v1.0 • Designed for Law Enforcement Intelligence Analysis (MHA SIH26189)
        </div>
      </div>
    </div>
  );
};
