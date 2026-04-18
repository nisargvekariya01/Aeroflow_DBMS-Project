import './globals.css';

export const metadata = {
  title: 'AeroFlow | DBMS',
  description: 'Premium Aviation Management System',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="layout">
          <aside className="sidebar">
            <div className="logo">AeroFlow</div>
            <nav className="nav-links">
              <a href="/" className="nav-item">📊 Command Centre</a>
              <a href="/reports" className="nav-item">📈 Analytical Reports</a>

              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', padding: '0.5rem 1rem 0.2rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Core</div>
              <a href="/airlines" className="nav-item">✈️ Airlines</a>
              <a href="/airports" className="nav-item">🏢 Airports</a>
              <a href="/route-mgmt" className="nav-item">🗺️ Routes</a>

              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', padding: '0.5rem 1rem 0.2rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Fleet</div>
              <a href="/aircrafts" className="nav-item">🛩️ Aircrafts</a>
              <a href="/maintenance" className="nav-item">🔧 Maintenance</a>

              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', padding: '0.5rem 1rem 0.2rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Operations</div>
              <a href="/flights" className="nav-item">🛫 Flights</a>
              <a href="/flight-legs" className="nav-item">📍 Flight Legs</a>
              <a href="/runways" className="nav-item">⬛ Runways</a>
              <a href="/gates" className="nav-item">🚪 Gates</a>

              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', padding: '0.5rem 1rem 0.2rem', textTransform: 'uppercase', letterSpacing: '1px' }}>People</div>
              <a href="/pilots" className="nav-item">👨‍✈️ Pilots</a>
              <a href="/crew" className="nav-item">👥 Crew</a>
              <a href="/users" className="nav-item">🧑 Users</a>

              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', padding: '0.5rem 1rem 0.2rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Bookings</div>
              <a href="/bookings" className="nav-item">📋 Bookings</a>
              <a href="/luggage" className="nav-item">🧳 Luggage</a>

              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', padding: '0.5rem 1rem 0.2rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Assignments</div>
              <a href="/pilot-assign" className="nav-item">🎯 Pilot Assign</a>
              <a href="/crew-assign" className="nav-item">📌 Crew Assign</a>
              <a href="/uses-runway" className="nav-item">↗️ Runway Usage</a>
              <a href="/uses-gate" className="nav-item">🔀 Gate Usage</a>
            </nav>
          </aside>
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
