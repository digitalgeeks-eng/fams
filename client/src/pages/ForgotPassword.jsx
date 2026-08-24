import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.js';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await api.post('/auth/forgot-password', { email });
      setMessage(response.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to send the reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative mx-auto mb-12 max-w-sm px-3 py-6 sm:px-4 sm:py-8 lg:px-8">
      <div className="overflow-hidden rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200 sm:rounded-3xl sm:p-8">
        <div className="mb-6 space-y-2 sm:mb-8 sm:space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-secondary sm:text-sm">Account recovery</p>
          <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">Forgot your password?</h1>
          <p className="text-xs text-slate-500 sm:text-sm">Enter your email and we&apos;ll send you a secure reset link.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {message && <div className="rounded-2xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700 ring-1 ring-emerald-200 sm:text-sm">{message}</div>}
          {error && <div className="rounded-2xl bg-rose-50 px-3 py-2.5 text-xs text-rose-700 ring-1 ring-rose-200 sm:text-sm">{error}</div>}
          <label className="block">
            <span className="text-xs font-medium text-slate-700 sm:text-sm">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={loading}
              autoComplete="email"
              className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 sm:mt-2 sm:px-4 sm:py-3 sm:text-base"
            />
          </label>
          <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60 sm:rounded-3xl sm:py-3 sm:text-base">
            {loading ? 'Sending link...' : 'Send reset link'}
          </button>
          <Link to="/login" className="block text-center text-sm font-semibold text-primary hover:text-blue-600">Back to login</Link>
        </form>
      </div>
    </section>
  );
};

export default ForgotPassword;
