import { useEffect, useState } from 'react';
import api from '../services/api.js';
import { LOCATIONS } from '../constants/locations.js';
import PropertyCard from '../components/PropertyCard.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

const Listings = () => {
  const [properties, setProperties] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, limit: 12 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('');
  const [priceRange, setPriceRange] = useState('');
  const [locationTracked, setLocationTracked] = useState(false);

  // Track user's geolocation on component mount
  useEffect(() => {
    if ('geolocation' in navigator && !locationTracked) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            await api.post('/users/track-location', {
              latitude,
              longitude,
              locationName: 'Current Location'
            });
            setLocationTracked(true);
            console.log('Location tracked:', { latitude, longitude });
          } catch (err) {
            console.error('Failed to track location:', err);
          }
        },
        (error) => {
          console.log('Geolocation permission denied or unavailable:', error.message);
        }
      );
    }
  }, [locationTracked]);

  // Fetch properties
  useEffect(() => {
    const fetchProperties = async () => {
      setLoading(true);
      try {
        const response = await api.get('/properties', { 
          params: { search: query, location, type, priceRange, page: pagination.page }
        });
        setProperties(response.data.data.properties);
        setPagination({
          page: response.data.data.page,
          total: response.data.data.total,
          limit: response.data.data.limit
        });

        // Track search preferences for recommendations
        if (location || type || priceRange || query) {
          const minPrice = priceRange.split('-')[0] || 0;
          const maxPrice = priceRange.split('-')[1] || 0;
          await api.post('/users/search-history', {
            query: query || '',
            location: location || '',
            propertyType: type || '',
            minPrice: parseInt(minPrice) || 0,
            maxPrice: parseInt(maxPrice) || 0
          }).catch(() => null); // Don't fail if tracking fails
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProperties();
  }, [query, location, type, priceRange, pagination.page]);

  const updateFilter = (setter, value) => {
    setPagination((current) => ({ ...current, page: 1 }));
    setter(value);
  };

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));

  return (
    <section className="space-y-6 sm:space-y-8">
      <div className="rounded-2xl sm:rounded-3xl bg-white p-4 sm:p-6 shadow-card ring-1 ring-slate-200">
        <div className="flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-950">Find your next place to stay</h1>
            <p className="mt-1.5 sm:mt-2 text-sm text-slate-600"><span className="font-medium text-slate-700">Find Your Next Place to Stay.</span> Browse accommodation around the Federal University of Lafia and narrow your search by location, type, or price.</p>
          </div>
          <div className="inline-flex items-center rounded-2xl sm:rounded-3xl bg-slate-50 px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-600 shadow-sm whitespace-nowrap">
            <span className="mr-2 text-primary">•</span>
            {pagination.total} properties
          </div>
        </div>
        <div className="mt-4 sm:mt-6 grid gap-2.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <input
            placeholder="Search title"
            value={query}
            onChange={(e) => updateFilter(setQuery, e.target.value)}
            className="w-full rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
          <select
            value={location}
            onChange={(e) => updateFilter(setLocation, e.target.value)}
            className="w-full rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
          >
            <option value="">All locations</option>
            {LOCATIONS.map((loc) => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
          <select
            value={type}
            onChange={(e) => updateFilter(setType, e.target.value)}
            className="w-full rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
          >
            <option value="">All house types</option>
            <option value="Single Room">Single Room</option>
            <option value="Self-Contain">Self-Contain</option>
            <option value="Room and Parlour">Room and Parlour</option>
            <option value="Mini Flat">Mini Flat</option>
          </select>
          <select
            value={priceRange}
            onChange={(e) => updateFilter(setPriceRange, e.target.value)}
            className="w-full rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
          >
            <option value="">Price range</option>
            <option value="0-50000">Under ₦50k</option>
            <option value="50000-150000">₦50k - ₦150k</option>
            <option value="150000-300000">₦150k+</option>
          </select>
        </div>
      </div>
      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {properties.length ? properties.map((property) => <PropertyCard key={property._id} property={property} />) : (
              <div className="col-span-full rounded-2xl sm:rounded-3xl bg-white p-6 sm:p-10 text-center text-sm sm:text-base text-slate-600 shadow-card ring-1 ring-slate-200">
                No matching properties found.
              </div>
            )}
          </div>
          {pagination.total > pagination.limit && (
            <nav aria-label="Property listing pages" className="flex items-center justify-center gap-4 rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-slate-600">Page {pagination.page} of {totalPages}</span>
              <button
                type="button"
                disabled={pagination.page >= totalPages}
                onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
};

export default Listings;
