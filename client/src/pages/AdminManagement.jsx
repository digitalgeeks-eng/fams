import { useEffect, useState } from 'react';
import api from '../services/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { LOCATIONS } from '../constants/locations.js';

const ADMIN_LOCATIONS = LOCATIONS;

const AdminManagement = () => {
  const [admins, setAdmins] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', assignedLocation: '' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState([]);

  const fetchAdmins = async () => {
    try {
      const [response, activityResponse] = await Promise.all([api.get('/admin/admins'), api.get('/admin/activities')]);
      setAdmins(response.data.data);
      setActivities(activityResponse.data.data);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to load administrators.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAdmins(); }, []);

  const createAdmin = async (event) => {
    event.preventDefault();
    setMessage('');
    try {
      const response = await api.post('/admin/admins', form);
      setAdmins((current) => [response.data.data.user, ...current]);
      setForm({ name: '', email: '', phone: '', password: '', assignedLocation: '' });
      setMessage('Location Admin created successfully.');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to create administrator.');
    }
  };

  const changeLocation = async (admin) => {
    const assignedLocation = window.prompt(`Assign ${admin.name} to: ${ADMIN_LOCATIONS.join(', ')}`, admin.assignedLocation || '');
    if (!assignedLocation || !ADMIN_LOCATIONS.includes(assignedLocation)) return;
    try {
      const response = await api.patch(`/admin/admins/${admin._id}/scope`, { assignedLocation });
      setAdmins((current) => current.map((item) => item._id === admin._id ? response.data.data : item));
      setMessage('Administrator location updated successfully.');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to update administrator location.');
    }
  };

  const updateStatus = async (admin) => {
    const status = admin.status === 'active' || !admin.status ? 'deactivated' : 'active';
    if (!window.confirm(`${status === 'active' ? 'Activate' : 'Deactivate'} ${admin.name}?`)) return;
    try {
      const response = await api.patch(`/admin/users/${admin._id}/status`, { status });
      setAdmins((current) => current.map((item) => item._id === admin._id ? response.data.data : item));
      setMessage(`Administrator ${status} successfully.`);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to update administrator status.');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-xl">
        <h1 className="text-2xl font-semibold">Admin Management</h1>
        <p className="mt-2 text-slate-600">Create and manage location administrators. The existing Super Admin remains unrestricted.</p>
        {message && <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-800">{message}</div>}
      </div>

      <form onSubmit={createAdmin} className="rounded-3xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-semibold">Create Admin</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {[
            ['name', 'Full name', 'text'],
            ['email', 'Email', 'email'],
            ['phone', 'Phone number', 'tel'],
            ['password', 'Password', 'password']
          ].map(([field, label, type]) => (
            <label key={field} className="block">
              <span className="text-sm font-medium text-slate-700">{label}</span>
              <input type={type} required value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3" />
            </label>
          ))}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Assigned location</span>
            <select required value={form.assignedLocation} onChange={(event) => setForm({ ...form, assignedLocation: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3">
              <option value="">Select location</option>
              {ADMIN_LOCATIONS.map((location) => <option key={location} value={location}>{location}</option>)}
            </select>
          </label>
        </div>
        <button type="submit" className="mt-5 rounded-2xl bg-primary px-5 py-3 font-semibold text-white hover:bg-blue-700">Create Location Admin</button>
      </form>

      <div className="grid gap-4">
        {admins.map((admin) => (
          <div key={admin._id} className="rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-lg font-semibold">{admin.name}</p>
                <p className="text-slate-600">{admin.email} · {admin.phone || 'No phone'}</p>
                <p className="mt-1 text-slate-600">Role: <span className="font-semibold">{admin.adminRole || 'super_admin'}</span></p>
                <p className="text-slate-600">Location: <span className="font-semibold">{admin.assignedLocation || 'All locations'}</span> · Status: {admin.status || 'active'}</p>
                <p className="text-sm text-slate-500">Created: {admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : 'Unknown'} · Last activity: {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString() : 'Not available'}</p>
              </div>
              {admin.adminRole !== 'super_admin' && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => changeLocation(admin)} className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Change location</button>
                  <button type="button" onClick={() => updateStatus(admin)} className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white">{admin.status === 'active' || !admin.status ? 'Deactivate' : 'Activate'}</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-3xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-semibold">Admin Activity</h2>
        <div className="mt-4 space-y-2">
          {activities.length ? activities.map((activity) => <p key={activity._id} className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">{new Date(activity.timestamp).toLocaleString()} · {activity.adminName} · {activity.action} · {activity.description}</p>) : <p className="text-slate-500">No administrator activity recorded yet.</p>}
        </div>
      </div>
    </section>
  );
};

export default AdminManagement;
