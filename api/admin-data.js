let visits = [];
let visitId = 1;

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📊 Vercel Admin data requested - Total:', visits.length);
    
    const now = Date.now();
    const fiveMinAgo = now - 5 * 60 * 1000;
    
    const liveVisitors = visits.filter(v => new Date(v.timestamp).getTime() > fiveMinAgo).length;
    const today = new Date().toDateString();
    const todayVisits = visits.filter(v => new Date(v.timestamp).toDateString() === today).length;

    return res.status(200).json({
      totalVisits: visits.length,
      uniqueIPs: new Set(visits.map(v => v.ip)).size,
      liveVisitors,
      todayVisits,
      visitors: visits.slice(0, 100).map(v => ({
        ...v,
        gps: v.gps_lat ? `📍 ${v.gps_lat.toFixed(6)}, ${v.gps_lon.toFixed(6)}` : '❌ No GPS'
      }))
    });
  } catch (error) {
    console.error('Admin-data error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};
