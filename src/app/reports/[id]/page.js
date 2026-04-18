'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DataTable from '@/components/DataTable';

export default function ReportViewer() {
  const { id } = useParams();
  const router = useRouter();
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchReport = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/reports?id=${id}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to generate report');
        setReport(json);
      } catch (e) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchReport();
  }, [id]);

  if (isLoading) return <div style={{ padding: '4rem', textAlign: 'center' }}><p className="animate-pulse">Building report database query...</p></div>;
  if (error) return (
    <div style={{ padding: '4rem', textAlign: 'center' }}>
      <h2 style={{ color: '#ff4545' }}>❌ Report Error</h2>
      <p style={{ marginTop: '1rem', color: 'var(--text-dim)' }}>{error}</p>
      <button onClick={() => router.push('/reports')} style={{ marginTop: '2rem' }}>Back to Reports</button>
    </div>
  );

  const columns = report.data.length > 0 
    ? Object.keys(report.data[0]).map(key => ({
        key: key,
        label: key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
      }))
    : [];

  return (
    <div className="animate-fade">
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button 
            onClick={() => router.push('/reports')}
            style={{ 
              background: 'none', 
              border: 'none', 
              padding: 0, 
              color: 'var(--text-dim)', 
              fontSize: '0.8rem', 
              marginBottom: '0.5rem',
              cursor: 'pointer'
            }}
          >
            ← Back to Library
          </button>
          <h1 style={{ fontSize: '1.8rem' }}>{report.title}</h1>
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textAlign: 'right' }}>
          Report ID: #{id} <br/>
          Status: <span style={{ color: '#4caf50' }}>Synchronized</span>
        </div>
      </header>

      <div className="card">
        {report.data.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-dim)' }}>
            <p>No records found for this analysis period.</p>
          </div>
        ) : (
          <DataTable 
            columns={columns} 
            data={report.data} 
            // Read-only report, so no edit handler
            onEdit={null} 
          />
        )}
      </div>
      
      <footer style={{ marginTop: '2rem', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
        * Results generated from live production database `202401492`.
      </footer>
    </div>
  );
}
