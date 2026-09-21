import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Headphones,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('Please enter both your username and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await login({
        username: username.trim(),
        password,
      });

      if (!result.success) {
        setErrorMessage(result.error || 'Invalid username or password.');
      }
    } catch {
      setErrorMessage('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-sky-50/30 to-slate-100/80 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans selection:bg-sky-100 selection:text-sky-900">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        {/* Brand Icon & Heading */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 via-indigo-600 to-sky-600 text-white shadow-lg shadow-sky-500/20 border border-sky-400/30">
            <Headphones className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Text to Speech Studio
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Sign in to access voice synthesis, multi-speaker dialogue & transcription tools
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="mt-8 bg-white py-8 px-5 sm:px-10 border border-slate-200/90 rounded-2xl shadow-xl shadow-slate-200/40">
          {/* Error Banner */}
          {errorMessage && (
            <div
              id="login-error-message"
              className="mb-5 p-3.5 rounded-xl border border-rose-200 bg-rose-50/90 text-rose-800 text-xs font-medium flex items-start gap-2.5 shadow-2xs animate-in fade-in slide-in-from-top-1"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          <form id="login-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Username Field */}
            <div>
              <label
                htmlFor="login-username"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Username
              </label>
              <div className="relative rounded-xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  id="login-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  disabled={isLoading}
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Enter your username"
                  className="block w-full pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
                >
                  Password
                </label>
              </div>
              <div className="relative rounded-xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Enter your password"
                  className="block w-full pl-10 pr-11 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all disabled:bg-slate-50 disabled:text-slate-400"
                />
                <button
                  type="button"
                  id="toggle-password-visibility"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  disabled={isLoading}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-slate-600" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                id="login-submit-button"
                disabled={isLoading || !username.trim() || !password}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 shadow-md shadow-sky-500/20 active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Signing in securely...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Studio</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Security Features Info */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-4 text-[11px] text-slate-400">
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Encrypted Session</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
              <span>Protected Studio Access</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
