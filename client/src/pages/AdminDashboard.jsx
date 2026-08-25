import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../services/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { useAuth } from '../hooks/useAuth.jsx';

const AdminDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const response = await api.get('/admin/analytics');
        setAnalytics(response.data.data);
      } catch (err) {
        console.error('Admin analytics fetch error:', err);
        setAnalytics({
          verifiedAgents: 0,
          activeProperties: 0,
          totalPayments: 0,
          pendingComplaints: 0,
          totalStudents: 0,
          pendingAgents: 0
        });
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) return <LoadingSpinner />;

  if (!analytics) return <div className="rounded-3xl bg-white p-8 text-slate-700">Unable to load analytics.</div>;

  return (
    <section className="space-y-8">
      <div className="rounded-3xl bg-white p-6 shadow-xl">
        <h1 className="text-3xl font-semibold">Admin dashboard</h1>
        <p className="mt-2 text-slate-600">{user?.adminRole === 'location_admin' ? `Manage ${user.assignedLocation} properties and approvals.` : 'Manage agents, property approvals, payments, complaints, and users from one place.'}</p>
        {user?.adminRole !== 'location_admin' && <Link to="/admin/manage" className="mt-4 inline-flex rounded-2xl bg-secondary px-4 py-2 font-semibold text-white hover:bg-slate-900">Admin Management</Link>}
      </div>
      {user?.adminRole !== 'location_admin' && <div className="grid gap-6 md:grid-cols-3">
        <Link to="/admin/agents" className="rounded-3xl bg-primary text-white p-6 shadow-xl hover:bg-slate-900">
          <h3 className="text-sm uppercase">Verify agents</h3>
          <p className="mt-4 text-2xl font-bold">{analytics.verifiedAgents}</p>
        </Link>
        <Link to="/admin/properties" className="rounded-3xl bg-primary text-white p-6 shadow-xl hover:bg-slate-900">
          <h3 className="text-sm uppercase">Approve listings</h3>
          <p className="mt-4 text-2xl font-bold">{analytics.activeProperties}</p>
        </Link>
        <Link to="/admin/payments" className="rounded-3xl bg-primary text-white p-6 shadow-xl hover:bg-slate-900">
          <h3 className="text-sm uppercase">Verify payments</h3>
          <p className="mt-4 text-2xl font-bold">{analytics.totalPayments}</p>
        </Link>
      </div>}
      {user?.adminRole === 'location_admin' ? <div className="grid gap-6 md:grid-cols-3">
        <Link to="/admin/properties" className="rounded-3xl bg-primary p-6 text-white shadow-xl hover:bg-slate-900"><h3 className="text-sm uppercase">Pending approvals</h3><p className="mt-4 text-4xl font-bold">{analytics.pendingApprovals}</p></Link>
        <Link to="/admin/properties" className="rounded-3xl bg-white p-6 shadow-xl hover:shadow-2xl"><h3 className="text-sm uppercase text-slate-500">Approved listings</h3><p className="mt-4 text-4xl font-bold">{analytics.activeProperties}</p></Link>
        <Link to="/admin/payments" className="rounded-3xl bg-white p-6 shadow-xl hover:shadow-2xl"><h3 className="text-sm uppercase text-slate-500">Payment verification</h3><p className="mt-4 text-4xl font-bold">{analytics.totalPayments}</p></Link>
        <div className="rounded-3xl bg-white p-6 shadow-xl"><h3 className="text-sm uppercase text-slate-500">Available</h3><p className="mt-4 text-4xl font-bold">{analytics.availableProperties}</p></div>
        <div className="rounded-3xl bg-white p-6 shadow-xl"><h3 className="text-sm uppercase text-slate-500">Not available</h3><p className="mt-4 text-4xl font-bold">{analytics.unavailableProperties}</p></div>
      </div> : <div className="grid gap-6 md:grid-cols-3">
        <Link to="/admin/complaints" className="rounded-3xl bg-white p-6 shadow-xl hover:shadow-2xl">
          <h3 className="text-sm uppercase text-slate-500">Pending complaints</h3>
          <p className="mt-4 text-4xl font-bold">{analytics.pendingComplaints}</p>
        </Link>
        <Link to="/admin/users" className="rounded-3xl bg-white p-6 shadow-xl hover:shadow-2xl">
          <h3 className="text-sm uppercase text-slate-500">User management</h3>
          <p className="mt-4 text-4xl font-bold">{analytics.totalStudents + analytics.verifiedAgents + analytics.pendingAgents}</p>
        </Link>
        <div className="rounded-3xl bg-white p-6 shadow-xl">
          <h3 className="text-sm uppercase text-slate-500">Agents pending</h3>
          <p className="mt-4 text-4xl font-bold">{analytics.pendingAgents}</p>
        </div>
      </div>}
      {user?.adminRole !== 'location_admin' && <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-3xl bg-white p-6 shadow-xl">
          <h3 className="text-sm uppercase text-slate-500">Students</h3>
          <p className="mt-4 text-4xl font-bold">{analytics.totalStudents}</p>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-xl">
          <h3 className="text-sm uppercase text-slate-500">Active properties</h3>
          <p className="mt-4 text-4xl font-bold">{analytics.activeProperties}</p>
        </div>
        <Link to="/admin/bookings" className="rounded-3xl bg-white p-6 shadow-xl hover:shadow-2xl">
          <h3 className="text-sm uppercase text-slate-500">Total bookings</h3>
          <p className="mt-4 text-4xl font-bold">{analytics.totalBookings}</p>
        </Link>
      </div>}
      {user?.adminRole !== 'location_admin' && <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-3xl bg-white p-6 shadow-xl">
          <h3 className="text-sm uppercase text-slate-500">Verified payments</h3>
          <p className="mt-4 text-4xl font-bold">{analytics.totalPayments}</p>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-xl">
          <h3 className="text-sm uppercase text-slate-500">Pending complaints</h3>
          <p className="mt-4 text-4xl font-bold">{analytics.pendingComplaints}</p>
        </div>
      </div>}
    </section>
  );
};

export default AdminDashboard;
