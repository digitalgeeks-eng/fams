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
  const [mode, setMode] = useState('create');
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [promotionLocation, setPromotionLocation] = useState('');
  const [searching, setSearching] = useState(false);
  const [promoting, setPromoting] = useState(false);

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

  useEffect(() => {
    if (mode !== 'promote') return undefined;
    const timeout = setTimeout(async () => {
      if (!userSearch.trim()) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const response = await api.get('/admin/users/search', { params: { search: userSearch, limit: 10 } });
        setSearchResults(response.data.data.users);
      } catch (err) {
        setMessage(err.response?.data?.message || 'Unable to search users.');
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [mode, userSearch]);

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

  const promoteUser = async (event) => {
    event.preventDefault();
    if (!selectedUser || !promotionLocation) return;
    if (!window.confirm(`Are you sure you want to promote ${selectedUser.name} to Location Admin for ${promotionLocation}?`)) return;
    setPromoting(true);
    try {
      const response = await api.post(`/admin/users/${selectedUser._id}/promote`, { adminRole: 'location_admin', assignedLocation: promotionLocation });
      setAdmins((current) => [response.data.data, ...current]);
      setMessage(response.data.message);
      setSelectedUser(null);
      setSearchResults([]);
      setUserSearch('');
      setPromotionLocation('');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to promote user.');
    } finally {
      setPromoting(false);
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

      <div className="flex flex-wrap gap-2 rounded-3xl bg-white p-3 shadow-xl">
        <button type="button" onClick={() => { setMode('create'); setSelectedUser(null); }} className={`rounded-2xl px-4 py-3 text-sm font-semibold ${mode === 'create' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'}`}>Create New Admin</button>
        <button type="button" onClick={() => setMode('promote')} className={`rounded-2xl px-4 py-3 text-sm font-semibold ${mode === 'promote' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'}`}>Promote Existing User</button>
      </div>

      {mode === 'create' ? <form onSubmit={createAdmin} className="rounded-3xl bg-white p-6 shadow-xl">
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
      </form> : <section className="rounded-3xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-semibold">Promote Existing User</h2>
        <p className="mt-2 text-slate-600">Search by name, email, or phone. The user&apos;s existing account and properties will be preserved.</p>
        <input value={userSearch} onChange={(event) => { setUserSearch(event.target.value); setSelectedUser(null); }} placeholder="Search name, email or phone" className="mt-4 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3" />
        {searching && <p className="mt-3 text-sm text-slate-500">Searching...</p>}
        <div className="mt-3 space-y-2">
          {searchResults.map((user) => <button type="button" key={user._id} onClick={() => setSelectedUser(user)} className="block w-full rounded-2xl border border-slate-200 p-4 text-left hover:border-primary hover:bg-blue-50">
            <p className="font-semibold">{user.name}</p><p className="text-sm text-slate-600">{user.email} · {user.role} {user.adminRole ? `(${user.adminRole})` : ''} · {user.phone || 'No phone'} · {user.status || 'active'}</p>
          </button>)}
        </div>
        {selectedUser && <form onSubmit={promoteUser} className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <h3 className="font-semibold text-slate-900">Promote User to Location Admin</h3>
          <p className="mt-2 text-sm text-slate-700"><b>User:</b> {selectedUser.name}</p>
          <p className="text-sm text-slate-700"><b>Email:</b> {selectedUser.email}</p>
          <p className="text-sm text-slate-700"><b>Current role:</b> {selectedUser.role}{selectedUser.adminRole ? ` (${selectedUser.adminRole})` : ''} · <b>Status:</b> {selectedUser.status || 'active'}</p>
          <label className="mt-4 block"><span className="text-sm font-medium text-slate-700">Assigned location</span><select required value={promotionLocation} onChange={(event) => setPromotionLocation(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"><option value="">Select location</option>{ADMIN_LOCATIONS.map((location) => <option key={location} value={location}>{location}</option>)}</select></label>
          <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => setSelectedUser(null)} className="rounded-2xl border border-slate-300 px-4 py-2 font-semibold text-slate-700">Cancel</button><button type="submit" disabled={promoting} className="rounded-2xl bg-primary px-4 py-2 font-semibold text-white">{promoting ? 'Promoting...' : 'Promote to Location Admin'}</button></div>
        </form>}
      </section>}

      <div className="grid gap-4">
        {admins.map((admin) => (
          <div key={admin._id} className="rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-lg font-semibold">{admin.name}</p>
                <p className="text-slate-600">{admin.email} · {admin.phone || 'No phone'}</p>
                <p className="mt-1 text-slate-600">Role: <span className="font-semibold">{admin.adminRole || 'super_admin'}</span> · Source: {admin.adminSource === 'promoted_existing_user' ? 'Promoted Existing User' : 'Created as Admin'}</p>
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
