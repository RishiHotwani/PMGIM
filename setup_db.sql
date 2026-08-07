-- PMGIM MySQL Database Setup Script
-- Open this file in MySQL Workbench and click the Lightning Bolt (Execute) icon!

CREATE DATABASE IF NOT EXISTS travelappgim;
USE travelappgim;

-- Create user and grant privileges
CREATE USER IF NOT EXISTS 'antigravity_user'@'localhost' IDENTIFIED BY 'GATE2026';
CREATE USER IF NOT EXISTS 'antigravity_user'@'%' IDENTIFIED BY 'GATE2026';
GRANT ALL PRIVILEGES ON travelappgim.* TO 'antigravity_user'@'localhost';
GRANT ALL PRIVILEGES ON travelappgim.* TO 'antigravity_user'@'%';
FLUSH PRIVILEGES;

-- Create Users Table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  avatar VARCHAR(10) DEFAULT 'US',
  batch VARCHAR(50) DEFAULT 'PGDM 2026',
  section VARCHAR(10) DEFAULT 'Sec A',
  phone VARCHAR(50) DEFAULT '',
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Create Vehicle Rentals Table
CREATE TABLE IF NOT EXISTS rentals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  vendor VARCHAR(255) NOT NULL,
  price_per_day INT NOT NULL,
  rating DECIMAL(3,1) DEFAULT 4.5,
  total_ratings INT DEFAULT 100,
  distance VARCHAR(50) DEFAULT '1.0 km away',
  fuel VARCHAR(50) DEFAULT 'Petrol',
  transmission VARCHAR(50) DEFAULT 'Automatic',
  tags VARCHAR(500) DEFAULT 'Women friendly',
  image VARCHAR(500) NOT NULL,
  is_available BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB;

-- Create Explore Goa Places Table
CREATE TABLE IF NOT EXISTS explore_places (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  rating DECIMAL(3,1) DEFAULT 4.5,
  distance VARCHAR(100) DEFAULT '',
  price VARCHAR(100) DEFAULT '',
  image VARCHAR(500) NOT NULL,
  is_bookmarked BOOLEAN DEFAULT FALSE
) ENGINE=InnoDB;

-- Create Travel Board Ride Share Table
CREATE TABLE IF NOT EXISTS travel_trips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_name VARCHAR(255) NOT NULL,
  user_initials VARCHAR(10) NOT NULL,
  batch_info VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  pickup VARCHAR(255) NOT NULL,
  date_time VARCHAR(255) NOT NULL,
  seats_left INT NOT NULL,
  seats_total INT NOT NULL,
  vehicle_type VARCHAR(50) NOT NULL,
  cost VARCHAR(50) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'Today',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Create User Activity Log Table
CREATE TABLE IF NOT EXISTS user_activities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT DEFAULT NULL,
  user_name VARCHAR(255) DEFAULT 'Guest',
  activity_type VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  details TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(100) DEFAULT '127.0.0.1'
) ENGINE=InnoDB;
