import { useEffect, useState } from 'react';
import api from '../services/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

const BookingRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const response = await api.get('/bookings/agent');
        setRequests(response.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();
  }, []);

  if (loading) return <LoadingSpinner />;

  const approveBooking = async (id) => {
    try {
      await api.put(`/bookings/${id}/approve`);
      setRequests((prev) => prev.map((booking) => booking._id === id ? { ...booking, bookingStatus: 'confirmed' } : booking));
    } catch (err) {
      console.error(err);
    }
  };

  const rejectBooking = async (id) => {
    try {
      await api.put(`/bookings/${id}/reject`);
      setRequests((prev) => prev.map((booking) => booking._id === id ? { ...booking, bookingStatus: 'cancelled' } : booking));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Booking Requests</h1>
      <div className="grid gap-4">
        {requests.length ? requests.map((booking) => (
          <div key={booking._id} className="rounded-3xl bg-white p-6 shadow-xl">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="font-semibold">{booking.propertyId?.title}</p>
                <p className="text-slate-600">Student: {booking.studentId?.name}</p>
                <p className="text-slate-600">Type: {booking.propertyId?.type}</p>
                <p className="text-slate-600">Check-in: {booking.checkInDate ? new Date(booking.checkInDate).toLocaleString() : 'N/A'}</p>
                <p className="text-slate-600">Check-out: {booking.checkOutDate ? new Date(booking.checkOutDate).toLocaleString() : 'N/A'}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-slate-600">Booking Status</p>
                <p className={`font-semibold capitalize ${
                  booking.bookingStatus === 'confirmed' ? 'text-emerald-600' :
                  booking.bookingStatus === 'pending' ? 'text-amber-600' :
                  booking.bookingStatus === 'cancelled' ? 'text-rose-600' :
                  'text-slate-600'
                }`}>
                  {booking.bookingStatus}
                </p>
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
            {booking.bookingStatus === 'pending' && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => approveBooking(booking._id)} className="rounded-2xl bg-primary px-4 py-3 text-white hover:bg-slate-900">Approve</button>
                <button onClick={() => rejectBooking(booking._id)} className="rounded-2xl bg-rose-500 px-4 py-3 text-white hover:bg-rose-600">Reject</button>
              </div>
            )}
          </div>
        )) : <div className="rounded-3xl bg-slate-50 p-6 text-slate-600">No booking requests yet.</div>}
      </div>
    </section>
  );
};

export default BookingRequests;
