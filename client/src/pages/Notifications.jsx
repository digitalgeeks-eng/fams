import { useEffect, useState, useContext } from 'react';
import api from '../services/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { AuthContext } from '../context/AuthContext.jsx';

const Notifications = () => {
  const { user } = useContext(AuthContext);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const endpoint = user?.role === 'admin' ? '/communications/notifications/admin/all' : '/communications/notifications';
      const response = await api.get(endpoint);
      setNotifications(response.data.data || []);
      setError('');
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setNotifications([]);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
    } else {
      setLoading(false);
    }
  }, [user]);

  const handleEdit = (notification) => {
    setEditingId(notification._id);
    setEditTitle(notification.title);
    setEditMessage(notification.message);
    setError('');
  };

  const handleSaveEdit = async (id) => {
    try {
      if (!editTitle || !editMessage) {
        setError('Title and message are required');
        return;
      }
      await api.put(`/communications/notifications/admin/${id}`, {
        title: editTitle,
        message: editMessage
      });
      setSuccess('Notification updated successfully');
      setEditingId(null);
      await fetchNotifications();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update notification');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this notification?')) {
      try {
        await api.delete(`/communications/notifications/admin/${id}`);
        setSuccess('Notification deleted successfully');
        await fetchNotifications();
        setTimeout(() => setSuccess(''), 3000);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to delete notification');
      }
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <section className="space-y-6 p-6">
      <div className="rounded-3xl bg-white p-6 shadow-xl">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="mt-2 text-slate-600">
          {user?.role === 'admin' ? 'Manage all notifications' : 'Review alerts about bookings, payments, and admin actions.'}
        </p>
        {user && <p className="mt-2 text-xs text-slate-500">Current Role: <span className="font-semibold uppercase">{user.role}</span></p>}
      </div>

      {error && (
        <div className="rounded-3xl bg-red-50 p-4 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-3xl bg-green-50 p-4 text-green-700 border border-green-200">
          {success}
        </div>
      )}

      <div className="grid gap-4">
        {notifications && notifications.length > 0 ? notifications.map((notification) => (
          <article key={notification._id} className="rounded-3xl bg-white p-6 shadow-xl">
            {editingId === notification._id ? (
              <div className="space-y-4">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Notification title"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:border-blue-500"
                />
                <textarea
                  value={editMessage}
                  onChange={(e) => setEditMessage(e.target.value)}
                  placeholder="Notification message"
                  rows="4"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:border-blue-500"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => handleSaveEdit(notification._id)}
                    className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded-lg bg-slate-300 px-4 py-2 text-slate-900 hover:bg-slate-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-slate-900">{notification.title}</h2>
                    <p className="mt-1 text-sm text-slate-500">{new Date(notification.createdAt).toLocaleString()}</p>
                    {user?.role === 'admin' && notification.userId && (
                      <p className="mt-1 text-xs text-slate-400">Sent to: {notification.userId.name}</p>
                    )}
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700 whitespace-nowrap">{notification.type}</span>
                </div>
                <p className="mt-4 text-slate-600 whitespace-pre-line">{notification.message}</p>
                {user?.role === 'admin' && (
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => handleEdit(notification)}
                      className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(notification._id)}
                      className="rounded-lg bg-red-500 px-4 py-2 text-white hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </>
            )}
          </article>
        )) : (
          <div className="rounded-3xl bg-slate-50 p-6 text-slate-600 text-center">
            No notifications yet.
          </div>
        )}
      </div>
    </section>
  );
};

export default Notifications;
