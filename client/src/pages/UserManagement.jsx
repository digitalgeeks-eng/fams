import { useEffect, useMemo, useState } from 'react';
import api from '../services/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const response = await api.get('/admin/users');
        setUsers(response.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const updateRole = async (id, role) => {
    try {
      await api.put(`/admin/users/${id}/role`, { role });
      setUsers((prev) => prev.map((user) => (user._id === id ? { ...user, role } : user)));
      setMessage('User role updated successfully.');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to update role.');
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm('Delete this user? This cannot be undone.')) return;
    try {
      await api.delete(`/admin/users/${id}`);
      setUsers((prev) => prev.filter((user) => user._id !== id));
      setMessage('User deleted successfully.');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to delete user.');
    }
  };

  const filteredUsers = useMemo(() => users.filter((user) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [user.name, user.email].some((value) => value?.toLowerCase().includes(query));
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  }), [users, search, roleFilter]);

  if (loading) return <LoadingSpinner />;

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">User management</h1>
            <p className="mt-2 text-slate-600">Search users, update roles, and remove accounts securely.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email"
              className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 shadow-sm focus:border-primary focus:outline-none sm:w-80"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 shadow-sm focus:border-primary focus:outline-none sm:w-56"
            >
              <option value="all">All roles</option>
              <option value="student">Student</option>
              <option value="agent">Agent</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        {message && (
          <div className="mt-4 rounded-3xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-700">
            {message}
          </div>
        )}
      </div>

      <div className="grid gap-4">
        {filteredUsers.length ? filteredUsers.map((user) => (
          <div key={user._id} className="rounded-3xl bg-white p-6 shadow-xl">
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
              <div>
                <p className="text-xl font-semibold text-slate-900">{user.name}</p>
                <p className="mt-1 text-slate-600">{user.email}</p>
                <p className="mt-1 text-slate-600">Role: <span className="font-semibold text-slate-900">{user.role}</span></p>
                <p className="mt-1 text-slate-600">Joined: {new Date(user.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => updateRole(user._id, 'student')} className="rounded-2xl bg-slate-700 px-4 py-2 text-white hover:bg-slate-800">Student</button>
                <button onClick={() => updateRole(user._id, 'agent')} className="rounded-2xl bg-primary px-4 py-2 text-white hover:bg-slate-900">Agent</button>
                <button onClick={() => updateRole(user._id, 'admin')} className="rounded-2xl bg-secondary px-4 py-2 text-white hover:bg-slate-900">Admin</button>
                <button onClick={() => deleteUser(user._id)} className="rounded-2xl bg-rose-500 px-4 py-2 text-white hover:bg-rose-600">Delete</button>
              </div>
            </div>
          </div>
        )) : (
          <div className="col-span-full rounded-3xl bg-slate-50 p-8 text-slate-600">No users match the current filters.</div>
        )}
      </div>
    </section>
  );
};

export default UserManagement;
