import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase, query, logActivity } from './db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Middleware to log API request activities automatically to MySQL
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') && !req.path.includes('/activities')) {
    const activityName = `${req.method} ${req.path}`;
    logActivity(
      req.headers['x-user-id'] || null,
      req.headers['x-user-name'] || 'Guest',
      'API_REQUEST',
      activityName,
      JSON.stringify(req.body || {})
    ).catch(err => console.error('Error logging activity:', err));
  }
  next();
});

// Initialize MySQL database connection
initDatabase();

// ----------------- AUTH ROUTES -----------------
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, batch, section, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, Email and Password are required' });
    }
    
    // Check existing user in MySQL
    const existing = await query('SELECT * FROM users WHERE email = ?', [email]);
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'An account with this email already exists. Please Log In.' });
    }

    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || 'US';
    
    const result = await query(
      'INSERT INTO users (name, email, avatar, batch, section, phone, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, email, initials, batch || 'PGDM 2026', section || 'Sec A', phone || '', password]
    );

    const user = {
      id: result.insertId || Date.now(),
      name,
      email,
      avatar: initials,
      batch: batch || 'PGDM 2026',
      section: section || 'Sec A',
      phone: phone || '',
      auth_method: 'email'
    };

    // Log User Signup event to MySQL database
    await logActivity(user.id, user.name, 'USER_SIGNUP', `New user signed up: ${user.name} (${user.email})`, JSON.stringify({ batch: user.batch, section: user.section }));
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const users = await query('SELECT * FROM users WHERE email = ?', [email]);
    if (!users || users.length === 0) {
      return res.status(401).json({ error: 'Account not found. Please Sign Up first.' });
    }
    
    const user = users[0];
    if (user.password_hash !== password) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    delete user.password_hash;
    user.auth_method = 'email';

    // Log User Login event to MySQL database
    await logActivity(user.id, user.name, 'USER_LOGIN', `User logged in: ${user.name} (${user.email})`);
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Google OAuth Endpoint
app.post('/api/auth/google', async (req, res) => {
  try {
    const { email, name, googleId } = req.body;
    if (!email || !name) {
      return res.status(400).json({ error: 'Google Account Profile data required' });
    }

    const users = await query('SELECT * FROM users WHERE email = ?', [email]);
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || 'GO';

    if (users && users.length > 0) {
      const user = users[0];
      delete user.password_hash;
      user.auth_method = 'google';
      await logActivity(user.id, user.name, 'USER_GOOGLE_LOGIN', `User logged in via Google OAuth: ${user.name} (${user.email})`);
      return res.json({ success: true, user });
    } else {
      // Auto Sign Up via Google OAuth into MySQL database
      const result = await query(
        'INSERT INTO users (name, email, avatar, batch, section, phone, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, email, initials, 'PGDM 2026', 'Sec B', '', `google_oauth_${googleId || Date.now()}`]
      );

      const user = {
        id: result.insertId || Date.now(),
        name,
        email,
        avatar: initials,
        batch: 'PGDM 2026',
        section: 'Sec B',
        phone: '',
        auth_method: 'google'
      };

      await logActivity(user.id, user.name, 'USER_GOOGLE_SIGNUP', `New user registered via Google OAuth: ${user.name} (${user.email})`);
      return res.json({ success: true, user });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------- RENTALS ROUTES -----------------
app.get('/api/rentals', async (req, res) => {
  try {
    const rentals = await query('SELECT * FROM rentals ORDER BY id ASC');
    res.json(rentals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/rentals/:id/book', async (req, res) => {
  try {
    const { id } = req.params;
    const { userName, userId, days } = req.body;
    
    const rentals = await query('SELECT * FROM rentals WHERE id = ?', [id]);
    const vehicle = rentals[0] || { title: `Vehicle #${id}` };

    await logActivity(
      userId || req.headers['x-user-id'] || null,
      userName || req.headers['x-user-name'] || 'User',
      'RENTAL_BOOKING',
      `Booked vehicle ${vehicle.title} for ${days || 1} day(s)`,
      JSON.stringify({ vehicleId: id, vehicleTitle: vehicle.title, days, pricePerDay: vehicle.price_per_day })
    );

    res.json({ success: true, message: `Successfully booked ${vehicle.title}!` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------- EXPLORE PLACES ROUTES -----------------
app.get('/api/explore', async (req, res) => {
  try {
    const places = await query('SELECT * FROM explore_places ORDER BY id ASC');
    res.json(places);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/explore/:id/bookmark', async (req, res) => {
  try {
    const { id } = req.params;
    await query('UPDATE explore_places SET is_bookmarked = NOT is_bookmarked WHERE id = ?', [id]);
    
    await logActivity(
      req.headers['x-user-id'] || null,
      req.headers['x-user-name'] || 'User',
      'TOGGLE_BOOKMARK',
      `Toggled bookmark for place ID #${id}`
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------- TRAVEL TRIPS (RIDE SHARING) ROUTES -----------------
app.get('/api/trips', async (req, res) => {
  try {
    const trips = await query('SELECT * FROM travel_trips ORDER BY id DESC');
    res.json(trips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trips', async (req, res) => {
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

    await logActivity(
      userId || req.headers['x-user-id'] || null,
      userName || req.headers['x-user-name'] || 'User',
      'POST_TRIP',
      `Created new travel buddy ride: ${title}`,
      JSON.stringify({ pickup, date_time, seats_total, cost })
    );

    res.json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trips/:id/join', async (req, res) => {
  try {
    const { id } = req.params;
    const { userName, userId } = req.body;
    
    await query('UPDATE travel_trips SET seats_left = GREATEST(seats_left - 1, 0) WHERE id = ?', [id]);
    
    await logActivity(
      userId || req.headers['x-user-id'] || null,
      userName || req.headers['x-user-name'] || 'User',
      'JOIN_TRIP',
      `Joined travel ride ID #${id}`,
      JSON.stringify({ tripId: id })
    );

    res.json({ success: true, message: 'Joined trip successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------- USER ACTIVITY LOGS (Backend) -----------------
app.get('/api/activities', async (req, res) => {
  try {
    const activities = await query('SELECT * FROM user_activities ORDER BY timestamp DESC LIMIT 50');
    res.json(activities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/activity', async (req, res) => {
  try {
    const { userId, userName, type, description, details } = req.body;
    await logActivity(userId || null, userName || 'User', type || 'USER_ACTION', description || 'User interaction', details || '');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
