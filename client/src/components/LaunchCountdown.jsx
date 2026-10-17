import { useEffect, useMemo, useState } from 'react';

const getRemainingMilliseconds = (status) => {
  if (!status) return null;
  const elapsed = performance.now() - status.anchorPerformance;
  return Math.max(0, Date.parse(status.launchAt) - (Date.parse(status.serverTime) + elapsed));
};

const getTimeParts = (milliseconds) => {
  const totalSeconds = Math.ceil(milliseconds / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60
  };
};

const LaunchCountdown = ({ status, error, onRetry }) => {
  const [now, setNow] = useState(0);
  const remaining = useMemo(() => getRemainingMilliseconds(status), [status, now]);
  const parts = remaining === null ? null : getTimeParts(remaining);
  const launchDate = status
    ? new Intl.DateTimeFormat('en-NG', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: 'Africa/Lagos'
    }).format(new Date(status.launchAt))
    : null;

  useEffect(() => {
    const interval = window.setInterval(() => setNow(performance.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-white">
      <section className="w-full max-w-4xl rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-center shadow-2xl backdrop-blur sm:p-12">
        <span className="inline-flex rounded-full border border-emerald-300/30 bg-emerald-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-200">
          StudentNest is getting ready
        </span>
        <h1 className="mt-7 text-3xl font-bold tracking-tight sm:text-5xl">
          A better way to find your next home is almost here.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
          We are preparing StudentNest for students, property agents, and the FULAFIA community.
          See you at launch.
        </p>

        {parts ? (
          <>
            <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-5" aria-label="Countdown to launch">
              {Object.entries(parts).map(([unit, value]) => (
                <div key={unit} className="rounded-2xl border border-white/10 bg-slate-900/70 px-3 py-5 sm:py-7">
                  <p className="text-4xl font-bold tabular-nums text-white sm:text-5xl">{String(value).padStart(2, '0')}</p>
                  <p className="mt-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{unit}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-slate-300">
              Official launch: <span className="font-semibold text-white">{launchDate} WAT</span>
            </p>
          </>
        ) : (
          <div className="mt-8 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-5 text-sm text-amber-100">
            Launch time is temporarily unavailable. The website will remain safely in pre-launch mode until it can verify the official schedule.
          </div>
        )}

        {error && (
          <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-100" role="alert">
            Could not reach the launch service. {status ? 'The countdown is using the latest verified server time.' : 'Please try again.'}
            <button type="button" onClick={onRetry} className="ml-2 font-semibold underline underline-offset-4">
              Retry
            </button>
          </div>
        )}

        <p className="mt-8 text-xs text-slate-500">Launch time is shown in Nigerian time (WAT).</p>
      </section>
    </main>
  );
};

export default LaunchCountdown;
