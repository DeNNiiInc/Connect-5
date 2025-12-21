// Database Configuration File - EXAMPLE
// Copy this file to db.config.js and fill in your actual Supabase credentials
// DO NOT commit db.config.js to git - it's in .gitignore

// Supabase Configuration
// Get these values from your Supabase project dashboard:
// 1. Go to https://app.supabase.com
// 2. Select your project
// 3. Go to Project Settings → API
module.exports = {
    supabaseUrl: 'https://xxxxxxxxxxxxx.supabase.co', // Your Supabase project URL
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', // Your Supabase anon/public key
    supabasePassword: 'your_database_password_here', // Your database password
    
    // Optional: Direct PostgreSQL connection string
    // Found in Project Settings → Database → Connection String
    postgresConnectionString: 'postgresql://postgres:your_password@db.xxxxxxxxxxxxx.supabase.co:5432/postgres'
};
