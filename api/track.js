const axios = require('axios');

let visits = [];
let visitId = 1;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || 
               req.headers['x-real-ip'] || 
               req.connection?.remoteAddress || 
               req.socket.remoteAddress || 'unknown';

    const now = new Date().toISOString();
    
    // Geolocation
    let location = { full: 'Unknown' };
    try {
      const geoRes = await axios.get(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,isp,lat,lon`, { 
        timeout: 2000 
      });
      if (geoRes.data.status === 'success') {
        location = {
          city: geoRes.data.city || '',
          region: geoRes.data.regionName || '',
          country: geoRes.data.country || '',
          isp: geoRes.data.isp || '',
          lat: geoRes.data.lat,
          lon: geoRes.data.lon,
          full: `${geoRes.data.city}, ${geoRes.data.regionName}, ${geoRes.data.country}`
        };
      }
    } catch (e) {}

    const visitor = {
      id: visitId++,
      ip: ip.replace('::ffff:', ''),
      userAgent: req.body.userAgent?.substring(0, 200) || 'Unknown',
      language: req.body.language || 'Unknown',
      platform: req.body.platform || 'Unknown',
      screen: req.body.screen || 'Unknown',
      timezone: req.body.timezone || 'Unknown',
      gps_lat: req.body.gps?.latitude || null,
      gps_lon: req.body.gps?.longitude || null,
      gps_accuracy: req.body.gps?.accuracy || null,
      timestamp: req.body.timestamp || Date.now(),
      visitTime: now,
      location,
      rawData: req.body
    };

    visits.unshift(visitor);
    if (visits.length > 5000) visits = visits.slice(0, 2500);

    console.log(`🕵️ Vercel Track: ${ip} | GPS: ${visitor.gps_lat ? 'YES' : 'NO'}`);
    
    return res.status(200).json({ success: true, id: visitor.id });
  } catch (error) {
    console.error('Track error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};
