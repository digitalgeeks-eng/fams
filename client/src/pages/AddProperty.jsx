import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api.js';
import { LEGACY_LOCATION_ALIASES, LOCATIONS } from '../constants/locations.js';

const PROPERTY_TYPES = ['Single Room', 'Self-Contain', 'Room and Parlour', 'Mini Flat'];

const AddProperty = () => {
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    customLocation: '',
    type: '',
    price: '',
    visibleUntil: '',
    adminContactName: '',
    adminContactEmail: '',
    adminContactPhone: '',
    adminContactWhatsapp: '',
    adminContactFacebook: '',
    adminContactInstagram: '',
    adminContactTwitter: '',
    adminContactLinkedin: ''
  });
  const [images, setImages] = useState([]);
  const [videos, setVideos] = useState([]);
  const [existingMediaCount, setExistingMediaCount] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!id) return;
    const loadProperty = async () => {
      try {
        const response = await api.get(`/properties/${id}`);
        const property = response.data.data;
        setExistingMediaCount((property.images?.length || 0) + (property.videos?.length || 0));
        const displayedLocation = LEGACY_LOCATION_ALIASES[property.location] || property.location || '';
        const isPredefined = LOCATIONS.includes(displayedLocation) && displayedLocation !== 'Other';
        setForm((current) => ({
          ...current,
          title: property.title || '',
          description: property.description || '',
          location: isPredefined ? displayedLocation : 'Other',
          customLocation: isPredefined ? '' : property.location || '',
          type: property.type || '',
          price: property.price || '',
          visibleUntil: property.visibleUntil ? new Date(property.visibleUntil).toISOString().slice(0, 16) : ''
        }));
      } catch (err) {
        setMessage(err.response?.data?.message || 'Could not load property');
      }
    };
    loadProperty();
  }, [id]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const totalSelectedMedia = images.length + videos.length;
    const totalMedia = totalSelectedMedia + existingMediaCount;

    if (totalMedia === 0) {
      setMessage('Please upload at least one property image or video before listing this property.');
      return;
    }

    const data = new FormData();
    data.append('title', form.title);
    data.append('description', form.description);
    data.append('location', form.location);
    if (form.location === 'Other') data.append('customLocation', form.customLocation.trim());
    data.append('type', form.type);
    data.append('price', form.price);
    if (form.visibleUntil) data.append('visibleUntil', form.visibleUntil);
    if (form.adminContactName) data.append('adminContactName', form.adminContactName);
    if (form.adminContactEmail) data.append('adminContactEmail', form.adminContactEmail);
    if (form.adminContactPhone) data.append('adminContactPhone', form.adminContactPhone);
    if (form.adminContactWhatsapp) data.append('adminContactWhatsapp', form.adminContactWhatsapp);
    if (form.adminContactFacebook) data.append('adminContactFacebook', form.adminContactFacebook);
    if (form.adminContactInstagram) data.append('adminContactInstagram', form.adminContactInstagram);
    if (form.adminContactTwitter) data.append('adminContactTwitter', form.adminContactTwitter);
    if (form.adminContactLinkedin) data.append('adminContactLinkedin', form.adminContactLinkedin);
    images.forEach((file) => data.append('images', file));
    videos.forEach((file) => data.append('videos', file));
    try {
      await api[isEditMode ? 'put' : 'post'](isEditMode ? `/properties/${id}` : '/properties', data);
      setMessage(isEditMode ? 'Property updated successfully and sent for approval' : 'Property created successfully and awaiting admin approval');
      setForm({ title: '', description: '', location: '', customLocation: '', type: '', price: '', visibleUntil: '', adminContactName: '', adminContactEmail: '', adminContactPhone: '', adminContactWhatsapp: '', adminContactFacebook: '', adminContactInstagram: '', adminContactTwitter: '', adminContactLinkedin: '' });
      setImages([]);
      setVideos([]);
      setExistingMediaCount(0);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Could not submit listing');
    }
  };

  return (
    <section className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">{isEditMode ? 'Edit Property' : 'Add Property'}</h1>
      <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-6 shadow-xl space-y-4">
        {message && <div className="rounded-xl bg-slate-100 p-4 text-slate-700">{message}</div>}
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="w-full border border-slate-300 rounded-2xl px-4 py-3" required />
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" className="w-full border border-slate-300 rounded-2xl px-4 py-3 h-32" required />
        <select value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value, customLocation: e.target.value === 'Other' ? form.customLocation : '' })} className="w-full border border-slate-300 rounded-2xl px-4 py-3 bg-white" required>
          <option value="">Select location</option>
          {LOCATIONS.map((location) => (
            <option key={location} value={location}>{location}</option>
          ))}
        </select>
        {form.location === 'Other' && (
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Other location *</span>
            <input value={form.customLocation} onChange={(e) => setForm({ ...form, customLocation: e.target.value })} placeholder="Enter location name" className="mt-2 w-full border border-slate-300 rounded-2xl px-4 py-3" required />
          </label>
        )}
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full border border-slate-300 rounded-2xl px-4 py-3 bg-white" required>
          <option value="">Select house type</option>
          {PROPERTY_TYPES.map((houseType) => (
            <option key={houseType} value={houseType}>{houseType}</option>
          ))}
        </select>
        <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Price" type="number" className="w-full border border-slate-300 rounded-2xl px-4 py-3" required />
        <label className="block text-sm font-medium text-slate-700">Visible until</label>
        <input
          type="datetime-local"
          value={form.visibleUntil}
          onChange={(e) => setForm({ ...form, visibleUntil: e.target.value })}
          className="w-full border border-slate-300 rounded-2xl px-4 py-3"
        />
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Admin contact name</label>
            <input
              value={form.adminContactName}
              onChange={(e) => setForm({ ...form, adminContactName: e.target.value })}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3"
              placeholder="Full name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Admin contact email</label>
            <input
              value={form.adminContactEmail}
              onChange={(e) => setForm({ ...form, adminContactEmail: e.target.value })}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3"
              placeholder="Email address"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Phone</label>
            <input
              value={form.adminContactPhone}
              onChange={(e) => setForm({ ...form, adminContactPhone: e.target.value })}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3"
              placeholder="Phone number"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Whatsapp</label>
            <input
              value={form.adminContactWhatsapp}
              onChange={(e) => setForm({ ...form, adminContactWhatsapp: e.target.value })}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3"
              placeholder="Whatsapp link or number"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Facebook</label>
            <input
              value={form.adminContactFacebook}
              onChange={(e) => setForm({ ...form, adminContactFacebook: e.target.value })}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3"
              placeholder="Facebook URL"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Instagram</label>
            <input
              value={form.adminContactInstagram}
              onChange={(e) => setForm({ ...form, adminContactInstagram: e.target.value })}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3"
              placeholder="Instagram URL"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Twitter</label>
            <input
              value={form.adminContactTwitter}
              onChange={(e) => setForm({ ...form, adminContactTwitter: e.target.value })}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3"
              placeholder="Twitter URL"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">LinkedIn</label>
            <input
              value={form.adminContactLinkedin}
              onChange={(e) => setForm({ ...form, adminContactLinkedin: e.target.value })}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3"
              placeholder="LinkedIn URL"
            />
          </div>
        </div>
        <input type="file" multiple accept="image/*" onChange={(e) => setImages([...e.target.files])} className="w-full text-slate-600" />
        <input type="file" multiple accept="video/*" onChange={(e) => setVideos([...e.target.files])} className="w-full text-slate-600" />
        <button className="px-6 py-3 bg-primary text-white rounded-2xl">{isEditMode ? 'Save changes' : 'Submit listing'}</button>
      </form>
    </section>
  );
};

export default AddProperty;
