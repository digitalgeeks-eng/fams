import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import api from '../services/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { formatInspectionFee } from '../utils/inspectionFee.js';
import PropertyMediaGallery from '../components/PropertyMediaGallery.jsx';

const PropertyDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingMessage, setRatingMessage] = useState('');

  useEffect(() => {
    const loadProperty = async () => {
      try {
        const response = await api.get(`/properties/${id}`);
        setProperty(response.data.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to load property');
      } finally {
        setLoading(false);
      }
    };
    loadProperty();
  }, [id]);

  const handleBooking = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (user?.role !== 'student') {
      setError('Only students can book properties. Please login with a student account.');
      return;
    }
    if (property?.approvalStatus !== 'approved') {
      setError('This property is not yet approved for booking.');
      return;
    }
    try {
      const defaultCheckIn = new Date();
      defaultCheckIn.setDate(defaultCheckIn.getDate() + 1);
      const defaultCheckOut = new Date(defaultCheckIn);
      defaultCheckOut.setDate(defaultCheckOut.getDate() + 7); // 7 day stay

      await api.post('/bookings', {
        propertyId: id,
        checkInDate: defaultCheckIn.toISOString().split('T')[0],
        checkOutDate: defaultCheckOut.toISOString().split('T')[0],
        guestCount: 1
      });
      navigate('/student/bookings');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to create booking');
    }
  };

  const handleRatingSubmit = async (event) => {
    event.preventDefault();
    try {
      setRatingMessage('');
      await api.post(`/properties/${id}/rate`, { rating: ratingValue, comment: ratingComment });
      const response = await api.get(`/properties/${id}`);
      setProperty(response.data.data);
      setRatingMessage('Thank you! Your rating has been submitted.');
      setRatingComment('');
      setRatingValue(5);
    } catch (err) {
      setRatingMessage(err.response?.data?.message || 'Unable to submit rating.');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="rounded-3xl bg-red-100 p-8 text-red-700">{error}</div>;

  const isUnavailable = property?.isUnavailable || property?.availabilityStatus === 'not_available';
  const canBook = property?.approvalStatus === 'approved' && !isUnavailable;
  const formattedInspectionFee = formatInspectionFee(property?.inspectionFee);

  return (
    <section className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <div className="bg-white rounded-3xl shadow-xl p-6">
        <PropertyMediaGallery property={property} />

        <h1 className="mt-6 text-3xl font-semibold text-slate-900">{property.title}</h1>
        <p className="mt-3 text-slate-600">{property.description}</p>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <span className="rounded-3xl border border-slate-200 px-4 py-3">Location: {property.location}</span>
          <span className="rounded-3xl border border-slate-200 px-4 py-3">Type: {property.type}</span>
          <span className="rounded-3xl border border-slate-200 px-4 py-3">Price: ₦{property.price.toLocaleString()}</span>
          {formattedInspectionFee && (
            <span className="rounded-3xl border border-slate-200 px-4 py-3">Inspection Fee: {formattedInspectionFee}</span>
          )}
          <span className="rounded-3xl border border-slate-200 px-4 py-3">Status: {isUnavailable ? 'Not Available' : property.approvalStatus}</span>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <span className="rounded-3xl border border-slate-200 px-4 py-3">Average rating: {property.averageRating?.toFixed(1) || 'N/A'}</span>
          <span className="rounded-3xl border border-slate-200 px-4 py-3">Ratings count: {property.ratingCount || 0}</span>
          <span className="rounded-3xl border border-slate-200 px-4 py-3">Visible until: {property.visibleUntil ? new Date(property.visibleUntil).toLocaleString() : 'No timer set'}</span>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl p-6">
        <h2 className="text-xl font-semibold">Booking details</h2>
        <p className="mt-3 text-slate-600">Click the button below to book this property instantly.</p>
        {isUnavailable ? (
          <div className="mt-4 rounded-3xl bg-rose-50 border border-rose-200 p-4 text-rose-700">
            House Not Available. This property is already booked or no longer available.
          </div>
        ) : property.approvalStatus !== 'approved' ? (
          <div className="mt-4 rounded-3xl bg-amber-50 border border-amber-200 p-4 text-amber-800">
            This property is currently {property.approvalStatus}. Booking is available after approval.
          </div>
        ) : null}
        {error && <div className="mt-4 rounded-3xl bg-rose-50 border border-rose-200 p-4 text-rose-700">{error}</div>}
        
        {/* Countdown Timer */}
        {property.visibleUntil && (
          <div className="mt-6 rounded-3xl border-2 border-primary bg-primary/10 p-6 text-center">
            <p className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Available Until</p>
            <p className="mt-2 text-3xl font-bold text-primary">
              {new Date(property.visibleUntil).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {new Date(property.visibleUntil).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        )}
        
        <button
          onClick={handleBooking}
          disabled={!canBook}
          className={`mt-6 w-full px-4 py-3 rounded-2xl text-white font-semibold transition ${canBook ? 'bg-primary hover:bg-slate-900' : 'bg-slate-300 cursor-not-allowed'}`}
        >
          {isUnavailable ? 'House Not Available' : canBook ? 'Book Now' : 'Waiting Approval'}
        </button>
        {user?.role === 'student' && (
          <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-slate-600">Already booked? Manage payment and complaint actions from your student pages.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Link to="/student/bookings" className="rounded-2xl bg-primary px-4 py-3 text-white text-center hover:bg-slate-900">My Bookings</Link>
              <Link to="/student/payments" className="rounded-2xl border border-primary px-4 py-3 text-primary text-center hover:bg-primary/10">Payments</Link>
            </div>
          </div>
        )}
        {user?.role === 'student' && (
          <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <h3 className="font-semibold text-slate-900">Rate this property</h3>
            {ratingMessage && (
              <div className={`mt-4 rounded-2xl px-4 py-3 ${ratingMessage.includes('Unable') ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                {ratingMessage}
              </div>
            )}
            <form onSubmit={handleRatingSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Rating</label>
                <select value={ratingValue} onChange={(e) => setRatingValue(Number(e.target.value))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 bg-white">
                  {[5,4,3,2,1].map((value) => (
                    <option key={value} value={value}>{value} star{value > 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Comment</label>
                <textarea value={ratingComment} onChange={(e) => setRatingComment(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3" rows={4} placeholder="Add feedback about the property" />
              </div>
              <button type="submit" className="rounded-2xl bg-primary px-6 py-3 text-white hover:bg-slate-900">Submit rating</button>
            </form>
          </div>
        )}
      </div>

    </section>
  );
};

export default PropertyDetails;
