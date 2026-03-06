/**
 * START ALL-IN-ONE SYSTEM
 * This file starts both the Discord Bot and the Website at the same time.
 * Perfect for hosting on Render.com or other similar platforms.
 */

console.log('--- STARTING REAR X TIER SYSTEM ---');

// Start the Discord Bot
console.log('🤖 Initializing Discord Bot...');
require('./index.js');

// Start the Website
console.log('🌐 Initializing Website Server...');
require('./website/server.js');

console.log('--- ALL SYSTEMS ONLINE ---');
