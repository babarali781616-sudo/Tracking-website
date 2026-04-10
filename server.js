const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 3000;
const ADMIN_SECRET = 'admin-panel-99'; // Secret route

// Middleware
app.use(express.json());
app.use(express.static('.'));

// In-memory storage (use MongoDB/Redis for production)
let visits = [];
let visitId = 1;

// Enhanced IP Geolocation
async function getLocation(ip) {
    try {
        const response = await axios.get(`http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,isp,org,timezone,query`, {
            timeout: 3000
        });
        if (response.data.status === 'success') {
            return {
                city: response.data.city,
                region: response.data.regionName,
                country: response.data.country,
                isp: response.data.isp,
                org: response.data.org,
                timezone: response.data.timezone,
                full: `${response.data.city}, ${response.data.regionName}, ${response.data.country}`
            };
        }
    } catch (e) {
        console.log('Geolocation failed:', e.message);
    }
    return { full: 'Unknown', city: 'Unknown', country: 'Unknown' };
}

// Stealth tracking endpoint
app.post('/track', async (req, res) => {
    const ip = req.ip === '::1' ? '127.0.0.1' : req.ip.replace('::ffff:', '');
    const now = new Date().toISOString();
    
    const visitor = {
        id: visitId++,
        ip,
        userAgent: req.body.userAgent || 'Unknown',
        language: req.body.language || 'Unknown',
        platform: req.body.platform || 'Unknown',
        screen: req.body.screen || 'Unknown',
        timezone: req.body.timezone || 'Unknown',
        cookiesEnabled: req.body.cookiesEnabled,
        doNotTrack: req.body.doNotTrack,
        referrer: req.body.referrer || '',
        timestamp: req.body.timestamp || Date.now(),
        visitTime: now,
        location: await getLocation(ip),
        rawData: req.body
    };

    visits.unshift(visitor); // Add to beginning for newest first
    if (visits.length > 10000) visits = visits.slice(0, 5000); // Keep recent 5k

    console.log(`🕵️  Tracked: ${ip} from ${visitor.location.full}`);
    res.json({ success: true });
});

// SECRET ADMIN PANEL - Only accessible at /admin-panel-99
app.get('/admin-panel-99', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Admin data endpoint
app.get('/admin-data', (req, res) => {
    // Simple auth check (add proper auth in production)
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${ADMIN_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const now = Date.now();
    const fiveMinAgo = now - 5 * 60 * 1000;
    
    // Live visitors (last 5 minutes)
    const liveVisitors = visits.filter(v => 
        new Date(v.timestamp).getTime() > fiveMinAgo
    ).length;

    res.json({
        totalVisits: visits.length,
        uniqueIPs: new Set(visits.map(v => v.ip)).size,
        liveVisitors,
        todayVisits: visits.filter(v => {
            const visitDate = new Date(v.timestamp);
            const today = new Date();
            return visitDate.toDateString() === today.toDateString();
        }).length,
        visitors: visits.slice(0, 100) // Last 100 visits
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Stealth Tracker running at http://localhost:${PORT}`);
    console.log(`🔐 Admin Panel: http://localhost:${PORT}/admin-panel-99`);
    console.log(`📊 Test tracking: Visit http://localhost:${PORT}/`);
});