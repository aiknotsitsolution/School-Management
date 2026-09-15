# Brightwood International School — ERP (Frontend Demo)

A responsive, frontend-only School ERP built with **React + Vite + Tailwind CSS**.
All data is realistic dummy data (no backend). Images load from free stock sources
(Unsplash) and generated initials avatars (ui-avatars.com) at runtime over the internet.

## Modules included
Dashboard · Attendance · Admission Enquiry · Communication (1:1 & broadcast) ·
Notice Board · Homework · Events · Timetable · Student Database · Examination ·
Fees Collection · Report Card · Reports & Analytics · Inventory Management ·
Bus Tracking (live map mock) · Online Fees Payment

## How to run (Windows)

1. Extract this folder anywhere on your `E:\` drive, e.g. `E:\School-ERP`
2. Install **Node.js** (v18 or newer) from https://nodejs.org if you don't have it
3. Open a terminal (PowerShell / CMD) in that folder:
   ```
   cd E:\School-ERP
   npm install
   npm run dev
   ```
4. Open the URL shown in the terminal (usually `http://localhost:5173`) in your browser

## Build for production / static hosting

```
npm run build
```
This creates a `dist/` folder you can deploy anywhere (Netlify, Vercel, IIS, etc.) or open directly.

## Notes
- This is a **UI/UX design prototype** — no backend, no real database, no authentication.
  The login screen is decorative and simply takes you to the dashboard.
- All student/staff names, fee figures, admission enquiries etc. are fictional sample data.
- Requires an internet connection to load the Google Fonts and stock images used for decoration.
- Built with: React 18, React Router, Tailwind CSS v4, Recharts, Lucide Icons.
