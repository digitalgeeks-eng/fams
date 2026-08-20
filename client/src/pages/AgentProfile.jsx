import { useEffect, useState } from 'react';
import api from '../services/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

const AgentProfile = () => {
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    address: '',
    bio: '',
    yearsOfExperience: '',
    licenseNumber: '',
    accountNumber: '',
    bankName: '',
    accountName: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showAccountNumber, setShowAccountNumber] = useState(false);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users/profile');
      const user = response.data.data || {};
      setProfile({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        company: user.company || '',
        address: user.address || '',
        bio: user.bio || '',
        yearsOfExperience: user.yearsOfExperience ?? '',
        licenseNumber: user.licenseNumber || '',
        accountNumber: user.accountNumber || '',
        bankName: user.bankName || '',
        accountName: user.accountName || ''
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
    setError('');
    setMessage('');
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const payload = {
        name: profile.name,
        phone: profile.phone,
        company: profile.company,
        address: profile.address,
        bio: profile.bio,
        yearsOfExperience: profile.yearsOfExperience,
        licenseNumber: profile.licenseNumber,
        accountNumber: profile.accountNumber,
        bankName: profile.bankName,
        accountName: profile.accountName
      };

      const response = await api.put('/users/profile', payload);
      setMessage(response.data.message || 'Bank information updated successfully.');
      setShowAccountNumber(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save profile changes.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <section className="mx-auto max-w-3xl space-y-6 pb-8">
      <div className="rounded-3xl bg-white p-6 shadow-xl">
        <h1 className="text-2xl font-semibold text-slate-900">Agent profile</h1>
        <p className="mt-2 text-slate-600">Update your professional details and payout information.</p>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6 rounded-3xl bg-white p-6 shadow-xl">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Name</span>
            <input name="name" value={profile.name} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input value={profile.email} disabled className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Phone Number</span>
            <input name="phone" value={profile.phone} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Years of Experience</span>
            <input type="number" min="0" name="yearsOfExperience" value={profile.yearsOfExperience} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Company Name</span>
            <input name="company" value={profile.company} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Address</span>
            <input name="address" value={profile.address} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-slate-700">License Number</span>
            <input name="licenseNumber" value={profile.licenseNumber} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Bio / About You</span>
            <textarea name="bio" value={profile.bio} onChange={handleChange} className="mt-2 min-h-[110px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" />
          </label>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">BANK / PAYMENT INFORMATION</h2>
            <span className="text-xs text-slate-500">Optional</span>
          </div>
          <p className="mb-4 text-sm text-slate-500">Optional — you can provide your bank details now or add them later from your profile.</p>
          <div className="grid gap-4 md:grid-cols-1">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Account Number</span>
              <div className="mt-2 flex gap-2">
                <input
                  type={showAccountNumber ? 'text' : 'password'}
                  name="accountNumber"
                  value={profile.accountNumber}
                  onChange={handleChange}
                  placeholder="8106083399"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"
                />
                {profile.accountNumber && (
                  <button type="button" onClick={() => setShowAccountNumber((prev) => !prev)} className="rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-medium text-slate-700">
                    {showAccountNumber ? 'Hide' : 'Show'}
                  </button>
                )}
              </div>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Bank Name</span>
              <input name="bankName" value={profile.bankName} onChange={handleChange} placeholder="Opay" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Account Name</span>
              <input name="accountName" value={profile.accountName} onChange={handleChange} placeholder="Miracle Obadiah" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3" />
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="rounded-2xl bg-primary px-6 py-3 font-semibold text-white disabled:opacity-60">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </section>
  );
};

export default AgentProfile;
