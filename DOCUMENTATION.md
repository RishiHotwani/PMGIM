# 🚀 BeyondGoa Campus Mobility — System & Application Documentation

> **BeyondGoa Campus Mobility** is a premium, full-stack campus mobility and lifestyle platform tailored specifically for students, faculty, and local vendors at the **Goa Institute of Management (GIM), Sanquelim**. 
> The platform unifies **Self-Drive Vehicle Rentals**, **Peer-to-Peer Ride Sharing (Travel Board)**, **Curated Goa Exploration**, **Private Bookmarks**, **Real-Time Reviews**, and **Vendor Fleet Management** under a modern, responsive web application.

---

## 🛠️ Technology Stack & Architecture

### 1. Frontend Technologies
- **Core Framework**: React 18 with functional components, hooks (`useState`, `useEffect`, `useContext`), and Vite 5 build system.
- **Styling**: Vanilla Tailwind CSS with custom glassmorphism effects, dynamic gradients, smooth transitions, and high contrast dark/light themes.
- **Icons**: `lucide-react` icon system.
- **Effects & UI Enhancements**: `canvas-confetti` for payment completion celebrations, Unsplash high-resolution photography presets.

### 2. Backend Architecture
- **Runtime**: Node.js (ES Modules).
- **Web Framework**: Express.js server (`server/index.js` for local development, `api/index.js` for Vercel serverless deployment).
- **Authentication & Security**:
  - JWT (JSON Web Tokens) with HttpOnly secure cookie rotation.
  - Google OAuth 2.0 integration via Google Identity Services (GIS).
  - `bcryptjs` password hashing (12 salt rounds).
  - `helmet` HTTP header security & `express-rate-limit` DDoS protection.
- **Payment Processing**: Razorpay API v1 SDK with server-side HMAC-SHA256 signature verification.

### 3. Database Layer (Dual-Engine System)
- **Primary Database**: MySQL 8 running on port `3308` (`travelappgim`).
- **Serverless Fallback Store**: In-memory database store (`memoryStore`) in `server/config/database.js` ensuring 100% zero-downtime execution in Vercel serverless environments when MySQL is unreachable.

---

## ✨ Core Features & Functional Modules

### 🔐 1. Authentication & Dual Account Roles
- **Sign Up & Sign In**: Supports both Email/Password authentication and 1-Click Google OAuth 2.0 login.
- **Dual Account Roles**:
  - **`USER` (Student / Customer)**: Default role for students to browse rentals, book vehicles, join cab splits, and save private bookmarks.
  - **`VENDOR` (Vehicle Rental Vendor)**: Unlocks the **Vendor Portal** and vehicle management capabilities.
- **1-Click Account Role Switcher**:
  - Located directly under **Account Information** in the **Profile** section (`/profile`).
  - Users can instantly upgrade to `VENDOR` mode or switch back to `USER` mode in 1 click (`PATCH /api/auth/role`).

---

### 🛵 2. Campus Vehicle Rentals (`/rentals`)
- **Fleet Discovery**: Interactive catalog of verified self-drive vehicles (Scooters, Bikes, Hatchbacks, SUVs).
- **Smart Filtering & Search**:
  - Filter by category: **All**, **Bikes**, **Scooters**, **Cars**.
  - Real-time search bar matching vehicle models and vendor names.
- **Vehicle Specs Modal**: View fuel type (Petrol/Electric), transmission (Manual/Automatic), daily rate, and vendor pickup guidelines.
- **Integrated Razorpay Checkout**:
  - Transparent itemized pricing breakdown:
    $$\text{Total} = (\text{Daily Rate} \times \text{Days}) + \text{Refundable Security Deposit} + \text{Service Fee} + \text{GST (18\%)}$$
  - Triggers Razorpay 1-Click payment modal with instant verification signature check (`POST /api/payments/verify`).

---

### 🏬 3. Vendor Management Portal (`/vendor_portal`)
- **Exclusive Vendor Access**: Rendered exclusively when `currentUser.role` is `VENDOR`, `ADMIN`, or `SUPER_ADMIN`.
- **Add New Vehicle**:
  - Modal form allowing vendors to publish vehicles with Title, Category, Daily Rate, Fuel, Transmission, Location, Description, and Unsplash Photo Presets.
- **Fleet Management**:
  - Real-time toggle for vehicle availability (`PATCH /api/rentals/:id/toggle`).
  - Remove vehicle listing (`DELETE /api/rentals/:id`).
  - Immediate sync: Listings published in Vendor Portal appear instantly at the top of the `/rentals` fleet for all users.

---

### 🌊 4. Explore Goa & Student Recommendations (`/explore`)
- **Curated Recommendations**: 10 student-voted spots adapted from *Londoner In Sydney* (Mandrem Beach & Lagoon, La Plage Ashwem, Anjuna Flea Market, Thalassa Siolim, Arambol Sunset Drum Circle, Britto's Shack Baga, Dudhsagar Waterfalls, Fontainhas Latin Quarter, Querim Keri Beach).
- **Category Filter**: **All**, **Beaches**, **Food**, **Nightlife**, **Cafes**, **Waterfalls**, **Shopping**.
- **Interactive Spot Detail Modal**:
  - Direct 1-click Google Maps navigation link.
  - Best time to visit, estimated cost per person, and pro tips.
  - **Live Community Reviews & Ratings**: Submit star ratings (1–5 stars) and comments (`GET /api/places/:id/reviews`, `POST /api/places/:id/reviews`).
- **Private Heart Bookmarks**:
  - Tap the heart icon to save any spot to your private profile (`POST /api/bookmarks/:placeId/toggle`).
  - Bookmark state persists seamlessly across sessions.

---

### 🚕 5. Travel Board & Ride Buddy Matching (`/travel`)
- **Cab Split Portal**: Peer-to-peer ride matching to split cab fares to **Dabolim Airport**, **MOPA Airport**, **Thivim Railway Station**, and **Panjim**.
- **Ride Details**: Host student name, batch, departure date & time, pickup point, cost split, and remaining seats counter.
- **Post Ride Share Modal**: Students can host their own cab split in seconds (`POST /api/trips`).

---

### 👤 6. Student Profile & Private Bookmarks (`/profile`)
- Displays User Avatar, Name, Email, Account Role Badge, and Auth Method (Google OAuth vs Password).
- **Account Role Switcher**: 1-Click upgrade to Vehicle Vendor Mode.
- **Private Bookmarks List**: Real-time derived list of saved places (`places.filter(p => Boolean(p.is_bookmarked))`) combined with `GET /api/bookmarks`.

---

### 🔔 7. Activity Logs & Global Notifications
- **Notification Center**: Bell icon in header displaying real-time updates (e.g., when a vendor lists a new vehicle).
- **Mark All Read**: `PATCH /api/notifications/read-all`.
- **Audit Activity Logger**: `POST /api/activity` logs user actions (`SWITCH_TAB`, `FILTER_RENTALS`, `VIEW_SPOT_DETAIL`, `VENDOR_POST_VEHICLE`).

---

## 📂 Project Structure

```
PMGIM/
├── api/
│   └── index.js                 # Vercel Serverless Function Express Entrypoint
├── server/
│   ├── config/
│   │   ├── database.js          # MySQL 8 Connection Pool & In-Memory Fallback Engine
│   │   └── env.js               # Environment Variables Configuration
│   ├── middleware/
│   │   ├── authenticate.js      # JWT & x-user-id Header Authentication Middleware
│   │   ├── errorHandler.js      # Global Express Error Handler
│   │   ├── rateLimiter.js       # Express Rate Limiting Middleware
│   │   └── validate.js          # Express Validator Input Validation Middleware
│   ├── modules/
│   │   └── auth/                # Auth Service, Controller, Routes & Repository
│   ├── utils/
│   │   ├── jwt.js               # JWT Token Generation & Cookie Utils
│   │   └── logger.js            # Audit Activity Logger Utils
│   └── index.js                 # Local Express Server Entrypoint (Port 5000)
├── src/
│   ├── components/
│   │   ├── BookingCheckoutModal.jsx # Razorpay Payment Modal & Invoice Breakdown
│   │   ├── BottomNav.jsx            # Mobile Responsive Navigation Bar
│   │   ├── Header.jsx               # Top Navigation & Notification Bell
│   │   ├── SearchBar.jsx            # Global Hero Search Input
│   │   ├── SpotDetailModal.jsx      # Explore Goa Spot Modal with Reviews
│   │   └── UserAvatar.jsx           # User Initials & Photo Avatar Component
│   ├── context/
│   │   └── AuthContext.jsx          # React Authentication Context Provider
│   ├── views/
│   │   ├── AuthGateView.jsx         # Sign In / Sign Up & Google OAuth View
│   │   ├── ExploreView.jsx          # Explore Goa Recommendations View
│   │   ├── HomeView.jsx             # Campus Dashboard Hero View
│   │   ├── ProfileView.jsx          # Student Profile & Bookmarks View
│   │   ├── RentalsView.jsx          # Campus Vehicle Rentals View
│   │   ├── TravelView.jsx           # Cab Split & Travel Board View
│   │   └── VendorPortalView.jsx     # Vendor Fleet Management View
│   ├── App.jsx                      # Main Application Component
│   └── main.jsx                     # Vite Application Entrypoint
├── vercel.json                      # Vercel Deployment & Route Rewrites Configuration
└── package.json                     # Node.js Dependencies & Scripts
```

---

## 🗄️ Database Schemas (MySQL 8)

### 1. `users`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INT AUTO_INCREMENT PRIMARY KEY` | Internal User ID |
| `uuid` | `VARCHAR(36) UNIQUE` | Public UUID |
| `name` | `VARCHAR(255)` | Full Name |
| `email` | `VARCHAR(255) UNIQUE` | GIM / Personal Email |
| `password_hash` | `VARCHAR(255)` | BCrypt Hashed Password |
| `google_id` | `VARCHAR(255) UNIQUE` | Google OAuth Unique ID |
| `provider` | `ENUM('EMAIL', 'GOOGLE')` | Auth Provider |
| `role` | `ENUM('USER', 'VENDOR', 'ADMIN', 'SUPER_ADMIN')` | User Role |

### 2. `rentals`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INT AUTO_INCREMENT PRIMARY KEY` | Rental Listing ID |
| `vendor_user_id` | `VARCHAR(255)` | Owner Vendor User ID / UUID |
| `title` | `VARCHAR(255)` | Vehicle Model Name |
| `vendor` | `VARCHAR(255)` | Vendor Business / Display Name |
| `category` | `ENUM('Bike', 'Scooter', 'Car')` | Vehicle Category |
| `price_per_day` | `INT` | Daily Rate in ₹ |
| `fuel` | `VARCHAR(50)` | Petrol / Electric / Diesel |
| `transmission` | `VARCHAR(50)` | Automatic / Manual |
| `image` | `VARCHAR(500)` | Vehicle Image URL |
| `is_available` | `BOOLEAN` | Availability Status |

### 3. `explore_places`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INT AUTO_INCREMENT PRIMARY KEY` | Spot ID |
| `name` | `VARCHAR(255)` | Spot Name |
| `category` | `VARCHAR(100)` | Beaches / Food / Nightlife / Cafes / Waterfalls / Shopping |
| `rating` | `DECIMAL(3,1)` | Average Rating (out of 5.0) |
| `distance` | `VARCHAR(100)` | Distance from GIM Campus |
| `image` | `VARCHAR(500)` | Spot Header Image |
| `maps_url` | `VARCHAR(500)` | Direct Google Maps Navigation URL |

### 4. `user_bookmarks`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INT AUTO_INCREMENT PRIMARY KEY` | Bookmark Record ID |
| `user_id` | `INT` | User ID |
| `place_id` | `INT` | Explore Place ID |

---

## ⚡ Key API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/signup` | Register new email account |
| `POST` | `/api/auth/login` | Authenticate with email & password |
| `POST` | `/api/auth/google` | Verify & authenticate Google OAuth token |
| `GET` | `/api/auth/me` | Fetch active user session |
| `PATCH` | `/api/auth/role` | Update account role (`USER` ↔ `VENDOR`) |
| `GET` | `/api/rentals` | Fetch all available rental vehicles |
| `GET` | `/api/rentals/vendor` | Fetch vehicles listed by active vendor |
| `POST` | `/api/rentals` | Publish new vehicle listing (Vendor role required) |
| `PATCH` | `/api/rentals/:id/toggle` | Toggle vehicle availability status |
| `DELETE` | `/api/rentals/:id` | Remove vehicle listing |
| `GET` | `/api/explore` | Fetch explore places with bookmark status |
| `POST` | `/api/bookmarks/:placeId/toggle` | Add/remove spot from private bookmarks |
| `POST` | `/api/payments/create-order` | Create Razorpay order ID for booking |
| `POST` | `/api/payments/verify` | Verify Razorpay payment signature |

---

## 🚀 Local Setup & Deployment Instructions

### Local Development
```bash
# 1. Install dependencies
npm install

# 2. Start Express Backend (Runs on http://localhost:5000)
node server/index.js

# 3. Start Vite Frontend (Runs on http://localhost:5173)
npm run dev
```

### Production Build
```bash
npm run build
```

---
*Built with ❤️ for the Goa Institute of Management (GIM) Campus Community.*
