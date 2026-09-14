// Supabase configuration
const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// JWT configuration for tokens
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-here-change-in-production";
const JWT_EXPIRES_IN = "7d"; // Token expiration time

// Other configuration
const SITE_URL = process.env.SITE_URL || "https://auth-materioa.netlify.app";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://materioa.netlify.app";

module.exports = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_KEY,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  SITE_URL,
  FRONTEND_URL
};