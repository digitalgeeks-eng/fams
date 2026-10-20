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
  const [roomData, setRoomData] = useState({ rooms: [], counts: null, priceRange: null });
  const [roomMessage, setRoomMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingMessage, setRatingMessage] = useState('');

  useEffect(() => {
    const loadProperty = async () => {
      try {
        const response = await api.get(`/properties/${id}`);
        const loadedProperty = response.data.data;
        setProperty(loadedProperty);
        if (loadedProperty.managementMode === 'multi_room') {
          try {
            const roomsResponse = await api.get(`/properties/${id}/rooms`);
            setRoomData(roomsResponse.data.data);
          } catch (roomError) {
            setRoomData({ rooms: [], counts: null, priceRange: null });
            if (roomError.response?.status !== 404) {
              setRoomMessage(roomError.response?.data?.message || 'Unable to load available rooms.');
            }
          }
        }
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

  const handleInspectionRequest = async (room) => {
    if (user?.role !== 'student') {
      navigate('/login');
      return;
    }
    try {
      setRoomMessage('');
      await api.post(`/properties/${id}/rooms/${room._id}/inspection-requests`, {});
      setRoomMessage(`Inspection request sent for ${room.roomNumber}. The room has not been reserved.`);
    } catch (err) {
      setRoomMessage(err.response?.data?.message || 'Unable to request an inspection for this room.');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="rounded-3xl bg-red-100 p-8 text-red-700">{error}</div>;

  const isUnavailable = property?.isUnavailable || property?.availabilityStatus === 'not_available';
  const isMultiRoom = property?.managementMode === 'multi_room';
  const canBook = !isMultiRoom && property?.approvalStatus === 'approved' && !isUnavailable;
  const isRoomManager = user?.role === 'admin'
    || (user?.role === 'agent' && (property?.agentId?._id || property?.agentId)?.toString() === user?._id?.toString());
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
          <span className="rounded-3xl border border-slate-200 px-4 py-3">
            {isMultiRoom ? 'Starting rent: ' : 'Price: '}
            {isMultiRoom && !roomData.priceRange
              ? 'Not currently available'
              : `₦${(isMultiRoom ? roomData.priceRange.minimum : property.price).toLocaleString()}`}
          </span>
          {formattedInspectionFee && (
            <span className="rounded-3xl border border-slate-200 px-4 py-3">Inspection Fee: {formattedInspectionFee}</span>
          )}
          <span className="rounded-3xl border border-slate-200 px-4 py-3">Status: {isUnavailable ? 'Not Available' : property.approvalStatus}</span>
        </div>
        {isMultiRoom && (
          <div className="mt-4 space-y-2">
            {property.buildingFacilities?.length > 0 && (
              <p className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                Building facilities: {property.buildingFacilities.join(', ')}
              </p>
            )}
            {property.addressDirections && (
              <p className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                Directions: {property.addressDirections}
              </p>
            )}
          </div>
        )}
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <span className="rounded-3xl border border-slate-200 px-4 py-3">Average rating: {property.averageRating?.toFixed(1) || 'N/A'}</span>
          <span className="rounded-3xl border border-slate-200 px-4 py-3">Ratings count: {property.ratingCount || 0}</span>
          <span className="rounded-3xl border border-slate-200 px-4 py-3">Visible until: {property.visibleUntil ? new Date(property.visibleUntil).toLocaleString() : 'No timer set'}</span>
        </div>
        {isMultiRoom && (
          <section className="mt-8 space-y-4 border-t border-slate-200 pt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Available rooms</h2>
                {roomData.priceRange && (
                  <p className="mt-1 text-sm text-slate-600">
                    Rent range: ₦{roomData.priceRange.minimum.toLocaleString()}–₦{roomData.priceRange.maximum.toLocaleString()}
                  </p>
                )}
                {roomData.counts && <p className="mt-1 text-sm text-slate-600">{roomData.counts.total} total rooms · {roomData.counts.available} available</p>}
              </div>
              {isRoomManager && (
                <Link
                  to={user?.role === 'admin' ? `/admin/properties/${id}/rooms` : `/agent/listings/${id}/rooms`}
                  className="rounded-xl border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5"
                >
                  Manage rooms
                </Link>
              )}
            </div>
            {roomMessage && <div role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{roomMessage}</div>}
            {roomData.rooms.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">No available rooms are currently listed.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {roomData.rooms.map((room) => (
                  <article key={room._id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-slate-900">{room.roomNumber} · {room.type}</h3>
                        <p className="mt-1 text-sm text-slate-600">₦{Number(room.price).toLocaleString()} / {room.billingPeriod}</p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium capitalize text-emerald-800">{room.status}</span>
                    </div>
                    {room.description && <p className="mt-3 text-sm text-slate-600">{room.description}</p>}
                    <p className="mt-2 text-sm text-slate-600">
                      Toilet: {room.toilet || 'unknown'} · Shower: {room.shower || 'unknown'} · Kitchen: {room.kitchen || 'unknown'}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Water: {room.waterSource || 'unknown'}{room.waterAvailable === true ? ' (available)' : room.waterAvailable === false ? ' (unavailable)' : ''}
                      {room.electricity === true ? ' · Electricity available' : room.electricity === false ? ' · Electricity unavailable' : ''}
                    </p>
                    {room.facilities?.length > 0 && <p className="mt-2 text-sm text-slate-600">Facilities: {room.facilities.join(', ')}</p>}
                    {room.images?.length > 0 && (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {room.images.slice(0, 3).map((media, index) => (
                          <img key={`${media.publicId || media.url || index}`} src={media.url || media.secure_url || media} alt={`${room.roomNumber} ${index + 1}`} className="aspect-square w-full rounded-lg object-cover" loading="lazy" />
                        ))}
                      </div>
                    )}
                    {room.videos?.length > 0 && (
                      <div className="mt-3 grid grid-cols-1 gap-2">
                        {room.videos.map((media, index) => (
                          <video key={`${media.publicId || media.url || index}`} src={media.url || media.secure_url || media} controls preload="metadata" className="aspect-video w-full rounded-lg bg-black" />
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleInspectionRequest(room)}
                      disabled={isUnavailable}
                      className="mt-4 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      Request an inspection
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <div className="bg-white rounded-3xl shadow-xl p-6">
        <h2 className="text-xl font-semibold">{isMultiRoom ? 'Room inspection' : 'Booking details'}</h2>
        <p className="mt-3 text-slate-600">{isMultiRoom
          ? 'Choose an available room and request an inspection. This does not reserve a room or initiate payment.'
          : 'Click the button below to book this property instantly.'}</p>
        {isMultiRoom ? (
          <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">Bookings and payments remain unchanged for single-unit properties. Multi-room listings use room-specific inspection requests only.</p>
        ) : (
        <>
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
        </>
        )}
        {user?.role === 'student' && !isMultiRoom && (
          <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-slate-600">Already booked? Manage payment and complaint actions from your student pages.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Link to="/student/bookings" className="rounded-2xl bg-primary px-4 py-3 text-white text-center hover:bg-slate-900">My Bookings</Link>
              <Link to="/student/payments" className="rounded-2xl border border-primary px-4 py-3 text-primary text-center hover:bg-primary/10">Payments</Link>
            </div>
          </div>
        )}
        {user?.role === 'student' && !isMultiRoom && (
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
