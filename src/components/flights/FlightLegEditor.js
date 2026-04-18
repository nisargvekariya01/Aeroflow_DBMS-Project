export default function FlightLegEditor({ legs, setLegs }) {
  
  const moveLeg = (index, direction) => {
    if (direction === -1 && index === 0) return;
    if (direction === 1 && index === legs.length - 1) return;
    
    const newLegs = [...legs];
    const temp = newLegs[index];
    newLegs[index] = newLegs[index + direction];
    newLegs[index + direction] = temp;
    setLegs(newLegs);
  };

  const removeLeg = (index) => {
    setLegs(legs.filter((_, i) => i !== index));
  };

  const updateTime = (index, field, value) => {
    const newLegs = [...legs];
    newLegs[index][field] = value;
    setLegs(newLegs);
  };

  if (!legs || legs.length === 0) return null;

  return (
    <div style={{
      marginTop: '1.5rem',
      padding: '20px',
      background: 'rgba(0, 0, 0, 0.2)',
      borderRadius: '16px',
      border: '1px solid var(--glass-border)'
    }}>
      <h3 style={{ margin: '0 0 1rem 0' }}>Flight Legs Sequence</h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {legs.map((leg, index) => (
          <div 
            key={leg.id} 
            style={{
              display: 'flex',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--glass-border)',
              borderRadius: '12px',
              padding: '16px',
              gap: '20px',
              alignItems: 'center',
              position: 'relative',
              animation: 'blurIn 0.2s ease-out'
            }}
          >
            {/* Sequence & Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <button 
                type="button" 
                onClick={() => moveLeg(index, -1)}
                disabled={index === 0}
                style={{ background: 'transparent', border: 'none', color: index === 0 ? 'rgba(255,255,255,0.1)' : 'var(--text-dim)', cursor: index === 0 ? 'default' : 'pointer', fontSize: '1.2rem', padding: 0 }}
              >
                ▲
              </button>
              <div style={{ 
                width: '30px', 
                height: '30px', 
                borderRadius: '50%', 
                background: 'var(--primary)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                fontWeight: 'bold'
              }}>
                {index + 1}
              </div>
              <button 
                type="button" 
                onClick={() => moveLeg(index, 1)}
                disabled={index === legs.length - 1}
                style={{ background: 'transparent', border: 'none', color: index === legs.length - 1 ? 'rgba(255,255,255,0.1)' : 'var(--text-dim)', cursor: index === legs.length - 1 ? 'default' : 'pointer', fontSize: '1.2rem', padding: 0 }}
              >
                ▼
              </button>
            </div>

            {/* Route Info */}
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '4px' }}>Route Segment ({leg.route_id})</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{leg.source_iata || leg.source_airport_id}</span>
                <span style={{ color: 'var(--primary)' }}>→</span>
                <span>{leg.dest_iata || leg.dest_airport_id}</span>
              </div>
            </div>

            {/* Time Inputs */}
            <div style={{ display: 'flex', gap: '15px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.8rem' }}>Takeoff Time</label>
                <input 
                  type="datetime-local" 
                  value={leg.takeoff_time || ''} 
                  onChange={(e) => updateTime(index, 'takeoff_time', e.target.value)}
                  style={{ padding: '8px 12px' }}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.8rem' }}>Landing Time</label>
                <input 
                  type="datetime-local" 
                  value={leg.landing_time || ''} 
                  onChange={(e) => updateTime(index, 'landing_time', e.target.value)}
                  style={{ padding: '8px 12px' }}
                  required
                />
              </div>
            </div>

            {/* Remove */}
            <button 
              type="button" 
              onClick={() => removeLeg(index)}
              style={{
                background: 'rgba(255, 69, 69, 0.1)',
                color: '#ff4545',
                border: 'none',
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 69, 69, 0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 69, 69, 0.1)'}
            >
              ×
            </button>

          </div>
        ))}
      </div>
    </div>
  );
}
