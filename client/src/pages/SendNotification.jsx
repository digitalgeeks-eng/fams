import { useEffect, useState } from 'react';
import api from '../services/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

const SendNotification = () => {
  const [audience, setAudience] = useState('all');
  const [userIds, setUserIds] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await api.get('/admin/users');
        const nextUsers = Array.isArray(response.data?.data?.users) ? response.data.data.users : [];
        setUsers(nextUsers);
      } catch (err) {
        console.error(err);
        setStatus(err.response?.data?.message || 'Unable to load users. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const ids = userIds.split(',').map((id) => id.trim()).filter(Boolean);
      await api.post('/communications/notifications', { title, message, audience, userIds: ids });
      setStatus('Notification sent successfully');
      setTitle('');
      setMessage('');
      setUserIds('');
    } catch (err) {
      setStatus(err.response?.data?.message || 'Failed to send notification');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-xl">
        <h1 className="text-2xl font-semibold">Send Notification</h1>
        <p className="mt-2 text-slate-600">Send a notification to all users, students, agents, or specific accounts.</p>
      </div>
      <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-6 shadow-xl space-y-4">
        {status && <div className="rounded-2xl bg-slate-100 p-4 text-slate-700">{status}</div>}
        <div>
          <label className="block text-sm font-medium text-slate-700">Audience</label>
          <select value={audience} onChange={(e) => setAudience(e.target.value)} className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3">
            <option value="all">All users</option>
            <option value="student">All students</option>
            <option value="agent">All agents</option>
            <option value="admin">All admins</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Specific user IDs</label>
          <input
            value={userIds}
            onChange={(e) => setUserIds(e.target.value)}
            placeholder="Comma separated user IDs"
            className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
          />
          <p className="mt-2 text-xs text-slate-500">Use this only when sending to specific users. Leave blank when using a category.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows="5"
            className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
            required
          />
        </div>
        <button type="submit" className="inline-flex items-center justify-center rounded-3xl bg-primary px-5 py-3 text-white hover:bg-slate-900">
          Send notification
        </button>
      </form>
      <div className="rounded-3xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-semibold">All users</h2>
        <p className="mt-2 text-slate-600">Available user IDs for specific notification targeting.</p>
        <div className="mt-4 grid gap-3">
          {users.map((user) => (
            <div key={user._id} className="rounded-3xl border border-slate-200 p-4">
              <p className="font-semibold text-slate-900">{user.name || 'Unknown'}</p>
              <p className="text-slate-500">{user.email}</p>
              <p className="text-slate-500">ID: {user._id}</p>
              <p className="text-slate-500">Role: {user.role}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SendNotification;
