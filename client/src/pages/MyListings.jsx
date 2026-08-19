import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { getImageUrl } from '../utils/imageUtils.js';

const MyListings = () => {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to archive this property? It will remain available to administrators.')) return;
    try {
      await api.delete(`/properties/${id}`, { data: { reason: 'Property no longer available' } });
      setListings((prev) => prev.filter((property) => property._id !== id));
      setMessage('Property deleted successfully.');
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.message || 'Unable to delete property.');
    }
  };

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const response = await api.get('/properties/agent/me');
        setListings(response.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchListings();
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">My Listings</h1>
      {message && <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-700">{message}</div>}
      <div className="grid gap-6 lg:grid-cols-2">
        {listings.length ? listings.map((property) => {
          const imageUrl = getImageUrl(property.images?.[0]);
          return (
            <div key={property._id} className="overflow-hidden rounded-3xl bg-white shadow-xl">
              <div className="h-64 w-full bg-slate-100">
                <img
                  src={imageUrl}
                  alt={property.title}
                  className="h-full w-full object-cover"
                  onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/600x400'; }}
                />
              </div>
              <div className="space-y-4 p-6">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-secondary">{property.type || 'Property'}</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">{property.title}</h2>
                  <p className="mt-2 text-slate-600">{property.location}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-xs uppercase text-slate-500">Price</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">₦{property.price?.toLocaleString() || 'N/A'}</p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-xs uppercase text-slate-500">Approval</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{property.approvalStatus || 'pending'}</p>
                  </div>
                </div>
                <p className="text-slate-700 line-clamp-3">{property.description || 'No description available.'}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-xs uppercase text-slate-500">Visible until</p>
                    <p className="mt-2 text-slate-900">{property.visibleUntil ? new Date(property.visibleUntil).toLocaleDateString() : 'No limit'}</p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-xs uppercase text-slate-500">Created</p>
                    <p className="mt-2 text-slate-900">{new Date(property.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Link to={`/agent/listings/${property._id}/edit`} className="inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-slate-900">
                    Edit Listing
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(property._id)}
                    className="inline-flex items-center justify-center rounded-2xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Delete Listing
                  </button>
                </div>
              </div>
            </div>
          );
        }) : (
          <div className="rounded-3xl bg-slate-50 p-6 text-slate-600">You have no property listings.</div>
        )}
      </div>
    </section>
  );
};

export default MyListings;
