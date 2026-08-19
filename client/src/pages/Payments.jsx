import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [searchParams] = useSearchParams();

  const fetchPayments = async () => {
    try {
      const response = await api.get('/payments/student');
      setPayments(response.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const verifyTestPayment = async (reference) => {
    try {
      setLoading(true);
      const response = await api.get(`/payments/verify/${reference}`);
      if (response.data) {
        setMessage('✅ Payment verified successfully!');
        await fetchPayments();
      }
    } catch (err) {
      setMessage('❌ Payment verification failed. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch payments on component mount
    fetchPayments();

    // Auto-refresh when page regains focus (user returns from payment)
    const handleFocus = () => {
      fetchPayments();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Check for payment reference in URL (from Paystack callback)
  useEffect(() => {
    const reference = searchParams.get('reference');
    if (reference) {
      verifyTestPayment(reference);
    }
  }, [searchParams]);

  if (loading) return <LoadingSpinner />;

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Payments</h1>
      <div className="rounded-3xl border border-blue-200 bg-blue-50 p-6 text-blue-900">
        <p className="font-semibold">Paystack Integration in Progress</p>
        <p className="mt-2 text-sm">Automated Paystack payment will be available soon. For now, complete payment using the manual OPay option from your booking.</p>
      </div>
      
      {message && (
        <div className={`rounded-2xl p-4 ${message.includes('✅') ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
          {message}
        </div>
      )}

      <div className="grid gap-4">
        {payments.length ? payments.map((payment) => (
          <div key={payment._id} className="rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1">
                <p className="font-semibold text-slate-900">Reference: {payment.paymentReference}</p>
                <p className="mt-2 text-slate-600">Method: <span className="font-medium capitalize">{payment.paymentMethod}</span></p>
                {payment.amount && (
                  <p className="mt-2 text-slate-600">Amount: <span className="font-medium">₦{payment.amount?.toLocaleString()}</span></p>
                )}
                <p className="mt-2">
                  Status: 
                  <span className={`ml-2 px-3 py-1 rounded-full text-sm font-semibold ${
                    payment.verificationStatus === 'verified' ? 'bg-emerald-100 text-emerald-700' :
                    ['pending', 'proof_submitted'].includes(payment.verificationStatus) ? 'bg-amber-100 text-amber-700' :
                    'bg-rose-100 text-rose-700'
                  }`}>
                    {payment.verificationStatus === 'proof_submitted' ? 'Awaiting Verification' : payment.verificationStatus}
                  </span>
                </p>
                {payment.verificationStatus === 'proof_submitted' && (
                  <p className="mt-3 text-sm text-amber-700">Your payment proof has been submitted. An administrator will review it before the booking is confirmed.</p>
                )}
                {payment.adminNote && <p className="mt-3 text-sm text-rose-700">Admin note: {payment.adminNote}</p>}
              </div>
            </div>
          </div>
        )) : (
          <div className="rounded-3xl bg-slate-50 p-8 text-center">
            <p className="text-slate-600">No payments recorded yet.</p>
          </div>
        )} 
      </div>
    </section>
  );
};

export default Payments;