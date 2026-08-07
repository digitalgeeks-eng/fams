import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

const AgentDashboard = () => {
  const [data, setData] = useState({ properties: [], bookings: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAgentData = async () => {
      setLoading(true);
      try {
        const results = await Promise.allSettled([
          api.get('/properties/agent/me'),
          api.get('/bookings/agent')
        ]);
        setData({
          properties: results[0].status === 'fulfilled' ? results[0].value.data.data : [],
          bookings: results[1].status === 'fulfilled' ? results[1].value.data.data : []
        });
      } catch (err) {
        console.error('Agent dashboard fetch error:', err);
        setData({ properties: [], bookings: [] });
      } finally {
        setLoading(false);
      }
    };
    fetchAgentData();
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <section className="space-y-8">
      <div className="grid gap-6 md:grid-cols-3">
        <Link to="/agent/listings" className="rounded-3xl bg-white p-6 shadow-xl hover:shadow-2xl">
          <h2 className="text-xl font-semibold">Manage listings</h2>
          <p className="mt-2 text-slate-600">View and edit your property listings.</p>
          <p className="mt-4 text-3xl font-bold">{data.properties.length}</p>
        </Link>
        <Link to="/agent/add-property" className="rounded-3xl bg-white p-6 shadow-xl hover:shadow-2xl">
          <h2 className="text-xl font-semibold">Add property</h2>
          <p className="mt-2 text-slate-600">Create a new property listing for approval.</p>
        </Link>
        <Link to="/agent/booking-requests" className="rounded-3xl bg-white p-6 shadow-xl hover:shadow-2xl">
          <h2 className="text-xl font-semibold">Booking requests</h2>
          <p className="mt-2 text-slate-600">Review booking requests from students.</p>
          <p className="mt-4 text-3xl font-bold">{data.bookings.length}</p>
        </Link>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl bg-white p-6 shadow-xl">
          <h3 className="font-semibold">Recent listings</h3>
          <ul className="mt-4 space-y-4">
            {data.properties.length ? data.properties.map((property) => (
              <li key={property._id} className="rounded-3xl border border-slate-200 p-4">
                <p className="font-semibold">{property.title}</p>
                <p className="text-slate-600">Status: {property.approvalStatus}</p>
              </li>
            )) : <p className="text-slate-600">No listings yet.</p>}
          </ul>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-xl">
          <h3 className="font-semibold">Recent booking activity</h3>
          <ul className="mt-4 space-y-4">
            {data.bookings.length ? data.bookings.map((booking) => (
              <li key={booking._id} className="rounded-3xl border border-slate-200 p-4">
                <p className="font-semibold">{booking.propertyId?.title || 'Booking request'}</p>
                <p className="text-slate-600">Status: {booking.bookingStatus}</p>
                <p className={`text-sm font-semibold capitalize ${
                  booking.paymentStatus === 'paid' ? 'text-emerald-600' :
                  booking.paymentStatus === 'pending' ? 'text-amber-600' :
                  booking.paymentStatus === 'failed' ? 'text-rose-600' :
                  'text-slate-600'
                }`}>Payment: {booking.paymentStatus === 'paid' ? 'Paid' : booking.paymentStatus}</p>
              </li>
            )) : <p className="text-slate-600">No bookings yet.</p>}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default AgentDashboard;
