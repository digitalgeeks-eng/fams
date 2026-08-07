# Payment Flow - Critical Fixes Required

## ISSUE #1: verifyPaymentAdmin Hardcodes Status (CRITICAL)

**Location**: `server/controllers/paymentController.js` (lines 151-171)

**Current Broken Code**:
```javascript
export const verifyPaymentAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'Payment ID is required' });

    const payment = await Payment.findById(id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    payment.verificationStatus = 'verified';  // ❌ ALWAYS APPROVED!
    await payment.save();

    const booking = await Booking.findById(payment.bookingId);
    if (booking) {
      booking.paymentStatus = 'paid';         // ❌ ALWAYS MARKED PAID!
      booking.bookingStatus = 'confirmed';    // ❌ ALWAYS CONFIRMED!
      await booking.save();
    }

    res.json({ message: 'Payment verified successfully', data: { payment, booking } });
  } catch (error) {
    next(error);
  }
};
```

**Why It's Broken**:
- Frontend sends `{ status: newStatus }` where newStatus can be 'verified', 'pending', or 'rejected'
- Controller IGNORES req.body.status and always uses 'verified'
- Admin can't reject payments - they get approved anyway
- Booking always becomes 'paid' and 'confirmed'

**Fix**:
```javascript
export const verifyPaymentAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'Payment ID is required' });

    const payment = await Payment.findById(id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    // Use the status from request body
    const { status } = req.body;
    if (!status || !['verified', 'pending', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Valid status (verified/pending/rejected) is required' });
    }

    payment.verificationStatus = status;  // Use actual status!
    await payment.save();

    // Only update booking if payment is verified
    if (status === 'verified') {
      const booking = await Booking.findById(payment.bookingId);
      if (booking) {
        booking.paymentStatus = 'paid';
        booking.bookingStatus = 'confirmed';
        await booking.save();
      }
    }

    res.json({ message: `Payment ${status} successfully`, data: { payment, booking: null } });
  } catch (error) {
    next(error);
  }
};
```

---

## ISSUE #2: getStudentPayments Missing Populate (HIGH PRIORITY)

**Location**: `server/controllers/paymentController.js` (lines 132-139)

**Current Broken Code**:
```javascript
export const getStudentPayments = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ studentId: req.user._id });
    const bookingIds = bookings.map((booking) => booking._id);
    const payments = await Payment.find({ bookingId: { $in: bookingIds } }).sort({ createdAt: -1 });
    res.json({ data: payments });
  } catch (error) {
    next(error);
  }
};
```

**Why It's Broken**:
- Returns minimal payment objects with only payment details
- bookingId is NOT populated, so frontend can't access:
  - Property name/location/price
  - Booking status/payment status
  - Student/agent details
- Payments.jsx can only show reference + status, missing all useful context

**Fix**:
```javascript
export const getStudentPayments = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ studentId: req.user._id });
    const bookingIds = bookings.map((booking) => booking._id);
    const payments = await Payment.find({ bookingId: { $in: bookingIds } })
      .populate({
        path: 'bookingId',
        select: 'studentId propertyId paymentStatus bookingStatus transactionReference',
        populate: [
          { path: 'studentId', select: 'name email' },
          {
            path: 'propertyId',
            select: 'title location price images type agentId',
            populate: { path: 'agentId', select: 'name email' }
          }
        ]
      })
      .sort({ createdAt: -1 });
    res.json({ data: payments });
  } catch (error) {
    next(error);
  }
};
```

---

## ISSUE #3: Payments.jsx Test Payment Invalid

**Location**: `client/src/pages/Payments.jsx` (lines 32-44)

**Current Broken Code**:
```javascript
const openPaystackTest = () => {
  const testReference = `test-${Date.now()}`;
  // Create test payment record first
  api.post('/payments/initialize', { 
    bookingId: 'test',  // ❌ INVALID - not a real booking ID
    paymentMethod: 'online' 
  }).catch(() => {
    // Expected to fail for test, but payment should be created
  });
  
  // Store reference for verification when user returns
  sessionStorage.setItem('pendingPaymentReference', testReference);
  window.open(TEST_PAYSTACK_URL, '_blank');
};
```

**Why It's Broken**:
- Uses string 'test' as bookingId instead of real MongoDB ObjectId
- Booking.findById('test') returns null
- Payment creation fails or gets invalid reference
- Test payment flow is broken

**Fix** (requires student to have a booking first):
```javascript
const openPaystackTest = async (bookingId) => {
  try {
    // Use real booking ID
    const response = await api.post('/payments/initialize', {
      bookingId,  // Real booking ID
      paymentMethod: 'online'
    });
    
    if (response.data.data.authorizationUrl) {
      // For test mode, redirect to test URL
      const url = response.data.data.authorizationUrl;
      window.location.href = url;
    }
  } catch (err) {
    console.error('Payment initialization failed:', err);
    setMessage('Unable to start payment. Please ensure you have an active booking.');
  }
};
```

Or if you want manual test without real booking:
```javascript
const openPaystackTest = () => {
  const testReference = `test-${Date.now()}`;
  // Store for verification when user returns
  sessionStorage.setItem('pendingPaymentReference', testReference);
  window.open(TEST_PAYSTACK_URL, '_blank');
  
  // Manually verify after user returns
  // This would require a separate test endpoint or manual UI action
};
```

---

## ISSUE #4: Missing updatedAt in Payment Model (MEDIUM)

**Location**: `server/models/Payment.js`

**Current Code**:
```javascript
const paymentSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  paymentMethod: { type: String, enum: ['online', 'offline'], required: true },
  paymentReference: { type: String, required: true },
  amount: { type: Number, required: true },
  proofImage: { type: String },
  verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});
```

**Why Improvement Needed**:
- No updatedAt field to track when payment was verified
- Can't distinguish between old pending payments and recently verified ones

**Fix**:
```javascript
const paymentSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  paymentMethod: { type: String, enum: ['online', 'offline'], required: true },
  paymentReference: { type: String, required: true },
  amount: { type: Number, required: true },
  proofImage: { type: String },
  verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update updatedAt on save
paymentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});
```

---

## ISSUE #5: Payment Routes Cleanup (OPTIONAL)

**Location**: `server/routes/paymentRoutes.js` (line 21)

**Current Code**:
```javascript
router.get('/admin', protect, authorizeRoles('admin'), asyncHandler(getAdminPayments));
```

**Why It's Redundant**:
- Full path is `/api/payments/admin`
- But adminRoutes.js already has `/api/admin/payments` endpoint
- Frontend uses `/admin/payments` so this route is never called
- Dead code

**Action**: 
- Option 1: Remove it (cleanup)
- Option 2: Keep both for backwards compatibility

**Remove** (recommended - cleanup):
```javascript
// Remove this line entirely
// router.get('/admin', protect, authorizeRoles('admin'), asyncHandler(getAdminPayments));
```

---

## Implementation Order

1. **FIRST** - Fix `verifyPaymentAdmin` (blocking admin functionality)
2. **SECOND** - Add populate to `getStudentPayments` (incomplete student view)
3. **THIRD** - Fix test payment logic in Payments.jsx
4. **FOURTH** - Add updatedAt to Payment model
5. **OPTIONAL** - Clean up payment routes and add indexes

---

## Testing After Fixes

```bash
# Test admin rejection
curl -X PUT http://localhost:5000/api/admin/payments/{paymentId}/verify \
  -H "Authorization: Bearer {adminToken}" \
  -d '{"status":"rejected"}'

# Verify payment is still pending
curl http://localhost:5000/api/admin/payments \
  -H "Authorization: Bearer {adminToken}"

# Test student payments list
curl http://localhost:5000/api/payments/student \
  -H "Authorization: Bearer {studentToken}"
# Should include full booking/property details
```
