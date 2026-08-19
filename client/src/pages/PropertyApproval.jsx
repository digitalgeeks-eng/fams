import { useEffect, useState } from 'react';
import api from '../services/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { getImageUrl } from '../utils/imageUtils.js';

const PropertyApproval = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  const deleteProperty = async (id) => {
    if (!window.confirm('Delete this property permanently?')) return;
    try {
      await api.delete(`/properties/${id}`);
      setProperties((prev) => prev.filter((property) => property._id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const response = await api.get('/admin/properties');
        setProperties(response.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProperties();
  }, []);

  const approve = async (id, status) => {
    await api.put(`/admin/properties/${id}/approve`, { status });
    setProperties((prev) => prev.map((property) => (property._id === id ? { ...property, approvalStatus: status } : property)));
  };

  const toggleDetails = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) return <LoadingSpinner />;

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Property approval</h1>
      <div className="grid gap-4">
        {properties.map((property) => {
          const imageUrl = getImageUrl(property.images?.[0]);
          return (
            <div key={property._id} className="rounded-3xl bg-white p-6 shadow-xl">
              <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
                <div className="h-48 w-full overflow-hidden rounded-3xl bg-slate-100">
                  <img
                    src={imageUrl}
                    alt={property.title}
                    className="h-full w-full object-cover"
                    onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/400x300'; }}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-lg">{property.title}</p>
                      <p className="text-slate-600">Agent: {property.agentId?.name || 'Unknown'}</p>
                      <p className="text-slate-600">Approval status: {property.approvalStatus}</p>
                      <p className="text-slate-600">Availability: {(property.isUnavailable || property.availabilityStatus === 'not_available') ? 'Not Available' : 'Available'}</p>
                      {(property.isUnavailable || property.availabilityStatus === 'not_available') && property.availabilityReason && (
                        <p className="text-slate-600">Reason: {property.availabilityReason.replace('_', ' ')}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleDetails(property._id)}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      {expanded[property._id] ? 'Hide details' : 'View details'}
                    </button>
                  </div>

                  {expanded[property._id] && (
                    <div className="mt-4 rounded-3xl bg-slate-50 p-4 border border-slate-200">
                      <p className="text-slate-700"><span className="font-semibold">Description:</span> {property.description}</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <p className="text-slate-700"><span className="font-semibold">Location:</span> {property.location}</p>
                        <p className="text-slate-700"><span className="font-semibold">Type:</span> {property.type}</p>
                        <p className="text-slate-700"><span className="font-semibold">Price:</span> ₦{property.price?.toLocaleString()}</p>
                        <p className="text-slate-700"><span className="font-semibold">Submitted:</span> {new Date(property.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="mt-3 border-t border-slate-200 pt-3">
                        <p className="font-semibold text-slate-800">Agent details</p>
                        <p className="text-slate-700">Name: {property.agentId?.name || 'Unknown'}</p>
                        <p className="text-slate-700">Email: {property.agentId?.email || 'Unknown'}</p>
                      </div>
                      {property.images?.length > 0 && (
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          {property.images.map((image, index) => (
                            <img
                              key={index}
                              src={getImageUrl(image)}
                              alt={`${property.title} ${index + 1}`}
                              className="h-32 w-full rounded-2xl object-cover"
                              onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/400x300'; }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => approve(property._id, 'approved')} className="px-3 py-2 bg-primary text-white rounded-2xl">
                      Approve
                    </button>
                    <button onClick={() => approve(property._id, 'rejected')} className="px-3 py-2 bg-red-500 text-white rounded-2xl">
                      Reject
                    </button>
                    <button onClick={() => deleteProperty(property._id)} className="px-3 py-2 bg-red-700 text-white rounded-2xl">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default PropertyApproval;
