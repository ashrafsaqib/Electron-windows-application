import React, { useState, useEffect } from 'react';
import '../styles/Home.css';

function Home() {
    // Format date/time in Slovakian format
    const formatSlovakDateTime = (dateString) => {
      if (!dateString) return 'Never';
      let dateObj;
      // Try ISO or fallback to parsing as local time
      if (!isNaN(Date.parse(dateString))) {
        dateObj = new Date(dateString);
      } else {
        // Try to parse as time string (e.g., 12:34:56)
        const today = new Date();
        const [h, m, s] = (dateString.split(':').map(Number));
        if (!isNaN(h) && !isNaN(m)) {
          dateObj = new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m, s || 0);
        } else {
          return dateString;
        }
      }
      return new Intl.DateTimeFormat('sk-SK', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(dateObj);
    };
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [stats, setStats] = useState({
    emailsCheckedToday: 0,
    pdfsGeneratedToday: 0,
    lastCheckTime: null
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
            setStats(result.stats);
          }
        }).catch(err => {
          console.error('[Home] Error loading stats:', err);
        });
      }
    };

    // Load initial activity log from file
    const loadActivities = () => {
      if (window.electronAPI && window.electronAPI.getTodayActivities) {
        window.electronAPI.getTodayActivities().then(result => {
          if (result.success && Array.isArray(result.activities)) {
            // Show most recent first, limit to 20
            setRecentActivity(result.activities.slice(-20).reverse());
          }
        }).catch(err => {
          console.error('[Home] Error loading activities:', err);
        });
      }
    };

    // Load stats and activities immediately
    loadStats();
    loadActivities();

    // Set up periodic stats loading (every 5 seconds)
    const statsInterval = setInterval(loadStats, 5000);

    // Subscribe to monitoring events
    if (window.electronAPI) {
      if (window.electronAPI.onMonitoringStarted) {
        window.electronAPI.onMonitoringStarted((event, data) => {
          setIsMonitoring(true);
          addActivity({
            type: 'started',
            message: `Monitoring started - checking every ${data.checkInterval}s`,
            timestamp: data.timestamp
          });
        });
      }

      if (window.electronAPI.onMonitoringEvent) {
        window.electronAPI.onMonitoringEvent((event, data) => {
          addActivity(data);
          // Reload stats to get fresh data
          loadStats();
        });
      }

      if (window.electronAPI.onMonitoringStopped) {
        window.electronAPI.onMonitoringStopped((event, data) => {
          setIsMonitoring(false);
          addActivity({
            type: 'stopped',
            message: 'Monitoring stopped',
            timestamp: data.timestamp
          });
        });
      }
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

        {/* Removed Errors stat card */}

        <div className="stat-card">
          <div className="stat-icon">🕐</div>
          <div className="stat-info">
            <h3>Last Check</h3>
            <p className="stat-value" style={{ fontSize: '0.9rem' }}>
              {formatSlovakDateTime(stats.lastCheckTime)}
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
                <span className="activity-time">{formatSlovakDateTime(activity.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;
