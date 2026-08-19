import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import api from '../services/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { getImageUrl } from '../utils/imageUtils.js';

const PropertyDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [showDebugUrl, setShowDebugUrl] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [mediaType, setMediaType] = useState('image');

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

  const handlePrevImage = () => {
    const currentList = mediaType === 'image' ? property?.images : property?.videos;
    setActiveIndex((prev) => (prev === 0 ? (currentList?.length || 1) - 1 : prev - 1));
  };

  const handleNextImage = () => {
    const currentList = mediaType === 'image' ? property?.images : property?.videos;
    setActiveIndex((prev) => (prev === (currentList?.length || 1) - 1 ? 0 : prev + 1));
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
  const currentImageUrl = getImageUrl(property?.images?.[activeIndex]);
  const hasMultipleImages = property?.images?.length > 1;

  return (
    <section className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <div className="bg-white rounded-3xl shadow-xl p-6">
        <div className="grid gap-4">
          {/* Main Image Container */}
          <div className="relative rounded-3xl overflow-hidden bg-slate-100">
            <img
              src={currentImageUrl}
              alt={property.title}
              className="w-full h-96 object-cover cursor-pointer hover:opacity-90 transition"
              onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/800x500'; }}
              onClick={() => setShowGalleryModal(true)}
            />
            
            {/* Image Navigation Arrows */}
            {hasMultipleImages && (
              <>
                <button
                  onClick={handlePrevImage}
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition"
                  aria-label="Previous image"
                >
                  &#10094;
                </button>
                <button
                  onClick={handleNextImage}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition"
                  aria-label="Next image"
                >
                  &#10095;
                </button>
                <div className="absolute bottom-3 right-3 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                  {activeIndex + 1} / {property.images?.length}
                </div>
              </>
            )}

            {/* View All Images Button */}
            {hasMultipleImages && (
              <button
                onClick={() => setShowGalleryModal(true)}
                className="absolute top-3 right-3 bg-primary hover:bg-slate-900 text-white px-4 py-2 rounded-2xl text-sm font-semibold transition"
              >
                View all ({property.images?.length})
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowDebugUrl((visible) => !visible)}
            className="self-start rounded-3xl bg-slate-50 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            {showDebugUrl ? 'Hide current image URL' : 'Show current image URL'}
          </button>
          {showDebugUrl && (
            <pre className="rounded-3xl bg-slate-50 p-4 text-xs text-slate-600 break-all">{currentImageUrl}</pre>
          )}
          
          {/* Thumbnail Gallery */}
          {hasMultipleImages && (
            <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 md:grid-cols-6">
              {property.images.map((image, index) => (
                <button
                  type="button"
                  key={index}
                  onClick={() => setActiveIndex(index)}
                  className={`rounded-2xl overflow-hidden border-2 transition ${activeIndex === index ? 'border-primary shadow-md' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <img 
                    src={getImageUrl(image)} 
                    alt={`${property.title} ${index + 1}`} 
                    className="w-full h-20 object-cover" 
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <h1 className="mt-6 text-3xl font-semibold text-slate-900">{property.title}</h1>
        <p className="mt-3 text-slate-600">{property.description}</p>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <span className="rounded-3xl border border-slate-200 px-4 py-3">Location: {property.location}</span>
          <span className="rounded-3xl border border-slate-200 px-4 py-3">Type: {property.type}</span>
          <span className="rounded-3xl border border-slate-200 px-4 py-3">Price: ₦{property.price.toLocaleString()}</span>
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

      {/* Full Screen Gallery Modal */}
      {showGalleryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50">
          <div className="relative w-full h-full flex flex-col">
            {/* Close Button */}
            <button
              onClick={() => setShowGalleryModal(false)}
              className="absolute top-4 right-4 text-white text-4xl hover:text-gray-300 z-10"
            >
              ×
            </button>

            {/* Main Display Image */}
            <div className="flex-1 flex items-center justify-center p-4">
              <img
                src={currentImageUrl}
                alt={`${property.title} ${activeIndex + 1}`}
                className="max-h-full max-w-full object-contain"
                onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/800x500'; }}
              />
            </div>

            {/* Navigation Arrows */}
            <div className="absolute top-1/2 left-4 -translate-y-1/2">
              <button
                onClick={handlePrevImage}
                className="bg-white/20 hover:bg-white/40 text-white p-3 rounded-full text-2xl transition"
              >
                &#10094;
              </button>
            </div>
            <div className="absolute top-1/2 right-4 -translate-y-1/2">
              <button
                onClick={handleNextImage}
                className="bg-white/20 hover:bg-white/40 text-white p-3 rounded-full text-2xl transition"
              >
                &#10095;
              </button>
            </div>

            {/* Thumbnail Strip at Bottom */}
            <div className="bg-black/50 p-4 overflow-x-auto">
              <div className="flex gap-2">
                {property.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveIndex(index)}
                    className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition ${activeIndex === index ? 'border-primary' : 'border-transparent hover:border-white/50'}`}
                  >
                    <img 
                      src={getImageUrl(image)} 
                      alt={`Thumbnail ${index + 1}`}
                      className="h-20 w-20 object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Counter */}
            <div className="text-center py-2 text-white text-sm">
              Image {activeIndex + 1} of {property.images?.length}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default PropertyDetails;
