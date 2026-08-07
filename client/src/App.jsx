import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Listings from './pages/Listings.jsx';
import PropertyDetails from './pages/PropertyDetails.jsx';
import StudentDashboard from './pages/StudentDashboard.jsx';
import AgentDashboard from './pages/AgentDashboard.jsx';
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
import Navbar from './components/Navbar.jsx';
import LoadingSpinner from './components/LoadingSpinner.jsx';

const PrivateRoute = ({ children, role }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user || (role && user.role !== role)) return <Navigate to="/login" replace />;
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
          <Route path="/listings" element={<Listings />} />
          <Route path="/properties/:id" element={<PropertyDetails />} />
          <Route path="/student" element={<PrivateRoute role="student"><StudentDashboard /></PrivateRoute>} />
          <Route path="/student/bookings" element={<PrivateRoute role="student"><MyBookings /></PrivateRoute>} />
          <Route path="/student/payments" element={<PrivateRoute role="student"><Payments /></PrivateRoute>} />
          <Route path="/student/complaints" element={<PrivateRoute role="student"><Complaints /></PrivateRoute>} />
          <Route path="/complaints" element={<PrivateRoute><Complaints /></PrivateRoute>} />
          <Route path="/student/recommendations" element={<PrivateRoute role="student"><Recommendations /></PrivateRoute>} />
          <Route path="/agent" element={<PrivateRoute role="agent"><AgentDashboard /></PrivateRoute>} />
          <Route path="/agent/listings" element={<PrivateRoute role="agent"><MyListings /></PrivateRoute>} />
          <Route path="/agent/add-property" element={<PrivateRoute role="agent"><AddProperty /></PrivateRoute>} />
          <Route path="/agent/booking-requests" element={<PrivateRoute role="agent"><BookingRequests /></PrivateRoute>} />
          <Route path="/admin" element={<PrivateRoute role="admin"><AdminDashboard /></PrivateRoute>} />
          <Route path="/admin/agents" element={<PrivateRoute role="admin"><AgentVerification /></PrivateRoute>} />
          <Route path="/admin/properties" element={<PrivateRoute role="admin"><PropertyApproval /></PrivateRoute>} />
          <Route path="/admin/payments" element={<PrivateRoute role="admin"><PaymentVerification /></PrivateRoute>} />
          <Route path="/admin/bookings" element={<PrivateRoute role="admin"><AdminBookings /></PrivateRoute>} />
          <Route path="/admin/complaints" element={<PrivateRoute role="admin"><ComplaintManagement /></PrivateRoute>} />
          <Route path="/admin/users" element={<PrivateRoute role="admin"><UserManagement /></PrivateRoute>} />
          <Route path="/admin/notifications" element={<PrivateRoute role="admin"><SendNotification /></PrivateRoute>} />
          <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
        </Routes>
      </main>
    </div>
  </BrowserRouter>
);

export default App;
