import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { ENV } from './config/env.js';
import { initDatabase, query } from './config/database.js';
import { logAuditActivity } from './utils/logger.js';
import authRouter from './modules/auth/auth.routes.js';
import { globalRateLimiter } from './middleware/rateLimiter.js';
import { globalErrorHandler } from './middleware/errorHandler.js';
import { authenticateToken } from './middleware/authenticate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = ENV.PORT || 5000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cookieParser(ENV.COOKIES.SECRET));

app.use(cors({
  origin: [ENV.FRONTEND_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-user-name']
}));

app.use(express.json());
app.use(globalRateLimiter);
app.use(express.static(path.join(__dirname, '../dist')));

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

initDatabase();

app.use('/api/auth', authRouter);
app.use('/auth', authRouter);
app.use('/users', authRouter);

// ----------------- RENTALS ROUTES -----------------
// GET all available rentals (for Customers)
app.get('/api/rentals', async (req, res, next) => {
  try {
    const { category } = req.query;
    let sql = 'SELECT * FROM rentals ORDER BY id DESC';
    let params = [];

    if (category && category !== 'All') {
      sql = 'SELECT * FROM rentals WHERE category = ? ORDER BY id DESC';
      params = [category];
    }

    const rentals = await query(sql, params);
    res.json(rentals);
  } catch (err) {
    next(err);
  }
});

// GET vendor's own uploaded fleet
app.get('/api/rentals/vendor', authenticateToken, async (req, res, next) => {
  try {
    const vendorUserId = req.user.id;
    const myFleet = await query('SELECT * FROM rentals WHERE vendor_user_id = ? ORDER BY id DESC', [vendorUserId]);
    res.json(myFleet);
  } catch (err) {
    next(err);
  }
});

// POST new rental vehicle (Vendor action)
app.post('/api/rentals', authenticateToken, async (req, res, next) => {
  try {
    if (req.user.role !== 'VENDOR' && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden. Vendor role required to post vehicle listings.' });
    }

    const { title, category, price_per_day, fuel, transmission, tags, image, description, location } = req.body;

    if (!title || !price_per_day || !image) {
      return res.status(400).json({ success: false, message: 'Title, Price per day, and Image URL are required.' });
    }

    const validCategory = ['Car', 'Bike', 'Scooter'].includes(category) ? category : 'Bike';
    const vendorName = req.user.name || 'Campus Vendor';
    const defaultImage = image || 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80';

    const result = await query(
      `INSERT INTO rentals 
       (vendor_user_id, title, vendor, category, price_per_day, rating, total_ratings, distance, fuel, transmission, tags, image, description, location, is_available) 
       VALUES (?, ?, ?, ?, ?, 5.0, 1, '0.5 km away', ?, ?, ?, ?, ?, ?, TRUE)`,
      [
        req.user.id,
        title,
        vendorName,
        validCategory,
        parseInt(price_per_day, 10),
        fuel || 'Petrol',
        transmission || 'Automatic',
        tags || 'Verified Vendor',
        defaultImage,
        description || `${title} available for campus and Goa trip rentals.`,
        location || 'Sanquelim / GIM Gate'
      ]
    );

    await logAuditActivity(
      req.user.id,
      req.user.name,
      'VENDOR_POST_VEHICLE',
      `Posted new rental vehicle: ${title} (${validCategory})`,
      { title, category: validCategory, price_per_day }
    );

    res.status(201).json({
      success: true,
      message: `${title} posted successfully!`,
      id: result.insertId
    });
  } catch (err) {
    next(err);
  }
});

// PATCH toggle vehicle availability (Vendor action)
app.patch('/api/rentals/:id/toggle', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    await query('UPDATE rentals SET is_available = NOT is_available WHERE id = ?', [id]);
    
    await logAuditActivity(
      req.user.id,
      req.user.name,
      'VENDOR_TOGGLE_AVAILABILITY',
      `Toggled vehicle availability for ID #${id}`
    );

    res.json({ success: true, message: 'Vehicle availability updated.' });
  } catch (err) {
    next(err);
  }
});

// DELETE rental vehicle (Vendor action)
app.delete('/api/rentals/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM rentals WHERE id = ? AND (vendor_user_id = ? OR ? IN ("ADMIN", "SUPER_ADMIN"))', [
      id,
      req.user.id,
      req.user.role
    ]);

    await logAuditActivity(
      req.user.id,
      req.user.name,
      'VENDOR_DELETE_VEHICLE',
      `Deleted vehicle listing ID #${id}`
    );

    res.json({ success: true, message: 'Vehicle deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

// POST book rental vehicle (Customer action)
app.post('/api/rentals/:id/book', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userName, userId, days, startDate } = req.body;
    
    const rentals = await query('SELECT * FROM rentals WHERE id = ?', [id]);
    const vehicle = rentals[0] || { title: `Vehicle #${id}` };

    await logAuditActivity(
      userId || req.headers['x-user-id'] || null,
      userName || req.headers['x-user-name'] || 'Customer',
      'RENTAL_BOOKING',
      `Booked vehicle ${vehicle.title} for ${days || 1} day(s) starting ${startDate || 'Today'}`,
      { vehicleId: id, vehicleTitle: vehicle.title, days, pricePerDay: vehicle.price_per_day }
    );

    res.json({
      success: true,
      message: `🎉 Success! Booked ${vehicle.title} for ${days || 1} day(s). Vendor will contact you for pickup.`
    });
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

// ----------------- TRAVEL TRIPS ROUTES -----------------
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

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'PMGIM Enterprise Auth & Vendor API Server Active',
    environment: ENV.NODE_ENV
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.use(globalErrorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Enterprise Auth Express Server listening on http://localhost:${PORT}`);
});
