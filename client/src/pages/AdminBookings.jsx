import { useEffect, useMemo, useState } from 'react';
import api from '../services/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { getImageUrl } from '../utils/imageUtils.js';

const statusOptions = ['all', 'pending', 'confirmed', 'cancelled', 'completed'];

const AdminBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const response = await api.get('/admin/bookings');
        setBookings(response.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, []);

  const filteredBookings = useMemo(() => bookings.filter((booking) => {
    const student = booking.studentId;
    const property = booking.propertyId;
    const agent = property?.agentId;
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [
      student?.name,
      student?.email,
      property?.title,
      property?.location,
      property?.type,
      agent?.name,
      agent?.email
    ].some((value) => value?.toLowerCase().includes(query));
    const matchesStatus = status === 'all' || booking.bookingStatus === status;
    return matchesSearch && matchesStatus;
  }), [bookings, search, status]);

  if (loading) return <LoadingSpinner />;

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-xl">
        <h1 className="text-2xl font-semibold">Booking history</h1>
        <p className="mt-2 text-slate-600">View all student bookings with full student, agent and property details.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search student, agent, or property"
          className="rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-primary focus:outline-none"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-primary focus:outline-none"
        >
          {statusOptions.map((option) => (
            <option key={option} value={option}>{option === 'all' ? 'All booking statuses' : option.charAt(0).toUpperCase() + option.slice(1)}</option>
          ))}
        </select>
      </div>

      {filteredBookings.length ? (
        <div className="grid gap-4">
          {filteredBookings.map((booking) => {
            const property = booking.propertyId;
            const student = booking.studentId;
            const agent = property?.agentId;
            const imageUrl = getImageUrl(property?.images?.[0]);
            return (
              <div key={booking._id} className="rounded-3xl bg-white p-6 shadow-xl">
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
                        <p className="text-sm uppercase tracking-wide text-slate-500">Booking</p>
                        <p className="mt-2 text-slate-700">Status: {booking.bookingStatus}</p>
                        <p className="mt-2">
                          Payment: 
                          <span className={`ml-2 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
                            booking.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                            booking.paymentStatus === 'pending' ? 'bg-amber-100 text-amber-700' :
                            booking.paymentStatus === 'failed' ? 'bg-rose-100 text-rose-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {booking.paymentStatus === 'paid' ? 'Paid' : booking.paymentStatus}
                          </span>
                        </p>
                        <p className="text-slate-700">Reference: {booking.transactionReference}</p>
                        <p className="text-slate-700">Booked: {new Date(booking.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-sm uppercase tracking-wide text-slate-500">Property</p>
                        <p className="mt-2 text-slate-700 font-semibold">{property?.title || 'Unknown'}</p>
                        <p className="text-slate-600">Location: {property?.location || 'Unknown'}</p>
                        <p className="text-slate-600">Type: {property?.type || 'Unknown'}</p>
                        <p className="text-slate-600">Price: ₦{property?.price?.toLocaleString() || '0'}</p>
                        <p className="text-slate-600">Property status: {property?.approvalStatus || 'Unknown'}</p>
                        <p className="text-slate-600">Availability: {(property?.isUnavailable || property?.availabilityStatus === 'not_available') ? 'Not Available' : 'Available'}</p>
                        {(property?.isUnavailable || property?.availabilityStatus === 'not_available') && property?.availabilityReason && (
                          <p className="text-slate-600">Reason: {property.availabilityReason.replace('_', ' ')}</p>
                        )}
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
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl bg-slate-50 p-6 text-slate-600">No bookings match the selected criteria.</div>
      )}
    </section>
  );
};

export default AdminBookings;
