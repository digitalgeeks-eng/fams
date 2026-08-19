import { useEffect, useState } from 'react';
import api from '../services/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { getImageUrl } from '../utils/imageUtils.js';

const PropertyApproval = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [filter, setFilter] = useState('all');
  const [history, setHistory] = useState({});
  const [message, setMessage] = useState('');

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

  const restore = async (id) => {
    if (!window.confirm('Restore this property?')) return;
    try {
      const response = await api.patch(`/properties/${id}/restore`);
      setProperties((prev) => prev.map((property) => (property._id === id ? response.data.data : property)));
      setMessage('Property restored successfully.');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to restore property.');
    }
  };

  const loadHistory = async (id) => {
    try {
      const response = await api.get(`/properties/${id}/history`);
      setHistory((prev) => ({ ...prev, [id]: response.data.data }));
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to load property history.');
    }
  };

  const toggleDetails = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
    if (!expanded[id]) loadHistory(id);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Property approval</h1>
      {message && <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-700">{message}</div>}
      <div className="flex flex-wrap gap-2">
        {['all', 'active', 'available', 'not_available', 'deleted'].map((option) => (
          <button key={option} type="button" onClick={() => setFilter(option)} className={`rounded-2xl px-4 py-2 text-sm font-semibold ${filter === option ? 'bg-primary text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>
            {option === 'not_available' ? 'Not Available' : option.charAt(0).toUpperCase() + option.slice(1)}
          </button>
        ))}
      </div>
      <div className="grid gap-4">
        {properties.filter((property) => {
          const deleted = property.isDeleted === true;
          const unavailable = property.isUnavailable || property.availabilityStatus === 'not_available';
          if (filter === 'deleted') return deleted;
          if (filter === 'active') return !deleted;
          if (filter === 'available') return !deleted && !unavailable;
          if (filter === 'not_available') return !deleted && unavailable;
          return true;
        }).map((property) => {
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
                      <p className="text-slate-600">Deleted: {property.isDeleted ? 'Yes' : 'No'}</p>
                      <p className="text-slate-600">Availability: {(property.isUnavailable || property.availabilityStatus === 'not_available') ? 'Not Available' : 'Available'}</p>
                      {(property.isUnavailable || property.availabilityStatus === 'not_available') && property.availabilityReason && (
                        <p className="text-slate-600">Reason: {property.availabilityReason.replace('_', ' ')}</p>
                      )}
                      {property.isDeleted && (
                        <div className="mt-3 border-t border-slate-200 pt-3">
                          <p className="text-slate-700">Deleted at: {property.deletedAt ? new Date(property.deletedAt).toLocaleString() : 'Unknown'}</p>
                          <p className="text-slate-700">Deleted by: {property.deletedBy?.name || property.deletedByRole || 'Unknown'}</p>
                          {property.deleteReason && <p className="text-slate-700">Reason: {property.deleteReason}</p>}
                        </div>
                      )}
                      {history[property._id] && (
                        <div className="mt-4 border-t border-slate-200 pt-3">
                          <p className="font-semibold text-slate-800">Edit History</p>
                          {history[property._id].history.length ? history[property._id].history.map((entry) => (
                            <div key={entry._id} className="mt-3 rounded-2xl bg-white p-3 text-sm">
                              <p className="font-medium text-slate-700">{new Date(entry.editedAt).toLocaleString()} by {entry.editedBy?.name || entry.editorRole}</p>
                              {entry.changes.map((change) => <p key={change.field} className="mt-1 text-slate-600">{change.field}: {String(change.oldValue ?? '')} → {String(change.newValue ?? '')}</p>)}
                            </div>
                          )) : <p className="mt-2 text-sm text-slate-600">No edits recorded.</p>}
                          <p className="mt-3 font-semibold text-slate-800">Booking/payment records: {history[property._id].bookings.length} bookings, {history[property._id].payments.length} payments</p>
                        </div>
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
                    {!property.isDeleted && <button onClick={() => approve(property._id, 'approved')} className="px-3 py-2 bg-primary text-white rounded-2xl">
                      Approve
                    </button>}
                    {!property.isDeleted && <button onClick={() => approve(property._id, 'rejected')} className="px-3 py-2 bg-red-500 text-white rounded-2xl">
                      Reject
                    </button>}
                    {property.isDeleted && <button onClick={() => restore(property._id)} className="px-3 py-2 bg-emerald-600 text-white rounded-2xl">Restore Property</button>}
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
