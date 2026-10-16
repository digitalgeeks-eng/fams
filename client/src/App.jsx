import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from './hooks/useAuth.jsx';
import api from './services/api.js';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import Listings from './pages/Listings.jsx';
import AboutUs from './pages/AboutUs.jsx';
import ContactUs from './pages/ContactUs.jsx';
import ContactInquiries from './pages/ContactInquiries.jsx';
import PropertyDetails from './pages/PropertyDetails.jsx';
import StudentDashboard from './pages/StudentDashboard.jsx';
import AgentDashboard from './pages/AgentDashboard.jsx';
import AgentProfile from './pages/AgentProfile.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import MyBookings from './pages/MyBookings.jsx';
import Payments from './pages/Payments.jsx';
import Complaints from './pages/Complaints.jsx';
import Recommendations from './pages/Recommendations.jsx';
import MyListings from './pages/MyListings.jsx';
import AddProperty from './pages/AddProperty.jsx';
import BookingRequests from './pages/BookingRequests.jsx';
import AgentVerification from './pages/AgentVerification.jsx';
import PropertyApproval from './pages/PropertyApproval.jsx';
import PaymentVerification from './pages/PaymentVerification.jsx';
import AdminBookings from './pages/AdminBookings.jsx';
import ComplaintManagement from './pages/ComplaintManagement.jsx';
import UserManagement from './pages/UserManagement.jsx';
import Notifications from './pages/Notifications.jsx';
import SendNotification from './pages/SendNotification.jsx';
import AdminManagement from './pages/AdminManagement.jsx';
import Navbar from './components/Navbar.jsx';
import LoadingSpinner from './components/LoadingSpinner.jsx';
import LaunchCountdown from './components/LaunchCountdown.jsx';

const PrivateRoute = ({ children, role }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user || (role && user.role !== role)) return <Navigate to="/login" replace />;
  return children;
};

const SuperAdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user || user.role !== 'admin' || (user.adminRole && user.adminRole !== 'super_admin')) return <Navigate to="/admin" replace />;
  return children;
};

const LocationAdminPropertyRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user || user.role !== 'admin') return <Navigate to="/login" replace />;
  return children;
};

const NonLocationAdminComplaintsRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user || (user.role === 'admin' && user.adminRole === 'location_admin')) return <Navigate to="/admin" replace />;
  return children;
};

const LaunchGate = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [launchStatus, setLaunchStatus] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    let timeout;

    const refreshStatus = async () => {
      try {
        const response = await api.get('/launch-status');
        const data = response.data.data;
        const nextStatus = { ...data, anchorPerformance: performance.now() };
        if (!active) return;
        setLaunchStatus(nextStatus);
        setError('');

        if (data.launched) return;
        const remaining = Date.parse(data.launchAt) - Date.parse(data.serverTime);
        const delay = remaining <= 0 ? 500 : remaining <= 60_000 ? 1000 : 30_000;
        timeout = window.setTimeout(refreshStatus, delay);
      } catch {
        if (!active) return;
        setError('Launch status could not be refreshed.');
        timeout = window.setTimeout(refreshStatus, launchStatus ? 5000 : 3000);
      }
    };

    refreshStatus();
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [retry]);

  const isSuperAdmin = user?.role === 'admin' && (!user.adminRole || user.adminRole === 'super_admin');
  const launchOpen = launchStatus && (!launchStatus.launchModeEnabled || launchStatus.launched);
  const adminLoginPath = !user
    && location.pathname === '/login'
    && new URLSearchParams(location.search).get('admin') === '1';

  if (!launchOpen && !(isSuperAdmin && !loading) && !adminLoginPath) {
    return (
      <LaunchCountdown
        status={launchStatus}
        error={error}
        onRetry={() => setRetry((value) => value + 1)}
      />
    );
  }

  if (!launchStatus && !adminLoginPath) return <LoadingSpinner />;

  return children;
};

const App = () => (
  <BrowserRouter>
    <LaunchGate>
      <div className="min-h-screen bg-background text-slate-900">
        <Navbar />
        <main className="max-w-7xl mx-auto px-3 py-4 sm:px-4 sm:py-6 lg:px-8">
          <Routes>
          <Route path="/" element={<Listings />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/verify-email/:token" element={<VerifyEmail />} />
          <Route path="/listings" element={<Listings />} />
          <Route path="/about-us" element={<AboutUs />} />
          <Route path="/contact-us" element={<ContactUs />} />
          <Route path="/properties/:id" element={<PropertyDetails />} />
          <Route path="/student" element={<PrivateRoute role="student"><StudentDashboard /></PrivateRoute>} />
          <Route path="/student/bookings" element={<PrivateRoute role="student"><MyBookings /></PrivateRoute>} />
          <Route path="/student/payments" element={<PrivateRoute role="student"><Payments /></PrivateRoute>} />
          <Route path="/student/complaints" element={<PrivateRoute role="student"><Complaints /></PrivateRoute>} />
          <Route path="/complaints" element={<NonLocationAdminComplaintsRoute><Complaints /></NonLocationAdminComplaintsRoute>} />
          <Route path="/student/recommendations" element={<PrivateRoute role="student"><Recommendations /></PrivateRoute>} />
          <Route path="/agent" element={<PrivateRoute role="agent"><AgentDashboard /></PrivateRoute>} />
          <Route path="/agent/profile" element={<PrivateRoute role="agent"><AgentProfile /></PrivateRoute>} />
          <Route path="/agent/listings" element={<PrivateRoute role="agent"><MyListings /></PrivateRoute>} />
          <Route path="/agent/add-property" element={<PrivateRoute role="agent"><AddProperty /></PrivateRoute>} />
          <Route path="/agent/listings/:id/edit" element={<PrivateRoute role="agent"><AddProperty /></PrivateRoute>} />
          <Route path="/agent/booking-requests" element={<PrivateRoute role="agent"><BookingRequests /></PrivateRoute>} />
          <Route path="/admin" element={<PrivateRoute role="admin"><AdminDashboard /></PrivateRoute>} />
          <Route path="/admin/manage" element={<SuperAdminRoute><AdminManagement /></SuperAdminRoute>} />
          <Route path="/admin/agents" element={<SuperAdminRoute><AgentVerification /></SuperAdminRoute>} />
          <Route path="/admin/properties" element={<LocationAdminPropertyRoute><PropertyApproval /></LocationAdminPropertyRoute>} />
          <Route path="/admin/payments" element={<LocationAdminPropertyRoute><PaymentVerification /></LocationAdminPropertyRoute>} />
          <Route path="/admin/bookings" element={<LocationAdminPropertyRoute><AdminBookings /></LocationAdminPropertyRoute>} />
          <Route path="/admin/complaints" element={<SuperAdminRoute><ComplaintManagement /></SuperAdminRoute>} />
          <Route path="/admin/users" element={<SuperAdminRoute><UserManagement /></SuperAdminRoute>} />
          <Route path="/admin/notifications" element={<SuperAdminRoute><SendNotification /></SuperAdminRoute>} />
          <Route path="/admin/contact-inquiries" element={<SuperAdminRoute><ContactInquiries /></SuperAdminRoute>} />
          <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
          </Routes>
        </main>
      </div>
    </LaunchGate>
  </BrowserRouter>
);

export default App;
