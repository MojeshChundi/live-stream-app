// Keep-alive script to prevent free tier from spinning down
// Run this separately or add to your hosting platform

const https = require('https');
const http = require('http');

const APP_URL = process.env.APP_URL || 'https://your-app-name.onrender.com';
const INTERVAL = 14 * 60 * 1000; // Ping every 14 minutes (before 15 min timeout)

function ping() {
  try {
    const url = new URL(APP_URL);
    const client = url.protocol === 'https:' ? https : http;
    const path = url.pathname + (url.pathname.endsWith('/health') ? '' : '/health');
    
    const req = client.get({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: path,
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`✅ Ping successful at ${new Date().toLocaleTimeString()} - Status: ${res.statusCode}`);
      });
    });
    
    req.on('error', (error) => {
      console.error(`❌ Ping failed: ${error.message}`);
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      console.error('❌ Ping timeout');
    });
  } catch (error) {
    console.error(`❌ Error parsing URL: ${error.message}`);
  }
}

// Ping immediately
ping();

// Then ping every 14 minutes
setInterval(ping, INTERVAL);

console.log(`🔄 Keep-alive started for ${APP_URL}`);
console.log(`⏰ Pinging every ${INTERVAL / 60000} minutes`);

