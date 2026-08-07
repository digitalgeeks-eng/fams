import { useEffect, useState } from 'react';
import api from '../services/api.js';
import PropertyCard from '../components/PropertyCard.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

const Recommendations = () => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const response = await api.get('/users/recommendations');
        setRecommendations(response.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchRecommendations();
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-xl">
        <h1 className="text-2xl font-semibold">Recommended Houses For You</h1>
        <p className="mt-2 text-slate-600">Personalized recommendations based on your search history and preferences</p>
      </div>
      
      {recommendations.length ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {recommendations.map((property) => (
            <PropertyCard key={property._id} property={property} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl bg-slate-50 p-8 text-center text-slate-600">
          <p className="text-lg font-semibold">No recommendations yet</p>
          <p className="text-sm mt-2">Search and view properties to improve suggestions</p>
        </div>
      )}
    </section>
  );
};

export default Recommendations;
