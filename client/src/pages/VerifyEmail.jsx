import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api.js';

const VerifyEmail = () => {
  const { token } = useParams();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Checking your verification link...');

  useEffect(() => {
    let active = true;

    const verify = async () => {
      try {
        const response = await api.get(`/auth/verify-email/${token}`);
        if (!active) return;
        setStatus('success');
        setMessage(response.data.message);
      } catch (err) {
        if (!active) return;
        setStatus('error');
        setMessage(err.response?.data?.message || 'This verification link is invalid or has expired.');
      }
    };

    verify();
    return () => { active = false; };
  }, [token]);

  return (
    <section className="relative mx-auto mb-12 max-w-md px-3 py-6 sm:px-4 sm:py-8 lg:px-8">
      <div className="overflow-hidden rounded-2xl bg-white p-6 text-center shadow-card ring-1 ring-slate-200 sm:rounded-3xl sm:p-10">
        <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold ${status === 'success' ? 'bg-emerald-100 text-emerald-600' : status === 'error' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-primary'}`}>
          {status === 'loading' ? '...' : status === 'success' ? '✓' : '!'}
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-secondary sm:text-sm">Email verification</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">
          {status === 'success' ? 'Email verified' : status === 'error' ? 'Link unavailable' : 'Verifying your email'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">{message}</p>
        {status === 'success' ? (
          <p className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-slate-700">Return to your open registration tab and continue creating your account.</p>
        ) : null}
        <Link to="/register" className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 sm:rounded-3xl">
          {status === 'success' ? 'Continue registration' : 'Back to registration'}
        </Link>
      </div>
    </section>
  );
};

export default VerifyEmail;
