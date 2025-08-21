// frontend/src/components/WGTelemetryDashboard.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart3,
  TrendingUp,
  Clock,
  AlertTriangle,
  Users,
  Target,
  Activity,
  Zap,
  Eye,
  Calendar,
  MapPin,
  Truck,
  Building2
} from 'lucide-react';
import { wgTelemetryService } from '@/lib/wgTelemetry';

interface TelemetryDashboardProps {
  shipmentId?: string; // If provided, shows shipment-specific analytics
}

const WGTelemetryDashboard: React.FC<TelemetryDashboardProps> = ({ shipmentId }) => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [globalAnalytics, setGlobalAnalytics] = useState<any>(null);
  const [isLive, setIsLive] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<string>('performance');

  // Update analytics data
  useEffect(() => {
    const updateData = () => {
      if (shipmentId) {
        setAnalytics(wgTelemetryService.getShipmentAnalytics(shipmentId));
      }
      setGlobalAnalytics(wgTelemetryService.getGlobalAnalytics());
    };

    updateData();

    if (isLive) {
      const interval = setInterval(updateData, 2000); // Update every 2 seconds
      return () => clearInterval(interval);
    }
  }, [shipmentId, isLive]);

  // Listen for real-time telemetry events
  useEffect(() => {
    const handleTelemetryEvent = (event: CustomEvent) => {
      console.log('Live telemetry event:', event.detail);
      // Trigger data refresh
      setTimeout(() => {
        if (shipmentId) {
          setAnalytics(wgTelemetryService.getShipmentAnalytics(shipmentId));
        }
        setGlobalAnalytics(wgTelemetryService.getGlobalAnalytics());
      }, 100);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('wg-telemetry', handleTelemetryEvent as EventListener);
      return () => {
        window.removeEventListener('wg-telemetry', handleTelemetryEvent as EventListener);
      };
    }
  }, [shipmentId]);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getPerformanceColor = (timeMs: number) => {
    if (timeMs <= 60000) return '#22c55e'; // Under 1 minute - excellent
    if (timeMs <= 120000) return '#3b82f6'; // Under 2 minutes - good
    if (timeMs <= 300000) return '#f59e0b'; // Under 5 minutes - warning
    return '#dc2626'; // Over 5 minutes - poor
  };

  const getConflictIcon = (type: string) => {
    switch (type) {
      case 'window': return <Calendar size={14} />;
      case 'travel': return <MapPin size={14} />;
      case 'hub': return <Building2 size={14} />;
      case 'calendar': return <Clock size={14} />;
      default: return <AlertTriangle size={14} />;
    }
  };

  if (!analytics && !globalAnalytics) {
    return (
      <div style={{
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid #e0e0e0',
        padding: '40px',
        textAlign: 'center'
      }}>
        <Activity size={32} color="#666" style={{ marginBottom: '16px' }} />
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
          No Telemetry Data Yet
        </h3>
        <p style={{ fontSize: '14px', color: '#666' }}>
          Start using the WG assignment system to see analytics
        </p>
      </div>
    );
  }

  return (
    <div style={{
      background: '#fff',
      borderRadius: '12px',
      border: '1px solid #e0e0e0'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h3 style={{
            fontSize: '18px',
            fontWeight: 600,
            marginBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <BarChart3 size={20} />
            {shipmentId ? `Analytics: ${shipmentId}` : 'Global WG Analytics'}
          </h3>
          <p style={{ fontSize: '13px', color: '#666' }}>
            Real-time performance and behavior insights
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setIsLive(!isLive)}
            style={{
              background: isLive ? '#22c55e' : '#6b7280',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#fff',
              animation: isLive ? 'pulse 2s infinite' : 'none'
            }} />
            {isLive ? 'LIVE' : 'PAUSED'}
          </button>
          
          {shipmentId && (
            <button
              onClick={() => window.open(`/sprint-8/logistics/wg/${shipmentId}`, '_blank')}
              style={{
                background: '#f0f9ff',
                color: '#0369a1',
                border: '1px solid #0ea5e9',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Open Assignment
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '20px' }}>
        {/* Metric Selector */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          background: '#f8fafc',
          padding: '4px',
          borderRadius: '8px'
        }}>
          {[
            { id: 'performance', label: 'Performance', icon: <Zap size={14} /> },
            { id: 'conflicts', label: 'Conflicts', icon: <AlertTriangle size={14} /> },
            { id: 'operators', label: 'Operators', icon: <Users size={14} /> }
          ].map((metric) => (
            <button
              key={metric.id}
              onClick={() => setSelectedMetric(metric.id)}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: selectedMetric === metric.id ? '#fff' : 'transparent',
                color: selectedMetric === metric.id ? '#000' : '#666',
                border: selectedMetric === metric.id ? '1px solid #e0e0e0' : 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              {metric.icon}
              {metric.label}
            </button>
          ))}
        </div>

        {/* Performance Metrics */}
        {selectedMetric === 'performance' && (
          <div>
            {shipmentId && analytics?.performance && (
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                  Assignment Timeline
                </h4>
                
                <div style={{
                  background: '#f8fafc',
                  borderRadius: '8px',
                  padding: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '24px', fontWeight: 700, color: getPerformanceColor(analytics.performance.totalConfirmTime || 0) }}>
                        {formatDuration(analytics.performance.totalConfirmTime || 0)}
                      </div>
                      <div style={{ fontSize: '11px', color: '#666', fontWeight: 500 }}>
                        TOTAL TIME TO CONFIRM
                      </div>
                    </div>
                    
                    <div style={{
                      background: analytics.performance.totalConfirmTime <= 120000 ? '#f0fdf4' : '#fef2f2',
                      color: analytics.performance.totalConfirmTime <= 120000 ? '#166534' : '#dc2626',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 600
                    }}>
                      {analytics.performance.totalConfirmTime <= 120000 ? 'TARGET MET' : 'TARGET MISSED'}
                    </div>
                  </div>
                  
                  {/* Stage Breakdown */}
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {[
                      { key: 'operatorSelection', label: 'Operator', icon: <Users size={12} /> },
                      { key: 'scheduling', label: 'Schedule', icon: <Clock size={12} /> },
                      { key: 'validation', label: 'Validation', icon: <Target size={12} /> },
                      { key: 'chainOfCustody', label: 'Custody', icon: <Eye size={12} /> }
                    ].map((stage) => {
                      const time = analytics.performance[stage.key] || 0;
                      return (
                        <div key={stage.key} style={{
                          background: '#fff',
                          borderRadius: '6px',
                          padding: '8px',
                          border: '1px solid #e0e0e0',
                          flex: 1,
                          textAlign: 'center'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>
                            {stage.icon}
                            <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>
                              {stage.label}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: 600 }}>
                            {formatDuration(time)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Global Performance Distribution */}
            {globalAnalytics && (
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                  Global Performance Distribution
                </h4>
                
                <div style={{
                  background: '#f8fafc',
                  borderRadius: '8px',
                  padding: '16px'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                    {[
                      { range: 'under60s', label: '< 1 min', color: '#22c55e', count: globalAnalytics.performanceDistribution.under60s },
                      { range: 'under120s', label: '< 2 min', color: '#3b82f6', count: globalAnalytics.performanceDistribution.under120s },
                      { range: 'under300s', label: '< 5 min', color: '#f59e0b', count: globalAnalytics.performanceDistribution.under300s },
                      { range: 'over300s', label: '> 5 min', color: '#dc2626', count: globalAnalytics.performanceDistribution.over300s }
                    ].map((dist) => (
                      <div key={dist.range} style={{
                        background: '#fff',
                        borderRadius: '6px',
                        padding: '12px',
                        border: '1px solid #e0e0e0',
                        textAlign: 'center'
                      }}>
                        <div style={{
                          fontSize: '18px',
                          fontWeight: 700,
                          color: dist.color,
                          marginBottom: '4px'
                        }}>
                          {dist.count}
                        </div>
                        <div style={{ fontSize: '11px', color: '#666', fontWeight: 500 }}>
                          {dist.label}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div style={{ marginTop: '16px', fontSize: '12px', color: '#666', textAlign: 'center' }}>
                    Total Sessions: {globalAnalytics.totalSessions} | Average: {formatDuration(globalAnalytics.averageConfirmTime)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Conflict Metrics */}
        {selectedMetric === 'conflicts' && (
          <div>
            {shipmentId && analytics?.conflicts && (
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                  Assignment Conflicts
                </h4>
                
                <div style={{
                  background: analytics.conflicts.totalConflicts > 0 ? '#fef2f2' : '#f0fdf4',
                  borderRadius: '8px',
                  padding: '16px',
                  border: `1px solid ${analytics.conflicts.totalConflicts > 0 ? '#fecaca' : '#bbf7d0'}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: 700,
                        color: analytics.conflicts.totalConflicts > 0 ? '#dc2626' : '#22c55e'
                      }}>
                        {analytics.conflicts.totalConflicts}
                      </div>
                      <div style={{ fontSize: '11px', color: '#666', fontWeight: 500 }}>
                        TOTAL CONFLICTS
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' }}>
                    {[
                      { type: 'window', label: 'Time Windows', count: analytics.conflicts.windowConflicts },
                      { type: 'travel', label: 'Travel Time', count: analytics.conflicts.travelConflicts },
                      { type: 'hub', label: 'Hub Capacity', count: analytics.conflicts.hubConflicts },
                      { type: 'calendar', label: 'Calendar', count: analytics.conflicts.calendarConflicts }
                    ].map((conflict) => (
                      <div key={conflict.type} style={{
                        background: '#fff',
                        borderRadius: '6px',
                        padding: '8px',
                        border: '1px solid #e0e0e0',
                        textAlign: 'center'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>
                          {getConflictIcon(conflict.type)}
                          <span style={{ fontSize: '10px', fontWeight: 600 }}>
                            {conflict.label}
                          </span>
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 600 }}>
                          {conflict.count}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Global Conflict Breakdown */}
            {globalAnalytics && (
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                  Global Conflict Analysis
                </h4>
                
                <div style={{
                  background: '#f8fafc',
                  borderRadius: '8px',
                  padding: '16px'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                    {[
                      { type: 'window', label: 'Time Windows', count: globalAnalytics.conflictBreakdown.window, icon: <Calendar size={16} /> },
                      { type: 'travel', label: 'Travel Time', count: globalAnalytics.conflictBreakdown.travel, icon: <MapPin size={16} /> },
                      { type: 'hub', label: 'Hub Capacity', count: globalAnalytics.conflictBreakdown.hub, icon: <Building2 size={16} /> },
                      { type: 'calendar', label: 'Calendar', count: globalAnalytics.conflictBreakdown.calendar, icon: <Clock size={16} /> }
                    ].map((conflict) => (
                      <div key={conflict.type} style={{
                        background: '#fff',
                        borderRadius: '6px',
                        padding: '12px',
                        border: '1px solid #e0e0e0',
                        textAlign: 'center'
                      }}>
                        <div style={{
                          color: '#666',
                          marginBottom: '8px',
                          display: 'flex',
                          justifyContent: 'center'
                        }}>
                          {conflict.icon}
                        </div>
                        <div style={{
                          fontSize: '18px',
                          fontWeight: 700,
                          color: conflict.count > 0 ? '#f59e0b' : '#22c55e',
                          marginBottom: '4px'
                        }}>
                          {conflict.count}
                        </div>
                        <div style={{ fontSize: '11px', color: '#666', fontWeight: 500 }}>
                          {conflict.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Operator Metrics */}
        {selectedMetric === 'operators' && globalAnalytics && (
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
              Top Operators by Score
            </h4>
            
            <div style={{
              background: '#f8fafc',
              borderRadius: '8px',
              padding: '16px'
            }}>
              {globalAnalytics.topOperatorsByScore.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '20px',
                  color: '#666',
                  fontSize: '13px'
                }}>
                  No operator suggestions yet
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {globalAnalytics.topOperatorsByScore.slice(0, 5).map(([operatorId, stats]: [string, any], idx: number) => (
                    <div key={operatorId} style={{
                      background: '#fff',
                      borderRadius: '6px',
                      padding: '12px',
                      border: '1px solid #e0e0e0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: idx === 0 ? '#fbbf24' : idx === 1 ? '#c0c0c0' : idx === 2 ? '#cd7f32' : '#e5e7eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: idx < 3 ? '#fff' : '#666'
                        }}>
                          {idx + 1}
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>
                            {operatorId}
                          </div>
                          <div style={{ fontSize: '11px', color: '#666' }}>
                            {stats.count} suggestions
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#22c55e' }}>
                          {stats.avg.toFixed(1)}
                        </div>
                        <div style={{ fontSize: '10px', color: '#666' }}>
                          AVG SCORE
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default WGTelemetryDashboard;
