import { useState, useEffect } from 'react';

export default function RouteSelector({ sourceId, destId, onSelectPath, onCancel }) {
  const [routes, setRoutes] = useState([]);
  const [paths, setPaths] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/routes')
      .then(r => r.json())
      .then(data => {
        setRoutes(data);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!routes.length || !sourceId || !destId) {
      setPaths([]);
      return;
    }

    // Graph Traversal (DFS) for paths up to 3 legs
    const findPaths = (currentSource, targetDest, currentPath = [], visited = new Set(), depth = 0) => {
      if (depth > 3) return []; 
      
      let foundPaths = [];
      
      const outgoing = routes.filter(r => String(r.source_airport_id) === String(currentSource));
      
      for (const route of outgoing) {
        if (visited.has(route.route_id)) continue;
        
        const nextPath = [...currentPath, route];
        
        if (String(route.dest_airport_id) === String(targetDest)) {
          foundPaths.push(nextPath);
        } else {
          const nextVisited = new Set(visited);
          nextVisited.add(route.route_id);
          // Recurse
          foundPaths = foundPaths.concat(findPaths(route.dest_airport_id, targetDest, nextPath, nextVisited, depth + 1));
        }
      }
      return foundPaths;
    };

    const validPaths = findPaths(String(sourceId), String(destId));
    
    // Sort shortest paths (direct flights) first
    validPaths.sort((a, b) => a.length - b.length);
    setPaths(validPaths);

  }, [routes, sourceId, destId]);

  return (
    <div style={{
      background: 'rgba(20, 20, 25, 0.95)',
      padding: '20px',
      borderRadius: '16px',
      border: '1px solid var(--primary)',
      marginTop: '1rem',
      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
      animation: 'blurIn 0.3s ease-out'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, color: 'var(--primary)' }}>Available Route Combinations</h3>
        <button type="button" onClick={onCancel} className="btn-secondary" style={{ padding: '6px 12px' }}>Close</button>
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--text-dim)' }}>Scanning global network...</p>
      ) : paths.length === 0 ? (
        <p style={{ color: '#ff4545' }}>No connected routes found between these airports (Max 3 stops).</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {paths.map((path, index) => (
            <div 
              key={index}
              onClick={() => onSelectPath(path)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--glass-border)',
                padding: '12px 16px',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(10, 132, 255, 0.15)';
                e.currentTarget.style.borderColor = 'var(--primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'var(--glass-border)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 'bold' }}>
                  {path.length === 1 ? 'Direct Flight' : `${path.length} Legs`}
                </span>
                <span style={{ color: 'var(--text-dim)' }}>|</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                  {path.map((route, i) => (
                    <span key={route.route_id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {i === 0 && <span style={{ color: 'white' }}>{route.source_iata || route.source_airport_id}</span>}
                      <span>→</span>
                      <span style={{ color: 'white' }}>{route.dest_iata || route.dest_airport_id}</span>
                    </span>
                  ))}
                </div>
              </div>
              <button 
                type="button" 
                style={{ padding: '6px 12px', background: 'var(--primary)', color: 'white', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); onSelectPath(path); }}
              >
                Select
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
