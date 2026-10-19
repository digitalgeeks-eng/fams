import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { LEGACY_LOCATION_ALIASES, LOCATIONS } from '../constants/locations.js';
import { calculatePropertyCommission, formatNairaAmount } from '../utils/propertyCommission.js';
import { getLegacyContactConflict, getPropertyContactPhone } from '../utils/propertyContact.js';
import { createMediaOrder, getEditablePropertyMedia, getMediaUrl, validatePropertyMediaFiles } from '../utils/propertyMedia.js';

const PROPERTY_TYPES = ['Single Room', 'Self-Contain', 'Room and Parlour', 'Mini Flat'];

const MediaPreview = ({ kind, file, media, label }) => {
  const [previewUrl, setPreviewUrl] = useState('');
  const [failed, setFailed] = useState(false);
  const storedUrl = getMediaUrl(media);

  useEffect(() => {
    setFailed(false);
    if (!file) {
      setPreviewUrl('');
      return undefined;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const url = file ? previewUrl : storedUrl;
  if (!url || failed) {
    return <div className="flex aspect-video items-center justify-center bg-slate-100 px-3 text-center text-xs text-slate-500">Media preview could not be loaded.</div>;
  }
  if (kind === 'videos') {
    return <video src={url} className="aspect-video w-full bg-black" controls preload="metadata" playsInline aria-label={label} onError={() => setFailed(true)} />;
  }
  return <img src={url} alt={label} className="aspect-[4/3] w-full bg-slate-100 object-contain" loading="lazy" onError={() => setFailed(true)} />;
};

const AddProperty = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const isEditMode = Boolean(id);
  const isSuperAdmin = user?.role === 'admin' && (!user.adminRole || user.adminRole === 'super_admin');
  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    customLocation: '',
    type: '',
    price: '',
    inspectionFee: '',
    visibleUntil: '',
    contactPhone: '',
    availabilityStatus: 'available'
  });
  const [images, setImages] = useState([]);
  const [videos, setVideos] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [existingVideos, setExistingVideos] = useState([]);
  const [message, setMessage] = useState('');
  const [loadingProperty, setLoadingProperty] = useState(Boolean(id));
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [legacyContactConflict, setLegacyContactConflict] = useState(null);
  const mediaKey = useRef(0);
  const [coverImageKey, setCoverImageKey] = useState('');
  const commissionEstimate = calculatePropertyCommission(form.price);

  useEffect(() => {
    if (!id) {
      setLoadingProperty(false);
      return;
    }
    setLoadingProperty(true);
    const loadProperty = async () => {
      try {
        const response = await api.get(`/properties/${id}`);
        const property = response.data.data;
        const savedImages = getEditablePropertyMedia(property, 'images')
          .map(({ media, sourceIndex }) => ({ key: `existing-image-${sourceIndex}`, media, sourceIndex }));
        const savedVideos = getEditablePropertyMedia(property, 'videos')
          .map(({ media, sourceIndex }) => ({ key: `existing-video-${sourceIndex}`, media, sourceIndex }));
        setExistingImages(savedImages);
        setExistingVideos(savedVideos);
        setCoverImageKey(savedImages[0]?.key || '');
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
          contactPhone: getPropertyContactPhone(property.adminContact),
          availabilityStatus: property.isUnavailable || property.availabilityStatus === 'not_available' ? 'not_available' : 'available'
        }));
      } catch (err) {
        setMessage(err.response?.data?.message || 'Could not load property');
      } finally {
        setLoadingProperty(false);
      }
    };
    loadProperty();
  }, [id]);

  const addSelectedFiles = (event, kind) => {
    const selected = Array.from(event.target.files || []).map((file) => ({
      key: `${kind}-${mediaKey.current++}`,
      file
    }));
    event.target.value = '';
    const nextImages = kind === 'image' ? [...images, ...selected] : images;
    const nextVideos = kind === 'video' ? [...videos, ...selected] : videos;
    const mediaError = validatePropertyMediaFiles(
      nextImages.map((item) => item.file),
      nextVideos.map((item) => item.file)
    );
    if (mediaError) {
      setMessage(mediaError);
      return;
    }
    setMessage('');
    setImages(nextImages);
    setVideos(nextVideos);
    if (kind === 'image' && !coverImageKey && selected.length) setCoverImageKey(selected[0].key);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting || loadingProperty) return;
    const inspectionFeeValue = form.inspectionFee.trim();
    const inspectionFee = inspectionFeeValue === '' ? null : Number(inspectionFeeValue);
    if (inspectionFeeValue !== '' && (!Number.isFinite(inspectionFee) || inspectionFee < 0)) {
      setMessage('Enter a valid inspection fee of 0 or more. Enter 0 if inspection is free.');
      return;
    }

    const totalMedia = images.length + videos.length + existingImages.length + existingVideos.length;

    if (totalMedia === 0) {
      setMessage('Please upload at least one property image or video before listing this property.');
      return;
    }
    const mediaError = validatePropertyMediaFiles(
      images.map((item) => item.file),
      videos.map((item) => item.file)
    );
    if (mediaError) {
      setMessage(mediaError);
      return;
    }
    if (isSuperAdmin && !form.contactPhone.trim()) {
      setMessage('Enter the private WhatsApp / Phone Number for this listing.');
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
    if (isSuperAdmin) data.append('availabilityStatus', form.availabilityStatus);
    images.forEach(({ file }) => data.append('images', file));
    videos.forEach(({ file }) => data.append('videos', file));
    data.append('imageOrder', JSON.stringify(createMediaOrder(
      existingImages,
      images.map((item, index) => ({ ...item, index })),
      coverImageKey
    )));
    data.append('videoOrder', JSON.stringify([
      ...existingVideos.map((item) => `existing:${item.sourceIndex}`),
      ...videos.map((item, index) => `upload:${index}`)
    ]));
    setSubmitting(true);
    setUploadProgress(0);
    try {
      const response = await api[isEditMode ? 'put' : 'post'](
        isEditMode ? `/properties/${id}` : '/properties',
        data,
        { onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
          }
        } }
      );
      setMessage(isEditMode
        ? (isSuperAdmin ? 'Property updated successfully.' : 'Property updated successfully and sent for approval.')
        : (isSuperAdmin ? 'Property created and approved successfully.' : 'Property created successfully and awaiting admin approval.'));
      if (!isEditMode) {
        setForm({
          title: '', description: '', location: '', customLocation: '', type: '', price: '', inspectionFee: '',
          visibleUntil: '', contactPhone: '', availabilityStatus: 'available'
        });
        setLegacyContactConflict(null);
        setExistingImages([]);
        setExistingVideos([]);
        setCoverImageKey('');
      } else {
        const savedProperty = response.data.data;
        const savedImages = getEditablePropertyMedia(savedProperty, 'images')
          .map(({ media, sourceIndex }) => ({ key: `existing-image-${sourceIndex}`, media, sourceIndex }));
        const savedVideos = getEditablePropertyMedia(savedProperty, 'videos')
          .map(({ media, sourceIndex }) => ({ key: `existing-video-${sourceIndex}`, media, sourceIndex }));
        setExistingImages(savedImages);
        setExistingVideos(savedVideos);
        setCoverImageKey(savedImages[0]?.key || '');
      }
      setImages([]);
      setVideos([]);
      setUploadProgress(100);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Could not submit listing');
    } finally {
      setSubmitting(false);
    }
  };

  const moveMedia = (setter, items, index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const reordered = [...items];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setter(reordered);
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
        {isSuperAdmin && (
          <label className="block">
            <span className="block text-sm font-medium text-slate-700">Availability</span>
            <select
              value={form.availabilityStatus}
              onChange={(e) => setForm({ ...form, availabilityStatus: e.target.value })}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
            >
              <option value="available">Available</option>
              <option value="not_available">Not Available</option>
            </select>
          </label>
        )}
        {!isSuperAdmin && commissionEstimate && (
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
              required={isSuperAdmin && !isEditMode}
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
        <section className="space-y-4 rounded-2xl border border-slate-200 p-4" aria-labelledby="property-images-heading">
          <div>
            <h2 id="property-images-heading" className="font-semibold text-slate-900">Property Images</h2>
            <p className="mt-1 text-xs text-slate-500">Up to 15 images per upload, 100 MB per file. The first image is the cover photo.</p>
          </div>
          <input
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff,.tif,.svg,.ico,image/*"
            onChange={(event) => addSelectedFiles(event, 'image')}
            className="w-full text-sm text-slate-600"
            aria-label="Upload property images"
          />
          {(existingImages.length > 0 || images.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {existingImages.map((item, index) => (
                <div key={item.key} className="overflow-hidden rounded-xl border border-slate-200">
                  <MediaPreview kind="images" media={item.media} label={`Saved property image ${index + 1}`} />
                  <div className="flex flex-wrap items-center gap-2 p-2">
                    <button type="button" onClick={() => setCoverImageKey(item.key)} className={`rounded-lg px-2 py-1 text-xs font-medium ${coverImageKey === item.key ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'}`}>
                      {coverImageKey === item.key ? 'Cover photo' : 'Make cover'}
                    </button>
                    <button type="button" disabled={index === 0} onClick={() => moveMedia(setExistingImages, existingImages, index, -1)} className="rounded-lg bg-slate-100 px-2 py-1 text-xs disabled:opacity-40" aria-label={`Move saved image ${index + 1} earlier`}>Move up</button>
                    <button type="button" disabled={index === existingImages.length - 1} onClick={() => moveMedia(setExistingImages, existingImages, index, 1)} className="rounded-lg bg-slate-100 px-2 py-1 text-xs disabled:opacity-40" aria-label={`Move saved image ${index + 1} later`}>Move down</button>
                    <button type="button" onClick={() => {
                      setExistingImages((current) => current.filter((candidate) => candidate.key !== item.key));
                      if (coverImageKey === item.key) setCoverImageKey(existingImages[index + 1]?.key || existingImages[index - 1]?.key || images[0]?.key || '');
                    }} className="ml-auto rounded-lg bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700">Remove</button>
                  </div>
                </div>
              ))}
              {images.map((item, index) => (
                <div key={item.key} className="overflow-hidden rounded-xl border border-slate-200">
                  <MediaPreview kind="images" file={item.file} label={`New property image ${index + 1}`} />
                  <div className="flex flex-wrap items-center gap-2 p-2">
                    <button type="button" onClick={() => setCoverImageKey(item.key)} className={`rounded-lg px-2 py-1 text-xs font-medium ${coverImageKey === item.key ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'}`}>
                      {coverImageKey === item.key ? 'Cover photo' : 'Make cover'}
                    </button>
                    <button type="button" disabled={index === 0} onClick={() => moveMedia(setImages, images, index, -1)} className="rounded-lg bg-slate-100 px-2 py-1 text-xs disabled:opacity-40" aria-label={`Move new image ${index + 1} earlier`}>Move up</button>
                    <button type="button" disabled={index === images.length - 1} onClick={() => moveMedia(setImages, images, index, 1)} className="rounded-lg bg-slate-100 px-2 py-1 text-xs disabled:opacity-40" aria-label={`Move new image ${index + 1} later`}>Move down</button>
                    <button type="button" onClick={() => {
                      setImages((current) => current.filter((candidate) => candidate.key !== item.key));
                      if (coverImageKey === item.key) setCoverImageKey(existingImages[0]?.key || images[index + 1]?.key || images[index - 1]?.key || '');
                    }} className="ml-auto rounded-lg bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="space-y-4 rounded-2xl border border-slate-200 p-4" aria-labelledby="property-videos-heading">
          <div>
            <h2 id="property-videos-heading" className="font-semibold text-slate-900">Property Videos</h2>
            <p className="mt-1 text-xs text-slate-500">Up to 5 videos per upload, 100 MB per file.</p>
          </div>
          <input
            type="file"
            multiple
            accept=".mp4,.avi,.mov,.mkv,.webm,video/*"
            onChange={(event) => addSelectedFiles(event, 'video')}
            className="w-full text-sm text-slate-600"
            aria-label="Upload property videos"
          />
          {(existingVideos.length > 0 || videos.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {existingVideos.map((item, index) => (
                <div key={item.key} className="overflow-hidden rounded-xl border border-slate-200">
                  <MediaPreview kind="videos" media={item.media} label={`Saved property video ${index + 1}`} />
                  <div className="flex items-center justify-between gap-2 p-2">
                    <span className="text-xs text-slate-600">Saved video {index + 1}</span>
                    <button type="button" onClick={() => setExistingVideos((current) => current.filter((candidate) => candidate.key !== item.key))} className="rounded-lg bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700">Remove</button>
                  </div>
                </div>
              ))}
              {videos.map((item, index) => (
                <div key={item.key} className="overflow-hidden rounded-xl border border-slate-200">
                  <MediaPreview kind="videos" file={item.file} label={`New property video ${index + 1}`} />
                  <div className="flex items-center justify-between gap-2 p-2">
                    <span className="text-xs text-slate-600">New video {index + 1}</span>
                    <button type="button" onClick={() => setVideos((current) => current.filter((candidate) => candidate.key !== item.key))} className="rounded-lg bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        {submitting && (
          <div className="space-y-2" role="status" aria-live="polite">
            <div className="flex justify-between text-sm text-slate-600"><span>Uploading property media</span><span>{uploadProgress}%</span></div>
            <progress className="h-2 w-full accent-primary" max="100" value={uploadProgress} aria-label="Media upload progress" />
          </div>
        )}
        {loadingProperty && <p className="text-sm text-slate-600" role="status">Loading saved property and media…</p>}
        <button disabled={submitting || loadingProperty} className="rounded-2xl bg-primary px-6 py-3 text-white disabled:cursor-not-allowed disabled:opacity-60">
          {loadingProperty ? 'Loading property…' : submitting ? 'Uploading...' : isEditMode ? 'Save changes' : isSuperAdmin ? 'Publish approved listing' : 'Submit listing'}
        </button>
      </form>
    </section>
  );
};

export default AddProperty;
