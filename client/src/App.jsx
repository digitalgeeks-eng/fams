import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import Listings from './pages/Listings.jsx';
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

const App = () => (
  <BrowserRouter>
    <div className="min-h-screen bg-background text-slate-900">
      <Navbar />
      <main className="max-w-7xl mx-auto px-3 py-4 sm:px-4 sm:py-6 lg:px-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/verify-email/:token" element={<VerifyEmail />} />
          <Route path="/listings" element={<Listings />} />
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
          <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
        </Routes>
      </main>
    </div>
  </BrowserRouter>
);

export default App;
