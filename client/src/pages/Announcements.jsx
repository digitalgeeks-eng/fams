import { useEffect, useState } from 'react';
import api from '../services/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

const Announcements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const response = await api.get('/communications/announcements');
        setAnnouncements(response.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnnouncements();
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-xl">
        <h1 className="text-2xl font-semibold">Announcements</h1>
        <p className="mt-2 text-slate-600">Important updates from the administration for your role.</p>
      </div>
      <div className="grid gap-4">
        {announcements.length ? announcements.map((announcement) => (
          <article key={announcement._id} className="rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{announcement.title}</h2>
                <p className="text-sm text-slate-500">{new Date(announcement.createdAt).toLocaleString()}</p>
              </div>
              <span className="rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">{announcement.audience}</span>
            </div>
            <p className="mt-4 text-slate-600 whitespace-pre-line">{announcement.body}</p>
          </article>
        )) : (
          <div className="rounded-3xl bg-slate-50 p-6 text-slate-600">No announcements available.</div>
        )}
      </div>
    </section>
  );
};

export default Announcements;
