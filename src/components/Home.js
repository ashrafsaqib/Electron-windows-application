import React, { useState, useEffect } from 'react';
import '../styles/Home.css';

function Home() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [stats, setStats] = useState({
    emailsCheckedToday: 0,
    pdfsGeneratedToday: 0,
    lastCheckTime: null,
    totalErrors: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check initial monitoring status
    if (window.electronAPI && window.electronAPI.getMonitoringStatus) {
      window.electronAPI.getMonitoringStatus().then(status => {
        setIsMonitoring(status.isMonitoring);
        setLoading(false);
      }).catch(err => {
        console.error('Error getting monitoring status:', err);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }

    // Load initial stats from file
    const loadStats = () => {
      if (window.electronAPI && window.electronAPI.getTodayStats) {
        window.electronAPI.getTodayStats().then(result => {
          if (result.success) {
            console.log('[Home] Loaded stats from file:', result.stats);
            setStats(result.stats);
          }
        }).catch(err => {
          console.error('[Home] Error loading stats:', err);
        });
      }
    };

    // Load stats immediately
    loadStats();

    // Set up periodic stats loading (every 5 seconds)
    const statsInterval = setInterval(loadStats, 5000);

    // Subscribe to monitoring events
    if (window.electronAPI) {
      console.log('[Home] electronAPI available, setting up listeners');
      console.log('[Home] electronAPI methods:', Object.keys(window.electronAPI));
      
      if (window.electronAPI.onMonitoringStarted) {
        console.log('[Home] Registering onMonitoringStarted listener');
        window.electronAPI.onMonitoringStarted((event, data) => {
          console.log('[Home] onMonitoringStarted fired with:', event, data);
          setIsMonitoring(true);
          addActivity({
            type: 'started',
            message: `Monitoring started - checking every ${data.checkInterval}s`,
            timestamp: data.timestamp
          });
        });
      }

      if (window.electronAPI.onMonitoringEvent) {
        console.log('[Home] Registering onMonitoringEvent listener');
        window.electronAPI.onMonitoringEvent((event, data) => {
          console.log('[Home] onMonitoringEvent callback fired with:', event, data);
          addActivity(data);
          // Reload stats to get fresh data
          loadStats();
        });
      } else {
        console.warn('[Home] onMonitoringEvent not available on electronAPI');
      }

      if (window.electronAPI.onMonitoringStopped) {
        console.log('[Home] Registering onMonitoringStopped listener');
        window.electronAPI.onMonitoringStopped((event, data) => {
          console.log('[Home] onMonitoringStopped fired with:', event, data);
          setIsMonitoring(false);
          addActivity({
            type: 'stopped',
            message: 'Monitoring stopped',
            timestamp: data.timestamp
          });
        });
      }
    } else {
      console.warn('[Home] electronAPI not available');
    }

    // Cleanup listeners and interval on unmount
    return () => {
      clearInterval(statsInterval);
      if (window.electronAPI && window.electronAPI.removeMonitoringListener) {
        window.electronAPI.removeMonitoringListener('monitoring-started');
        window.electronAPI.removeMonitoringListener('monitoring-event');
        window.electronAPI.removeMonitoringListener('monitoring-stopped');
      }
    };
  }, []);

  const addActivity = (activity) => {
    setRecentActivity(prev => [activity, ...prev.slice(0, 19)]); // Keep latest 20
  };

  const getActivityIcon = (type) => {
    const icons = {
      'success': '✅',
      'error': '❌',
      'info': 'ℹ️',
      'started': '▶️',
      'stopped': '⏹️'
    };
    return icons[type] || '📌';
  };

  const getActivityColor = (type) => {
    const colors = {
      'success': 'activity-success',
      'error': 'activity-error',
      'info': 'activity-info',
      'started': 'activity-started',
      'stopped': 'activity-stopped'
    };
    return colors[type] || '';
  };

  if (loading) {
    return (
      <div className="home-container">
        <div className="loading">
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="home-container">
      {/* Status Banner */}
      <div className={`status-banner ${isMonitoring ? 'monitoring' : 'idle'}`}>
        <div className="status-content">
          <span className={`status-indicator ${isMonitoring ? 'active' : ''}`}></span>
          <div className="status-text">
            <h2>{isMonitoring ? '🟢 Monitoring ACTIVE' : '🔴 Monitoring INACTIVE'}</h2>
            <p>
              {isMonitoring 
                ? 'Email monitoring is running and checking for new messages' 
                : 'Go to Settings to start automated email monitoring'}
            </p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📧</div>
          <div className="stat-info">
            <h3>Emails Checked</h3>
            <p className="stat-value">{stats.emailsCheckedToday}</p>
            <span className="stat-label">Today</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📄</div>
          <div className="stat-info">
            <h3>PDFs Generated</h3>
            <p className="stat-value">{stats.pdfsGeneratedToday}</p>
            <span className="stat-label">Today</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⚠️</div>
          <div className="stat-info">
            <h3>Errors</h3>
            <p className="stat-value">{stats.totalErrors}</p>
            <span className="stat-label">Today</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🕐</div>
          <div className="stat-info">
            <h3>Last Check</h3>
            <p className="stat-value" style={{ fontSize: '0.9rem' }}>
              {stats.lastCheckTime || 'Never'}
            </p>
            <span className="stat-label">Recent</span>
          </div>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="activity-section">
        <div className="activity-header">
          <h2>📜 Recent Activity</h2>
          <p className="activity-subtitle">Latest events from monitoring system (last 20)</p>
        </div>

        {recentActivity.length === 0 ? (
          <div className="activity-empty">
            <p>No activity yet. Start monitoring to see events here.</p>
          </div>
        ) : (
          <div className="activity-list">
            {recentActivity.map((activity, idx) => (
              <div 
                key={idx} 
                className={`activity-item ${getActivityColor(activity.type)}`}
              >
                <span className="activity-icon">{getActivityIcon(activity.type)}</span>
                <div className="activity-details">
                  <p className="activity-message">{activity.message}</p>
                  {activity.email && (
                    <p className="activity-meta">Email: {activity.email}</p>
                  )}
                  {activity.file && (
                    <p className="activity-meta">File: {activity.file}</p>
                  )}
                </div>
                <span className="activity-time">{activity.timestamp}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="info-section">
        <h3>ℹ️ How to Use</h3>
        <ol>
          <li>Go to <strong>Settings</strong> → <strong>⚙️ Polling Monitor</strong></li>
          <li>Configure check interval, email count, and PDF save folder</li>
          <li>Click <strong>▶️ Start Monitoring</strong> to begin automated email checking</li>
          <li>Monitor will check for new emails at regular intervals</li>
          <li>XLSX attachments will be automatically parsed and converted to PDFs</li>
          <li>Check this dashboard to see recent activity and statistics</li>
          <li>Click <strong>⏹️ Stop Monitoring</strong> to disable automated checking</li>
        </ol>
      </div>
    </div>
  );
}

export default Home;
