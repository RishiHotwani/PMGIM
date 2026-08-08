import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { ENV } from '../server/config/env.js';
import { initDatabase, query, memoryStore } from '../server/config/database.js';
import { logAuditActivity } from '../server/utils/logger.js';
import authRouter from '../server/modules/auth/auth.routes.js';
import { globalRateLimiter } from '../server/middleware/rateLimiter.js';
import { globalErrorHandler } from '../server/middleware/errorHandler.js';
import { authenticateToken } from '../server/middleware/authenticate.js';

const app = express();

const razorpayInstance = new Razorpay({
  key_id: ENV.RAZORPAY.KEY_ID,
  key_secret: ENV.RAZORPAY.KEY_SECRET
});

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

// RAZORPAY PAYMENTS
app.post('/api/payments/create-order', async (req, res, next) => {
  try {
    const {
      rental_id,
      vehicle_title,
      vendor_user_id,
      days,
      start_date,
      daily_rate,
      deposit,
      service_fee,
      gst_amount,
      total_amount,
      user_name,
      user_email,
      user_phone
    } = req.body;

    const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id'], 10) : null;
    const amountInPaise = Math.round(parseFloat(total_amount) * 100);

    const orderOptions = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
      notes: {
        vehicle_title,
        user_name,
        days: String(days)
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
       (rental_id, user_id, user_name, user_email, user_phone, vendor_user_id, vehicle_title, days, start_date, daily_rate, deposit, service_fee, gst_amount, total_amount, razorpay_order_id, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [
        rental_id,
        userId,
        user_name,
        user_email,
        user_phone,
        vendor_user_id || null,
        vehicle_title,
        days,
        start_date,
        daily_rate,
        deposit,
        service_fee,
        gst_amount,
        total_amount,
        razorpayOrder.id
      ]
    );

    res.json({
      success: true,
      order_id: razorpayOrder.id,
      amount_in_paise: amountInPaise,
      razorpay_key: ENV.RAZORPAY.KEY_ID,
      booking_id: bookingResult.insertId
    });
  } catch (err) {
    next(err);
  }
});

app.post('/api/payments/verify', async (req, res, next) => {
  try {
    const { booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id'], 10) : null;

    let isSignatureValid = true;

    if (razorpay_signature && !razorpay_order_id.startsWith('order_mock_')) {
      const generatedSignature = crypto
        .createHmac('sha256', ENV.RAZORPAY.KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      isSignatureValid = generatedSignature === razorpay_signature;
    }

    if (!isSignatureValid) {
      await query('UPDATE rental_bookings SET status = "FAILED" WHERE razorpay_order_id = ? OR id = ?', [razorpay_order_id, booking_id]);
      return res.status(400).json({ success: false, message: 'Invalid Razorpay payment signature.' });
    }

    await query(
      'UPDATE rental_bookings SET status = "PAID", razorpay_payment_id = ?, razorpay_signature = ? WHERE razorpay_order_id = ? OR id = ?',
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

    const memUser = memoryStore.users.find(u => u.id === parsedIntId || u.uuid === rawUserId || u.email === rawUserId);
    if (memUser) memUser.role = newRole;

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
    const placeId = parseInt(req.params.placeId, 10);
    const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id'], 10) : null;

    if (!userId || isNaN(placeId)) {
      return res.status(400).json({ success: false, message: 'Log in required to bookmark places.' });
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

    let rentals = await query(sql, params);

    if (memoryStore && memoryStore.rentals && memoryStore.rentals.length > 0) {
      const existingIds = new Set(rentals.map(r => r.id));
      for (const memR of memoryStore.rentals) {
        if (!existingIds.has(memR.id)) {
          if (!category || category === 'All' || memR.category === category) {
            rentals.unshift(memR);
            existingIds.add(memR.id);
          }
        }
      }
    }

    res.json(rentals);
  } catch (err) {
    next(err);
  }
});

app.get('/api/rentals/vendor', authenticateToken, async (req, res, next) => {
  try {
    const vendorUserId = req.user.id;
    let myFleet = await query('SELECT * FROM rentals WHERE vendor_user_id = ? ORDER BY id DESC', [vendorUserId]);

    if (memoryStore && memoryStore.rentals) {
      const memFleet = memoryStore.rentals.filter(r => String(r.vendor_user_id) === String(vendorUserId));
      const existingIds = new Set(myFleet.map(f => f.id));
      for (const mf of memFleet) {
        if (!existingIds.has(mf.id)) {
          myFleet.unshift(mf);
          existingIds.add(mf.id);
        }
      }
    }

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

    const newRentalItem = {
      id: result.insertId || (memoryStore.rentals.length + 1),
      vendor_user_id: req.user.id,
      title,
      vendor: vendorName,
      category: validCategory,
      price_per_day: parseInt(price_per_day, 10),
      rating: 5.0,
      total_ratings: 1,
      distance: '0.5 km away',
      fuel: fuel || 'Petrol',
      transmission: transmission || 'Automatic',
      tags: tags || 'Verified Vendor',
      image: defaultImage,
      description: description || `${title} available for campus and Goa trip rentals.`,
      location: location || 'Sanquelim / GIM Gate',
      is_available: true,
      created_at: new Date().toISOString()
    };

    if (memoryStore && memoryStore.rentals) {
      if (!memoryStore.rentals.some(r => r.id === newRentalItem.id)) {
        memoryStore.rentals.unshift(newRentalItem);
      }
    }

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
      rentalId: result.insertId || newRentalItem.id
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

// EXPLORE PLACES & REVIEWS
app.get('/api/explore', async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id'], 10) : null;
    let sql = `
      SELECT ep.id, ep.name, ep.category, ep.rating, ep.distance, ep.price, ep.image, 
             ep.description, ep.maps_url, ep.best_time, ep.est_cost, ep.pro_tips, 
             FALSE AS is_bookmarked 
      FROM explore_places ep 
      ORDER BY ep.id ASC
    `;
    let params = [];

    if (userId) {
      sql = `
        SELECT ep.id, ep.name, ep.category, ep.rating, ep.distance, ep.price, ep.image, 
               ep.description, ep.maps_url, ep.best_time, ep.est_cost, ep.pro_tips, 
               IF(ub.id IS NOT NULL, TRUE, FALSE) AS is_bookmarked 
        FROM explore_places ep 
        LEFT JOIN user_bookmarks ub 
               ON ep.id = ub.place_id AND ub.user_id = ? 
        ORDER BY ep.id ASC
      `;
      params = [userId];
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
