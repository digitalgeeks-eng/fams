import { useEffect, useState } from 'react';
import api from '../services/api.js';
import { LOCATIONS } from '../constants/locations.js';
import PropertyCard from '../components/PropertyCard.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

const Listings = () => {
  const [properties, setProperties] = useState([]);
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
          params: { search: query, location, type, priceRange } 
        });
        setProperties(response.data.data.properties);

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
  }, [query, location, type, priceRange]);

  return (
    <section className="space-y-6 sm:space-y-8">
      <div className="rounded-2xl sm:rounded-3xl bg-white p-4 sm:p-6 shadow-card ring-1 ring-slate-200">
        <div className="flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex-1">
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-950">Search properties</h2>
            <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-slate-500">Find the perfect accommodation with filters for location, price and type. Your search history helps us improve recommendations.</p>
          </div>
          <div className="inline-flex items-center rounded-2xl sm:rounded-3xl bg-slate-50 px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-600 shadow-sm whitespace-nowrap">
            <span className="mr-2 text-primary">•</span>
            {properties.length} properties
          </div>
        </div>
        <div className="mt-4 sm:mt-6 grid gap-2.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <input
            placeholder="Search title"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
          >
            <option value="">All locations</option>
            {LOCATIONS.map((loc) => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
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
            onChange={(e) => setPriceRange(e.target.value)}
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
        <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {properties.length ? properties.map((property) => <PropertyCard key={property._id} property={property} />) : (
            <div className="col-span-full rounded-2xl sm:rounded-3xl bg-white p-6 sm:p-10 text-center text-sm sm:text-base text-slate-600 shadow-card ring-1 ring-slate-200">
              No matching properties found.
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default Listings;
