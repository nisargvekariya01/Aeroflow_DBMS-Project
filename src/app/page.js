'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Dashboard() {
  const [stats, setStats] = useState({
    bookings: 0,
    revenue: 0,
    carbon: 0,
    maintenance: 0,
    topRoutes: [],
    recentFlights: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch 4 key reports for the dashboard
        const [revRes, carbonRes, routeRes, flightRes] = await Promise.all([
          fetch('/api/reports?id=12'), // Revenue per Route
          fetch('/api/reports?id=33'), // Carbon Footprint
          fetch('/api/reports?id=2'),  // Top 3 Routes
          fetch('/api/reports?id=1'),  // Full Schedule
        ]);

        const [rev, carbon, routes, flights] = await Promise.all([
          revRes.json(), carbonRes.json(), routeRes.json(), flightRes.json()
        ]);

        const totalRevenue = rev.data?.reduce((acc, curr) => acc + (parseFloat(curr.est_revenue_inr) || 0), 0) || 0;
        const totalBookings = rev.data?.reduce((acc, curr) => acc + (parseInt(curr.total_confirmed_bookings) || 0), 0) || 0;
        const totalCarbon = carbon.data?.reduce((acc, curr) => acc + (parseFloat(curr.est_co2_metric_tons) || 0), 0) || 0;

        setStats({
          revenue: totalRevenue,
          bookings: totalBookings,
          carbon: totalCarbon,
          topRoutes: routes.data || [],
          recentFlights: flights.data?.slice(0, 5) || []
        });
      } catch (e) {
        console.error('Dashboard Load Error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  if (loading) return <div style={{ padding: '4rem', textAlign: 'center' }}><p className="animate-pulse">Initializing Flight Operations Dashboard...</p></div>;

  return (
    <div className="animate-fade">
      <header style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.2rem' }}>Command Centre</h1>
        <p style={{ color: 'var(--text-dim)', marginTop: '0.5rem' }}>Global fleet status and real-time operations analytics.</p>
      </header>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '3rem' }}>
        {[
          { label: 'Total Confirmed Bookings', value: stats.bookings, sub: 'Confirmed Seats', icon: '🎫' },
          { label: 'Estimated Gross Revenue', value: `₹${(stats.revenue / 100000).toFixed(1)}L`, sub: 'Segment Revenue', icon: '💰' },
          { label: 'Carbon Footprint', value: `${stats.carbon.toFixed(1)}t`, sub: 'CO2 Metric Tons', icon: '🌱' },
          { label: 'Operational Flights', value: stats.recentFlights.length, sub: 'Active Schedule', icon: '✈️' },
        ].map((kpi, i) => (
          <div key={i} className="card" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontSize: '2rem', opacity: 0.2, position: 'absolute', right: '1rem', bottom: '0.5rem' }}>{kpi.icon}</div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>{kpi.label}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: '700', color: 'var(--primary)' }}>{kpi.value}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem' }}>
        {/* Top Routes Chart (CSS Visual) */}
        <div className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <h2>Top Routes by Volume</h2>
            <Link href="/reports/2" style={{ color: 'var(--primary)', fontSize: '0.8rem' }}>View Detail</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {stats.topRoutes.map((route, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                  <span>{route.from_airport} → {route.to_airport}</span>
                  <span style={{ color: 'var(--primary)' }}>{route.booking_count} Bookings</span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${(route.booking_count / (stats.topRoutes[0].booking_count || 1)) * 100}%`, 
                    background: 'var(--primary-gradient)',
                    borderRadius: '4px'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Schedule */}
        <div className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <h2>Flight Briefing</h2>
            <Link href="/reports/1" style={{ color: 'var(--primary)', fontSize: '0.8rem' }}>Full Schedule</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {stats.recentFlights.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                <div style={{ background: 'rgba(212,175,55,0.1)', color: 'var(--primary)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                  {f.source}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.9rem' }}>{f.airline_name} — {f.aircraft_model}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Dep: {new Date(f.departure_time).toLocaleString()}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                   <div style={{ fontSize: '0.8rem' }}>{f.destination}</div>
                   <div style={{ fontSize: '0.6rem', color: '#4caf50' }}>Scheduled</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
