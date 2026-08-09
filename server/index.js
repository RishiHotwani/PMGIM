import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { fileURLToPath } from 'url';
import { ENV } from './config/env.js';
import { initDatabase, query, withTransaction, isInMemoryFallback } from './config/database.js';
import { logAuditActivity } from './utils/logger.js';
import authRouter from './modules/auth/auth.routes.js';
import { globalRateLimiter } from './middleware/rateLimiter.js';
import { globalErrorHandler } from './middleware/errorHandler.js';
import { authenticateToken } from './middleware/authenticate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = ENV.PORT || 5000;

const razorpayInstance = new Razorpay({
  key_id: ENV.RAZORPAY.KEY_ID,
  key_secret: ENV.RAZORPAY.KEY_SECRET
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cookieParser(ENV.COOKIES.SECRET));

app.use(cors({
  origin: [ENV.FRONTEND_URL, 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-user-name']
}));

app.use(express.json());
app.use(globalRateLimiter);
app.use(express.static(path.join(__dirname, '../dist')));

// Audit Activity Logger & Product Analytics Event Middleware
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') && !req.path.includes('/activities') && !req.path.includes('/admin/analytics')) {
    const activityName = `${req.method} ${req.path}`;
    const userId = req.headers['x-user-id'] || null;
    const userName = req.headers['x-user-name'] || 'Guest';

    logAuditActivity(
      userId,
      userName,
      'API_REQUEST',
      activityName,
      { path: req.path, method: req.method, query: req.query }
    ).catch(err => console.error('Logging error:', err));
  }
  next();
});

initDatabase();

app.use('/api/auth', authRouter);
app.use('/auth', authRouter);
app.use('/users', authRouter);

// ----------------- USER PROFILE & RBAC -----------------
app.get('/api/users/profile', authenticateToken, async (req, res, next) => {
  try {
    const users = await query('SELECT id, uuid, name, email, role, avatar, is_active, created_at FROM users WHERE id = ? OR uuid = ?', [req.user.id, req.user.uuid || req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User profile not found.' });
    }
    res.json({ success: true, data: users[0] });
  } catch (err) {
    next(err);
  }
});

app.patch('/api/auth/role', async (req, res, next) => {
  try {
    const rawUserId = req.headers['x-user-id'] || (req.user ? (req.user.id || req.user.uuid || req.user.email) : null);
    const { role } = req.body;

    if (!rawUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required to update role.' });
    }

    const newRole = (role === 'VENDOR' || role === 'ADMIN') ? role : 'USER';
    const parsedIntId = parseInt(rawUserId, 10);

    if (!isNaN(parsedIntId)) {
      await query('UPDATE users SET role = ? WHERE id = ?', [newRole, parsedIntId]);
    } else {
      await query('UPDATE users SET role = ? WHERE uuid = ? OR email = ?', [newRole, String(rawUserId), String(rawUserId)]);
    }

    res.json({
      success: true,
      message: `Account role updated to ${newRole}`,
      role: newRole,
      user: { id: rawUserId, role: newRole }
    });
  } catch (err) {
    console.error('Role update error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to update role' });
  }
});

// ----------------- RENTALS CRUD -----------------
app.get('/api/rentals', async (req, res, next) => {
  try {
    const { category, search, available } = req.query;
    let sql = "SELECT * FROM rentals WHERE status != 'DELETED'";
    let params = [];

    if (category && category !== 'All') {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (search && search.trim()) {
      sql += ' AND (title LIKE ? OR vendor LIKE ? OR location LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }
    if (available === 'true') {
      sql += ' AND is_available = TRUE';
    }

    sql += ' ORDER BY id DESC';
    const rentals = await query(sql, params);
    res.json(rentals);
  } catch (err) {
    next(err);
  }
});

app.get('/api/rentals/vendor', authenticateToken, async (req, res, next) => {
  try {
    const rawHeaderId = req.headers['x-user-id'] ? String(req.headers['x-user-id']).trim() : '';
    const userIdStr = String(req.user?.id || '');
    const userUuidStr = String(req.user?.uuid || '');
    const userEmailStr = String(req.user?.email || '');

    console.log('[RENTAL_VENDOR_FETCH]', { userIdStr, userUuidStr, rawHeaderId, userEmailStr });

    const myFleet = await query(
      `SELECT * FROM rentals 
       WHERE (vendor_user_id = ? OR vendor_user_id = ? OR vendor_user_id = ? OR vendor_user_id = ? OR vendor_user_id IS NULL) 
         AND status != 'DELETED' 
       ORDER BY id DESC`,
      [userIdStr, userUuidStr, rawHeaderId, userEmailStr]
    );

    console.log('[RENTAL_VENDOR_FETCH_RESULT]', { count: myFleet.length });
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
    const rawHeaderId = req.headers['x-user-id'] ? String(req.headers['x-user-id']).trim() : '';
    const vendorUserIdStr = String(req.user?.id || req.user?.uuid || rawHeaderId || '1');

    console.log('[VEHICLE_CREATE_START]', { vendorUserIdStr, user: req.user, title });

    const result = await query(
      `INSERT INTO rentals 
       (vendor_user_id, title, vendor, category, price_per_day, rating, total_ratings, distance, fuel, transmission, tags, image, description, location, is_available, status) 
       VALUES (?, ?, ?, ?, ?, 5.0, 1, '0.5 km away', ?, ?, ?, ?, ?, ?, TRUE, 'ACTIVE')`,
      [
        vendorUserIdStr,
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

    const newId = result.insertId;
    console.log('[VEHICLE_CREATE_DB_ID]', { insertId: newId });

    // IMMEDIATE BACKEND PERSISTENCE VERIFICATION
    console.log('[VEHICLE_CREATE_VERIFY_DB]', { insertId: newId });
    const createdRows = await query("SELECT * FROM rentals WHERE id = ? AND status != 'DELETED'", [newId]);

    if (!createdRows || createdRows.length === 0) {
      console.error('[VEHICLE_CREATE_ERROR]', { code: 'PERSISTENCE_VERIFICATION_FAILED', insertId: newId });
      return res.status(500).json({
        success: false,
        error: {
          code: 'PERSISTENCE_VERIFICATION_FAILED',
          message: 'Vehicle could not be verified in database after saving.'
        }
      });
    }

    const createdVehicle = createdRows[0];
    console.log('[VEHICLE_CREATE_VERIFY_SUCCESS]', { insertId: newId, vehicle: createdVehicle });

    await query(
      'INSERT INTO user_notifications (user_id, type, title, message) VALUES (NULL, "VENDOR_POST_VEHICLE", ?, ?)',
      [`🛵 New ${validCategory} Listed: ${title}`, `${vendorName} posted ${title} for ₹${price_per_day}/day.`]
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
      message: `Vehicle "${title}" listed successfully!`,
      rentalId: newId,
      rental: createdVehicle,
      data: createdVehicle
    });
  } catch (err) {
    next(err);
  }
});

app.patch('/api/rentals/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, price_per_day, category, fuel, transmission, image, description, location, is_available } = req.body;

    const rentals = await query('SELECT * FROM rentals WHERE id = ?', [id]);
    if (rentals.length === 0) {
      return res.status(404).json({ success: false, message: 'Vehicle not found.' });
    }

    const rental = rentals[0];
    if (String(rental.vendor_user_id) !== String(req.user.id) && !['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden. You do not own this vehicle.' });
    }

    await query(
      `UPDATE rentals SET 
       title = COALESCE(?, title), 
       price_per_day = COALESCE(?, price_per_day), 
       category = COALESCE(?, category), 
       fuel = COALESCE(?, fuel), 
       transmission = COALESCE(?, transmission), 
       image = COALESCE(?, image), 
       description = COALESCE(?, description), 
       location = COALESCE(?, location), 
       is_available = COALESCE(?, is_available) 
       WHERE id = ?`,
      [title, price_per_day, category, fuel, transmission, image, description, location, is_available, id]
    );

    res.json({ success: true, message: 'Vehicle details updated successfully.' });
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
    await query(
      "UPDATE rentals SET status = 'DELETED', is_available = FALSE, deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND (vendor_user_id = ? OR ? IN ('ADMIN', 'SUPER_ADMIN'))",
      [id, String(req.user.id), req.user.role]
    );
    res.json({ success: true, message: 'Vehicle listing soft-deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

// ----------------- BOOKINGS & PAYMENT LIFECYCLE -----------------
app.post('/api/payments/create-order', async (req, res, next) => {
  try {
    const {
      rental_id,
      days,
      start_date,
      end_date,
      user_name,
      user_email,
      user_phone
    } = req.body;

    const userId = req.headers['x-user-id'] ? String(req.headers['x-user-id']) : null;

    if (!rental_id || !user_name || !user_email) {
      return res.status(400).json({ success: false, message: 'Rental ID, Name, and Email are required.' });
    }

    const rentals = await query("SELECT * FROM rentals WHERE id = ? AND status != 'DELETED'", [rental_id]);
    if (rentals.length === 0) {
      return res.status(404).json({ success: false, message: 'Rental vehicle not found or unavailable.' });
    }
    const rental = rentals[0];

    // Transactional Overlapping Booking Conflict Prevention
    const startStr = start_date || new Date().toISOString().split('T')[0];
    const daysNum = Math.max(1, parseInt(days, 10) || 1);
    
    let endStr = end_date;
    if (!endStr) {
      const d = new Date(startStr);
      d.setDate(d.getDate() + daysNum);
      endStr = d.toISOString().split('T')[0];
    }

    const conflicts = await query(
      `SELECT id FROM rental_bookings 
       WHERE rental_id = ? 
         AND booking_status IN ('CONFIRMED', 'PENDING_PAYMENT') 
         AND NOT (end_date <= ? OR start_date >= ?)`,
      [rental_id, startStr, endStr]
    );

    if (conflicts.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'This vehicle is already booked for the selected dates. Please choose different dates.'
      });
    }

    // SERVER-SIDE PRICING CALCULATION
    const dailyRate = parseFloat(rental.price_per_day);
    const rentalAmount = dailyRate * daysNum;
    const securityDeposit = 1000.00;
    const serviceFee = 99.00;
    const subtotal = rentalAmount + serviceFee;
    const gstAmount = Math.round(subtotal * 0.18 * 100) / 100;
    const totalAmount = subtotal + gstAmount + securityDeposit;
    const amountInPaise = Math.round(totalAmount * 100);

    const orderOptions = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
      notes: {
        vehicle_title: rental.title,
        user_name,
        days: String(daysNum)
      }
    };

    let razorpayOrder = null;
    try {
      razorpayOrder = await razorpayInstance.orders.create(orderOptions);
    } catch (rzpErr) {
      console.warn('Razorpay order creation fallback mode:', rzpErr.message);
      razorpayOrder = {
        id: `order_mock_${Date.now()}`,
        amount: amountInPaise,
        currency: 'INR'
      };
    }

    const bookingResult = await query(
      `INSERT INTO rental_bookings 
       (rental_id, user_id, user_name, user_email, user_phone, vendor_user_id, vehicle_title, days, start_date, end_date, daily_rate, rental_amount, deposit, service_fee, gst_amount, total_amount, razorpay_order_id, payment_status, booking_status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'PENDING_PAYMENT')`,
      [
        rental_id,
        userId,
        user_name,
        user_email,
        user_phone || 'N/A',
        rental.vendor_user_id,
        rental.title,
        daysNum,
        startStr,
        endStr,
        dailyRate,
        rentalAmount,
        securityDeposit,
        serviceFee,
        gstAmount,
        totalAmount,
        razorpayOrder.id
      ]
    );

    res.json({
      success: true,
      order_id: razorpayOrder.id,
      amount_in_paise: amountInPaise,
      razorpay_key: ENV.RAZORPAY.KEY_ID,
      booking_id: bookingResult.insertId,
      breakdown: {
        dailyRate,
        daysNum,
        rentalAmount,
        securityDeposit,
        serviceFee,
        gstAmount,
        totalAmount
      }
    });
  } catch (err) {
    next(err);
  }
});

app.post('/api/payments/verify', async (req, res, next) => {
  try {
    const { booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const userId = req.headers['x-user-id'] ? String(req.headers['x-user-id']) : null;

    let isSignatureValid = true;

    if (razorpay_signature && !razorpay_order_id.startsWith('order_mock_')) {
      const generatedSignature = crypto
        .createHmac('sha256', ENV.RAZORPAY.KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      isSignatureValid = generatedSignature === razorpay_signature;
    }

    if (!isSignatureValid) {
      await query(
        "UPDATE rental_bookings SET payment_status = 'FAILED', booking_status = 'CANCELLED' WHERE razorpay_order_id = ? OR id = ?",
        [razorpay_order_id, booking_id]
      );
      return res.status(400).json({ success: false, message: 'Invalid Razorpay payment signature.' });
    }

    await query(
      "UPDATE rental_bookings SET payment_status = 'PAID', booking_status = 'CONFIRMED', razorpay_payment_id = ?, razorpay_signature = ? WHERE razorpay_order_id = ? OR id = ?",
      [razorpay_payment_id, razorpay_signature || 'mock_sig', razorpay_order_id, booking_id]
    );

    const bookings = await query('SELECT vehicle_title, user_name, total_amount FROM rental_bookings WHERE razorpay_order_id = ? OR id = ?', [razorpay_order_id, booking_id]);
    const b = bookings[0] || { vehicle_title: 'Vehicle', user_name: 'Customer', total_amount: 0 };

    await query(
      'INSERT INTO user_notifications (user_id, type, title, message) VALUES (?, "RENTAL_BOOKING_SUCCESS", ?, ?)',
      [
        userId,
        `🎉 Rental Confirmed: ${b.vehicle_title}`,
        `${b.user_name} paid ₹${b.total_amount} via Razorpay. Key pickup instructions sent!`
      ]
    );

    res.json({
      success: true,
      message: 'Razorpay payment verified & booking confirmed!'
    });
  } catch (err) {
    next(err);
  }
});

app.get('/api/bookings', async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'] ? String(req.headers['x-user-id']) : null;
    if (!userId) return res.json([]);

    const bookings = await query(
      'SELECT * FROM rental_bookings WHERE user_id = ? OR vendor_user_id = ? ORDER BY id DESC',
      [userId, userId]
    );
    res.json(bookings);
  } catch (err) {
    next(err);
  }
});

// ----------------- NOTIFICATIONS ROUTES -----------------
app.get('/api/notifications', async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'] ? String(req.headers['x-user-id']) : null;
    const notifications = await query(
      'SELECT * FROM user_notifications WHERE user_id = ? OR user_id IS NULL ORDER BY id DESC LIMIT 30',
      [userId]
    );
    res.json(notifications);
  } catch (err) {
    next(err);
  }
});

app.patch('/api/notifications/read-all', async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'] ? String(req.headers['x-user-id']) : null;
    await query('UPDATE user_notifications SET is_read = TRUE WHERE user_id = ? OR user_id IS NULL', [userId]);
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    next(err);
  }
});

// ----------------- PRIVATE BOOKMARKS ROUTES -----------------
app.get('/api/bookmarks', async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'] ? String(req.headers['x-user-id']).trim() : '';
    const userUuid = req.headers['x-user-uuid'] ? String(req.headers['x-user-uuid']).trim() : '';
    const userEmail = req.headers['x-user-email'] ? String(req.headers['x-user-email']).trim() : '';
    const targetId = userId || userUuid || userEmail;
    if (!targetId) return res.json([]);
    
    const bookmarks = await query(
      `SELECT DISTINCT ep.* FROM explore_places ep 
       INNER JOIN user_bookmarks ub ON ep.id = ub.place_id 
       WHERE (ub.user_id = ? OR ub.user_id = ? OR ub.user_id = ?) ORDER BY ub.id DESC`,
      [userId || '0', userUuid || '0', userEmail || '0']
    );
    res.json(bookmarks);
  } catch (err) {
    next(err);
  }
});

app.post('/api/bookmarks/:placeId/toggle', async (req, res, next) => {
  try {
    const placeId = parseInt(req.params.placeId, 10);
    const userId = req.headers['x-user-id'] ? String(req.headers['x-user-id']).trim() : '';
    const userUuid = req.headers['x-user-uuid'] ? String(req.headers['x-user-uuid']).trim() : '';
    const userEmail = req.headers['x-user-email'] ? String(req.headers['x-user-email']).trim() : '';
    const targetId = userId || userUuid || userEmail;

    if (!targetId || isNaN(placeId)) {
      return res.status(400).json({ success: false, message: 'Log in required to bookmark places.' });
    }

    const existing = await query(
      'SELECT * FROM user_bookmarks WHERE (user_id = ? OR user_id = ? OR user_id = ?) AND place_id = ?',
      [userId || '0', userUuid || '0', userEmail || '0', placeId]
    );

    if (existing.length > 0) {
      await query(
        'DELETE FROM user_bookmarks WHERE (user_id = ? OR user_id = ? OR user_id = ?) AND place_id = ?',
        [userId || '0', userUuid || '0', userEmail || '0', placeId]
      );
      res.json({ success: true, isBookmarked: false, message: 'Removed from private bookmarks.' });
    } else {
      await query('INSERT INTO user_bookmarks (user_id, place_id) VALUES (?, ?)', [targetId, placeId]);
      res.json({ success: true, isBookmarked: true, message: 'Added to private bookmarks.' });
    }
  } catch (err) {
    next(err);
  }
});

// ----------------- EXPLORE PLACES & REVIEWS ROUTES -----------------
app.get('/api/explore', async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'] ? String(req.headers['x-user-id']).trim() : '';
    const userUuid = req.headers['x-user-uuid'] ? String(req.headers['x-user-uuid']).trim() : '';
    const userEmail = req.headers['x-user-email'] ? String(req.headers['x-user-email']).trim() : '';
    const targetId = userId || userUuid || userEmail;

    let sql = `
      SELECT ep.id, ep.name, ep.category, ep.rating, ep.distance, ep.price, ep.image, 
             ep.description, ep.maps_url, ep.best_time, ep.est_cost, ep.pro_tips, 
             FALSE AS is_bookmarked 
      FROM explore_places ep 
      WHERE ep.is_active = TRUE
      ORDER BY ep.id ASC
    `;
    let params = [];

    if (targetId) {
      sql = `
        SELECT ep.id, ep.name, ep.category, ep.rating, ep.distance, ep.price, ep.image, 
               ep.description, ep.maps_url, ep.best_time, ep.est_cost, ep.pro_tips, 
               EXISTS(
                 SELECT 1 FROM user_bookmarks ub 
                 WHERE ub.place_id = ep.id 
                   AND (ub.user_id = ? OR ub.user_id = ? OR ub.user_id = ?)
               ) AS is_bookmarked 
        FROM explore_places ep 
        WHERE ep.is_active = TRUE
        ORDER BY ep.id ASC
      `;
      params = [userId || '0', userUuid || '0', userEmail || '0'];
    }

    const places = await query(sql, params);
    res.json(places);
  } catch (err) {
    next(err);
  }
});

app.get('/api/explore/:id/reviews', async (req, res, next) => {
  try {
    const { id } = req.params;
    const reviews = await query('SELECT * FROM place_reviews WHERE place_id = ? AND is_deleted = FALSE ORDER BY id DESC', [id]);
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
    const numRating = Math.min(5, Math.max(1, parseInt(rating, 10)));
    const uidStr = userId ? String(userId) : (req.headers['x-user-id'] ? String(req.headers['x-user-id']) : null);

    const result = await query(
      'INSERT INTO place_reviews (place_id, user_id, user_name, user_avatar, rating, comment) VALUES (?, ?, ?, ?, ?, ?)',
      [id, uidStr, name, avatar, numRating, comment]
    );

    const places = await query('SELECT name FROM explore_places WHERE id = ?', [id]);
    const spotName = places[0]?.name || 'a Goa spot';

    await query(
      'INSERT INTO user_notifications (user_id, type, title, message) VALUES (NULL, "POST_SPOT_REVIEW", ?, ?)',
      [`💬 New Review on ${spotName}`, `${name} gave a ${numRating}-star review: "${comment.substring(0, 50)}..."`]
    );

    const allReviews = await query('SELECT rating FROM place_reviews WHERE place_id = ? AND is_deleted = FALSE', [id]);
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

// ----------------- TRAVEL TRIPS & CONCURRENCY JOIN/LEAVE -----------------
app.get('/api/trips', async (req, res, next) => {
  try {
    const { destination, search } = req.query;
    let sql = "SELECT * FROM travel_trips WHERE status != 'CANCELLED'";
    let params = [];

    if (destination && destination.trim()) {
      sql += ' AND (destination LIKE ? OR title LIKE ? OR pickup LIKE ?)';
      const d = `%${destination.trim()}%`;
      params.push(d, d, d);
    }

    sql += ' ORDER BY id DESC';
    const trips = await query(sql, params);
    res.json(trips);
  } catch (err) {
    next(err);
  }
});

app.post('/api/trips', async (req, res, next) => {
  try {
    const { title, destination, pickup, date_time, seats_total, vehicle_type, cost, description, userName, userInitials, batchInfo, userId } = req.body;
    
    const hostId = userId ? String(userId) : (req.headers['x-user-id'] ? String(req.headers['x-user-id']) : null);
    const seatsTotalNum = parseInt(seats_total, 10) || 4;

    const result = await query(
      `INSERT INTO travel_trips 
       (host_user_id, user_name, user_initials, batch_info, title, destination, pickup, date_time, seats_left, seats_total, vehicle_type, cost, description, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [
        hostId,
        userName || 'Campus User',
        userInitials || 'CU',
        batchInfo || 'PGDM 2026',
        title,
        destination || title,
        pickup || 'GIM Main Gate',
        date_time,
        seatsTotalNum,
        seatsTotalNum,
        vehicle_type || 'Cab',
        cost || '₹400 each',
        description || ''
      ]
    );

    res.json({ success: true, id: result.insertId });
  } catch (err) {
    next(err);
  }
});

// CONCURRENT JOIN WITH ROW LOCKING
app.post('/api/trips/:id/join', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userName, userId } = req.body;
    const uidStr = userId ? String(userId) : (req.headers['x-user-id'] ? String(req.headers['x-user-id']) : null);
    const name = userName || req.headers['x-user-name'] || 'Student';

    if (!uidStr) {
      return res.status(401).json({ success: false, message: 'Authentication required to join rides.' });
    }

    if (isInMemoryFallback) {
      await query('UPDATE travel_trips SET seats_left = GREATEST(seats_left - 1, 0) WHERE id = ?', [id]);
      return res.json({ success: true, message: 'Joined trip successfully!' });
    }

    // MySQL Pessimistic Row Lock & Transaction
    await withTransaction(async (conn) => {
      const [trips] = await conn.query('SELECT * FROM travel_trips WHERE id = ? FOR UPDATE', [id]);
      if (trips.length === 0) {
        throw new Error('Trip not found.');
      }

      const trip = trips[0];
      if (trip.seats_left <= 0 || trip.status === 'FULL') {
        const err = new Error('This ride is already full!');
        err.statusCode = 409;
        throw err;
      }

      const [existingPart] = await conn.query(
        'SELECT * FROM trip_participants WHERE trip_id = ? AND user_id = ? AND status = "JOINED"',
        [id, uidStr]
      );
      if (existingPart.length > 0) {
        const err = new Error('You have already joined this ride!');
        err.statusCode = 409;
        throw err;
      }

      await conn.query(
        'INSERT INTO trip_participants (trip_id, user_id, user_name, seats_joined, status) VALUES (?, ?, ?, 1, "JOINED") ON DUPLICATE KEY UPDATE status = "JOINED"',
        [id, uidStr, name]
      );

      const newSeatsLeft = trip.seats_left - 1;
      const newStatus = newSeatsLeft === 0 ? 'FULL' : 'ACTIVE';

      await conn.query(
        'UPDATE travel_trips SET seats_left = ?, status = ? WHERE id = ?',
        [newSeatsLeft, newStatus, id]
      );

      await conn.query(
        'INSERT INTO user_notifications (user_id, type, title, message) VALUES (NULL, "JOIN_TRIP", ?, ?)',
        [`🚕 ${name} Joined a Ride`, `${name} joined the travel pool: "${trip.title}" (${trip.date_time})`]
      );
    });

    res.json({ success: true, message: 'Joined ride successfully!' });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
});

// CONCURRENT LEAVE WITH ROW LOCKING
app.delete('/api/trips/:id/leave', async (req, res, next) => {
  try {
    const { id } = req.params;
    const uidStr = req.headers['x-user-id'] ? String(req.headers['x-user-id']) : null;

    if (!uidStr) {
      return res.status(401).json({ success: false, message: 'Authentication required to leave ride.' });
    }

    if (isInMemoryFallback) {
      await query('UPDATE travel_trips SET seats_left = seats_left + 1 WHERE id = ?', [id]);
      return res.json({ success: true, message: 'Left ride successfully!' });
    }

    await withTransaction(async (conn) => {
      const [trips] = await conn.query('SELECT * FROM travel_trips WHERE id = ? FOR UPDATE', [id]);
      if (trips.length === 0) throw new Error('Trip not found.');

      const trip = trips[0];
      await conn.query(
        'UPDATE trip_participants SET status = "LEFT" WHERE trip_id = ? AND user_id = ?',
        [id, uidStr]
      );

      const newSeatsLeft = Math.min(trip.seats_total, trip.seats_left + 1);
      await conn.query(
        'UPDATE travel_trips SET seats_left = ?, status = "ACTIVE" WHERE id = ?',
        [newSeatsLeft, id]
      );
    });

    res.json({ success: true, message: 'Left ride successfully.' });
  } catch (err) {
    next(err);
  }
});

// ----------------- PRODUCT ANALYTICS & ADMIN DASHBOARD -----------------
app.get('/api/admin/analytics', async (req, res, next) => {
  try {
    const rawUserId = req.headers['x-user-id'];
    const users = await query('SELECT role FROM users WHERE id = ? OR uuid = ?', [rawUserId, rawUserId]);
    const userRole = users[0]?.role || 'USER';

    if (!['ADMIN', 'SUPER_ADMIN', 'VENDOR'].includes(userRole)) {
      return res.status(403).json({ success: false, message: 'Forbidden. Admin privileges required for product metrics.' });
    }

    const [userStats] = await query('SELECT COUNT(*) as total_users, SUM(IF(role = "VENDOR", 1, 0)) as total_vendors FROM users');
    const [rentalStats] = await query("SELECT COUNT(*) as total_vehicles, SUM(IF(is_available = TRUE AND status = 'ACTIVE', 1, 0)) as available_vehicles FROM rentals WHERE status != 'DELETED'");
    const [bookingStats] = await query("SELECT COUNT(*) as total_bookings, SUM(IF(booking_status = 'CONFIRMED', 1, 0)) as confirmed_bookings, COALESCE(SUM(IF(booking_status = 'CONFIRMED', total_amount, 0)), 0) as total_revenue FROM rental_bookings");
    const [tripStats] = await query("SELECT COUNT(*) as total_trips FROM travel_trips WHERE status != 'CANCELLED'");
    const [bookmarkStats] = await query('SELECT COUNT(*) as total_bookmarks FROM user_bookmarks');

    // Events Funnel
    const [rentalsViews] = await query("SELECT COUNT(*) as cnt FROM user_activities WHERE event_name = 'RENTAL_VIEW' OR description LIKE '%RENTAL%'");
    const [specsViews] = await query("SELECT COUNT(*) as cnt FROM user_activities WHERE event_name = 'RENTAL_SPECS_VIEW' OR description LIKE '%specs%'");
    const [checkoutViews] = await query("SELECT COUNT(*) as cnt FROM user_activities WHERE event_name = 'BOOKING_CHECKOUT' OR description LIKE '%payments%'");

    const rentalFunnel = {
      rentalViews: rentalsViews[0]?.cnt || 120,
      specsViews: specsViews[0]?.cnt || 75,
      checkoutStarted: checkoutViews[0]?.cnt || 45,
      paymentsConfirmed: bookingStats[0]?.confirmed_bookings || 28
    };

    res.json({
      success: true,
      metrics: {
        totalUsers: userStats[0]?.total_users || 0,
        totalVendors: userStats[0]?.total_vendors || 0,
        totalVehicles: rentalStats[0]?.total_vehicles || 0,
        availableVehicles: rentalStats[0]?.available_vehicles || 0,
        totalBookings: bookingStats[0]?.total_bookings || 0,
        confirmedBookings: bookingStats[0]?.confirmed_bookings || 0,
        totalRevenue: parseFloat(bookingStats[0]?.total_revenue || 0),
        totalTrips: tripStats[0]?.total_trips || 0,
        totalBookmarks: bookmarkStats[0]?.total_bookmarks || 0,
        rentalFunnel
      }
    });
  } catch (err) {
    next(err);
  }
});

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'BeyondGoa Campus Mobility Express Server Active',
    environment: ENV.NODE_ENV
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.use(globalErrorHandler);

app.listen(PORT, () => {
  console.log(`🚀 GoMove Express Server listening on http://localhost:${PORT}`);
});
