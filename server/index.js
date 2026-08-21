import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { fileURLToPath } from 'url';
import { ENV } from './config/env.js';
import { initDatabase, query, withTransaction, isInMemoryFallback, checkWritePersistence, memoryStore } from './config/database.js';
import { logAuditActivity } from './utils/logger.js';
import authRouter from './modules/auth/auth.routes.js';
import { globalRateLimiter } from './middleware/rateLimiter.js';
import { globalErrorHandler } from './middleware/errorHandler.js';
import { authenticateToken } from './middleware/authenticate.js';
import { freePort } from './utils/freePort.js';

import { handleGoogleAuth } from './modules/auth/auth.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
const PORT = ENV.PORT || 5001;

let razorpayInstance = null;
try {
  if (ENV.RAZORPAY?.KEY_ID && ENV.RAZORPAY?.KEY_SECRET) {
    razorpayInstance = new Razorpay({
      key_id: ENV.RAZORPAY.KEY_ID,
      key_secret: ENV.RAZORPAY.KEY_SECRET
    });
  }
} catch (e) {
  console.warn('Razorpay init warning:', e.message);
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cookieParser(ENV.COOKIES.SECRET));

const allowedOrigins = ENV.CORS?.ALLOWED_ORIGINS ? ENV.CORS.ALLOWED_ORIGINS.split(',').map(s => s.trim()) : null;
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (!allowedOrigins || allowedOrigins.length === 0) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-user-name', 'x-user-uuid', 'x-user-email']
}));

app.use(express.json());
app.use(globalRateLimiter);
app.use(express.static(path.join(__dirname, '../dist')));

// Audit Activity Logger & Product Analytics Event Middleware
app.use((req, res, next) => {
  try {
    if (req.path && req.path.startsWith('/api/') && !req.path.includes('/activities') && !req.path.includes('/admin/analytics')) {
      const activityName = `${req.method} ${req.path}`;
      const userId = req.headers['x-user-id'] || null;
      const userName = req.headers['x-user-name'] || 'Guest';

      logAuditActivity(
        userId,
        userName,
        'API_REQUEST',
        activityName,
        { path: req.path, method: req.method }
      ).catch(err => console.error('Logging error:', err.message));
    }
  } catch (e) {
    console.error('Middleware audit logging catch:', e.message);
  }
  next();
});

initDatabase();

app.post('/api/auth/google', handleGoogleAuth);
app.post('/api/auth/google/callback', handleGoogleAuth);
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

app.patch('/api/auth/role', authenticateToken, async (req, res, next) => {
  try {
    const { role } = req.body;
    const authenticatedId = String(req.user.id || req.user.uuid);
    const authenticatedEmail = req.user.email ? String(req.user.email) : null;

    // Only allow USER <-> VENDOR self-switch; ADMIN promotion not allowed via this endpoint
    const allowedRoles = ['USER', 'VENDOR'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role. Allowed: USER, VENDOR.' });
    }
    const newRole = role;

    // Enforce self-only update: authenticated user can only change own role
    const parsedIntId = parseInt(authenticatedId, 10);
    if (!isNaN(parsedIntId)) {
      await query('UPDATE users SET role = ? WHERE id = ?', [newRole, parsedIntId]);
    } else if (authenticatedEmail) {
      await query('UPDATE users SET role = ? WHERE uuid = ? OR email = ?', [newRole, authenticatedId, authenticatedEmail]);
    } else {
      await query('UPDATE users SET role = ? WHERE uuid = ?', [newRole, authenticatedId]);
    }

    res.json({
      success: true,
      message: `Account role updated to ${newRole}`,
      role: newRole,
      user: { id: authenticatedId, role: newRole }
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
    let sql = `SELECT r.*, COALESCE(r.vendor_phone, u.phone_number) AS vendor_phone_resolved FROM rentals r LEFT JOIN users u ON (u.id = r.vendor_user_id OR u.uuid = r.vendor_user_id OR u.email = r.vendor_user_id) WHERE r.status != 'DELETED'`;
    let params = [];

    if (category && category !== 'All') {
      sql += ' AND r.category = ?';
      params.push(category);
    }
    if (search && search.trim()) {
      sql += ' AND (r.title LIKE ? OR r.vendor LIKE ? OR r.location LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }
    if (available === 'true') {
      sql += ' AND r.is_available = TRUE';
    }

    sql += ' ORDER BY r.id DESC';
    const rentals = await query(sql, params);
    const mapped = rentals.map(r => ({ ...r, vendor_phone: r.vendor_phone_resolved || r.vendor_phone, phone: r.vendor_phone_resolved || r.vendor_phone }));
    res.json(mapped);
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

    const myFleet = await query(
      `SELECT * FROM rentals 
       WHERE (vendor_user_id = ? OR vendor_user_id = ? OR vendor_user_id = ? OR vendor_user_id = ?) 
         AND status != 'DELETED' 
       ORDER BY id DESC`,
      [userIdStr, userUuidStr, rawHeaderId, userEmailStr]
    );
    res.json(myFleet);
  } catch (err) {
    next(err);
  }
});

app.post('/api/rentals', authenticateToken, async (req, res, next) => {
  try {
    if (!checkWritePersistence(res)) return;

    if (req.user.role !== 'VENDOR' && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden. Vendor role required to post vehicle listings.' });
    }

    const { title, category, price_per_day, fuel, transmission, tags, image, description, location, vendor_phone } = req.body;

    if (!title || !price_per_day || !image) {
      return res.status(400).json({ success: false, message: 'Title, Price per day, and Image URL are required.' });
    }

    const validCategory = ['Car', 'Bike', 'Scooter'].includes(category) ? category : 'Bike';
    const vendorName = req.user.name || 'Campus Vendor';
    const defaultImage = image || 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80';
    const rawHeaderId = req.headers['x-user-id'] ? String(req.headers['x-user-id']).trim() : '';
    const vendorUserIdStr = String(req.user?.uuid || req.user?.email || req.user?.id || rawHeaderId || 'vendor_' + Date.now());
    let vendorPhoneVal = vendor_phone || req.user?.phone_number || req.user?.phone || null;
    if (vendorPhoneVal) {
      const d = String(vendorPhoneVal).replace(/\D/g,'');
      if (d.length===10) vendorPhoneVal = `+91${d}`;
      else if (d.length===12 && d.startsWith('91')) vendorPhoneVal = `+${d}`;
      else if (d) vendorPhoneVal = `+${d}`;
    }

    const result = await query(
      `INSERT INTO rentals 
       (vendor_user_id, title, vendor, category, price_per_day, rating, total_ratings, distance, fuel, transmission, tags, image, description, location, vendor_phone, is_available, status) 
       VALUES (?, ?, ?, ?, ?, 5.0, 1, '0.5 km away', ?, ?, ?, ?, ?, ?, ?, TRUE, 'ACTIVE')`,
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
        location || 'Sanquelim / GIM Gate',
        vendorPhoneVal
      ]
    );

    const newId = result.insertId;

    // IMMEDIATE BACKEND PERSISTENCE VERIFICATION
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
    const rentals = await query('SELECT vendor_user_id FROM rentals WHERE id = ? AND status != \'DELETED\'', [id]);
    if (rentals.length === 0) {
      return res.status(404).json({ success: false, message: 'Vehicle not found.' });
    }
    const ownerId = String(rentals[0].vendor_user_id);
    const requesterId = String(req.user.id || req.user.uuid);
    const requesterEmail = req.user.email ? String(req.user.email) : '';
    const isOwner = ownerId === requesterId || ownerId === String(req.user.uuid) || ownerId === requesterEmail;
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(req.user.role);
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden. You do not own this vehicle.' });
    }
    await query('UPDATE rentals SET is_available = NOT is_available WHERE id = ?', [id]);
    res.json({ success: true, message: 'Vehicle availability updated.' });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/rentals/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(req.user.role);
    if (isAdmin) {
      await query("UPDATE rentals SET status = 'DELETED', is_available = FALSE, deleted_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
    } else {
      const requesterIds = [String(req.user.id), String(req.user.uuid), req.user.email ? String(req.user.email) : ''].filter(Boolean);
      // Verify ownership before soft-delete
      const rentals = await query('SELECT vendor_user_id FROM rentals WHERE id = ? AND status != \'DELETED\'', [id]);
      if (rentals.length === 0) {
        return res.status(404).json({ success: false, message: 'Vehicle not found.' });
      }
      const ownerId = String(rentals[0].vendor_user_id);
      if (!requesterIds.includes(ownerId)) {
        return res.status(403).json({ success: false, message: 'Forbidden. You do not own this vehicle.' });
      }
      await query("UPDATE rentals SET status = 'DELETED', is_available = FALSE, deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND vendor_user_id = ?", [id, ownerId]);
    }
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

    // SERVER-SIDE PRICING CALCULATION (SINGLE SOURCE OF TRUTH)
    const dailyRate = parseFloat(rental.price_per_day || rental.price || 350);
    const baseTotal = dailyRate * daysNum;
    const deposit = rental.category === 'Car' ? 2000.00 : 500.00;
    const serviceFee = 50.00;
    const gstAmount = Math.round((baseTotal + serviceFee) * 0.18);
    const totalAmount = baseTotal + deposit + serviceFee + gstAmount;
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
      console.error('[RAZORPAY_ORDER_CREATE_ERROR]', rzpErr);
      if (ENV.RAZORPAY.KEY_ID && !ENV.RAZORPAY.KEY_ID.includes('dummy') && process.env.NODE_ENV === 'production') {
        return res.status(400).json({
          success: false,
          message: `Razorpay Gateway Error: ${rzpErr.message || 'Order creation rejected by payment gateway'}`
        });
      }
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
        baseTotal,
        deposit,
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
      pricing: {
        daily_rate: dailyRate,
        days: daysNum,
        base_total: baseTotal,
        deposit,
        service_fee: serviceFee,
        gst_amount: gstAmount,
        total_amount: totalAmount
      },
      breakdown: {
        dailyRate,
        daysNum,
        rentalAmount: baseTotal,
        securityDeposit: deposit,
        serviceFee,
        gstAmount,
        totalAmount
      }
    });
  } catch (err) {
    next(err);
  }
});

app.post('/api/payments/verify', authenticateToken, async (req, res, next) => {
  try {
    const { booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const userId = String(req.user.id || req.user.uuid);

    // Reject mock order bypass in production
    if (razorpay_order_id && razorpay_order_id.startsWith('order_mock_') && process.env.NODE_ENV === 'production' && ENV.RAZORPAY.KEY_ID && !ENV.RAZORPAY.KEY_ID.includes('dummy')) {
      return res.status(400).json({ success: false, message: 'Mock payment not allowed in production.' });
    }

    let isSignatureValid = true;

    if (razorpay_signature && razorpay_order_id && !razorpay_order_id.startsWith('order_mock_')) {
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
       WHERE (ub.user_id = ? OR ub.user_id = ? OR ub.user_id = ?) ORDER BY ep.id DESC`,
      [userId || '0', userUuid || '0', userEmail || '0']
    );
    res.json(bookmarks);
  } catch (err) {
    next(err);
  }
});

app.post('/api/bookmarks/:placeId/toggle', async (req, res, next) => {
  try {
    if (!checkWritePersistence(res)) return;

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
      try {
        await query('INSERT INTO user_bookmarks (user_id, place_id) VALUES (?, ?)', [targetId, placeId]);
      } catch (insertErr) {
        if (!insertErr.message?.includes('ER_DUP_ENTRY')) {
          throw insertErr;
        }
      }
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

app.post('/api/explore', async (req, res, next) => {
  try {
    if (!checkWritePersistence(res)) return;
    const { name, category, rating, distance, price, image, description, maps_url, best_time, est_cost, pro_tips } = req.body;
    const trimmedName = String(name || '').trim();
    if (!trimmedName || !image || !description) {
      return res.status(400).json({ success: false, message: 'Name, image URL and description are required.' });
    }
    const dup = await query('SELECT id FROM explore_places WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1', [trimmedName]);
    if (dup && dup.length > 0) {
      return res.status(409).json({ success: false, message: `Place "${trimmedName}" already exists — duplicate not allowed.` });
    }
    const allowed = ['Beaches','Food','Nightlife','Waterfalls','Shopping','Forts','Heritage','Adventure'];
    const validCategory = allowed.includes(category) ? category : (category ? String(category).trim().slice(0,30) : 'Beaches');
    const result = await query(
      `INSERT INTO explore_places (name, category, rating, distance, price, image, description, maps_url, best_time, est_cost, pro_tips, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [trimmedName, validCategory, parseFloat(rating)||4.5, distance||'', price||est_cost||'₹400 / person', image, description, maps_url||null, best_time||'5:00 PM – 7:00 PM', est_cost||price||'₹400 / person', pro_tips||'']
    );
    const createdRows = await query('SELECT * FROM explore_places WHERE id = ?', [result.insertId]);
    const created = createdRows[0] || { id: result.insertId, name: trimmedName, category: validCategory, image, description };
    res.status(201).json({ success: true, message: 'Place added successfully', id: result.insertId, data: created, place: created });
  } catch (err) { next(err); }
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
    const userId = req.headers['x-user-id'] ? String(req.headers['x-user-id']).trim() : '';
    const userUuid = req.headers['x-user-uuid'] ? String(req.headers['x-user-uuid']).trim() : '';
    const userEmail = req.headers['x-user-email'] ? String(req.headers['x-user-email']).trim() : '';
    const targetId = userId || userUuid || userEmail;

    if (isInMemoryFallback) {
      let filtered = memoryStore.travel_trips.filter(t => t.status !== 'CANCELLED');
      if (destination && destination.trim()) {
        const d = destination.trim().toLowerCase();
        filtered = filtered.filter(t => (t.destination || '').toLowerCase().includes(d) || (t.title || '').toLowerCase().includes(d) || (t.pickup || '').toLowerCase().includes(d));
      }
      const joinedTripIds = new Set(
        targetId
          ? memoryStore.trip_participants.filter(p => String(p.user_id) === targetId && p.status === 'JOINED').map(p => Number(p.trip_id))
          : []
      );
      const result = filtered.map(t => ({
        ...t,
        is_joined: joinedTripIds.has(Number(t.id)) || Boolean(t.is_joined)
      }));
      return res.json(result);
    }

    let sql = `
      SELECT tt.*, 
             FALSE AS is_joined 
      FROM travel_trips tt 
      WHERE tt.status != 'CANCELLED'
    `;
    let params = [];

    if (targetId) {
      sql = `
        SELECT tt.*, 
               EXISTS(
                 SELECT 1 FROM trip_participants tp 
                 WHERE tp.trip_id = tt.id 
                   AND tp.status = 'JOINED' 
                   AND (tp.user_id = ? OR tp.user_id = ? OR tp.user_id = ?)
               ) AS is_joined 
        FROM travel_trips tt 
        WHERE tt.status != 'CANCELLED'
      `;
      params = [userId || '0', userUuid || '0', userEmail || '0'];
    }

    if (destination && destination.trim()) {
      sql += ' AND (tt.destination LIKE ? OR tt.title LIKE ? OR tt.pickup LIKE ?)';
      const d = `%${destination.trim()}%`;
      params.push(d, d, d);
    }

    sql += ' ORDER BY tt.id DESC';
    const trips = await query(sql, params);
    const result = trips.map(t => ({
      ...t,
      is_joined: Boolean(t.is_joined)
    }));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.post('/api/trips', async (req, res, next) => {
  try {
    if (!checkWritePersistence(res)) return;

    const { title, destination, pickup, date_time, seats_total, vehicle_type, cost, description, userName, userInitials, batchInfo, userId, contact_phone } = req.body;
    
    const hostId = userId ? String(userId) : (req.headers['x-user-id'] ? String(req.headers['x-user-id']) : null);
    const seatsTotalNum = parseInt(seats_total, 10) || 4;
    let normalizedContact = null;
    if (contact_phone) {
      const digits = String(contact_phone).replace(/\D/g, '');
      if (digits.length === 10) normalizedContact = `+91${digits}`;
      else if (digits.length === 12 && digits.startsWith('91')) normalizedContact = `+${digits}`;
      else if (digits.length >= 10) normalizedContact = `+${digits}`;
      else normalizedContact = String(contact_phone).trim();
    }
    if (!normalizedContact) {
      const fallbackPhone = req.user?.phone_number || req.user?.phone || '';
      if (fallbackPhone) {
        const d = String(fallbackPhone).replace(/\D/g, '');
        if (d.length === 10) normalizedContact = `+91${d}`;
        else if (d.length >= 10) normalizedContact = `+${d}`;
      }
    }

    const result = await query(
      `INSERT INTO travel_trips 
       (host_user_id, user_name, user_initials, batch_info, title, destination, pickup, date_time, seats_left, seats_total, vehicle_type, cost, description, contact_phone, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
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
        description || '',
        normalizedContact
      ]
    );

    const insertedTrips = await query('SELECT * FROM travel_trips WHERE id = ?', [result.insertId]);
    const createdTrip = insertedTrips[0] || {
      id: result.insertId,
      host_user_id: hostId,
      user_name: userName || 'Campus User',
      user_initials: userInitials || 'CU',
      batch_info: batchInfo || 'PGDM 2026',
      title,
      destination: destination || title,
      pickup: pickup || 'GIM Main Gate',
      date_time,
      seats_left: seatsTotalNum,
      seats_total: seatsTotalNum,
      vehicle_type: vehicle_type || 'Cab',
      cost: cost || '₹400 each',
      description: description || '',
      contact_phone: normalizedContact,
      status: 'ACTIVE'
    };

    res.status(201).json({ success: true, id: result.insertId, data: createdTrip });
  } catch (err) {
    next(err);
  }
});

app.patch('/api/trips/:id', async (req, res, next) => {
  try {
    if (!checkWritePersistence(res)) return;
    const { id } = req.params;
    const tripId = parseInt(id, 10);

    if (isNaN(tripId)) {
      return res.status(400).json({ success: false, message: 'Invalid trip ID.' });
    }

    const hostIdStr = req.user?.id
      ? String(req.user.id)
      : (req.headers['x-user-id'] ? String(req.headers['x-user-id']).trim() : '');

    if (!hostIdStr) {
      return res.status(401).json({ success: false, message: 'Authentication required to update ride.' });
    }

    const trips = await query('SELECT * FROM travel_trips WHERE id = ?', [tripId]);
    if (trips.length === 0) {
      return res.status(404).json({ success: false, message: 'Trip not found.' });
    }

    const trip = trips[0];
    const isOwner = String(trip.host_user_id) === hostIdStr || req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';

    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Forbidden. Only the ride host can update ride details.' });
    }

    const { title, destination, pickup, date_time, cost, description } = req.body;

    const newTitle = title !== undefined ? title : trip.title;
    const newDestination = destination !== undefined ? destination : (trip.destination || trip.title);
    const newPickup = pickup !== undefined ? pickup : trip.pickup;
    const newDateTime = date_time !== undefined ? date_time : trip.date_time;
    const newCost = cost !== undefined ? cost : trip.cost;
    const newDescription = description !== undefined ? description : trip.description;

    await query(
      `UPDATE travel_trips SET 
       title = COALESCE(?, title), 
       destination = COALESCE(?, destination), 
       pickup = COALESCE(?, pickup), 
       date_time = COALESCE(?, date_time), 
       cost = COALESCE(?, cost), 
       description = COALESCE(?, description) 
       WHERE id = ?`,
      [title || null, destination || null, pickup || null, date_time || null, cost || null, description || null, tripId]
    );

    // Targeted notification to existing joined participants
    const participants = await query(
      'SELECT DISTINCT user_id FROM trip_participants WHERE trip_id = ? AND status = "JOINED" AND user_id != ?',
      [tripId, hostIdStr]
    );

    for (const p of participants) {
      if (p.user_id) {
        await query(
          'INSERT INTO user_notifications (user_id, type, title, message, entity_type, entity_id) VALUES (?, "TRIP_UPDATE", ?, ?, "TRIP", ?)',
          [
            String(p.user_id),
            `🚕 Ride Updated: ${newDestination}`,
            `${trip.user_name || 'Host'} updated ride details for "${newTitle}". New drop-off: ${newDestination}`,
            String(tripId)
          ]
        );
      }
    }

    const updatedTrips = await query('SELECT * FROM travel_trips WHERE id = ?', [tripId]);
    const updatedTrip = updatedTrips[0] || { ...trip, title: newTitle, destination: newDestination, pickup: newPickup, date_time: newDateTime, cost: newCost, description: newDescription };

    res.json({
      success: true,
      message: 'Ride details updated successfully!',
      data: updatedTrip
    });
  } catch (err) {
    next(err);
  }
});

// CONCURRENT JOIN WITH ROW LOCKING
app.post('/api/trips/:id/join', async (req, res, next) => {
  try {
    if (!checkWritePersistence(res)) return;

    const { id } = req.params;
    const { userName, userId } = req.body;
    const uidStr = userId ? String(userId) : (req.headers['x-user-id'] ? String(req.headers['x-user-id']).trim() : null);
    const name = userName || req.headers['x-user-name'] || 'Student';

    if (!uidStr) {
      return res.status(401).json({ success: false, message: 'Authentication required to join rides.' });
    }

    if (isInMemoryFallback) {
      const existingIndex = memoryStore.trip_participants.findIndex(p => Number(p.trip_id) === Number(id) && String(p.user_id) === String(uidStr));
      if (existingIndex >= 0 && memoryStore.trip_participants[existingIndex].status === 'JOINED') {
        return res.status(409).json({ success: false, message: 'You have already joined this ride!' });
      }
      const t = memoryStore.travel_trips.find(x => Number(x.id) === Number(id));
      if (!t || t.seats_left <= 0 || t.status === 'FULL' || t.status === 'CANCELLED') {
        return res.status(409).json({ success: false, message: 'This ride is already full or cancelled!' });
      }
      t.seats_left = Math.max(0, t.seats_left - 1);
      if (t.seats_left === 0) t.status = 'FULL';
      if (existingIndex >= 0) {
        memoryStore.trip_participants[existingIndex].status = 'JOINED';
      } else {
        memoryStore.trip_participants.push({ id: memoryStore.trip_participants.length + 1, trip_id: Number(id), user_id: String(uidStr), user_name: name, status: 'JOINED' });
      }
      if (t.host_user_id && String(t.host_user_id) !== String(uidStr)) {
        memoryStore.user_notifications.push({
          id: memoryStore.user_notifications.length + 1,
          user_id: String(t.host_user_id),
          type: 'JOIN_TRIP',
          title: `🚕 ${name} Joined Your Ride`,
          message: `${name} joined your travel pool: "${t.title}" (${t.date_time})`,
          entity_type: 'TRIP',
          entity_id: String(id),
          is_read: false,
          created_at: new Date().toISOString()
        });
      }
      return res.json({ success: true, message: 'Joined trip successfully!', trip_id: Number(id), is_joined: true, seats_left: t.seats_left, status: t.status });
    }

    let updatedSeatsLeft = 0;
    let updatedStatus = 'ACTIVE';

    // MySQL Pessimistic Row Lock & Transaction
    await withTransaction(async (conn) => {
      const [trips] = await conn.query('SELECT * FROM travel_trips WHERE id = ? FOR UPDATE', [id]);
      if (trips.length === 0) {
        const err = new Error('Trip not found.');
        err.statusCode = 404;
        throw err;
      }

      const trip = trips[0];
      if (trip.status === 'CANCELLED') {
        const err = new Error('This ride has been cancelled.');
        err.statusCode = 409;
        throw err;
      }

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
        'INSERT INTO trip_participants (trip_id, user_id, user_name, seats_joined, status) VALUES (?, ?, ?, 1, "JOINED") ON DUPLICATE KEY UPDATE status = "JOINED", user_name = ?',
        [id, uidStr, name, name]
      );

      updatedSeatsLeft = Math.max(0, trip.seats_left - 1);
      updatedStatus = updatedSeatsLeft === 0 ? 'FULL' : 'ACTIVE';

      await conn.query(
        'UPDATE travel_trips SET seats_left = ?, status = ? WHERE id = ?',
        [updatedSeatsLeft, updatedStatus, id]
      );

      // Target notification specifically to host_user_id (entity_type='TRIP', entity_id=id)
      if (trip.host_user_id && String(trip.host_user_id) !== String(uidStr)) {
        await conn.query(
          'INSERT INTO user_notifications (user_id, type, title, message, entity_type, entity_id) VALUES (?, "JOIN_TRIP", ?, ?, "TRIP", ?)',
          [
            String(trip.host_user_id),
            `🚕 ${name} Joined Your Ride`,
            `${name} joined your travel pool: "${trip.title}" (${trip.date_time})`,
            String(id)
          ]
        );
      }
    });

    res.json({
      success: true,
      message: 'Joined trip successfully!',
      trip_id: Number(id),
      is_joined: true,
      seats_left: updatedSeatsLeft,
      status: updatedStatus
    });
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
    if (!checkWritePersistence(res)) return;
    const { id } = req.params;
    const uidStr = req.headers['x-user-id'] ? String(req.headers['x-user-id']).trim() : null;

    if (!uidStr) {
      return res.status(401).json({ success: false, message: 'Authentication required to leave ride.' });
    }

    if (isInMemoryFallback) {
      const part = memoryStore.trip_participants.find(p => Number(p.trip_id) === Number(id) && String(p.user_id) === String(uidStr));
      if (part) part.status = 'LEFT';
      const t = memoryStore.travel_trips.find(x => Number(x.id) === Number(id));
      if (t) {
        t.seats_left = Math.min(t.seats_total, t.seats_left + 1);
        if (t.status === 'FULL') t.status = 'ACTIVE';
      }
      return res.json({ success: true, message: 'Left ride successfully!', trip_id: Number(id), is_joined: false, seats_left: t?.seats_left, status: t?.status });
    }

    let updatedSeatsLeft = 0;
    let updatedStatus = 'ACTIVE';

    await withTransaction(async (conn) => {
      const [trips] = await conn.query('SELECT * FROM travel_trips WHERE id = ? FOR UPDATE', [id]);
      if (trips.length === 0) throw new Error('Trip not found.');

      const trip = trips[0];
      await conn.query(
        'UPDATE trip_participants SET status = "LEFT" WHERE trip_id = ? AND user_id = ?',
        [id, uidStr]
      );

      updatedSeatsLeft = Math.min(trip.seats_total, trip.seats_left + 1);
      updatedStatus = updatedSeatsLeft > 0 ? 'ACTIVE' : trip.status;

      await conn.query(
        'UPDATE travel_trips SET seats_left = ?, status = ? WHERE id = ?',
        [updatedSeatsLeft, updatedStatus, id]
      );
    });

    res.json({
      success: true,
      message: 'Left ride successfully.',
      trip_id: Number(id),
      is_joined: false,
      seats_left: updatedSeatsLeft,
      status: updatedStatus
    });
  } catch (err) {
    next(err);
  }
});

// ----------------- RIDE MESSAGING ROUTES -----------------
app.get('/api/trips/:id/messages', async (req, res, next) => {
  try {
    const { id } = req.params;
    const tripId = parseInt(id, 10);

    if (isNaN(tripId)) {
      return res.status(400).json({ success: false, message: 'Invalid trip ID.' });
    }

    const messages = await query(
      'SELECT id, trip_id, sender_user_id, sender_name, receiver_user_id, message, is_read, created_at FROM trip_messages WHERE trip_id = ? ORDER BY id ASC',
      [tripId]
    );

    res.json(messages);
  } catch (err) {
    next(err);
  }
});

app.post('/api/trips/:id/messages', async (req, res, next) => {
  try {
    const { id } = req.params;
    const tripId = parseInt(id, 10);
    const { message } = req.body;

    if (isNaN(tripId) || !message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Trip ID and message text are required.' });
    }

    // Authenticated identity conventions from session or headers
    const senderUserId = req.user?.id ? String(req.user.id) : (req.headers['x-user-id'] ? String(req.headers['x-user-id']).trim() : '');
    const senderName = req.user?.name || req.headers['x-user-name'] || req.body.userName || 'Student User';

    if (!senderUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required to send ride messages.' });
    }

    // Retrieve target trip details for host user id and trip title
    const trips = await query('SELECT host_user_id, title FROM travel_trips WHERE id = ?', [tripId]);
    const trip = trips[0] || { host_user_id: null, title: 'Ride' };
    const receiverUserId = trip.host_user_id ? String(trip.host_user_id) : null;

    const trimmedMsg = message.trim();

    const result = await query(
      'INSERT INTO trip_messages (trip_id, sender_user_id, sender_name, receiver_user_id, message) VALUES (?, ?, ?, ?, ?)',
      [tripId, senderUserId, senderName, receiverUserId, trimmedMsg]
    );

    const newMessageObj = {
      id: result.insertId,
      trip_id: tripId,
      sender_user_id: senderUserId,
      sender_name: senderName,
      receiver_user_id: receiverUserId,
      message: trimmedMsg,
      is_read: false,
      created_at: new Date().toISOString()
    };

    // Create targeted notification for the ride host if sender is not the host
    if (receiverUserId && receiverUserId !== senderUserId) {
      await query(
        'INSERT INTO user_notifications (user_id, type, title, message, entity_type, entity_id) VALUES (?, "TRIP_MESSAGE", ?, ?, "TRIP", ?)',
        [
          receiverUserId,
          `💬 New message from ${senderName} on "${trip.title}"`,
          `"${trimmedMsg.substring(0, 80)}${trimmedMsg.length > 80 ? '...' : ''}"`,
          String(tripId)
        ]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully!',
      data: newMessageObj
    });
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

freePort(PORT);

const server = app.listen(PORT, () => {
  console.log(`🚀 GoMove Express Server listening on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ PORT ${PORT} IS ALREADY IN USE BY ANOTHER PROCESS!`);
    console.error(`💡 Free the port in PowerShell: Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force\n`);
  } else {
    console.error('Server error:', err);
  }
});
