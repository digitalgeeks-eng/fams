import { useEffect, useMemo, useState } from 'react';
import api from '../services/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { getImageUrl } from '../utils/imageUtils.js';

const statusOptions = ['all', 'pending', 'proof_submitted', 'verified', 'rejected', 'failed'];
const monthOptions = ['all', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

const PaymentVerification = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [month, setMonth] = useState('all');
  const [year, setYear] = useState('all');

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const response = await api.get('/admin/payments');
        setPayments(response.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPayments();
  }, []);

  const verify = async (id, newStatus) => {
    const prompt = newStatus === 'verified'
      ? 'Are you sure you want to verify this payment?'
      : 'Please enter an optional rejection reason:';
    if (newStatus === 'verified' && !window.confirm(prompt)) return;
    const adminNote = newStatus === 'rejected' ? window.prompt(prompt, 'Payment proof could not be verified. Please upload a valid payment receipt.') : undefined;
    if (newStatus === 'rejected' && adminNote === null) return;
    await api.put(`/admin/payments/${id}/verify`, { status: newStatus, adminNote });
    setPayments((prev) => prev.map((payment) => (payment._id === id ? { ...payment, verificationStatus: newStatus, adminNote } : payment)));
  };

  const uniqueYears = useMemo(() => {
    const years = payments.map((payment) => new Date(payment.createdAt).getFullYear());
    return ['all', ...Array.from(new Set(years)).sort((a, b) => b - a)];
  }, [payments]);

  const filteredPayments = useMemo(() => payments.filter((payment) => {
    const query = search.trim().toLowerCase();
    const student = payment.bookingId?.studentId;
    const property = payment.bookingId?.propertyId;
    const agent = property?.agentId;
    const matchesSearch = !query || [
      payment.paymentReference,
      student?.name,
      student?.email,
      property?.title,
      property?.location,
      agent?.name,
      agent?.email
    ].some((value) => value?.toLowerCase().includes(query));

    const matchesStatus = status === 'all' || payment.verificationStatus === status;
    const paymentDate = new Date(payment.createdAt);
    const matchesMonth = month === 'all' || paymentDate.getMonth() + 1 === Number(month);
    const matchesYear = year === 'all' || paymentDate.getFullYear() === Number(year);

    return matchesSearch && matchesStatus && matchesMonth && matchesYear;
  }), [payments, search, status, month, year]);

  if (loading) return <LoadingSpinner />;

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-xl">
        <h1 className="text-2xl font-semibold">Payment verification</h1>
        <p className="mt-2 text-slate-600">Review payments with student, agent and property details. Filter by user, month, year, and status.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search student, agent, property, or reference"
          className="rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-primary focus:outline-none"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-primary focus:outline-none"
        >
          {statusOptions.map((option) => (
            <option key={option} value={option}>{option === 'all' ? 'All statuses' : option.charAt(0).toUpperCase() + option.slice(1)}</option>
          ))}
        </select>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-primary focus:outline-none"
        >
          {monthOptions.map((option) => (
            <option key={option} value={option}>{option === 'all' ? 'All months' : option}</option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-primary focus:outline-none"
        >
          {uniqueYears.map((option) => (
            <option key={option} value={option}>{option === 'all' ? 'All years' : option}</option>
          ))}
        </select>
      </div>

      {filteredPayments.length ? (
        <div className="grid gap-4">
          {filteredPayments.map((payment) => {
            const student = payment.bookingId?.studentId;
            const property = payment.bookingId?.propertyId;
            const agent = property?.agentId;
            const imageUrl = getImageUrl(property?.images?.[0]);
            return (
              <div key={payment._id} className="rounded-3xl bg-white p-6 shadow-xl">
                <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
                  <div className="h-48 w-full overflow-hidden rounded-3xl bg-slate-100">
                    <img
                      src={imageUrl}
                      alt={property?.title || 'Property image'}
                      className="h-full w-full object-cover"
                      onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/400x300'; }}
                    />
                  </div>
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-sm uppercase tracking-wide text-slate-500">Payment</p>
                        <p className="mt-2 text-slate-700 font-semibold">Reference: {payment.paymentReference}</p>
                        <p className="text-slate-600">Method: {payment.paymentMethod}</p>
                        {payment.paymentProvider && <p className="text-slate-600">Provider: {payment.paymentProvider}</p>}
                        {payment.amount && <p className="text-slate-600">Amount: ₦{payment.amount.toLocaleString()}</p>}
                        <p className="text-slate-600">Status: {payment.verificationStatus}</p>
                        <p className="text-slate-600">Date: {new Date(payment.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-sm uppercase tracking-wide text-slate-500">Booking</p>
                        <p className="mt-2 text-slate-700">Status: {payment.bookingId?.bookingStatus || 'Unknown'}</p>
                        <p className="text-slate-600">Payment status: {payment.bookingId?.paymentStatus || 'Unknown'}</p>
                        <p className="text-slate-600">Transaction ref: {payment.bookingId?.transactionReference || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-3xl bg-slate-50 p-4 border border-slate-200">
                        <p className="text-sm uppercase tracking-wide text-slate-500">Student</p>
                        <p className="mt-2 text-slate-700 font-semibold">{student?.name || 'Unknown'}</p>
                        <p className="text-slate-600">{student?.email || 'No email'}</p>
                      </div>
                      <div className="rounded-3xl bg-slate-50 p-4 border border-slate-200">
                        <p className="text-sm uppercase tracking-wide text-slate-500">Agent</p>
                        <p className="mt-2 text-slate-700 font-semibold">{agent?.name || 'Unknown'}</p>
                        <p className="text-slate-600">{agent?.email || 'No email'}</p>
                      </div>
                    </div>
                    <div className="rounded-3xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-sm uppercase tracking-wide text-slate-500">Property</p>
                      <p className="mt-2 text-slate-700 font-semibold">{property?.title || 'Unknown'}</p>
                      <p className="text-slate-600">Location: {property?.location || 'Unknown'}</p>
                      <p className="text-slate-600">Type: {property?.type || 'Unknown'}</p>
                      <p className="text-slate-600">Price: ₦{property?.price?.toLocaleString() || '0'}</p>
                      <p className="text-slate-600">Availability: {(property?.isUnavailable || property?.availabilityStatus === 'not_available') ? 'Not Available' : 'Available'}</p>
                      {(property?.isUnavailable || property?.availabilityStatus === 'not_available') && property?.availabilityReason && (
                        <p className="text-slate-600">Reason: {property.availabilityReason.replace('_', ' ')}</p>
                      )}
                    </div>
                    {payment.paymentMethod === 'manual' && (
                      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
                        <p className="font-semibold text-amber-900">Manual Payment Verification</p>
                        <p className="mt-1 text-sm text-amber-800">Submitted: {payment.submittedAt ? new Date(payment.submittedAt).toLocaleString() : 'Not recorded'}</p>
                        {payment.proofImage && (
                          <a href={getImageUrl(payment.proofImage)} target="_blank" rel="noreferrer" className="mt-3 inline-flex font-semibold text-primary hover:underline">
                            View Proof{payment.proofFilename ? ` (${payment.proofFilename})` : ''}
                          </a>
                        )}
                        {payment.adminNote && <p className="mt-2 text-sm text-rose-700">Admin note: {payment.adminNote}</p>}
                      </div>
                    )}
                    {payment.bookingId?.paymentStatus === 'paid' || payment.verificationStatus === 'verified' ? (
                      <div className="mt-4 rounded-3xl bg-emerald-50 p-4 text-emerald-700">
                        This payment is already completed and marked as paid.
                      </div>
                    ) : (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button onClick={() => verify(payment._id, 'verified')} className="px-3 py-2 bg-primary text-white rounded-2xl">Verify</button>
                        <button onClick={() => verify(payment._id, 'rejected')} className="px-3 py-2 bg-red-500 text-white rounded-2xl">Reject</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl bg-slate-50 p-6 text-slate-600">No payments matched the current filter.</div>
      )}
    </section>
  );
};

export default PaymentVerification;
