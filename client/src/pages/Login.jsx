import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

const Login = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [localError, setLocalError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, error: contextError, setError: setContextError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setContextError(null);
    setLocalError('');
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setLocalError('');
    try {
      const result = await login(form);
      setLoading(false);
      if (result?.data?.user?.role === 'admin') navigate('/admin');
      else if (result?.data?.user?.role === 'agent') navigate('/agent');
      else navigate('/student');
    } catch (err) {
      setLoading(false);
      const errorMessage = err.response?.data?.message || contextError || 'Unable to log in';
      setLocalError(errorMessage);
    }
  };

  const displayError = localError || contextError;

  return (
    <section className="relative mx-auto mb-12 sm:mb-16 max-w-sm px-3 sm:px-4 py-6 sm:py-8 lg:px-8">
      <div className="overflow-hidden rounded-2xl sm:rounded-3xl bg-white p-6 sm:p-8 shadow-card ring-1 ring-slate-200">
        <div className="mb-6 sm:mb-8 space-y-2 sm:space-y-3">
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-secondary">Welcome back</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-950">Login to your account</h1>
          <p className="text-xs sm:text-sm text-slate-500">Access student or agent dashboards with a secure login.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {displayError && <div className="rounded-2xl sm:rounded-3xl bg-rose-50 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-rose-700 ring-1 ring-rose-200">{displayError}</div>}
          <label className="block">
            <span className="text-xs sm:text-sm font-medium text-slate-700">Email</span>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              disabled={loading}
              className="mt-1.5 sm:mt-2 w-full rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </label>
          <label className="block">
            <span className="text-xs sm:text-sm font-medium text-slate-700">Password</span>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              disabled={loading}
              className="mt-1.5 sm:mt-2 w-full rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-2xl sm:rounded-3xl bg-primary px-5 py-2.5 sm:py-3 text-sm sm:text-base font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </section>
  );
};

export default Login;
