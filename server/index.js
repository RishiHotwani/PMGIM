import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ENV } from './config/env.js';
import { initDatabase, query } from './config/database.js';
import { logAuditActivity } from './utils/logger.js';
import authRouter from './modules/auth/auth.routes.js';
import { globalRateLimiter } from './middleware/rateLimiter.js';
import { globalErrorHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = ENV.PORT || 5000;

// Security Headers & Cookies Middleware
app.use(helmet({
  contentSecurityPolicy: false // Allows inline scripts for GIS SDK
}));
app.use(cookieParser(ENV.COOKIES.SECRET));

// CORS Configuration (Strict Origins)
app.use(cors({
  origin: [ENV.FRONTEND_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-user-name']
}));

app.use(express.json());
app.use(globalRateLimiter);

// Middleware for Request Logging
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') && !req.path.includes('/activities')) {
    const activityName = `${req.method} ${req.path}`;
    logAuditActivity(
      req.headers['x-user-id'] || null,
      req.headers['x-user-name'] || 'Guest',
      'API_REQUEST',
      activityName,
      { path: req.path, method: req.method }
    ).catch(err => console.error('Logging error:', err));
  }
  next();
});

// Initialize MySQL Database
initDatabase();

// Mount Authentication & User Routes
app.use('/api/auth', authRouter);
app.use('/auth', authRouter); // Backward compatibility
app.use('/users', authRouter);

// ----------------- RENTALS ROUTES -----------------
app.get('/api/rentals', async (req, res, next) => {
  try {
    const rentals = await query('SELECT * FROM rentals ORDER BY id ASC');
    res.json(rentals);
  } catch (err) {
    next(err);
  }
});

app.post('/api/rentals/:id/book', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userName, userId, days } = req.body;
    
    const rentals = await query('SELECT * FROM rentals WHERE id = ?', [id]);
    const vehicle = rentals[0] || { title: `Vehicle #${id}` };

    await logAuditActivity(
      userId || req.headers['x-user-id'] || null,
      userName || req.headers['x-user-name'] || 'User',
      'RENTAL_BOOKING',
      `Booked vehicle ${vehicle.title} for ${days || 1} day(s)`,
      { vehicleId: id, vehicleTitle: vehicle.title, days, pricePerDay: vehicle.price_per_day }
    );

    res.json({ success: true, message: `Successfully booked ${vehicle.title}!` });
  } catch (err) {
    next(err);
  }
});

// ----------------- EXPLORE PLACES ROUTES -----------------
app.get('/api/explore', async (req, res, next) => {
  try {
    const places = await query('SELECT * FROM explore_places ORDER BY id ASC');
    res.json(places);
  } catch (err) {
    next(err);
  }
});

app.post('/api/explore/:id/bookmark', async (req, res, next) => {
  try {
    const { id } = req.params;
    await query('UPDATE explore_places SET is_bookmarked = NOT is_bookmarked WHERE id = ?', [id]);
    
    await logAuditActivity(
      req.headers['x-user-id'] || null,
      req.headers['x-user-name'] || 'User',
      'TOGGLE_BOOKMARK',
      `Toggled bookmark for place ID #${id}`
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ----------------- TRAVEL TRIPS (RIDE SHARING) ROUTES -----------------
app.get('/api/trips', async (req, res, next) => {
  try {
    const trips = await query('SELECT * FROM travel_trips ORDER BY id DESC');
    res.json(trips);
  } catch (err) {
    next(err);
  }
});

app.post('/api/trips', async (req, res, next) => {
  try {
    const { title, pickup, date_time, seats_total, vehicle_type, cost, description, userName, userInitials, batchInfo, userId } = req.body;
    
    const result = await query(
      `INSERT INTO travel_trips 
       (user_name, user_initials, batch_info, title, pickup, date_time, seats_left, seats_total, vehicle_type, cost, description, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userName || 'Campus User',
        userInitials || 'CU',
        batchInfo || 'PGDM 2026',
        title,
        pickup || 'GIM Main Gate',
        date_time,
        parseInt(seats_total),
        parseInt(seats_total),
        vehicle_type || 'Cab',
        cost || '₹400 each',
        description || '',
        'Today'
      ]
    );

    await logAuditActivity(
      userId || req.headers['x-user-id'] || null,
      userName || req.headers['x-user-name'] || 'User',
      'POST_TRIP',
      `Created new travel buddy ride: ${title}`,
      { pickup, date_time, seats_total, cost }
    );

    res.json({ success: true, id: result.insertId });
  } catch (err) {
    next(err);
  }
});

app.post('/api/trips/:id/join', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userName, userId } = req.body;
    
    await query('UPDATE travel_trips SET seats_left = GREATEST(seats_left - 1, 0) WHERE id = ?', [id]);
    
    await logAuditActivity(
      userId || req.headers['x-user-id'] || null,
      userName || req.headers['x-user-name'] || 'User',
      'JOIN_TRIP',
      `Joined travel ride ID #${id}`,
      { tripId: id }
    );

    res.json({ success: true, message: 'Joined trip successfully!' });
  } catch (err) {
    next(err);
  }
});

// Global Error Handler
app.use(globalErrorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Enterprise Auth Express Server listening on http://localhost:${PORT}`);
});
