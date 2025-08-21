'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Package, 
  Truck, 
  MapPin, 
  Clock, 
  AlertTriangle, 
  TrendingUp,
  Users,
  Building2
} from 'lucide-react';

export default function LogisticsPage() {
  // Mock data for dashboard
  const quickStats = [
    { label: 'Active Shipments', value: '24', change: '+12%', icon: Package, color: '#3B82F6' },
    { label: 'In Transit', value: '18', change: '+8%', icon: Truck, color: '#10B981' },
    { label: 'Delivered Today', value: '7', change: '+3%', icon: MapPin, color: '#8B5CF6' },
    { label: 'Pending Approval', value: '5', change: '-2%', icon: Clock, color: '#F59E0B' }
  ];

  const recentShipments = [
    { id: 'SH-001', origin: 'Dubai', destination: 'London', status: 'In Transit', eta: '2 days', priority: 'High' },
    { id: 'SH-002', origin: 'Singapore', destination: 'New York', status: 'Pending', eta: '5 days', priority: 'Medium' },
    { id: 'SH-003', origin: 'Hong Kong', destination: 'Paris', status: 'Delivered', eta: 'Completed', priority: 'Low' },
    { id: 'SH-004', origin: 'Tokyo', destination: 'Berlin', status: 'In Transit', eta: '3 days', priority: 'High' }
  ];

  const alerts = [
    { type: 'warning', message: 'Shipment SH-001 delayed due to weather', time: '2 hours ago' },
    { type: 'info', message: 'New delivery route optimized', time: '4 hours ago' },
    { type: 'error', message: 'Hub capacity reaching threshold', time: '6 hours ago' }
  ];

  return (
    <div>
      {/* Breadcrumb */}
      <nav style={{ display: 'flex', marginBottom: '24px' }} aria-label="Breadcrumb">
        <ol style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <li style={{ display: 'inline-flex', alignItems: 'center' }}>
            <Link 
              href="/sprint-8/logistics" 
              style={{ 
                color: '#374151', 
                textDecoration: 'none',
                fontSize: '14px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#111827'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#374151'}
            >
              Logistics
            </Link>
          </li>
          <li>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ margin: '0 8px', color: '#9CA3AF' }}>/</span>
              <span style={{ color: '#6B7280', fontSize: '14px' }}>Dashboard</span>
            </div>
          </li>
        </ol>
      </nav>

      {/* Page Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ 
          fontSize: '30px', 
          fontWeight: 300, 
          color: '#111827', 
          marginBottom: '8px',
          letterSpacing: '-0.02em'
        }}>
          Logistics Dashboard
        </h1>
        <p style={{ 
          color: '#6B7280',
          fontSize: '16px'
        }}>
          Monitor shipments, track operations, and manage logistics workflow
        </p>
      </div>

      {/* Quick Stats */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '24px', 
        marginBottom: '32px' 
      }}>
        {quickStats.map((stat, index) => (
          <div key={index} style={{
            background: '#fff',
            borderRadius: '8px',
            border: '1px solid #e0e0e0',
            padding: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ 
                  fontSize: '14px', 
                  fontWeight: 500, 
                  color: '#6B7280',
                  marginBottom: '4px'
                }}>
                  {stat.label}
                </p>
                <p style={{ 
                  fontSize: '24px', 
                  fontWeight: 600, 
                  color: '#111827' 
                }}>
                  {stat.value}
                </p>
              </div>
              <div style={{
                padding: '12px',
                borderRadius: '50%',
                background: stat.color,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <stat.icon style={{ height: '24px', width: '24px' }} />
              </div>
            </div>
            <div style={{ marginTop: '16px' }}>
              <span style={{ 
                fontSize: '14px', 
                fontWeight: 500,
                color: stat.change.startsWith('+') ? '#059669' : '#DC2626'
              }}>
                {stat.change}
              </span>
              <span style={{ 
                fontSize: '14px', 
                color: '#6B7280', 
                marginLeft: '4px' 
              }}>
                from last week
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr', 
        gap: '32px' 
      }}>
        {/* Recent Shipments */}
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            border: '1px solid #e0e0e0'
          }}>
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #e0e0e0'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between' 
              }}>
                <h3 style={{ 
                  fontSize: '18px', 
                  fontWeight: 500, 
                  color: '#111827' 
                }}>
                  Recent Shipments
                </h3>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <Link 
                    href="/sprint-8/logistics/plan"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '8px 16px',
                      border: '1px solid #2563EB',
                      fontSize: '14px',
                      fontWeight: 500,
                      borderRadius: '6px',
                      color: '#2563EB',
                      background: '#fff',
                      textDecoration: 'none',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#2563EB';
                      e.currentTarget.style.color = '#fff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#fff';
                      e.currentTarget.style.color = '#2563EB';
                    }}
                  >
                    Plan Routes
                  </Link>
                  <Link 
                    href="/sprint-8/logistics/new"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '8px 16px',
                      border: '1px solid transparent',
                      fontSize: '14px',
                      fontWeight: 500,
                      borderRadius: '6px',
                      color: '#fff',
                      background: '#2563EB',
                      textDecoration: 'none',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#1D4ED8'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#2563EB'}
                  >
                    New Shipment
                  </Link>
                </div>
              </div>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {recentShipments.map((shipment) => (
                  <div key={shipment.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    background: '#f9fafb',
                    borderRadius: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ flexShrink: 0 }}>
                        <Package style={{ height: '32px', width: '32px', color: '#9CA3AF' }} />
                      </div>
                      <div>
                        <p style={{ 
                          fontSize: '14px', 
                          fontWeight: 500, 
                          color: '#111827' 
                        }}>
                          {shipment.id}
                        </p>
                        <p style={{ 
                          fontSize: '14px', 
                          color: '#6B7280' 
                        }}>
                          {shipment.origin} → {shipment.destination}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        fontSize: '12px',
                        fontWeight: 500,
                        ...(shipment.priority === 'High' ? {
                          background: '#FEE2E2',
                          color: '#991B1B'
                        } : shipment.priority === 'Medium' ? {
                          background: '#FEF3C7',
                          color: '#92400E'
                        } : {
                          background: '#D1FAE5',
                          color: '#065F46'
                        })
                      }}>
                        {shipment.priority}
                      </span>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        fontSize: '12px',
                        fontWeight: 500,
                        ...(shipment.status === 'Delivered' ? {
                          background: '#D1FAE5',
                          color: '#065F46'
                        } : shipment.status === 'In Transit' ? {
                          background: '#DBEAFE',
                          color: '#1E40AF'
                        } : {
                          background: '#F3F4F6',
                          color: '#374151'
                        })
                      }}>
                        {shipment.status}
                      </span>
                      <span style={{ 
                        fontSize: '14px', 
                        color: '#6B7280' 
                      }}>
                        {shipment.eta}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Alerts and Quick Actions */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '24px' 
        }}>
          {/* Alerts */}
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            border: '1px solid #e0e0e0'
          }}>
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #e0e0e0'
            }}>
              <h3 style={{ 
                fontSize: '18px', 
                fontWeight: 500, 
                color: '#111827' 
              }}>
                Recent Alerts
              </h3>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {alerts.map((alert, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{
                      flexShrink: 0,
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      marginTop: '8px',
                      ...(alert.type === 'error' ? { background: '#DC2626' } :
                          alert.type === 'warning' ? { background: '#F59E0B' } :
                          { background: '#3B82F6' })
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ 
                        fontSize: '14px', 
                        color: '#111827' 
                      }}>
                        {alert.message}
                      </p>
                      <p style={{ 
                        fontSize: '12px', 
                        color: '#6B7280', 
                        marginTop: '4px' 
                      }}>
                        {alert.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            border: '1px solid #e0e0e0'
          }}>
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #e0e0e0'
            }}>
              <h3 style={{ 
                fontSize: '18px', 
                fontWeight: 500, 
                color: '#111827' 
              }}>
                Quick Actions
              </h3>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Link 
                  href="/sprint-8/logistics/incidents"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    fontSize: '14px',
                    color: '#374151',
                    textDecoration: 'none',
                    borderRadius: '8px',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <AlertTriangle style={{ height: '20px', width: '20px', color: '#DC2626' }} />
                  <span>Report Incident</span>
                </Link>
                <Link 
                  href="/sprint-8/logistics/hub"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    fontSize: '14px',
                    color: '#374151',
                    textDecoration: 'none',
                    borderRadius: '8px',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Building2 style={{ height: '20px', width: '20px', color: '#3B82F6' }} />
                  <span>Hub Console</span>
                </Link>
                <Link 
                  href="/sprint-8/logistics/hub/management"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    fontSize: '14px',
                    color: '#374151',
                    textDecoration: 'none',
                    borderRadius: '8px',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Building2 style={{ height: '20px', width: '20px', color: '#8B5CF6' }} />
                  <span>Hub Management</span>
                </Link>
                <Link 
                  href="/sprint-8/people/contacts"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    fontSize: '14px',
                    color: '#374151',
                    textDecoration: 'none',
                    borderRadius: '8px',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Users style={{ height: '20px', width: '20px', color: '#059669' }} />
                  <span>Manage Contacts</span>
                </Link>
                <Link 
                  href="/sprint-8/billing/quotes"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    fontSize: '14px',
                    color: '#374151',
                    textDecoration: 'none',
                    borderRadius: '8px',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <TrendingUp style={{ height: '20px', width: '20px', color: '#8B5CF6' }} />
                  <span>View Quotes</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
