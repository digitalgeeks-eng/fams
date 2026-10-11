import { useState } from 'react';
import api from '../services/api.js';

const categories = [
  'Accommodation Inquiry',
  'Property Listing',
  'Registration or Account Issue',
  'Payment Issue',
  'Complaint',
  'Other'
];

const initialForm = { name: '', email: '', category: '', message: '', website: '' };

const ContactUs = () => {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError('');
    setSuccess('');
  };

  const submitInquiry = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await api.post('/contact', {
        name: form.name,
        email: form.email,
        category: form.category,
        message: form.message,
        website: form.website
      });
      setSuccess(response.data.message || 'Your message has been received.');
      setForm(initialForm);
    } catch (err) {
      setError(err.response?.data?.message || 'We could not send your message. Please try again or contact us directly.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-6xl space-y-8">
      <header className="rounded-3xl bg-gradient-to-br from-primary/10 via-white to-white p-6 shadow-card ring-1 ring-slate-200 sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">We’re here to help</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Contact Us</h1>
        <p className="mt-4 max-w-2xl leading-7 text-slate-600">Send a question or reach the StudentNest team directly using the contact details below.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <aside className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-slate-200 sm:p-8">
          <h2 className="text-xl font-semibold text-slate-950">Contact information</h2>
          <dl className="mt-5 space-y-5">
            <div>
              <dt className="text-sm font-medium text-slate-500">Phone</dt>
              <dd className="mt-1"><a className="font-semibold text-primary hover:underline" href="tel:+2348106083399">08106083399</a></dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">WhatsApp</dt>
              <dd className="mt-1"><a className="font-semibold text-primary hover:underline" href="https://wa.me/2348106083399" target="_blank" rel="noreferrer">Chat with us on WhatsApp</a></dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">Email</dt>
              <dd className="mt-1"><a className="break-all font-semibold text-primary hover:underline" href="mailto:studentnest06@gmail.com">studentnest06@gmail.com</a></dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">Location</dt>
              <dd className="mt-1 font-semibold text-slate-900">Lafia, Nasarawa State, Nigeria</dd>
            </div>
          </dl>
        </aside>

        <form onSubmit={submitInquiry} className="space-y-5 rounded-3xl bg-white p-6 shadow-card ring-1 ring-slate-200 sm:p-8">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Send an inquiry</h2>
            <p className="mt-1 text-sm text-slate-500">All fields are required.</p>
          </div>
          {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
          {success && <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</div>}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Full Name</span>
            <input name="name" autoComplete="name" value={form.name} onChange={updateField} maxLength={120} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email Address</span>
            <input name="email" type="email" autoComplete="email" value={form.email} onChange={updateField} maxLength={254} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Inquiry Category</span>
            <select name="category" value={form.category} onChange={updateField} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10">
              <option value="">Select a category</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Message</span>
            <textarea name="message" value={form.message} onChange={updateField} maxLength={5000} rows={6} required className="mt-2 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
            <span className="mt-1 block text-right text-xs text-slate-500">{form.message.length}/5000</span>
          </label>
          <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
            <label>
              Leave this field empty
              <input name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={updateField} />
            </label>
          </div>
          <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center rounded-2xl bg-primary px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60 sm:w-auto">
            {loading ? 'Sending…' : 'Send Message'}
          </button>
        </form>
      </div>
    </section>
  );
};

export default ContactUs;
