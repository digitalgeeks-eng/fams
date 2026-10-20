import { useCallback, useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from '../hooks/useAuth.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { validateRoomMediaFiles } from '../utils/propertyMedia.js';

const EMPTY_FORM = {
  roomNumberPrefix: 'Room ',
  count: '1',
  type: 'Single Room',
  price: '',
  billingPeriod: 'yearly',
  toilet: 'unknown',
  shower: 'unknown',
  kitchen: 'unknown',
  waterSource: 'unknown',
  waterAvailable: '',
  electricity: '',
  facilities: '',
  floorSection: '',
  description: ''
};

const getRoomDraft = (room) => ({
  ...room,
  facilities: Array.isArray(room.facilities) ? room.facilities.join(', ') : ''
});

const RoomManagement = () => {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const [property, setProperty] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [roomOverrides, setRoomOverrides] = useState([]);
  const [draft, setDraft] = useState(null);
  const [images, setImages] = useState([]);
  const [videos, setVideos] = useState([]);
  const [editImages, setEditImages] = useState([]);
  const [editVideos, setEditVideos] = useState([]);
  const [keptImageIndexes, setKeptImageIndexes] = useState([]);
  const [keptVideoIndexes, setKeptVideoIndexes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(location.state?.message || '');

  const loadData = useCallback(async () => {
    const propertyResponse = await api.get(`/properties/${id}`);
    const [roomResponse, requestResponse] = await Promise.all([
      api.get(`/properties/${id}/rooms`),
      api.get(`/properties/${id}/room-inspection-requests`)
    ]);
    setProperty(propertyResponse.data.data);
    setRooms(roomResponse.data.data.rooms || []);
    setRequests(requestResponse.data.data || []);
  }, [id]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        await loadData();
      } catch (error) {
        if (active) setMessage(error.response?.data?.message || 'Unable to load this property’s rooms.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [loadData]);

  const handleFiles = (event, kind, editing = false) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    const nextImages = kind === 'images' ? files : editing ? editImages : images;
    const nextVideos = kind === 'videos' ? files : editing ? editVideos : videos;
    const validation = validateRoomMediaFiles(nextImages, nextVideos);
    if (validation) {
      setMessage(validation);
      return;
    }
    if (editing) {
      setEditImages(nextImages);
      setEditVideos(nextVideos);
    } else {
      setImages(nextImages);
      setVideos(nextVideos);
    }
    setMessage('');
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (saving) return;
    const count = Number(form.count);
    const price = Number(form.price);
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      setMessage('Add between 1 and 100 rooms at a time.');
      return;
    }
    if (!Number.isFinite(price) || price < 0 || !form.price.trim()) {
      setMessage('Enter a valid non-negative room rent.');
      return;
    }
    const validation = validateRoomMediaFiles(images, videos);
    if (validation) {
      setMessage(validation);
      return;
    }
    if (count > 1 && (images.length || videos.length)) {
      setMessage('Create the batch first, then add room-specific media from each room’s edit form.');
      return;
    }

    const data = new FormData();
    const roomInputs = Array.from({ length: count }, (_, index) => {
      const override = roomOverrides[index] || {};
      return {
        roomNumber: String(override.roomNumber || `${form.roomNumberPrefix}${index + 1}`).trim(),
        type: override.type || form.type,
        price: override.price === undefined || override.price === '' ? price : Number(override.price),
        billingPeriod: override.billingPeriod || form.billingPeriod,
        status: override.status || 'available',
        toilet: override.toilet || form.toilet,
        shower: override.shower || form.shower,
        kitchen: override.kitchen || form.kitchen,
        waterSource: override.waterSource || form.waterSource,
        waterAvailable: override.waterAvailable === undefined
          ? (form.waterAvailable === '' ? null : form.waterAvailable === 'true')
          : override.waterAvailable === '' ? null : override.waterAvailable === 'true',
        electricity: override.electricity === undefined
          ? (form.electricity === '' ? null : form.electricity === 'true')
          : override.electricity === '' ? null : override.electricity === 'true',
        facilities: override.facilities === undefined
          ? form.facilities.split(',').map((item) => item.trim()).filter(Boolean)
          : String(override.facilities).split(',').map((item) => item.trim()).filter(Boolean),
        floorSection: override.floorSection ?? form.floorSection,
        description: override.description ?? form.description
      };
    });
    data.append('rooms', JSON.stringify(roomInputs));
    images.forEach((file) => data.append('images', file));
    videos.forEach((file) => data.append('videos', file));
    setSaving(true);
    try {
      const response = await api.post(`/properties/${id}/rooms`, data);
      setMessage(response.data.message || 'Rooms added successfully.');
      setForm(EMPTY_FORM);
      setRoomOverrides([]);
      setImages([]);
      setVideos([]);
      await loadData();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to add rooms.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (saving || !draft) return;
    const data = new FormData();
    for (const [key, value] of Object.entries(draft)) {
      if (['_id', 'propertyId', 'images', 'videos', 'statusHistory', 'createdAt', 'updatedAt', '__v', 'commissionEstimate'].includes(key)) continue;
      if (key === 'facilities') {
        data.append(key, JSON.stringify(String(value || '').split(',').map((item) => item.trim()).filter(Boolean)));
      } else if (key === 'waterAvailable' || key === 'electricity') {
        data.append(key, value === null || value === '' ? '' : String(value));
      } else if (value !== undefined && value !== null) {
        data.append(key, String(value));
      }
    }
    editImages.forEach((file) => data.append('images', file));
    editVideos.forEach((file) => data.append('videos', file));
    data.append('imageOrder', JSON.stringify([
      ...keptImageIndexes.map((index) => `existing:${index}`),
      ...editImages.map((_, index) => `upload:${index}`)
    ]));
    data.append('videoOrder', JSON.stringify([
      ...keptVideoIndexes.map((index) => `existing:${index}`),
      ...editVideos.map((_, index) => `upload:${index}`)
    ]));
    setSaving(true);
    try {
      const response = await api.put(`/properties/${id}/rooms/${draft._id}`, data);
      setMessage(response.data.message || 'Room updated successfully.');
      setDraft(null);
      setEditImages([]);
      setEditVideos([]);
      setKeptImageIndexes([]);
      setKeptVideoIndexes([]);
      await loadData();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to update this room.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (room) => {
    if (!window.confirm(`Deactivate ${room.roomNumber}? This keeps its history and does not delete any records.`)) return;
    setSaving(true);
    try {
      const response = await api.delete(`/properties/${id}/rooms/${room._id}`, { data: { reason: 'Deactivated by property manager' } });
      setMessage(response.data.message || 'Room deactivated.');
      await loadData();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to deactivate this room.');
    } finally {
      setSaving(false);
    }
  };

  const reviewRequest = async (requestId, status) => {
    setSaving(true);
    try {
      await api.patch(`/properties/${id}/room-inspection-requests/${requestId}`, { status });
      setMessage('Inspection request updated. Room availability did not change.');
      await loadData();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to update this inspection request.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const isAgentOwner = user?.role === 'agent'
    && (property?.agentId?._id || property?.agentId)?.toString() === user?._id?.toString();
  const canSeeCommission = isAgentOwner && property?.ownerType !== 'admin';
  const activeRooms = rooms.filter((room) => room.isActive);
  const availableRooms = activeRooms.filter((room) => room.status === 'available');

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <header className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-slate-200">
        <p className="text-sm font-medium text-primary">{property?.location}</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">Manage rooms · {property?.title}</h1>
        <p className="mt-2 text-sm text-slate-600">Rooms are managed independently. Updating an inspection request never reserves or books a room.</p>
        <p className="mt-2 text-sm font-medium text-slate-700">{activeRooms.length} total rooms · {availableRooms.length} available</p>
      </header>
      {message && <div role="status" className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-700">{message}</div>}

      <section className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">Add rooms</h2>
        <p className="mt-1 text-sm text-slate-600">Generate identical rooms quickly, then adjust them individually below.</p>
        <form className="mt-4 space-y-4" onSubmit={handleCreate}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm text-slate-700">Room label prefix
              <input value={form.roomNumberPrefix} maxLength={30} onChange={(event) => setForm({ ...form, roomNumberPrefix: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
            </label>
            <label className="text-sm text-slate-700">Number of rooms
              <input
                type="number"
                min="1"
                max="100"
                step="1"
                value={form.count}
                onChange={(event) => {
                  const value = event.target.value;
                  setForm({ ...form, count: value });
                  const nextCount = Number(value);
                  if (Number.isInteger(nextCount) && nextCount >= 1 && nextCount <= 100) {
                    setRoomOverrides((current) => Array.from({ length: nextCount }, (_, index) => current[index] || {}));
                  }
                }}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                required
              />
            </label>
            <label className="text-sm text-slate-700">Room type
              <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2">
                {['Single Room', 'Self-Contain', 'Room and Parlour', 'Mini Flat', 'Other'].map((type) => <option key={type}>{type}</option>)}
              </select>
            </label>
            <label className="text-sm text-slate-700">Rent (₦)
              <input type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" required />
            </label>
          </div>
          <details className="rounded-xl border border-slate-200 p-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">Customize room numbers, prices, types, and facilities individually</summary>
            <div className="mt-3 space-y-3">
              {Array.from({ length: Math.min(Number(form.count) || 0, 100) }, (_, index) => {
                const override = roomOverrides[index] || {};
                const updateOverride = (field, value) => setRoomOverrides((current) => {
                  const next = [...current];
                  next[index] = { ...(next[index] || {}), [field]: value };
                  return next;
                });
                return (
                  <fieldset key={index} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-4">
                    <legend className="px-1 text-xs text-slate-500">Room {index + 1}</legend>
                    <label className="text-xs text-slate-700">Room number
                      <input value={override.roomNumber ?? `${form.roomNumberPrefix}${index + 1}`} onChange={(event) => updateOverride('roomNumber', event.target.value)} maxLength={40} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" required />
                    </label>
                    <label className="text-xs text-slate-700">Room type
                      <select value={override.type || form.type} onChange={(event) => updateOverride('type', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm">
                        {['Single Room', 'Self-Contain', 'Room and Parlour', 'Mini Flat', 'Other'].map((type) => <option key={type}>{type}</option>)}
                      </select>
                    </label>
                    <label className="text-xs text-slate-700">Rent (₦)
                      <input type="number" min="0" step="0.01" value={override.price ?? form.price} onChange={(event) => updateOverride('price', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" required />
                    </label>
                    {['toilet', 'shower', 'kitchen'].map((facility) => (
                      <label key={facility} className="text-xs capitalize text-slate-700">{facility}
                        <select value={override[facility] || form[facility]} onChange={(event) => updateOverride(facility, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm">
                          {['unknown', 'private', 'shared', 'none'].map((option) => <option key={option}>{option}</option>)}
                        </select>
                      </label>
                    ))}
                    <label className="text-xs text-slate-700">Water source
                      <select value={override.waterSource || form.waterSource} onChange={(event) => updateOverride('waterSource', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm">
                        {['unknown', 'tap', 'borehole', 'well', 'other', 'unavailable'].map((source) => <option key={source}>{source}</option>)}
                      </select>
                    </label>
                    {[
                      ['waterAvailable', 'Water available'],
                      ['electricity', 'Electricity available']
                    ].map(([field, label]) => (
                      <label key={field} className="text-xs text-slate-700">{label}
                        <select value={override[field] === undefined ? form[field] : override[field]} onChange={(event) => updateOverride(field, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm">
                          <option value="">Unknown</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      </label>
                    ))}
                    <label className="text-xs text-slate-700">Facilities
                      <input value={override.facilities ?? form.facilities} onChange={(event) => updateOverride('facilities', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" />
                    </label>
                    <label className="text-xs text-slate-700">Floor / section
                      <input value={override.floorSection ?? form.floorSection} onChange={(event) => updateOverride('floorSection', event.target.value)} maxLength={80} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" />
                    </label>
                    <label className="text-xs text-slate-700">Room description
                      <input value={override.description ?? form.description} onChange={(event) => updateOverride('description', event.target.value)} maxLength={2000} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" />
                    </label>
                  </fieldset>
                );
              })}
            </div>
          </details>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm text-slate-700">Billing period
              <select value={form.billingPeriod} onChange={(event) => setForm({ ...form, billingPeriod: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2">
                {['yearly', 'monthly', 'weekly', 'daily'].map((period) => <option key={period} value={period}>{period}</option>)}
              </select>
            </label>
            {['toilet', 'shower', 'kitchen'].map((facility) => (
              <label key={facility} className="text-sm capitalize text-slate-700">{facility}
                <select value={form[facility]} onChange={(event) => setForm({ ...form, [facility]: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2">
                  {['unknown', 'private', 'shared', 'none'].map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-slate-700">Water source
              <select value={form.waterSource} onChange={(event) => setForm({ ...form, waterSource: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2">
                {['unknown', 'tap', 'borehole', 'well', 'other', 'unavailable'].map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label className="text-sm text-slate-700">Floor / section
              <input value={form.floorSection} maxLength={80} onChange={(event) => setForm({ ...form, floorSection: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['waterAvailable', 'Water currently available'],
              ['electricity', 'Electricity available']
            ].map(([field, label]) => (
              <label key={field} className="text-sm text-slate-700">{label}
                <select value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2">
                  <option value="">Unknown</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </label>
            ))}
          </div>
          <label className="block text-sm text-slate-700">Room facilities (comma separated)
            <input value={form.facilities} onChange={(event) => setForm({ ...form, facilities: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Wardrobe, ceiling fan" />
          </label>
          <label className="block text-sm text-slate-700">Description
            <textarea value={form.description} maxLength={2000} rows={3} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-slate-700">Room photos
              <input type="file" multiple accept="image/*" onChange={(event) => handleFiles(event, 'images')} className="mt-1 block w-full text-sm" />
            </label>
            <label className="text-sm text-slate-700">Room videos
              <input type="file" multiple accept="video/*" onChange={(event) => handleFiles(event, 'videos')} className="mt-1 block w-full text-sm" />
            </label>
          </div>
          <p className="text-xs text-slate-500">To avoid suggesting that one room’s photos show every room, add room photos and videos from each room’s edit form after creating the batch. Room media is limited to 5 images and 2 videos per upload, at 10 MB per file.</p>
          <button disabled={saving} className="rounded-xl bg-primary px-5 py-3 font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Add rooms'}</button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Rooms ({rooms.length})</h2>
        {!rooms.length && <p className="rounded-2xl bg-white p-5 text-slate-600">No rooms have been added yet.</p>}
        {rooms.map((room) => (
          <article key={room._id} className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-200">
            {draft?._id === room._id ? (
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-sm text-slate-700">Room label
                    <input value={draft.roomNumber} maxLength={40} onChange={(event) => setDraft({ ...draft, roomNumber: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" required />
                  </label>
                  <label className="text-sm text-slate-700">Type
                    <select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2">
                      {['Single Room', 'Self-Contain', 'Room and Parlour', 'Mini Flat', 'Other'].map((type) => <option key={type}>{type}</option>)}
                    </select>
                  </label>
                  <label className="text-sm text-slate-700">Rent (₦)
                    <input type="number" min="0" step="0.01" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" required />
                  </label>
                  <label className="text-sm text-slate-700">Availability
                    <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2">
                      {['available', 'reserved', 'occupied', 'unavailable'].map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </label>
                </div>
                <label className="block text-sm text-slate-700">Description
                  <textarea value={draft.description || ''} maxLength={2000} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" rows={3} />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-slate-700">Facilities (comma separated)
                    <input value={draft.facilities} onChange={(event) => setDraft({ ...draft, facilities: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
                  </label>
                  <label className="text-sm text-slate-700">Floor / section
                    <input value={draft.floorSection || ''} maxLength={80} onChange={(event) => setDraft({ ...draft, floorSection: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {['toilet', 'shower', 'kitchen'].map((facility) => (
                    <label key={facility} className="text-sm capitalize text-slate-700">{facility}
                      <select value={draft[facility]} onChange={(event) => setDraft({ ...draft, [facility]: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2">
                        {['unknown', 'private', 'shared', 'none'].map((option) => <option key={option}>{option}</option>)}
                      </select>
                    </label>
                  ))}
                  <label className="text-sm text-slate-700">Billing period
                    <select value={draft.billingPeriod} onChange={(event) => setDraft({ ...draft, billingPeriod: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2">
                      {['yearly', 'monthly', 'weekly', 'daily'].map((period) => <option key={period}>{period}</option>)}
                    </select>
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ['waterAvailable', 'Water currently available'],
                    ['electricity', 'Electricity available']
                  ].map(([field, label]) => (
                    <label key={field} className="text-sm text-slate-700">{label}
                      <select value={draft[field] == null ? '' : String(draft[field])} onChange={(event) => setDraft({ ...draft, [field]: event.target.value === '' ? null : event.target.value === 'true' })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2">
                        <option value="">Unknown</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    </label>
                  ))}
                  <label className="text-sm text-slate-700">Room record
                    <select value={draft.isActive ? 'true' : 'false'} onChange={(event) => setDraft({ ...draft, isActive: event.target.value === 'true' })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2">
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </label>
                </div>
                {(draft.images?.length > 0 || draft.videos?.length > 0) && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-700">Existing room media</p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {draft.images?.map((media, index) => (
                        <label key={`image-${index}`} className="rounded-xl border border-slate-200 p-2 text-xs text-slate-600">
                          <img src={media.url || media.secure_url || media} alt={`${draft.roomNumber} ${index + 1}`} className="aspect-video w-full rounded-lg object-cover" />
                          <span className="mt-2 flex items-center gap-2">
                            <input type="checkbox" checked={keptImageIndexes.includes(index)} onChange={(event) => setKeptImageIndexes((current) => event.target.checked ? [...current, index].sort((a, b) => a - b) : current.filter((item) => item !== index))} />
                            Keep this image
                          </span>
                        </label>
                      ))}
                      {draft.videos?.map((media, index) => (
                        <label key={`video-${index}`} className="rounded-xl border border-slate-200 p-2 text-xs text-slate-600">
                          <video src={media.url || media.secure_url || media} controls preload="metadata" className="aspect-video w-full rounded-lg bg-black" />
                          <span className="mt-2 flex items-center gap-2">
                            <input type="checkbox" checked={keptVideoIndexes.includes(index)} onChange={(event) => setKeptVideoIndexes((current) => event.target.checked ? [...current, index].sort((a, b) => a - b) : current.filter((item) => item !== index))} />
                            Keep this video
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-slate-700">Add room photos
                    <input type="file" multiple accept="image/*" onChange={(event) => handleFiles(event, 'images', true)} className="mt-1 block w-full text-sm" />
                  </label>
                  <label className="text-sm text-slate-700">Add room videos
                    <input type="file" multiple accept="video/*" onChange={(event) => handleFiles(event, 'videos', true)} className="mt-1 block w-full text-sm" />
                  </label>
                </div>
                <div className="flex gap-2">
                  <button disabled={saving} className="rounded-xl bg-primary px-4 py-2 font-medium text-white disabled:opacity-50">Save room</button>
                  <button type="button" onClick={() => { setDraft(null); setEditImages([]); setEditVideos([]); setKeptImageIndexes([]); setKeptVideoIndexes([]); }} className="rounded-xl border border-slate-300 px-4 py-2">Cancel</button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{room.roomNumber} · {room.type}</h3>
                    <p className="mt-1 text-sm text-slate-600">₦{Number(room.price).toLocaleString()} / {room.billingPeriod} · {room.status}{room.isActive ? '' : ' · inactive'}</p>
                    {room.description && <p className="mt-2 text-sm text-slate-600">{room.description}</p>}
                    {room.facilities?.length > 0 && <p className="mt-2 text-sm text-slate-600">Facilities: {room.facilities.join(', ')}</p>}
                    {canSeeCommission && room.commissionEstimate && <p className="mt-2 text-xs text-slate-500">3% commission estimate: ₦{room.commissionEstimate.studentNestCommission.toLocaleString()}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(getRoomDraft(room));
                        setEditImages([]);
                        setEditVideos([]);
                        setKeptImageIndexes((room.images || []).map((_, index) => index));
                        setKeptVideoIndexes((room.videos || []).map((_, index) => index));
                      }}
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    >Edit</button>
                    {room.isActive && <button type="button" disabled={saving} onClick={() => handleDeactivate(room)} className="rounded-xl border border-rose-200 px-3 py-2 text-sm text-rose-700 disabled:opacity-50">Deactivate</button>}
                  </div>
                </div>
                {(room.images?.length > 0 || room.videos?.length > 0) && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {room.images?.map((media, index) => (
                      <img key={`${media.publicId || media.url || index}`} src={media.url || media.secure_url || media} alt={`${room.roomNumber} room ${index + 1}`} className="aspect-video w-full rounded-xl bg-slate-100 object-cover" loading="lazy" />
                    ))}
                    {room.videos?.map((media, index) => (
                      <video key={`${media.publicId || media.url || index}`} src={media.url || media.secure_url || media} controls preload="metadata" className="aspect-video w-full rounded-xl bg-black" />
                    ))}
                  </div>
                )}
              </>
            )}
          </article>
        ))}
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">Inspection requests</h2>
        <p className="mt-1 text-sm text-slate-600">Requests do not reserve rooms. Review status changes are recorded separately.</p>
        {!requests.length && <p className="mt-3 text-sm text-slate-500">No inspection requests yet.</p>}
        <div className="mt-4 space-y-3">
          {requests.map((request) => (
            <div key={request._id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4">
              <div>
                <p className="font-medium text-slate-900">{request.roomId?.roomNumber || 'Room'} · {request.studentId?.name || 'Student'}</p>
                <p className="text-sm text-slate-600">{request.studentId?.email || ''} · {request.status}</p>
                {request.message && <p className="mt-1 text-sm text-slate-600">{request.message}</p>}
              </div>
              {request.status === 'pending' && (
                <div className="flex gap-2">
                  <button type="button" disabled={saving} onClick={() => reviewRequest(request._id, 'accepted')} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Accept</button>
                  <button type="button" disabled={saving} onClick={() => reviewRequest(request._id, 'declined')} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Decline</button>
                </div>
              )}
              {request.status === 'accepted' && <button type="button" disabled={saving} onClick={() => reviewRequest(request._id, 'completed')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">Mark inspection complete</button>}
            </div>
          ))}
        </div>
      </section>
    </section>
  );
};

export default RoomManagement;
