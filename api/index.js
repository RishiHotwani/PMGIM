import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ENV } from '../server/config/env.js';
import { initDatabase, query } from '../server/config/database.js';
import { logAuditActivity } from '../server/utils/logger.js';
import authRouter from '../server/modules/auth/auth.routes.js';
import { globalRateLimiter } from '../server/middleware/rateLimiter.js';
import { globalErrorHandler } from '../server/middleware/errorHandler.js';

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cookieParser(ENV.COOKIES.SECRET));

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-user-name']
}));

app.use(express.json());
app.use(globalRateLimiter);

// Asynchronously initialize database connection
let dbInitialized = false;
app.use(async (req, res, next) => {
  if (!dbInitialized) {
    await initDatabase();
    dbInitialized = true;
  }
  next();
});

// Audit log middleware
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

// Mount Routers
app.use('/api/auth', authRouter);
app.use('/auth', authRouter);
app.use('/users', authRouter);

// Rentals
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

// Explore
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

// Travel Trips
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

app.use(globalErrorHandler);

export default app;
