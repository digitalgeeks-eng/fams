import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';

const Navbar = () => {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
  };

  const MenuLink = ({ to, label, onClick }) => (
    <Link
      to={to}
      onClick={() => {
        onClick?.();
        setMobileMenuOpen(false);
      }}
      className="block px-4 py-3 rounded-lg transition text-slate-700 hover:bg-slate-100 hover:text-primary md:inline-block md:px-3 md:py-2 md:rounded-full"
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 md:py-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 sm:gap-3 text-sm sm:text-lg font-semibold tracking-wide text-slate-900 flex-shrink-0">
          <span className="inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-2xl bg-primary text-white shadow-card text-sm sm:text-base font-bold">F</span>
          <span className="hidden sm:inline">FULAFIA AMS</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-slate-700">
          <MenuLink to="/listings" label="Listings" />
          
          {!user && (
            <>
              <MenuLink to="/login" label="Login" />
              <MenuLink to="/register" label="Register" />
            </>
          )}

          {user && user.role === 'admin' && (
            <>
              {user.adminRole !== 'location_admin' && <MenuLink to="/admin/manage" label="Admin Management" />}
              {user.adminRole !== 'location_admin' && <MenuLink to="/admin/agents" label="Agents" />}
              <MenuLink to="/admin/properties" label="Properties" />
              {user.adminRole !== 'location_admin' && <MenuLink to="/admin/users" label="Users" />}
              <MenuLink to="/admin/payments" label="Payments" />
              {user.adminRole !== 'location_admin' && <MenuLink to="/complaints" label="Complaints" />}
              {user.adminRole !== 'location_admin' && <MenuLink to="/admin/notifications" label="Send Notification" />}
            </>
          )}

          {user && user.role === 'student' && (
            <>
              <MenuLink to="/student/bookings" label="My Bookings" />
              <MenuLink to="/student/payments" label="Payments" />
              <MenuLink to="/student/complaints" label="Complaints" />
              <MenuLink to="/student/recommendations" label="Recommendations" />
              <MenuLink to="/notifications" label="Notifications" />
            </>
          )}

          {user && user.role === 'agent' && (
            <>
              <MenuLink to="/agent/profile" label="Profile" />
              <MenuLink to="/agent/listings" label="My Listings" />
              <MenuLink to="/agent/add-property" label="Add Property" />
              <MenuLink to="/agent/booking-requests" label="Booking Requests" />
              <MenuLink to="/complaints" label="Complaints" />
              <MenuLink to="/notifications" label="Notifications" />
            </>
          )}

          {user && (
            <>
              <MenuLink to={user.role === 'admin' ? '/admin' : user.role === 'agent' ? '/agent' : '/student'} label="Dashboard" />
              <button
                onClick={handleLogout}
                className="ml-2 rounded-full px-4 py-2 text-slate-700 transition hover:bg-slate-100 hover:text-danger"
              >
                Logout
              </button>
            </>
          )}
        </nav>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileMenuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
          </svg>
        </button>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <nav className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1 max-h-[calc(100vh-70px)] overflow-y-auto">
          <MenuLink to="/listings" label="Listings" />
          
          {!user && (
            <>
              <MenuLink to="/login" label="Login" />
              <MenuLink to="/register" label="Register" />
            </>
          )}

          {user && user.role === 'admin' && (
            <>
              {user.adminRole !== 'location_admin' && <MenuLink to="/admin/manage" label="Admin Management" />}
              {user.adminRole !== 'location_admin' && <MenuLink to="/admin/agents" label="Agents" />}
              <MenuLink to="/admin/properties" label="Properties" />
              {user.adminRole !== 'location_admin' && <MenuLink to="/admin/users" label="Users" />}
              <MenuLink to="/admin/payments" label="Payments" />
              {user.adminRole !== 'location_admin' && <MenuLink to="/complaints" label="Complaints" />}
              {user.adminRole !== 'location_admin' && <MenuLink to="/admin/notifications" label="Send Notification" />}
              <MenuLink to="/admin" label="Dashboard" />
            </>
          )}

          {user && user.role === 'student' && (
            <>
              <MenuLink to="/student/bookings" label="My Bookings" />
              <MenuLink to="/student/payments" label="Payments" />
              <MenuLink to="/student/complaints" label="Complaints" />
              <MenuLink to="/student/recommendations" label="Recommendations" />
              <MenuLink to="/notifications" label="Notifications" />
              <MenuLink to="/student" label="Dashboard" />
            </>
          )}

          {user && user.role === 'agent' && (
            <>
              <MenuLink to="/agent/profile" label="Profile" />
              <MenuLink to="/agent/listings" label="My Listings" />
              <MenuLink to="/agent/add-property" label="Add Property" />
              <MenuLink to="/agent/booking-requests" label="Booking Requests" />
              <MenuLink to="/complaints" label="Complaints" />
              <MenuLink to="/notifications" label="Notifications" />
              <MenuLink to="/agent" label="Dashboard" />
            </>
          )}

          {user && (
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-3 rounded-lg text-slate-700 transition hover:bg-slate-100 hover:text-danger font-medium"
            >
              Logout
            </button>
          )}
        </nav>
      )}
    </header>
  );
};

export default Navbar;
