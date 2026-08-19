import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

const MyBookings = () => {
  const [searchParams] = useSearchParams();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeBooking, setActiveBooking] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');
  const [verifying, setVerifying] = useState(false);

  const fetchBookings = async () => {
    try {
      const response = await api.get('/bookings/student');
      setBookings(response.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const verifyPayment = async (reference) => {
    try {
      setVerifying(true);
      console.log('Verifying payment with reference:', reference);
      const response = await api.get(`/payments/verify/${reference}`);
      console.log('Payment verification response:', response);
      setMessage('✅ Payment verified successfully! Your booking is confirmed.');
      // Refresh bookings to show updated payment status
      await fetchBookings();
    } catch (err) {
      console.error('Payment verification error:', err);
      setMessage('⚠️ Payment verification is in progress. Please check your bookings in a moment.');
      // Still refresh bookings as payment might be verified on backend
      await fetchBookings();
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    fetchBookings();

    // Auto-refresh when page regains focus (user returns from payment)
    const handleFocus = () => {
      fetchBookings();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Check for payment reference in URL (from Paystack callback)
  useEffect(() => {
    const reference = searchParams.get('reference');
    if (reference) {
      console.log('Found payment reference in URL:', reference);
      verifyPayment(reference);
      
      // Auto-refresh bookings after a few seconds in case verification is still processing
      const timeout = setTimeout(() => {
        fetchBookings();
      }, 3000);
      
      return () => clearTimeout(timeout);
    }
  }, [searchParams]);

  const copyAccountNumber = async () => {
    try {
      await navigator.clipboard.writeText('8106083399');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setMessage('Unable to copy the account number. Please copy it manually.');
    }
  };

  const handleUploadProof = async (event, booking) => {
    event.preventDefault();
    if (!proofFile) {
      setMessage('Please upload your payment receipt or transaction screenshot.');
      return;
    }

    const formData = new FormData();
    formData.append('bookingId', booking._id);
    formData.append('proof', proofFile);

    try {
      await api.post('/payments/manual/proof', formData);
      setMessage('Payment proof submitted successfully. Your payment is awaiting verification.');
      setActiveBooking(null);
      setProofFile(null);
      fetchBookings();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to upload payment proof.');
    }
  };

  const handleCancelBooking = async (bookingId) => {
    try {
      await api.put(`/bookings/${bookingId}/cancel`);
      setMessage('Booking cancelled successfully. Refund request has been submitted if applicable.');
      fetchBookings();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to cancel booking.');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">My bookings</h1>
      {message && (
        <div className={`rounded-3xl border p-4 ${message.includes('successfully') ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
          {message}
        </div>
      )}
      <div className="grid gap-4">
        {bookings.length ? bookings.map((booking) => (
          <div key={booking._id} className="rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-4 pb-4 border-b border-slate-200">
              <h3 className="font-semibold text-lg text-slate-900">{booking.propertyId?.title || 'Booked property'}</h3>
              <p className="text-slate-600">Location: {booking.propertyId?.location}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-slate-600">Booking Status</p>
                <p className={`font-semibold capitalize ${
                  booking.bookingStatus === 'confirmed' ? 'text-emerald-600' :
                  booking.bookingStatus === 'pending' ? 'text-amber-600' :
                  booking.bookingStatus === 'cancelled' ? 'text-rose-600' :
                  'text-slate-600'
                }`}>
                  {booking.bookingStatus}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Payment Status</p>
                <p className={`font-semibold capitalize ${
                  booking.paymentStatus === 'paid' ? 'text-emerald-600' :
                  booking.paymentStatus === 'pending' ? 'text-amber-600' :
                  booking.paymentStatus === 'failed' ? 'text-rose-600' :
                  'text-slate-600'
                }`}>
                  {booking.paymentStatus === 'paid' ? 'Paid' : booking.paymentStatus}
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 mb-4">
              <div>
                <p className="text-sm text-slate-600">Check-in</p>
                <p className="text-slate-900">{booking.checkInDate ? new Date(booking.checkInDate).toLocaleString() : 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Check-out</p>
                <p className="text-slate-900">{booking.checkOutDate ? new Date(booking.checkOutDate).toLocaleString() : 'N/A'}</p>
              </div>
            </div>
            {booking.refundStatus && booking.refundStatus !== 'none' && (
              <div className="rounded-3xl bg-amber-50 border border-amber-200 p-4 text-amber-800 mb-4">
                Refund status: {booking.refundStatus}
              </div>
            )}

            {booking.transactionReference && (
              <p className="text-sm text-slate-600 mb-4">Reference: <span className="font-mono bg-slate-100 px-2 py-1 rounded">{booking.transactionReference}</span></p>
            )}

            {booking.paymentStatus !== 'paid' && booking.bookingStatus !== 'cancelled' && (
              <div className="mt-4 flex flex-col gap-3">
                <button
                  type="button"
                  disabled
                  className="w-full rounded-2xl bg-slate-200 px-4 py-3 text-slate-500 cursor-not-allowed font-semibold"
                >
                  Paystack Payment - Coming Soon
                </button>
                <button
                  type="button"
                  onClick={() => setActiveBooking(activeBooking === booking._id ? null : booking._id)}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-700 hover:bg-slate-50 font-semibold"
                >
                  {activeBooking === booking._id ? '✕ Cancel' : '+ Upload Proof'}
                </button>
              </div>
            )}
            {booking.bookingStatus !== 'cancelled' && (
              <button
                type="button"
                onClick={() => handleCancelBooking(booking._id)}
                className="mt-4 w-full rounded-2xl bg-rose-500 px-4 py-3 text-white hover:bg-rose-600 font-semibold"
              >
                Cancel booking
              </button>
            )}

            {activeBooking === booking._id && (
              <form onSubmit={(event) => handleUploadProof(event, booking)} className="mt-4 space-y-4 rounded-3xl border border-slate-200 p-4 bg-slate-50">
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-900">
                  <p className="font-semibold">Paystack integration in progress</p>
                  <p className="mt-1 text-sm">Automated online payment will be available soon. For now, complete payment using OPay below.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h4 className="font-semibold text-slate-900">Pay Manually via OPay</h4>
                  <p className="mt-1 text-sm text-slate-600">Transfer the required amount to the account below.</p>
                  <dl className="mt-4 grid gap-2 text-sm text-slate-700">
                    <div><dt className="inline font-medium">Account Name: </dt><dd className="inline">Miracle Obadiah</dd></div>
                    <div><dt className="inline font-medium">Account Number: </dt><dd className="inline font-mono">8106083399</dd></div>
                    <div><dt className="inline font-medium">Payment Provider: </dt><dd className="inline">OPay</dd></div>
                  </dl>
                  <button type="button" onClick={copyAccountNumber} className="mt-4 rounded-2xl border border-primary px-4 py-2 font-semibold text-primary hover:bg-primary/10">
                    Copy Account Number
                  </button>
                  {copied && <p className="mt-2 text-sm font-medium text-emerald-700">Account number copied!</p>}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">How to complete payment:</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
                    <li>Transfer the required amount to the OPay account above.</li>
                    <li>Complete the transfer using your banking or OPay app.</li>
                    <li>Keep your payment receipt or transaction screenshot.</li>
                    <li>Upload your proof of payment below.</li>
                    <li>Submit the proof for verification.</li>
                    <li>An administrator will verify your payment.</li>
                  </ol>
                  <p className="mt-3 text-sm font-medium text-amber-700">Uploading proof does not automatically confirm payment.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Proof of Payment</label>
                  <p className="mt-1 text-sm text-slate-600">Upload a JPG, JPEG, PNG, or PDF receipt (maximum 5 MB).</p>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                    onChange={(e) => {
                      const selectedFile = e.target.files?.[0];
                      if (!selectedFile) return;
                      const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
                      if (!allowedTypes.includes(selectedFile.type) || selectedFile.size > 5 * 1024 * 1024) {
                        setMessage('Invalid proof file. Choose a JPG, JPEG, PNG, or PDF file up to 5 MB.');
                        e.target.value = '';
                        setProofFile(null);
                        return;
                      }
                      setMessage('');
                      setProofFile(selectedFile);
                    }}
                    className="mt-2 w-full text-slate-600"
                  />
                  {proofFile && (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                      <p className="text-sm font-medium text-slate-700">{proofFile.name}</p>
                      {proofFile.type.startsWith('image/') && <img src={URL.createObjectURL(proofFile)} alt="Payment proof preview" className="mt-3 max-h-48 rounded-xl object-contain" />}
                      <button type="button" onClick={() => setProofFile(null)} className="mt-3 text-sm font-semibold text-rose-600 hover:text-rose-700">Remove</button>
                    </div>
                  )}
                </div>
                <button type="submit" className="w-full rounded-2xl bg-primary px-4 py-3 text-white hover:bg-slate-900 font-semibold">Submit Payment Proof</button>
              </form>
            )}
          </div>
        )) : <div className="rounded-3xl bg-slate-50 p-6 text-slate-600 text-center">No booking history available.</div>}
      </div>
    </section>
  );
};

export default MyBookings;
