const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static('.'));

// In-memory storage (use Redis/MongoDB for production)
let visits = [];
let sessionTimeouts = new Map();

// IP Geolocation API (free tier)
async function getLocation(ip) {
    try {
        const response = await axios.get(`http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,isp`);
        if (response.data.status === 'success') {
            return `${response.data.city}, ${response.data.regionName}, ${response.data.country}`;
        }
    } catch (e) {
        return 'Unknown';
    }
    return 'Unknown';
}

// Track visitor
app.post('/track', async (req, res) => {
    const ip = req.ip === '::1' ? '127.0.0.1' : req.ip;
    const userAgent = req.body.userAgent || 'Unknown';
    const now = Date.now();
    
    // Check if visitor exists
    let visitor = visits.find(v => v.ip === ip);
    
    if (!visitor) {
        // New visitor
        visitor = {
            id: visits.length + 1,
            ip,
            userAgent,
            firstVisit: now,
            lastSeen: now,
            location: await getLocation(ip),
            stayTime: 0
        };
        visits.push(visitor);
    } else {
        // Update existing visitor
        visitor.lastSeen = now;
        visitor.userAgent = userAgent;
    }
    
    // Update session timeout
    sessionTimeouts.set(ip, setTimeout(() => {
        const idx = visits.findIndex(v => v.ip === ip);
        if (idx !== -1) {
            visits[idx].stayTime = Date.now() - visits[idx].firstVisit;
        }
        sessionTimeouts.delete(ip);
    }, 300000)); // 5 minutes
    
    res.json({ success: true });
});

// Get dashboard data
app.get('/data', (req, res) => {
    const now = Date.now();
    const fiveMinAgo = now - 300000;
    
    // Live visitors (seen in last 5 minutes)
    const liveVisitors = visits.filter(v => v.lastSeen > fiveMinAgo).length;
    
    // Calculate average stay time
    const completedVisits = visits.filter(v => v.stayTime > 0);
    const avgStay = completedVisits.length > 0 
        ? completedVisits.reduce((sum, v) => sum + v.stayTime, 0) / completedVisits.length 
        : 0;
    
    res.json({
        totalVisits: visits.length,
        uniqueVisitors: new Set(visits.map(v => v.ip)).size,
        liveVisitors,
        avgStay,
        visitors: visits.sort((a, b) => b.lastSeen - a.lastSeen)
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Tracking server running at http://localhost:${PORT}`);
});