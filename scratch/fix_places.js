import { initDatabase, query } from '../server/config/database.js';

async function main() {
  await initDatabase();

  // 1. Update Grand Island category from Waterfalls to Beaches
  await query("UPDATE explore_places SET category = 'Beaches' WHERE name LIKE '%Grand Island%'");

  // 2. Ensure all places from defaultPlaces are in DB
  const { DEFAULT_EXPLORE_PLACES } = await import('../src/data/defaultPlaces.js');

  for (const place of DEFAULT_EXPLORE_PLACES) {
    const existing = await query("SELECT id FROM explore_places WHERE name = ?", [place.name]);
    if (existing.length === 0) {
      await query(
        `INSERT INTO explore_places (name, category, rating, distance, price, image, is_bookmarked, description, maps_url, best_time, est_cost, pro_tips, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
        [
          place.name,
          place.category,
          place.rating,
          place.distance,
          place.price,
          place.image,
          false,
          place.description,
          place.maps_url,
          place.best_time,
          place.est_cost,
          place.pro_tips
        ]
      );
      console.log(`[Inserted] ${place.name}`);
    } else {
      await query(
        `UPDATE explore_places SET category = ?, rating = ?, distance = ?, price = ?, image = ?, description = ?, maps_url = ?, best_time = ?, est_cost = ?, pro_tips = ?, is_active = TRUE WHERE name = ?`,
        [
          place.category,
          place.rating,
          place.distance,
          place.price,
          place.image,
          place.description,
          place.maps_url,
          place.best_time,
          place.est_cost,
          place.pro_tips,
          place.name
        ]
      );
      console.log(`[Updated] ${place.name}`);
    }
  }

  const allPlaces = await query("SELECT id, name, category, is_active FROM explore_places ORDER BY id ASC");
  console.log(`Total live places in DB: ${allPlaces.length}`);
  console.table(allPlaces);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
