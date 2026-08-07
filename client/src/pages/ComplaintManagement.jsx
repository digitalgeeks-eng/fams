import { useEffect, useState } from 'react';
import api from '../services/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

const ComplaintManagement = () => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        const response = await api.get('/admin/complaints');
        setComplaints(response.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchComplaints();
  }, []);

  const update = async (id, status) => {
    await api.put(`/complaints/${id}/status`, { status });
    setComplaints((prev) => prev.map((complaint) => (complaint._id === id ? { ...complaint, status } : complaint)));
  };

  if (loading) return <LoadingSpinner />;

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Complaint management</h1>
      <div className="grid gap-4">
        {complaints.map((complaint) => (
          <div key={complaint._id} className="rounded-3xl bg-white p-6 shadow-xl">
            <p className="font-semibold">{complaint.message}</p>
            <p className="text-slate-600">Student: {complaint.studentId?.name}</p>
            <p className="text-slate-600">Status: {complaint.status}</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => update(complaint._id, 'resolved')} className="px-3 py-2 bg-primary text-white rounded-2xl">Resolve</button>
              <button onClick={() => update(complaint._id, 'rejected')} className="px-3 py-2 bg-red-500 text-white rounded-2xl">Reject</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default ComplaintManagement;
