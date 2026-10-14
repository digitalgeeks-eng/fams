import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api.js';
import { LEGACY_LOCATION_ALIASES, LOCATIONS } from '../constants/locations.js';
import { calculatePropertyCommission, formatNairaAmount } from '../utils/propertyCommission.js';
import { getLegacyContactConflict, getPropertyContactPhone } from '../utils/propertyContact.js';

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
    inspectionFee: '',
    visibleUntil: '',
    contactPhone: ''
  });
  const [images, setImages] = useState([]);
  const [videos, setVideos] = useState([]);
  const [existingMediaCount, setExistingMediaCount] = useState(0);
  const [message, setMessage] = useState('');
  const [legacyContactConflict, setLegacyContactConflict] = useState(null);
  const commissionEstimate = calculatePropertyCommission(form.price);

  useEffect(() => {
    if (!id) return;
    const loadProperty = async () => {
      try {
        const response = await api.get(`/properties/${id}`);
        const property = response.data.data;
        setExistingMediaCount((property.images?.length || 0) + (property.videos?.length || 0));
        const displayedLocation = LEGACY_LOCATION_ALIASES[property.location] || property.location || '';
        const isPredefined = LOCATIONS.includes(displayedLocation) && displayedLocation !== 'Other';
        setLegacyContactConflict(getLegacyContactConflict(property.adminContact));
        setForm((current) => ({
          ...current,
          title: property.title || '',
          description: property.description || '',
          location: isPredefined ? displayedLocation : 'Other',
          customLocation: isPredefined ? '' : property.location || '',
          type: property.type || '',
          price: property.price || '',
          inspectionFee: property.inspectionFee == null ? '' : String(property.inspectionFee),
          visibleUntil: property.visibleUntil ? new Date(property.visibleUntil).toISOString().slice(0, 16) : '',
          contactPhone: getPropertyContactPhone(property.adminContact)
        }));
      } catch (err) {
        setMessage(err.response?.data?.message || 'Could not load property');
      }
    };
    loadProperty();
  }, [id]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const inspectionFeeValue = form.inspectionFee.trim();
    const inspectionFee = inspectionFeeValue === '' ? null : Number(inspectionFeeValue);
    if (inspectionFeeValue !== '' && (!Number.isFinite(inspectionFee) || inspectionFee < 0)) {
      setMessage('Enter a valid inspection fee of 0 or more. Enter 0 if inspection is free.');
      return;
    }

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
    data.append('inspectionFee', inspectionFee === null ? '' : String(inspectionFee));
    data.append('visibleUntil', form.visibleUntil);
    data.append('contactPhone', form.contactPhone.trim());
    images.forEach((file) => data.append('images', file));
    videos.forEach((file) => data.append('videos', file));
    try {
      await api[isEditMode ? 'put' : 'post'](isEditMode ? `/properties/${id}` : '/properties', data);
      setMessage(isEditMode ? 'Property updated successfully and sent for approval' : 'Property created successfully and awaiting admin approval');
      if (!isEditMode) {
        setForm({
          title: '', description: '', location: '', customLocation: '', type: '', price: '', inspectionFee: '',
          visibleUntil: '', contactPhone: ''
        });
        setLegacyContactConflict(null);
      }
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
        <label className="block">
          <span className="block text-sm font-medium text-slate-700">Property rental price (₦)</span>
          <input
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            placeholder="Price"
            type="number"
            min="0"
            step="0.01"
            className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3"
            required
          />
        </label>
        {commissionEstimate && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" aria-live="polite">
            <h2 className="font-semibold text-slate-800">Estimated commission breakdown</h2>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              <p className="text-slate-600">Property rental price <span className="block font-semibold text-slate-900">{formatNairaAmount(commissionEstimate.propertyPrice)}</span></p>
              <p className="text-slate-600">StudentNest commission (3%) <span className="block font-semibold text-slate-900">{formatNairaAmount(commissionEstimate.studentNestCommission)}</span></p>
              <p className="text-slate-600">Agent expected amount (97%) <span className="block font-semibold text-slate-900">{formatNairaAmount(commissionEstimate.agentAmount)}</span></p>
            </div>
            <p className="mt-2 text-xs text-slate-500">Estimate only. No commission is deducted or earned when a listing is created.</p>
          </div>
        )}
        <label className="block">
          <span className="block text-sm font-medium text-slate-700">Inspection Fee (₦)</span>
          <input
            value={form.inspectionFee}
            onChange={(e) => setForm({ ...form, inspectionFee: e.target.value })}
            placeholder="Enter inspection fee (e.g. 3000)"
            type="number"
            min="0"
            step="any"
            className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3"
          />
          <span className="mt-1 block text-xs text-slate-500">
            Enter the amount a user will pay to inspect this property. Enter 0 if inspection is free.
          </span>
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-slate-700">Visible Until (Optional)</span>
          <input
            type="datetime-local"
            value={form.visibleUntil}
            onChange={(e) => setForm({ ...form, visibleUntil: e.target.value })}
            className="mt-2 w-full border border-slate-300 rounded-2xl px-4 py-3"
          />
          <span className="mt-1 block text-xs text-slate-500">
            Optional: Choose when this property listing should stop being visible. Leave blank if you do not want to set an expiration date.
          </span>
        </label>
        <div className="rounded-2xl border border-slate-200 p-4">
          <label className="block">
            <span className="block text-sm font-medium text-slate-700">WhatsApp / Phone Number</span>
            <input
              type="tel"
              inputMode="tel"
              pattern="(?:0[789][01][0-9]{8}|[+]234[789][01][0-9]{8})"
              value={form.contactPhone}
              onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              placeholder="08123456789 or +2348123456789"
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3"
            />
          </label>
          <span className="mt-1 block text-xs text-slate-500">
            This number is visible only to authorized administrators.
          </span>
          {legacyContactConflict && (
            <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="status">
              This property has different legacy contact values. The current contact number is shown above; both saved legacy values are being preserved.
              <span className="mt-1 block">Legacy phone: {legacyContactConflict.phone} · Legacy WhatsApp: {legacyContactConflict.whatsapp}</span>
            </div>
          )}
        </div>
        <input type="file" multiple accept="image/*" onChange={(e) => setImages([...e.target.files])} className="w-full text-slate-600" />
        <input type="file" multiple accept="video/*" onChange={(e) => setVideos([...e.target.files])} className="w-full text-slate-600" />
        <button className="px-6 py-3 bg-primary text-white rounded-2xl">{isEditMode ? 'Save changes' : 'Submit listing'}</button>
      </form>
    </section>
  );
};

export default AddProperty;
