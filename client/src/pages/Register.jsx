import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import { setAuthToken } from '../services/api.js';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../hooks/useAuth.jsx';

const Register = () => {
  const [step, setStep] = useState(1); // Step 1: Basic, Step 2: Agent details (if agent)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
    // Agent specific fields
    phone: '',
    company: '',
    address: '',
    yearsOfExperience: '',
    licenseNumber: '',
    bio: '',
    accountNumber: '',
    bankName: '',
    accountName: ''
  });
  const [idImage, setIdImage] = useState(null);
  const [licenseImage, setLicenseImage] = useState(null);
  const [cameraMode, setCameraMode] = useState(null); // 'id', 'license', or null
  const [error, setError] = useState('');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { loginWithGoogle } = useAuth();
  const cameraRef = useRef(null);
  const canvasRef = useRef(null);

  const handleBasicChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    setError('');
    if (name === 'email') {
      setEmailVerificationSent(false);
      setEmailVerified(false);
      setVerificationMessage('');
    }
  };

  const handleAgentChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleFileUpload = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (type === 'id') {
          setIdImage(reader.result);
        } else if (type === 'license') {
          setLicenseImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = (type) => {
    setCameraMode(type);
    setTimeout(() => {
      if (cameraRef.current) {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
          .then((stream) => {
            cameraRef.current.srcObject = stream;
          })
          .catch(() => setError('Unable to access camera'));
      }
    }, 100);
  };

  const capturePhoto = (type) => {
    if (cameraRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.drawImage(cameraRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
      const imageData = canvasRef.current.toDataURL('image/jpeg');
      
      if (type === 'id') {
        setIdImage(imageData);
      } else if (type === 'license') {
        setLicenseImage(imageData);
      }
      
      // Stop camera
      if (cameraRef.current.srcObject) {
        cameraRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
      setCameraMode(null);
    }
  };

  const submitBasicForm = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      setError('');
      if (!emailVerificationSent) {
        await api.post('/auth/send-registration-verification', { email: form.email });
        setEmailVerificationSent(true);
        setVerificationMessage('Verification link sent. Open it in your email, then return here to continue.');
        return;
      }

      const response = await api.get('/auth/registration-verification-status', { params: { email: form.email } });
      if (!response.data?.data?.verified) {
        setError('Please open the verification link in your email before continuing.');
        return;
      }

      setEmailVerified(true);
      if (form.role === 'agent') setStep(2);
      else await submitRegistration();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to verify your email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async () => {
    try {
      setLoading(true);
      setError('');
      await api.post('/auth/send-registration-verification', { email: form.email });
      setVerificationMessage('A fresh verification link has been sent. It expires in 30 minutes.');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to resend the verification link.');
    } finally {
      setLoading(false);
    }
  };

  const submitRegistration = async () => {
    try {
      setLoading(true);
      setError('');

      // Create FormData to handle file uploads
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('email', form.email);
      formData.append('password', form.password);
      formData.append('role', form.role);

      if (form.role === 'agent') {
        formData.append('phone', form.phone);
        formData.append('address', form.address);
        formData.append('yearsOfExperience', form.yearsOfExperience);
        if (form.company.trim()) formData.append('company', form.company.trim());
        if (form.licenseNumber.trim()) formData.append('licenseNumber', form.licenseNumber.trim());
        if (form.bio.trim()) formData.append('bio', form.bio.trim());

        if (form.accountNumber.trim()) formData.append('accountNumber', form.accountNumber.trim());
        if (form.bankName.trim()) formData.append('bankName', form.bankName.trim());
        if (form.accountName.trim()) formData.append('accountName', form.accountName.trim());

        // Add images if captured
        if (idImage) {
          const blob = await fetch(idImage).then(r => r.blob());
          formData.append('idImage', blob, 'passport.jpg');
        }
        if (licenseImage) {
          const blob = await fetch(licenseImage).then(r => r.blob());
          formData.append('licenseImage', blob, 'license.jpg');
        }
      }

      // Use api service for the request
      const response = await api.post('/auth/register', formData);

      // Store token
      if (response.data?.data?.token) {
        localStorage.setItem('amsToken', response.data.data.token);
        setAuthToken(response.data.data.token);
      }

      navigate(form.role === 'agent' ? '/agent' : '/student');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (response) => {
    try {
      setLoading(true);
      setError('');
      const result = await loginWithGoogle(response.credential);
      const role = result?.data?.user?.role;
      navigate(role === 'admin' ? '/admin' : role === 'agent' ? '/agent' : '/student');
    } catch (err) {
      setError(err.response?.data?.message || 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative mx-auto mb-12 sm:mb-16 max-w-2xl px-3 sm:px-4 py-6 sm:py-8 lg:px-8">
      <div className="overflow-hidden rounded-2xl sm:rounded-3xl bg-white p-6 sm:p-8 shadow-card ring-1 ring-slate-200">
        <div className="mb-6 sm:mb-8 space-y-2 sm:space-y-3">
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-secondary">Create account</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-950">
            {step === 1 ? 'Register for FULAFIA AMS' : 'Complete Your Agent Profile'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            {step === 1 
              ? 'Sign up as a student or agent and start managing bookings, listings, and payments.'
              : 'Provide your professional information and upload required documents for verification.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 sm:mb-6 rounded-2xl sm:rounded-3xl bg-rose-50 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-rose-700 ring-1 ring-rose-200">
            {error}
          </div>
        )}
        {verificationMessage && (
          <div className="mb-4 rounded-2xl bg-emerald-50 px-3 py-3 text-xs text-emerald-700 ring-1 ring-emerald-200 sm:mb-6 sm:px-4 sm:text-sm">
            <p>{verificationMessage}</p>
            {emailVerificationSent && !emailVerified && (
              <button type="button" onClick={resendVerification} disabled={loading} className="mt-2 font-semibold text-emerald-800 underline underline-offset-2 hover:text-emerald-950">Resend verification link</button>
            )}
          </div>
        )}

        {/* STEP 1: Basic Registration */}
        {step === 1 && (
          <form onSubmit={submitBasicForm} className="space-y-4 sm:space-y-5">
            <div className="flex justify-center">
              {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
                <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError('Google sign-in failed. Please try again.')} useOneTap={false} />
              ) : (
                <button type="button" onClick={() => setError('Google sign-in is not configured. Add VITE_GOOGLE_CLIENT_ID to the frontend environment and restart the frontend.')} className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                  <span className="text-base font-bold text-blue-600">G</span> Continue with Google
                </button>
              )}
            </div>
            <label className="block">
              <span className="text-xs sm:text-sm font-medium text-slate-700">Full name *</span>
              <input
                type="text"
                name="name"
                required
                value={form.name}
                onChange={handleBasicChange}
                className="mt-1.5 sm:mt-2 w-full rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </label>

            <label className="block">
              <span className="text-xs sm:text-sm font-medium text-slate-700">Email *</span>
              <input
                type="email"
                name="email"
                required
                value={form.email}
                onChange={handleBasicChange}
                className="mt-1.5 sm:mt-2 w-full rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </label>

            <label className="block">
              <span className="text-xs sm:text-sm font-medium text-slate-700">Password *</span>
              <input
                type="password"
                name="password"
                required
                value={form.password}
                onChange={handleBasicChange}
                className="mt-1.5 sm:mt-2 w-full rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </label>

            <label className="block">
              <span className="text-xs sm:text-sm font-medium text-slate-700">Register as *</span>
              <select
                name="role"
                value={form.role}
                onChange={handleBasicChange}
                className="mt-1.5 sm:mt-2 w-full rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
              >
                <option value="student">Student</option>
                <option value="agent">Real Estate Agent</option>
              </select>
            </label>

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-2xl sm:rounded-3xl bg-primary px-5 py-2.5 sm:py-3 text-sm sm:text-base font-semibold text-white transition hover:bg-blue-600 mt-2 sm:mt-0"
            >
              {loading ? 'Checking email...' : !emailVerificationSent ? 'Verify email to continue' : form.role === 'agent' ? 'I have verified - continue' : 'I have verified - register'}
            </button>
          </form>
        )}

        {/* STEP 2: Agent Details */}
        {step === 2 && (
          <form onSubmit={(e) => { e.preventDefault(); submitRegistration(); }} className="space-y-4 sm:space-y-6">
            {/* Camera Modal */}
            {cameraMode && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="rounded-2xl sm:rounded-3xl bg-white p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                  <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
                    Capture {cameraMode === 'id' ? 'Passport/ID' : 'License'}
                  </h3>
                  <video ref={cameraRef} autoPlay playsInline className="w-full rounded-lg mb-3 sm:mb-4" />
                  <canvas ref={canvasRef} width="320" height="240" style={{ display: 'none' }} />
                  <div className="flex gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => capturePhoto(cameraMode)}
                      className="flex-1 rounded-lg bg-primary text-white py-2 hover:bg-blue-600 font-semibold text-sm sm:text-base"
                    >
                      Capture
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (cameraRef.current?.srcObject) {
                          cameraRef.current.srcObject.getTracks().forEach(track => track.stop());
                        }
                        setCameraMode(null);
                      }}
                      className="flex-1 rounded-lg bg-slate-300 text-slate-900 py-2 hover:bg-slate-400 font-semibold text-sm sm:text-base"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs sm:text-sm font-medium text-slate-700">Phone Number *</span>
                <input
                  type="tel"
                  name="phone"
                  required
                  value={form.phone}
                  onChange={handleAgentChange}
                  className="mt-1.5 sm:mt-2 w-full rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </label>

              <label className="block">
                <span className="text-xs sm:text-sm font-medium text-slate-700">Years of Experience *</span>
                <input
                  type="number"
                  name="yearsOfExperience"
                  required
                  min="0"
                  value={form.yearsOfExperience}
                  onChange={handleAgentChange}
                  className="mt-1.5 sm:mt-2 w-full rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </label>

              <label className="block">
                <span className="text-xs sm:text-sm font-medium text-slate-700">Company Name</span>
                <input
                  type="text"
                  name="company"
                  value={form.company}
                  onChange={handleAgentChange}
                  className="mt-1.5 sm:mt-2 w-full rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </label>

              <label className="block">
                <span className="text-xs sm:text-sm font-medium text-slate-700">License Number</span>
                <input
                  type="text"
                  name="licenseNumber"
                  value={form.licenseNumber}
                  onChange={handleAgentChange}
                  className="mt-1.5 sm:mt-2 w-full rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-xs sm:text-sm font-medium text-slate-700">Address *</span>
              <input
                type="text"
                name="address"
                required
                value={form.address}
                onChange={handleAgentChange}
                className="mt-1.5 sm:mt-2 w-full rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </label>

            <label className="block">
              <span className="text-xs sm:text-sm font-medium text-slate-700">Bio / About You</span>
              <textarea
                name="bio"
                value={form.bio}
                onChange={handleAgentChange}
                rows="3"
                className="mt-1.5 sm:mt-2 w-full rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                placeholder="Tell students about your experience and services..."
              />
            </label>

            {/* Passport/ID Upload */}
            <div className="rounded-xl sm:rounded-2xl border-2 border-dashed border-slate-300 p-4 sm:p-6">
              <p className="text-xs sm:text-sm font-semibold text-slate-700 mb-3 sm:mb-4">Passport or ID Photo *</p>
              {idImage ? (
                <div className="space-y-2 sm:space-y-3">
                  <img src={idImage} alt="ID" className="w-24 sm:w-32 h-24 sm:h-32 object-cover rounded-lg" />
                  <button
                    type="button"
                    onClick={() => setIdImage(null)}
                    className="text-xs sm:text-sm text-red-600 hover:text-red-700 font-semibold"
                  >
                    Remove & Recapture
                  </button>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  <label className="block cursor-pointer">
                    <span className="inline-flex items-center justify-center rounded-lg bg-blue-50 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-primary hover:bg-blue-100 transition">
                      📁 Upload File
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'id')}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-slate-500">or</p>
                  <button
                    type="button"
                    onClick={() => startCamera('id')}
                    className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-200 transition"
                  >
                    📷 Take Photo
                  </button>
                </div>
              )}
            </div>

            {/* License Upload */}
            <div className="rounded-xl sm:rounded-2xl border-2 border-dashed border-slate-300 p-4 sm:p-6">
              <p className="text-xs sm:text-sm font-semibold text-slate-700 mb-3 sm:mb-4">License Photo</p>
              {licenseImage ? (
                <div className="space-y-2 sm:space-y-3">
                  <img src={licenseImage} alt="License" className="w-24 sm:w-32 h-24 sm:h-32 object-cover rounded-lg" />
                  <button
                    type="button"
                    onClick={() => setLicenseImage(null)}
                    className="text-xs sm:text-sm text-red-600 hover:text-red-700 font-semibold"
                  >
                    Remove & Recapture
                  </button>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  <label className="block cursor-pointer">
                    <span className="inline-flex items-center justify-center rounded-lg bg-blue-50 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-primary hover:bg-blue-100 transition">
                      📁 Upload File
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'license')}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-slate-500">or</p>
                  <button
                    type="button"
                    onClick={() => startCamera('license')}
                    className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-200 transition"
                  >
                    📷 Take Photo
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3 pt-2 sm:pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 rounded-2xl sm:rounded-3xl border-2 border-slate-300 px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || !idImage}
                className="flex-1 rounded-2xl sm:rounded-3xl bg-primary px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-white transition hover:bg-blue-600 disabled:bg-slate-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Registering...' : 'Complete Registration'}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
};

export default Register;
