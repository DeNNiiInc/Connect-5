// Database Configuration File
// IMPORTANT: This file contains sensitive credentials and should NEVER be committed to git
// Copy this file to db.config.js and update with your actual database credentials

module.exports = {
    host: 'your-database-host.com',
    user: 'your-database-username',
    password: 'your-secure-password',
    database: 'your-database-name',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};
