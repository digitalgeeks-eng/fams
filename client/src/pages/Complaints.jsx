import { useEffect, useState } from 'react';
import api from '../services/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { useAuth } from '../hooks/useAuth.jsx';

const Complaints = () => {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => {
    fetchComplaints();
  }, [filter]);

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      setError('');
      let response;
      
      console.log('User role:', user?.role);
      
      if (user?.role === 'admin') {
        // Only admins see all complaints
        console.log('Fetching admin complaints...');
        response = await api.get('/complaints/admin');
        console.log('Admin complaints response:', response);
        
        let data = Array.isArray(response.data.data) ? response.data.data : [];
        
        if (filter !== 'all') {
          data = data.filter((c) => c.status === filter);
        }
        setComplaints(data);
      } else if (user?.role === 'student' || user?.role === 'agent') {
        // Students and agents see only their own complaints
        console.log('Fetching personal complaints...');
        response = await api.get('/complaints/student');
        console.log('Personal complaints response:', response);
        
        const data = Array.isArray(response.data.data) ? response.data.data : [];
        setComplaints(data);
      }
    } catch (err) {
      console.error('Error fetching complaints:', err);
      setError(err.response?.data?.message || 'Failed to load complaints');
      setComplaints([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!message.trim()) return;
    try {
      setError('');
      console.log('Submitting complaint:', message);
      const response = await api.post('/complaints', { message });
      console.log('Submit response:', response);
      setMessage('');
      fetchComplaints();
    } catch (err) {
      console.error('Error submitting complaint:', err);
      setError(err.response?.data?.message || 'Failed to submit complaint');
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      setActionLoading({ ...actionLoading, [id]: true });
      setError('');
      console.log('Updating complaint status:', id, status);
      const response = await api.put(`/complaints/${id}/status`, { status });
      console.log('Update response:', response);
      
      setComplaints((prev) =>
        prev.map((complaint) =>
          complaint._id === id ? { ...complaint, status } : complaint
        )
      );
    } catch (err) {
      console.error('Error updating complaint:', err);
      setError(err.response?.data?.message || 'Failed to update complaint');
    } finally {
      setActionLoading({ ...actionLoading, [id]: false });
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <section className="space-y-8 max-w-6xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-slate-900">
          {user?.role === 'admin' ? 'Complaint Management' : 'My Complaints'}
        </h1>
        <p className="text-slate-600">
          {user?.role === 'admin'
            ? 'Review and manage complaints from students'
            : 'Submit and track your complaints'}
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-red-800 flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <p>{error}</p>
          <button onClick={() => setError('')} className="ml-auto text-red-600 hover:text-red-800">✕</button>
        </div>
      )}

      {/* Student/Agent Submit Form */}
      {(user?.role === 'student' || user?.role === 'agent') && (
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-lg border border-blue-100 space-y-4"
        >
          <h2 className="text-lg font-semibold text-slate-900">Submit a New Complaint</h2>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe your issue in detail..."
            className="w-full border border-slate-300 rounded-2xl p-4 h-32 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={!message.trim()}
            className="px-6 py-3 bg-gradient-to-r from-primary to-blue-600 text-white rounded-2xl font-semibold hover:shadow-lg transition disabled:opacity-50"
          >
            Submit Complaint
          </button>
        </form>
      )}

      {/* Filter Bar for Admin Only */}
      {user?.role === 'admin' && (
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-full font-semibold transition ${
              filter === 'all'
                ? 'bg-primary text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All ({complaints.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-full font-semibold transition ${
              filter === 'pending'
                ? 'bg-yellow-500 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Pending ({complaints.filter((c) => c.status === 'pending').length})
          </button>
          <button
            onClick={() => setFilter('resolved')}
            className={`px-4 py-2 rounded-full font-semibold transition ${
              filter === 'resolved'
                ? 'bg-green-500 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Resolved ({complaints.filter((c) => c.status === 'resolved').length})
          </button>
          <button
            onClick={() => setFilter('rejected')}
            className={`px-4 py-2 rounded-full font-semibold transition ${
              filter === 'rejected'
                ? 'bg-red-500 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Rejected ({complaints.filter((c) => c.status === 'rejected').length})
          </button>
        </div>
      )}

      {/* Complaints List */}
      <div className="grid gap-4">
        {complaints.length > 0 ? (
          complaints.map((complaint) => (
            <div
              key={complaint._id}
              className="rounded-2xl bg-white p-6 shadow-md hover:shadow-lg transition border border-slate-200"
            >
              <div className="flex justify-between items-start gap-4 flex-wrap">
                <div className="flex-1">
                  <p className="font-bold text-lg text-slate-900">{complaint.message}</p>
                  {user?.role === 'admin' && (
                    <>
                      <p className="mt-2 text-sm text-slate-600">
                        <span className="font-semibold">Name:</span> {complaint.studentId?.name || 'Unknown'}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        <span className="font-semibold">Role:</span> 
                        <span className={`ml-2 inline-flex items-center rounded-full px-2 py-1 text-xs font-bold uppercase ${
                          complaint.studentId?.role === 'student' 
                            ? 'bg-blue-100 text-blue-800'
                            : complaint.studentId?.role === 'agent'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {complaint.studentId?.role || 'Unknown'}
                        </span>
                      </p>
                    </>
                  )}
                  <p className="mt-2 text-sm text-slate-600">
                    <span className="font-semibold">Submitted:</span>{' '}
                    {new Date(complaint.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                      complaint.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : complaint.status === 'resolved'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {complaint.status}
                  </span>
                </div>
              </div>

              {/* Action Buttons for Admin Only */}
              {user?.role === 'admin' && complaint.status === 'pending' && (
                <div className="mt-4 flex gap-2 flex-wrap">
                  <button
                    onClick={() => handleUpdateStatus(complaint._id, 'resolved')}
                    disabled={actionLoading[complaint._id]}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-semibold transition disabled:opacity-50 flex items-center gap-2"
                  >
                    ✓ Resolve
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(complaint._id, 'rejected')}
                    disabled={actionLoading[complaint._id]}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-semibold transition disabled:opacity-50 flex items-center gap-2"
                  >
                    ✕ Reject
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="rounded-2xl bg-slate-50 p-8 text-center text-slate-600 border border-slate-200">
            <p className="text-lg font-semibold">No complaints found</p>
            {user?.role !== 'admin' && (
              <p className="text-sm mt-2">You haven't submitted any complaints yet.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default Complaints;
