import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../services/api.js';

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/auth/reset-password/${token}`, { password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to reset your password. Please request a new link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative mx-auto mb-12 max-w-sm px-3 py-6 sm:px-4 sm:py-8 lg:px-8">
      <div className="overflow-hidden rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200 sm:rounded-3xl sm:p-8">
        <div className="mb-6 space-y-2 sm:mb-8 sm:space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-secondary sm:text-sm">Account recovery</p>
          <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">Set a new password</h1>
          <p className="text-xs text-slate-500 sm:text-sm">Choose a password with at least 6 characters.</p>
        </div>
        {success ? (
          <div className="space-y-4 text-center">
            <p className="rounded-2xl bg-emerald-50 px-3 py-3 text-sm text-emerald-700 ring-1 ring-emerald-200">Password reset successful. Redirecting to login...</p>
            <Link to="/login" className="block text-sm font-semibold text-primary hover:text-blue-600">Go to login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {error && <div className="rounded-2xl bg-rose-50 px-3 py-2.5 text-xs text-rose-700 ring-1 ring-rose-200 sm:text-sm">{error}</div>}
            <label className="block">
              <span className="text-xs font-medium text-slate-700 sm:text-sm">New password</span>
              <input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} autoComplete="new-password" className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 sm:mt-2 sm:px-4 sm:py-3 sm:text-base" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700 sm:text-sm">Confirm password</span>
              <input type="password" required minLength={6} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={loading} autoComplete="new-password" className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 sm:mt-2 sm:px-4 sm:py-3 sm:text-base" />
            </label>
            <button type="submit" disabled={loading || !token} className="inline-flex w-full items-center justify-center rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60 sm:rounded-3xl sm:py-3 sm:text-base">
              {loading ? 'Resetting password...' : 'Reset password'}
            </button>
            <Link to="/login" className="block text-center text-sm font-semibold text-primary hover:text-blue-600">Back to login</Link>
          </form>
        )}
      </div>
    </section>
  );
};

export default ResetPassword;
