import { useCallback, useEffect, useState } from 'react';
import api from '../services/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

const statuses = ['New', 'In Progress', 'Resolved'];

const ContactInquiries = () => {
  const [inquiries, setInquiries] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  const fetchInquiries = useCallback(async (page = 1, status = statusFilter) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/admin/contact-inquiries', { params: { page, limit: 20, status } });
      setInquiries(response.data.data.inquiries);
      setPagination(response.data.data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load contact inquiries.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchInquiries(1, statusFilter); }, [fetchInquiries, statusFilter]);

  const updateStatus = async (inquiry, status) => {
    setUpdatingId(inquiry._id);
    setError('');
    try {
      await api.patch(`/admin/contact-inquiries/${inquiry._id}/status`, { status });
      if (statusFilter !== 'all' && statusFilter !== status) {
        await fetchInquiries(pagination.page, statusFilter);
      } else {
        setInquiries((current) => current.map((item) => item._id === inquiry._id ? { ...item, status } : item));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update inquiry status.');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading && !inquiries.length) return <LoadingSpinner />;

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <header className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-slate-200">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">Contact Inquiries</h1>
            <p className="mt-2 text-slate-600">Review messages submitted through the public Contact Us form.</p>
          </div>
          <label className="text-sm font-medium text-slate-700">
            Filter by status
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPagination((current) => ({ ...current, page: 1 })); }} className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <option value="all">All statuses</option>
              {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
        </div>
        <p className="mt-3 text-sm text-slate-500">{pagination.total} inquiries</p>
        {error && <div role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}
      </header>

      {loading ? <LoadingSpinner /> : inquiries.length ? (
        <div className="grid gap-4">
          {inquiries.map((inquiry) => (
            <article key={inquiry._id} className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-200 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-slate-950">{inquiry.name}</h2>
                  <a href={`mailto:${inquiry.email}`} className="break-all text-sm text-primary hover:underline">{inquiry.email}</a>
                  <p className="mt-2 text-sm text-slate-600">{inquiry.category} · {new Date(inquiry.createdAt).toLocaleString()}</p>
                </div>
                <label className="text-sm font-medium text-slate-700 sm:min-w-44">
                  Status
                  <select value={inquiry.status} disabled={updatingId === inquiry._id} onChange={(event) => updateStatus(inquiry, event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 disabled:opacity-60">
                    {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
              </div>
              <p className="mt-4 whitespace-pre-wrap break-words rounded-2xl bg-slate-50 p-4 leading-7 text-slate-700">{inquiry.message}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl bg-white p-8 text-center text-slate-600 shadow-card ring-1 ring-slate-200">No inquiries match this filter.</div>
      )}

      {pagination.totalPages > 1 && (
        <nav aria-label="Contact inquiry pages" className="flex items-center justify-center gap-4 rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200">
          <button type="button" disabled={pagination.page <= 1 || loading} onClick={() => fetchInquiries(pagination.page - 1)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm disabled:opacity-40">Previous</button>
          <span className="text-sm text-slate-600">Page {pagination.page} of {pagination.totalPages}</span>
          <button type="button" disabled={pagination.page >= pagination.totalPages || loading} onClick={() => fetchInquiries(pagination.page + 1)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm disabled:opacity-40">Next</button>
        </nav>
      )}
    </section>
  );
};

export default ContactInquiries;
