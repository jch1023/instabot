/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow better-sqlite3 native module in server-side code
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
