import { useEffect, useState } from 'react';
import api from '../services/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState({});
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [filters, setFilters] = useState({ search: '', role: 'all', status: 'all', verificationStatus: 'all', authProvider: 'all' });
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState('');

  const fetchUsers = async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      Object.entries(filters).forEach(([key, value]) => { if (value !== 'all' && value) params[key] = value; });
      const response = await api.get('/admin/users', { params });
      setUsers(response.data.data.users);
      setStatistics(response.data.data.statistics);
      setPagination(response.data.data.pagination);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => fetchUsers(1), 250);
    return () => clearTimeout(timeout);
  }, [filters.search, filters.role, filters.status, filters.verificationStatus, filters.authProvider]);

  const updateRole = async (id, role) => {
    try {
      await api.put(`/admin/users/${id}/role`, { role });
      setUsers((prev) => prev.map((user) => (user._id === id ? { ...user, role } : user)));
      setMessage('User role updated successfully.');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to update role.');
    }
  };

  const changeRole = async (user) => {
    const role = window.prompt('Enter role: student, agent, or admin', user.role);
    if (role && ['student', 'agent', 'admin'].includes(role)) await updateRole(user._id, role);
  };

  const editUser = async (user) => {
    const name = window.prompt('Full name', user.name);
    if (!name || name === user.name) return;
    try {
      const response = await api.put(`/admin/users/${user._id}`, { name });
      setUsers((prev) => prev.map((item) => (item._id === user._id ? { ...item, ...response.data.data } : item)));
      setMessage('User updated successfully.');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to update user.');
    }
  };

  const updateStatus = async (user, status) => {
    if (!window.confirm(`${status === 'deactivated' ? 'Deactivate' : status === 'suspended' ? 'Suspend' : 'Activate'} ${user.name}?`)) return;
    try {
      const response = await api.patch(`/admin/users/${user._id}/status`, { status });
      setUsers((prev) => prev.map((item) => (item._id === user._id ? { ...item, ...response.data.data } : item)));
      setMessage(`User ${status} successfully.`);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to update user status.');
    }
  };

  const viewUser = async (id) => {
    try {
      const response = await api.get(`/admin/users/${id}`);
      setSelectedUser(response.data.data);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to load user details.');
    }
  };

  if (loading && !users.length) return <LoadingSpinner />;

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">User management</h1>
            <p className="mt-2 text-slate-600">Search users, update roles, and manage account status securely.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="search"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search name, email, or phone"
              className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 shadow-sm focus:border-primary focus:outline-none sm:w-80"
            />
            <select
              value={filters.role}
              onChange={(e) => setFilters({ ...filters, role: e.target.value })}
              className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 shadow-sm focus:border-primary focus:outline-none sm:w-56"
            >
              <option value="all">All roles</option>
              <option value="student">Student</option>
              <option value="agent">Agent</option>
              <option value="admin">Admin</option>
            </select>
            {['status', 'verificationStatus', 'authProvider'].map((key) => (
              <select key={key} value={filters[key]} onChange={(e) => setFilters({ ...filters, [key]: e.target.value })} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 sm:w-56">
                <option value="all">All {key === 'verificationStatus' ? 'verification' : key === 'authProvider' ? 'providers' : 'status'}</option>
                {(key === 'status' ? ['active', 'suspended', 'deactivated'] : key === 'verificationStatus' ? ['pending', 'verified', 'rejected'] : ['local', 'google', 'both']).map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            ))}
          </div>
        </div>
        {message && (
          <div className="mt-4 rounded-3xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-700">
            {message}
          </div>
        )}
      </div>

      <div className="grid gap-4">
        {users.length ? users.map((user) => (
          <div key={user._id} className="rounded-3xl bg-white p-6 shadow-xl">
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
              <div>
                <p className="text-xl font-semibold text-slate-900">{user.name}</p>
                <p className="mt-1 text-slate-600">{user.email}</p>
                <p className="mt-1 text-slate-600">Role: <span className="font-semibold text-slate-900">{user.role}</span></p>
                <p className="mt-1 text-slate-600">Status: <span className="font-semibold">{user.status || 'active'}</span> · Provider: {user.authProvider || 'local'}</p>
                <p className="mt-1 text-slate-600">Verification: {user.verificationStatus || 'verified'} · Joined: {new Date(user.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => viewUser(user._id)} className="rounded-2xl border border-slate-300 px-4 py-2 text-slate-700">View</button>
                <button onClick={() => editUser(user)} className="rounded-2xl bg-primary px-4 py-2 text-white">Edit</button>
                <button onClick={() => changeRole(user)} className="rounded-2xl bg-secondary px-4 py-2 text-white">Change Role</button>
                {user.status === 'active' || !user.status ? <button onClick={() => updateStatus(user, 'suspended')} className="rounded-2xl bg-amber-600 px-4 py-2 text-white">Suspend</button> : <button onClick={() => updateStatus(user, 'active')} className="rounded-2xl bg-emerald-600 px-4 py-2 text-white">Activate</button>}
                {user.status !== 'deactivated' && <button onClick={() => updateStatus(user, 'deactivated')} className="rounded-2xl bg-rose-600 px-4 py-2 text-white">Deactivate</button>}
              </div>
            </div>
          </div>
        )) : (
          <div className="col-span-full rounded-3xl bg-slate-50 p-8 text-slate-600">No users match the current filters.</div>
        )}
      </div>
      <div className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm"><button disabled={pagination.page <= 1} onClick={() => fetchUsers(pagination.page - 1)} className="rounded-xl border px-3 py-2 disabled:opacity-40">Previous</button><span>Page {pagination.page} of {pagination.totalPages || 1}</span><button disabled={pagination.page >= pagination.totalPages} onClick={() => fetchUsers(pagination.page + 1)} className="rounded-xl border px-3 py-2 disabled:opacity-40">Next</button></div>
      {selectedUser && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setSelectedUser(null)}><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6" onClick={(event) => event.stopPropagation()}><div className="flex justify-between"><h2 className="text-xl font-semibold">User details</h2><button onClick={() => setSelectedUser(null)}>Close</button></div><div className="mt-4 space-y-2 text-slate-700"><p><b>Name:</b> {selectedUser.user.name}</p><p><b>Email:</b> {selectedUser.user.email}</p><p><b>Role:</b> {selectedUser.user.role}</p><p><b>Status:</b> {selectedUser.user.status || 'active'}</p><p><b>Provider:</b> {selectedUser.user.authProvider || 'local'}</p><p><b>Properties:</b> {selectedUser.properties.length}</p><p><b>Bookings:</b> {selectedUser.bookings.length}</p><p><b>Payments:</b> {selectedUser.payments.length}</p><p><b>Complaints:</b> {selectedUser.complaints.length}</p></div><h3 className="mt-6 font-semibold">Management history</h3>{selectedUser.history.map((entry) => <p key={entry._id} className="mt-2 rounded-xl bg-slate-50 p-3 text-sm">{entry.action} by {entry.adminId?.name || 'admin'} on {new Date(entry.createdAt).toLocaleString()}</p>)}</div></div>}
    </section>
  );
};

export default UserManagement;
