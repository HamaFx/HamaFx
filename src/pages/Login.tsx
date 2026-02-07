import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Mail, Lock, User, AlertCircle, ArrowRight, Bot, Shield, BarChart3 } from 'lucide-react';
// cn utility available if needed
import { useAuthStore } from '@/stores/authStore';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { register, login } = useAuthStore();

  const scrollIntoViewOnMobile = (target: EventTarget | null) => {
    if (window.innerWidth >= 768 || !(target instanceof HTMLElement)) return;
    window.setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        if (!username.trim()) {
          setError('Username is required');
          setLoading(false);
          usernameRef.current?.focus();
          return;
        }
        const result = await register(email, password, username);
        if (result.success) {
          navigate('/');
        } else {
          setError(result.error || 'Registration failed');
        }
      } else {
        const result = await login(email, password);
        if (result.success) {
          navigate('/');
        } else {
          setError(result.error || 'Login failed');
          emailRef.current?.focus();
        }
      }
    } catch {
      setError('An unexpected error occurred');
    }
    setLoading(false);
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    const demoEmail = 'demo@hamafx.app';
    const demoPass = 'demo123';
    // Try login first, if fails, register
    const loginResult = await login(demoEmail, demoPass);
    if (loginResult.success) {
      navigate('/');
    } else {
      const regResult = await register(demoEmail, demoPass, 'Demo Trader');
      if (regResult.success) {
        navigate('/');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-nexus-bg">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-indigo-950/30 via-nexus-bg to-violet-950/20 pointer-events-none" />

      <div className="relative w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20 mb-4">
            <TrendingUp className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
            HamaFX
          </h1>
          <p className="text-sm text-slate-400 mt-1">AI Trading Intelligence</p>
        </div>

        {/* Auth Card */}
        <div className="bg-nexus-card rounded-2xl border border-nexus-border p-6 space-y-5">
          <div className="text-center">
            <h2 className="text-lg font-semibold">{isRegister ? 'Create Account' : 'Welcome Back'}</h2>
            <p className="text-sm text-slate-400 mt-1">
              {isRegister ? 'Start paper trading with $100,000' : 'Sign in to your account'}
            </p>
          </div>

          {error && (
            <div id="auth-error" className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label htmlFor="auth-username" className="mb-1.5 block text-xs text-slate-400">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    ref={usernameRef}
                    id="auth-username"
                    name="username"
                    type="text"
                    placeholder="trader_01"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    onFocus={(e) => scrollIntoViewOnMobile(e.target)}
                    autoComplete="username"
                    autoCapitalize="none"
                    aria-describedby={error ? 'auth-error' : undefined}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-nexus-elevated border border-nexus-border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 placeholder:text-slate-600"
                    enterKeyHint="next"
                    required
                  />
                </div>
              </div>
            )}
            <div>
              <label htmlFor="auth-email" className="mb-1.5 block text-xs text-slate-400">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  ref={emailRef}
                  id="auth-email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={(e) => scrollIntoViewOnMobile(e.target)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-nexus-elevated border border-nexus-border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 placeholder:text-slate-600"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="off"
                  autoCorrect="off"
                  aria-describedby={error ? 'auth-error' : undefined}
                  enterKeyHint="next"
                  required
                />
              </div>
            </div>
            <div>
              <label htmlFor="auth-password" className="mb-1.5 block text-xs text-slate-400">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  ref={passwordRef}
                  id="auth-password"
                  name="password"
                  type="password"
                  placeholder="min 4 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={(e) => scrollIntoViewOnMobile(e.target)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-nexus-elevated border border-nexus-border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 placeholder:text-slate-600"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  aria-describedby={error ? 'auth-error' : undefined}
                  enterKeyHint={isRegister ? 'go' : 'done'}
                  required
                  minLength={4}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-11 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-semibold disabled:opacity-50 transition-[background-position,opacity,transform] duration-200 flex items-center justify-center gap-2"
            >
              {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-nexus-border" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-nexus-card px-3 text-slate-500">or</span></div>
          </div>

          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full min-h-11 py-3 rounded-xl bg-nexus-elevated border border-nexus-border text-sm font-medium text-slate-300 hover:text-white hover:border-indigo-500/30 transition-[color,border-color,opacity] duration-200 disabled:opacity-50"
          >
            Try Demo Account ($100K Paper Trading)
          </button>

          <p className="text-center text-sm text-slate-400">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button type="button" onClick={() => { setIsRegister(!isRegister); setError(''); }} className="text-indigo-400 hover:text-indigo-300 font-medium">
              {isRegister ? 'Sign In' : 'Register'}
            </button>
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Bot, label: 'AI Analysis', desc: 'Gemini-powered' },
            { icon: BarChart3, label: 'Live Charts', desc: 'Real-time data' },
            { icon: Shield, label: 'Paper Trade', desc: '$100K virtual' },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="text-center p-3 rounded-xl bg-nexus-card/50 border border-nexus-border/50">
              <Icon className="w-5 h-5 mx-auto mb-1.5 text-indigo-400" />
              <p className="text-xs font-medium">{label}</p>
              <p className="text-xs text-slate-500">{desc}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-slate-600 leading-relaxed">
          ⚠️ Hama Fx is for educational purposes only. Not financial advice.
          <br />Paper trading uses simulated funds. All data stored locally.
        </p>
      </div>
    </div>
  );
}
