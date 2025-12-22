// Database Configuration File - EXAMPLE
// Copy this file to db.config.js and fill in your actual PostgreSQL credentials
// DO NOT commit db.config.js to git - it's in .gitignore

// PostgreSQL Configuration
// Update these values with your PostgreSQL database details
module.exports = {
  HOST: "your-postgres-host", // e.g., 'localhost' or '202.171.184.108'
  USER: "postgres", // PostgreSQL username
  PASSWORD: "your-database-password", // Your database password
  DB: "connect5", // Database name
  dialect: "postgres",
  pool: {
    max: 5, // Maximum number of connections in pool
    min: 0, // Minimum number of connections in pool
    acquire: 30000, // Maximum time (ms) to try to get connection before throwing error
    idle: 10000, // Maximum time (ms) a connection can be idle before being released
  },
};
