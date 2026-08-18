/**
 * LoginPage.tsx
 *
 * Public login page. Resolves the tenant (company) first, then authenticates
 * username/password within that tenant's scope — matching the multi-tenant
 * login flow in dev-system-spec.md §3.
 *
 * On success: admin → /admin, supervisor → /supervisor.
 *
 * Styled strictly per design-system.json:
 *   - bg-slate-50 page shell, bg-white card
 *   - Flat, no shadows — border-slate-200 outlines only
 *   - blue-700 primary button, slate palette inputs
 *   - Sentence case labels, font-weight 400/500 only
 */
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import magaLogo from '../../../assets/maga-logo-47321F1221-seeklogo.com.png';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [tenant, setTenant] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!tenant.trim() || !username.trim() || !password) {
      setError('All fields are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(tenant, username, password);
      // login() sets the user in context; read role from the resolved user
      // by navigating — ProtectedRoute will redirect if needed, but we
      // do a best-effort route here using the auth service result implicitly.
      // We get the role from context after login sets it — re-read via a
      // small indirection: navigate to a role-agnostic path and let
      // ProtectedRoute sort it out, OR we read from context.
      // Simpler: we re-read after login resolves.
      //
      // Because login() is async and setState is synchronous inside AuthContext,
      // we need to get the role from the service result. We do this by reading
      // the user out of localStorage (which authService just wrote) for a
      // clean single-source read — or we pass role back from context.
      //
      // Chosen approach: read from localStorage immediately after login().
      // This avoids a second render cycle before we can navigate.
      const stored = localStorage.getItem('les_auth_user');
      if (stored) {
        const u = JSON.parse(stored) as { role: 'admin' | 'supervisor' };
        navigate(u.role === 'admin' ? '/admin' : '/supervisor', { replace: true });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Login failed. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // Page shell — bg-slate-50, full viewport
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Login card — bg-white, border, no shadow */}
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-lg px-6 py-8">

        {/* Product identity */}
        <div className="flex flex-col items-center gap-2 mb-6">
          <img
            src={magaLogo}
            alt="MäGA Logo"
            className="w-36 h-auto object-contain mb-1"
          />
          <div className="text-center">
            <h1 className="text-sm font-medium tracking-[0.14em] uppercase text-slate-700">
              Labour Entry System
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Sign in to your account</p>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 mb-4">
            <AlertCircle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">

          {/* Company field */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="login-tenant"
              className="text-xs font-medium text-slate-500 uppercase tracking-wide"
            >
              Company
            </label>
            <input
              id="login-tenant"
              type="text"
              autoComplete="organization"
              placeholder="e.g. maga"
              value={tenant}
              onChange={(e) => setTenant(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white text-slate-800 font-medium text-sm min-h-[52px] focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-colors placeholder:text-slate-400 placeholder:font-normal disabled:bg-slate-100 disabled:text-slate-400"
            />
            <p className="text-xs text-slate-400">
              Your company's short name — shown in the URL (e.g.&nbsp;<span className="font-mono">maga</span>)
            </p>
          </div>

          {/* Username field */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="login-username"
              className="text-xs font-medium text-slate-500 uppercase tracking-wide"
            >
              Username
            </label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white text-slate-800 font-medium text-sm min-h-[52px] focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-colors placeholder:text-slate-400 placeholder:font-normal disabled:bg-slate-100 disabled:text-slate-400"
            />
          </div>

          {/* Password field */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="login-password"
              className="text-xs font-medium text-slate-500 uppercase tracking-wide"
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white text-slate-800 font-medium text-sm min-h-[52px] focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-colors placeholder:text-slate-400 placeholder:font-normal disabled:bg-slate-100 disabled:text-slate-400"
            />
          </div>

          {/* Submit button */}
          <button
            id="login-submit"
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-700 text-white font-medium rounded-lg min-h-[52px] px-4 transition-colors active:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed mt-2"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* Dev hint — remove before production */}
        <div className="mt-6 pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-400 text-center font-medium uppercase tracking-wide mb-2">
            Dev credentials
          </p>
          <div className="flex flex-col gap-1 text-xs text-slate-400 font-mono">
            <span>maga / admin / admin123 → admin</span>
            <span>maga / supervisor1 / sup123 → supervisor</span>
          </div>
        </div>
      </div>
    </div>
  );
}
