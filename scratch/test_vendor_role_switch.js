import * as database from '../server/config/database.js';

async function testRoleSwitchFlow() {
  console.log('=== TESTING VENDOR VEHICLE CREATION AND ROLE SWITCH ===');
  await database.initDatabase();

  // Step 1: User 1 exists with role VENDOR
  const userRows = await database.query('SELECT * FROM users WHERE email = ?', ['testvendor@gim.ac.in']);
  let userId;
  if (userRows.length === 0) {
    const res = await database.query(
      'INSERT INTO users (uuid, name, email, role, password_hash, is_active) VALUES (?, ?, ?, ?, ?, TRUE)',
      ['uuid_vendor_1', 'Test Vendor', 'testvendor@gim.ac.in', 'VENDOR', 'hash123']
    );
    userId = String(res.insertId);
  } else {
    userId = String(userRows[0].id);
    await database.query('UPDATE users SET role = "VENDOR" WHERE id = ?', [userId]);
  }
  console.log(`[USER_SETUP] User ID: ${userId}, Role: VENDOR`);

  // Step 2: Vendor creates vehicle
  const insertRes = await database.query(
    `INSERT INTO rentals 
     (vendor_user_id, title, vendor, category, price_per_day, rating, total_ratings, distance, fuel, transmission, tags, image, description, location, is_available, status) 
     VALUES (?, ?, ?, ?, ?, 5.0, 1, '0.5 km away', ?, ?, ?, ?, ?, ?, TRUE, 'ACTIVE')`,
    [userId, 'Test Activa 7G', 'Test Vendor Fleet', 'Scooter', 400, 'Petrol', 'Automatic', 'Verified', 'http://example.com/image.jpg', 'Test desc', 'GIM Gate']
  );
  const vehicleId = insertRes.insertId;
  console.log(`[VEHICLE_CREATED] Vehicle ID: ${vehicleId}, vendor_user_id: ${userId}`);

  // Step 3: Fetch vendor fleet
  const vendorFleet = await database.query(
    'SELECT * FROM rentals WHERE (vendor_user_id = ? OR vendor_user_id IS NULL) AND status != "DELETED"',
    [userId]
  );
  console.log(`[VENDOR_FLEET_CHECK] Count: ${vendorFleet.length}, found vehicle:`, vendorFleet.some(v => v.id === vehicleId));

  // Step 4: Fetch public rentals while VENDOR
  const publicRentalsVendorMode = await database.query(
    'SELECT * FROM rentals WHERE status != "DELETED" ORDER BY id DESC'
  );
  console.log(`[PUBLIC_RENTALS_VENDOR_MODE] Count: ${publicRentalsVendorMode.length}, found vehicle:`, publicRentalsVendorMode.some(v => v.id === vehicleId));

  // Step 5: User switches role VENDOR -> USER
  await database.query('UPDATE users SET role = "USER" WHERE id = ?', [userId]);
  console.log(`[ROLE_SWITCH] Updated User ID ${userId} role to USER`);

  // Step 6: Fetch public rentals while USER
  const publicRentalsUserMode = await database.query(
    'SELECT * FROM rentals WHERE status != "DELETED" ORDER BY id DESC'
  );
  console.log(`[PUBLIC_RENTALS_USER_MODE] Count: ${publicRentalsUserMode.length}, found vehicle:`, publicRentalsUserMode.some(v => v.id === vehicleId));

  // Clean up test vehicle
  await database.query('DELETE FROM rentals WHERE id = ?', [vehicleId]);
  console.log('=== TEST COMPLETED SUCCESSFULLY ===');
}

testRoleSwitchFlow().then(() => process.exit(0)).catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
