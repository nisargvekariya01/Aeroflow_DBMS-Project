'use client';
import Link from 'next/link';

const SCENARIOS = [
  {
    title: 'OPERATIONS CONTROL CENTRE',
    description: 'Real-time flight scheduling, delay tracking, and infrastructure utilisation.',
    reports: [
      { id: '1', title: 'Full Flight Schedule' },
      { id: '2', title: 'Top 3 Busiest Routes' },
      { id: '3', title: 'Delayed Flight Legs' },
      { id: '4', title: 'Hub Airport Analysis' },
      { id: '5', title: 'Pilot & Crew Counts' },
      { id: '7', title: 'Gate Usage Profile' },
      { id: '9', title: 'Airport Bottleneck Score' },
      { id: '11', title: 'Human-Readable Routes' },
    ]
  },
  {
    title: 'PASSENGER & BOOKING ANALYTICS',
    description: 'Revenue analysis, passenger loyalty, and luggage logistics.',
    reports: [
      { id: '12', title: 'Revenue per Route' },
      { id: '13', title: 'Power Passengers' },
      { id: '14', title: 'Aircraft Passenger Volume' },
      { id: '15', title: 'Heavy Luggage Flights' },
      { id: '16', title: 'Mixed Class Passengers' },
      { id: '17', title: 'Loyal Passengers (No Cancellations)' },
      { id: '18', title: 'IndiGo-Only Passengers' },
    ]
  },
  {
    title: 'FLEET HEALTH & CREW OPS',
    description: 'Maintenance reliability, technical performance, and staffing audits.',
    reports: [
      { id: '21', title: 'Airline Fleet Summary' },
      { id: '22', title: 'Maintenance Cost Audit' },
      { id: '23', title: 'Utilisation Benchmarking' },
      { id: '25', title: 'Aircraft Financial Efficiency' },
      { id: '26', title: 'Runway Traffic Profile' },
      { id: '27', title: 'Cabin Manager Appraisal' },
      { id: '28', title: 'Pilot Workload Tiers' },
    ]
  },
  {
    title: 'STRATEGIC RISK & SUSTAINABILITY',
    description: 'Executive intelligence, carbon tracking, and safety compliance.',
    reports: [
      { id: '31', title: 'Ghost Flights (Low Occupancy)' },
      { id: '32', title: 'Loyalty Tier Eligibility' },
      { id: '33', title: 'Carbon Footprint Profile' },
      { id: '34', title: 'Crew Fatigue / Safety Violations' },
      { id: '35', title: 'Peak Hour Congestion' },
      { id: '36', title: 'Revenue Leakage' },
      { id: '37', title: 'Pilot Seniority Audit' },
    ]
  }
];

export default function ReportsPage() {
  return (
    <div className="animate-fade">
      <header style={{ marginBottom: '3rem' }}>
        <h1>Analytical Reports</h1>
        <p style={{ color: 'var(--text-dim)', maxWidth: '600px', marginTop: '1rem' }}>
          Execute complex SQL scenarios to derive business intelligence from flight operations, 
          fleet health, and passenger behavior.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {SCENARIOS.map((s, idx) => (
          <div key={idx} className="card" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1rem', color: 'var(--primary)', letterSpacing: '2px', marginBottom: '0.5rem' }}>{s.title}</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{s.description}</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
              {s.reports.map(r => (
                <Link 
                  key={r.id} 
                  href={`/reports/${r.id}`}
                  className="nav-item"
                  style={{ 
                    border: '1px solid var(--glass-border)',
                    margin: 0,
                    padding: '0.75rem 1rem',
                    background: 'rgba(255,255,255,0.02)'
                  }}
                >
                  <span style={{ opacity: 0.5, marginRight: '0.5rem' }}>#{r.id}</span> {r.title}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
