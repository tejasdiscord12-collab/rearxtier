/**
 * START BACKEND ONLY (Website Server + API)
 * This file is used to bypass the 16-character limit in Pterodactyl.
 */

console.log('--- STARTING REAR X WEBSITE BACKEND ---');

// Start ONLY the Website API
// This will allow Vercel to fetch rankings and listen for Discord updates
require('./website/server.js');

console.log('--- BACKEND ONLINE ---');
