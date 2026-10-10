# FULAFIA Accommodation Management System (AMS)

Enterprise-level accommodation management system for students, agents, and administrators.

## Features
- Student registration, search, booking, online/offline payments, complaints, recommendations
- Agent onboarding, property creation, listing management, booking requests
- Admin verification, approvals, analytics, payment review, complaint resolution, user management
- JWT auth, RBAC, secure middleware, rate limiting, file uploads, Paystack integration

## Backend
Location: `/server`

### Setup
1. `cd server`
2. Copy `.env.example` to `.env`
3. Configure `MONGO_URI` with your MongoDB Atlas connection string, `JWT_SECRET`, Paystack keys, and `CLIENT_URL`
4. `npm install`
5. `npm run dev`

### Registration Email Verification
Email is sent through Brevo's transactional email API over HTTPS by default. Configure:
- `BREVO_API_KEY` (Brevo API key)
- `EMAIL_FROM` (sender email address verified in Brevo)
- `EMAIL_PROVIDER=brevo` (optional; this is the default)

The existing SMTP transport remains available for environments that allow outbound SMTP. To explicitly use it, set `EMAIL_PROVIDER=smtp` and configure:
- `EMAIL_HOST`
- `EMAIL_PORT` (defaults to `587`)
- `EMAIL_SECURE` (`true` to use a secure TLS connection)
- `EMAIL_USER`
- `EMAIL_PASS`
- `EMAIL_FROM` (optional for SMTP; defaults to `EMAIL_USER`)

SMTP is not used automatically if Brevo is missing or fails. On Render Free, keep `EMAIL_PROVIDER=brevo` (or unset it) to avoid attempting blocked SMTP ports.

`JWT_SECRET` is also used to securely hash verification codes; configure it as a long, random secret. Registration completion uses a MongoDB transaction, so the MongoDB deployment must support transactions; MongoDB Atlas clusters do.

### Contact Inquiries
The public contact form submits inquiries to `POST /api/contact`. Submissions are stored in MongoDB and are limited to five requests per IP per 15 minutes. Super Admins can review and update inquiry status from the Contact Inquiries page; its endpoints require an authenticated Super Admin account.

### MongoDB Atlas
Use your Atlas connection string in the server `.env` file:
- `MONGO_URI=mongodb+srv://<your-username>:<your-password>@<your-cluster>.mongodb.net/fulafia-ams?retryWrites=true&w=majority`

### Local MongoDB Compass
If you still need a local reference, keep this as a commented example:
- `# MONGO_URI=mongodb://localhost:27017/fulafia-ams`

### Project locations
This application is configured for the following local areas:
- Gandu
- Mararaba
- Gimare
- Bukan Koto
- Akunza
- Tudun Kauri

## Frontend
Location: `/client`

### Setup
1. `cd client`
2. `npm install`
3. `npm run dev`

## Deployment
- Frontend: Vercel
- Backend: Render
- Database: MongoDB Atlas

## Notes
- Uploaded images are stored in `/server/uploads`
- API routes are proxied from the client to `/api`
