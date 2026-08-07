import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

const MyBookings = () => {
  const [searchParams] = useSearchParams();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeBooking, setActiveBooking] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('offline');
  const [paymentReference, setPaymentReference] = useState('');
  const [proofImage, setProofImage] = useState(null);
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

  const handlePayOnline = async (booking) => {
    setMessage('');
    try {
      const response = await api.post('/payments/initialize', {
        bookingId: booking._id,
        paymentMethod: 'online'
      });
      const url = response.data.data.authorizationUrl;
      if (url) {
        window.location.href = url;
      } else {
        setMessage('Unable to start online payment. Please try offline proof upload.');
      }
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to initialize payment.');
    }
  };

  const handleUploadProof = async (event, booking) => {
    event.preventDefault();
    if (!proofImage) {
      setMessage('Please upload a payment proof image.');
      return;
    }

    const formData = new FormData();
    formData.append('bookingId', booking._id);
    formData.append('paymentMethod', paymentMethod);
    formData.append('paymentReference', paymentReference || booking.transactionReference || `BOOKING-${booking._id}`);
    formData.append('proofImage', proofImage);

    try {
      await api.post('/payments/upload-proof', formData);
      setMessage('Payment proof uploaded successfully and is awaiting admin verification.');
      setActiveBooking(null);
      setPaymentReference('');
      setProofImage(null);
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
                  onClick={() => handlePayOnline(booking)}
                  className="w-full rounded-2xl bg-primary px-4 py-3 text-white hover:bg-slate-900 font-semibold"
                >
                  Pay Online Now
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
                <div>
                  <label className="block text-sm font-medium text-slate-700">Payment method</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 bg-white">
                    <option value="offline">Offline Transfer</option>
                    <option value="online">Online Payment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Payment reference</label>
                  <input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Enter transaction reference" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Proof image</label>
                  <input type="file" accept="image/*" onChange={(e) => setProofImage(e.target.files?.[0] || null)} className="mt-2 w-full text-slate-600" />
                </div>
                <button type="submit" className="w-full rounded-2xl bg-primary px-4 py-3 text-white hover:bg-slate-900 font-semibold">Submit proof</button>
              </form>
            )}
          </div>
        )) : <div className="rounded-3xl bg-slate-50 p-6 text-slate-600 text-center">No booking history available.</div>}
      </div>
    </section>
  );
};

export default MyBookings;
