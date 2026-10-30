import {
  TECHNICAL_SUPPORT_CALL_HREF,
  TECHNICAL_SUPPORT_PHONE,
  TECHNICAL_SUPPORT_WHATSAPP_HREF
} from '../constants/technicalSupport.js';

const TechnicalSupport = () => (
  <section aria-labelledby="technical-support-heading" className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-emerald-50 p-5 shadow-card sm:p-8">
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">StudentNest Technical Support</p>
        <h2 id="technical-support-heading" className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
          Experiencing Technical Issues?
        </h2>
        <p className="mt-3 leading-7 text-slate-600">
          Are you having difficulties booking accommodation, requesting an inspection, making a payment, logging into your account, or using any feature on StudentNest?
        </p>
        <p className="mt-2 leading-7 text-slate-600">Our technical support team is available to assist you.</p>
        <p className="mt-3 font-semibold text-slate-900">
          Contact: <a className="text-primary underline-offset-4 hover:underline" href={TECHNICAL_SUPPORT_CALL_HREF}>{TECHNICAL_SUPPORT_PHONE}</a>
        </p>
      </div>

      <div className="grid shrink-0 gap-3 sm:min-w-56">
        <a
          href={TECHNICAL_SUPPORT_CALL_HREF}
          aria-label={`Call StudentNest technical support at ${TECHNICAL_SUPPORT_PHONE}`}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.95.68l1.5 4.5a1 1 0 01-.5 1.21l-2.2 1.1a11.04 11.04 0 005.48 5.48l1.1-2.2a1 1 0 011.21-.5l4.5 1.5a1 1 0 01.68.95V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z" />
          </svg>
          Call Support
        </a>
        <a
          href={TECHNICAL_SUPPORT_WHATSAPP_HREF}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Message StudentNest technical support on WhatsApp"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          <svg aria-hidden="true" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.52 3.48A11.86 11.86 0 0012.08 0C5.5 0 .15 5.35.15 11.93c0 2.1.55 4.15 1.6 5.96L.05 24l6.26-1.64a11.9 11.9 0 005.76 1.47h.01c6.57 0 11.92-5.35 11.92-11.93 0-3.19-1.24-6.19-3.48-8.42zM12.08 21.8h-.01a9.9 9.9 0 01-5.04-1.38l-.36-.21-3.72.98.99-3.63-.23-.37a9.86 9.86 0 01-1.52-5.26c0-5.46 4.44-9.9 9.9-9.9a9.84 9.84 0 017.01 2.91 9.84 9.84 0 012.9 7.01c0 5.46-4.44 9.9-9.92 9.9zm5.43-7.42c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.47-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.48-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.21 5.09 4.5.71.31 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35z" />
          </svg>
          WhatsApp Support
        </a>
      </div>
    </div>
    <p className="mt-5 border-t border-slate-200/80 pt-4 text-xs leading-5 text-slate-500">
      Please do not share your password or one-time verification codes with anyone.
    </p>
  </section>
);

export default TechnicalSupport;
