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
import { authenticateToken } from '../server/middleware/authenticate.js';

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

let dbInitialized = false;
app.use(async (req, res, next) => {
  if (!dbInitialized) {
    await initDatabase();
    dbInitialized = true;
  }
  next();
});

app.use('/api/auth', authRouter);
app.use('/auth', authRouter);
app.use('/users', authRouter);

// NOTIFICATIONS
app.get('/api/notifications', async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id'], 10) : null;
    const notifications = await query(
      'SELECT * FROM user_notifications WHERE user_id = ? OR user_id IS NULL ORDER BY id DESC LIMIT 20',
      [userId]
    );
    res.json(notifications);
  } catch (err) {
    next(err);
  }
});

app.patch('/api/notifications/read-all', async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id'], 10) : null;
    await query('UPDATE user_notifications SET is_read = TRUE WHERE user_id = ? OR user_id IS NULL', [userId]);
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    next(err);
  }
});

// PRIVATE BOOKMARKS
app.get('/api/bookmarks', async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id'], 10) : null;
    if (!userId) return res.json([]);
    
    const bookmarks = await query(
      `SELECT ep.* FROM explore_places ep 
       INNER JOIN user_bookmarks ub ON ep.id = ub.place_id 
       WHERE ub.user_id = ? ORDER BY ub.id DESC`,
      [userId]
    );
    res.json(bookmarks);
  } catch (err) {
    next(err);
  }
});

app.post('/api/bookmarks/:placeId/toggle', async (req, res, next) => {
  try {
    const { placeId } = req.params;
    const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id'], 10) : null;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Log in required to bookmark places.' });
    }

    const existing = await query('SELECT * FROM user_bookmarks WHERE user_id = ? AND place_id = ?', [userId, placeId]);

    if (existing.length > 0) {
      await query('DELETE FROM user_bookmarks WHERE user_id = ? AND place_id = ?', [userId, placeId]);
      res.json({ success: true, isBookmarked: false, message: 'Removed from private bookmarks.' });
    } else {
      await query('INSERT INTO user_bookmarks (user_id, place_id) VALUES (?, ?)', [userId, placeId]);
      res.json({ success: true, isBookmarked: true, message: 'Added to private bookmarks.' });
    }
  } catch (err) {
    next(err);
  }
});

// RENTALS
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

app.get('/api/rentals/vendor', authenticateToken, async (req, res, next) => {
  try {
    const vendorUserId = req.user.id;
    const myFleet = await query('SELECT * FROM rentals WHERE vendor_user_id = ? ORDER BY id DESC', [vendorUserId]);
    res.json(myFleet);
  } catch (err) {
    next(err);
  }
});

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

    await query(
      'INSERT INTO user_notifications (user_id, type, title, message) VALUES (NULL, "VENDOR_POST_VEHICLE", ?, ?)',
      [`🛵 New ${validCategory} Listed: ${title}`, `${vendorName} posted ${title} for ₹${price_per_day}/day.`]
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

app.patch('/api/rentals/:id/toggle', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    await query('UPDATE rentals SET is_available = NOT is_available WHERE id = ?', [id]);
    res.json({ success: true, message: 'Vehicle availability updated.' });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/rentals/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM rentals WHERE id = ? AND (vendor_user_id = ? OR ? IN ("ADMIN", "SUPER_ADMIN"))', [
      id,
      req.user.id,
      req.user.role
    ]);
    res.json({ success: true, message: 'Vehicle deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

app.post('/api/rentals/:id/book', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userName, userId, days, startDate } = req.body;
    const rentals = await query('SELECT * FROM rentals WHERE id = ?', [id]);
    const vehicle = rentals[0] || { title: `Vehicle #${id}` };

    res.json({
      success: true,
      message: `🎉 Success! Booked ${vehicle.title} for ${days || 1} day(s). Vendor will contact you for pickup.`
    });
  } catch (err) {
    next(err);
  }
});

// EXPLORE & REVIEWS
app.get('/api/explore', async (req, res, next) => {
  try {
    const places = await query('SELECT * FROM explore_places ORDER BY id ASC');
    res.json(places);
  } catch (err) {
    next(err);
  }
});

app.get('/api/explore/:id/reviews', async (req, res, next) => {
  try {
    const { id } = req.params;
    const reviews = await query('SELECT * FROM place_reviews WHERE place_id = ? ORDER BY id DESC', [id]);
    res.json(reviews);
  } catch (err) {
    next(err);
  }
});

app.post('/api/explore/:id/reviews', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rating, comment, userName, userId } = req.body;

    if (!rating || !comment) {
      return res.status(400).json({ success: false, message: 'Rating (1-5) and comment text are required.' });
    }

    const name = userName || req.headers['x-user-name'] || 'Anonymous Student';
    const avatar = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || 'US';
    const numRating = parseInt(rating, 10);

    const result = await query(
      'INSERT INTO place_reviews (place_id, user_id, user_name, user_avatar, rating, comment) VALUES (?, ?, ?, ?, ?, ?)',
      [id, userId || null, name, avatar, numRating, comment]
    );

    const places = await query('SELECT name FROM explore_places WHERE id = ?', [id]);
    const spotName = places[0]?.name || 'a Goa spot';

    await query(
      'INSERT INTO user_notifications (user_id, type, title, message) VALUES (NULL, "POST_SPOT_REVIEW", ?, ?)',
      [`💬 New Review on ${spotName}`, `${name} gave a ${numRating}-star review: "${comment.substring(0, 50)}..."`]
    );

    const allReviews = await query('SELECT rating FROM place_reviews WHERE place_id = ?', [id]);
    if (allReviews.length > 0) {
      const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
      await query('UPDATE explore_places SET rating = ? WHERE id = ?', [avg.toFixed(1), id]);
    }

    res.status(201).json({
      success: true,
      message: 'Review and rating submitted successfully!',
      id: result.insertId
    });
  } catch (err) {
    next(err);
  }
});

// TRAVEL TRIPS
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

    res.json({ success: true, id: result.insertId });
  } catch (err) {
    next(err);
  }
});

app.post('/api/trips/:id/join', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userName, userId } = req.body;
    const name = userName || req.headers['x-user-name'] || 'Student';
    
    const trips = await query('SELECT * FROM travel_trips WHERE id = ?', [id]);
    const trip = trips[0] || { title: `Trip #${id}` };

    await query('UPDATE travel_trips SET seats_left = GREATEST(seats_left - 1, 0) WHERE id = ?', [id]);

    await query(
      'INSERT INTO user_notifications (user_id, type, title, message) VALUES (NULL, "JOIN_TRIP", ?, ?)',
      [`🚕 ${name} Joined a Ride`, `${name} joined the travel pool: "${trip.title}" (${trip.date_time})`]
    );

    res.json({ success: true, message: 'Joined trip successfully!' });
  } catch (err) {
    next(err);
  }
});

app.use(globalErrorHandler);

export default app;
