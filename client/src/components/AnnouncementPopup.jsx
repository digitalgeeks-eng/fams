import { useEffect, useState } from 'react';
import {
  hasDismissedAnnouncement,
  rememberAnnouncementDismissal
} from '../utils/announcementPopup.js';

const AnnouncementPopup = () => {
  const [isOpen, setIsOpen] = useState(() => !hasDismissedAnnouncement(window.sessionStorage));

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        rememberAnnouncementDismissal(window.sessionStorage);
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const dismiss = () => {
    rememberAnnouncementDismissal(window.sessionStorage);
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="accommodations-announcement-heading"
        aria-describedby="accommodations-announcement-message"
        className="my-auto w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-white/30"
      >
        <div className="h-2 bg-gradient-to-r from-primary via-blue-500 to-accent" />
        <div className="p-6 sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3v2m7.07.93-1.42 1.42M21 12h-2M5 12H3m3.35-5.65L4.93 4.93m12.72 12.72 1.42 1.42M12 19v2m-4-9a4 4 0 118 0c0 1.5-.75 2.3-1.5 3.2-.5.6-.8 1.1-.8 1.8h-3.4c0-.7-.3-1.2-.8-1.8C8.75 14.3 8 13.5 8 12zm2.5 7h3" />
            </svg>
          </div>
          <h1 id="accommodations-announcement-heading" className="mt-5 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            More Accommodations Coming Soon!
          </h1>
          <div id="accommodations-announcement-message" className="mt-4 space-y-3 text-sm leading-7 text-slate-600 sm:text-base">
            <p>
              We are still uploading more houses and accommodation options to StudentNest. Please keep checking our website regularly for new listings and updates.
            </p>
            <p>Thank you for your patience and for choosing StudentNest!</p>
          </div>
          <button
            type="button"
            autoFocus
            onClick={dismiss}
            className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-primary px-5 py-3 font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Got It
          </button>
        </div>
      </section>
    </div>
  );
};

export default AnnouncementPopup;
