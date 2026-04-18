'use client';
import { useState, useEffect } from 'react';

export default function BookingFlightSelector({ sourceId, destId, onSelectPath, onCancel }) {
  const [routes, setRoutes] = useState([]);
  const [flightLegs, setFlightLegs] = useState([]);
  const [paths, setPaths] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/routes').then(r => r.json()),
      fetch('/api/flight-legs').then(r => r.json())
    ]).then(([routesData, legsData]) => {
      setRoutes(routesData);
      setFlightLegs(legsData);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!routes.length || !flightLegs.length || !sourceId || !destId) {
      setPaths([]);
      return;
    }

    // Embed origin and destination logic into each concrete flight leg
    const enrichedLegs = flightLegs.map(leg => {
      const parentRoute = routes.find(r => String(r.route_id) === String(leg.route_id));
      return {
        ...leg,
        source_airport_id: parentRoute?.source_airport_id,
        dest_airport_id: parentRoute?.dest_airport_id,
        source_iata: parentRoute?.source_iata,
        dest_iata: parentRoute?.dest_iata,
      };
    }).filter(leg => leg.source_airport_id && leg.dest_airport_id); // Drop orphaned data

    // Time-aware graph traverse
    const findPaths = (currentSource, targetDest, currentPath = [], visitedIds = new Set(), depth = 0) => {
      if (depth > 3) return []; 
      
      let foundPaths = [];
      const outgoingLegs = enrichedLegs.filter(leg => String(leg.source_airport_id) === String(currentSource));
      
      for (const leg of outgoingLegs) {
        // Prevent infinite loops by referencing unique flight legs
        const uniqueLegToken = `${leg.flight_id}-${leg.route_id}-${leg.leg_sequence_no}`;
        if (visitedIds.has(uniqueLegToken)) continue;

        // Strict Time Chronology Rule: If this isn't the first leg, ensure Takeoff > previous Landing
        if (currentPath.length > 0) {
           const prevLandingTime = new Date(currentPath[currentPath.length - 1].landing_time).getTime();
           const currentTakeoffTime = new Date(leg.takeoff_time).getTime();
           if (currentTakeoffTime <= prevLandingTime) continue; // Timestamps conflict
        }
        
        const nextPath = [...currentPath, leg];
        
        if (String(leg.dest_airport_id) === String(targetDest)) {
          foundPaths.push(nextPath);
        } else {
          const nextVisited = new Set(visitedIds);
          nextVisited.add(uniqueLegToken);
          foundPaths = foundPaths.concat(findPaths(leg.dest_airport_id, targetDest, nextPath, nextVisited, depth + 1));
        }
      }
      return foundPaths;
    };

    const validPaths = findPaths(String(sourceId), String(destId));
    
    // Sort paths by the shortest number of layovers, then by chronologically earliest departure
    validPaths.sort((a, b) => {
       if (a.length !== b.length) return a.length - b.length;
       return new Date(a[0].takeoff_time).getTime() - new Date(b[0].takeoff_time).getTime();
    });
    
    setPaths(validPaths);

  }, [routes, flightLegs, sourceId, destId]);

  return (
    <div style={{
      background: 'rgba(20, 20, 20, 0.98)',
      padding: '20px',
      borderRadius: '16px',
      border: '1px solid var(--primary)',
      marginTop: '1rem',
      boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
      animation: 'blurIn 0.3s ease-out',
      position: 'relative',
      zIndex: 100
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, color: 'var(--primary)' }}>Available Scheduled Flights</h3>
        <button type="button" onClick={onCancel} className="btn-secondary" style={{ padding: '6px 12px' }}>Close</button>
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--text-dim)' }}>Interrogating flight schedules...</p>
      ) : paths.length === 0 ? (
        <p style={{ color: '#ff4545' }}>No available flight schedules between these airports exist.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto', paddingRight: '5px' }}>
          {paths.map((path, index) => {
            const firstLeg = path[0];
            const lastLeg = path[path.length - 1];
            const departureTime = new Date(firstLeg.takeoff_time).toLocaleString();
            const arrivalTime = new Date(lastLeg.landing_time).toLocaleString();

            return (
              <div 
                key={index}
                onClick={() => onSelectPath(path)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--glass-border)',
                  padding: '16px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s',
                  gap: '1rem'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(10, 132, 255, 0.15)';
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'var(--glass-border)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                      {path.length === 1 ? 'Direct Flight' : `${path.length - 1} Layover${path.length > 2 ? 's' : ''}`}
                    </span>
                    <span style={{ color: 'var(--text-dim)' }}>|</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                      {path.map((leg, i) => (
                        <span key={`${leg.flight_id}-${leg.route_id}`} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {i === 0 && <span style={{ color: 'white' }}>{leg.source_iata || leg.source_airport_id}</span>}
                          <span style={{ color: 'var(--primary)' }}>→</span>
                          <span style={{ color: 'white' }}>{leg.dest_iata || leg.dest_airport_id}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.85rem', color: '#ccc' }}>
                     <div>
                       <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Departure</div>
                       <div>{departureTime}</div>
                     </div>
                     <div>
                       <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Arrival</div>
                       <div>{arrivalTime}</div>
                     </div>
                  </div>
                  
                </div>
                
                <button 
                  type="button" 
                  style={{ padding: '10px 20px', background: 'var(--primary)', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                  onClick={(e) => { e.stopPropagation(); onSelectPath(path); }}
                >
                  Select
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
