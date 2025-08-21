// frontend/src/app/sprint-8/logistics/wg/rbac-demo/page.tsx
'use client';

import React, { useState } from 'react';
import { ArrowLeft, Shield, User, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createWGContext, getWGUIPermissions, type UserRole } from '@/lib/wgRBAC';
import { wgEventService } from '@/lib/wgEvents';

const WGRBACDemo: React.FC = () => {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<UserRole>('ops_admin');
  const [eventLog, setEventLog] = useState<any[]>([]);
  
  // Subscribe to all WG events for demo
  React.useEffect(() => {
    const handleEvent = (event: any) => {
      setEventLog(prev => [event, ...prev].slice(0, 10)); // Keep last 10 events
    };
    
    wgEventService.subscribe('*', handleEvent);
    
    return () => {
      wgEventService.unsubscribe('*', handleEvent);
    };
  }, []);

  const rbacContext = createWGContext('demo-user', selectedRole, 'demo-session');
  const permissions = getWGUIPermissions(rbacContext);

  const roles: Array<{role: UserRole, label: string, description: string, color: string}> = [
    {
      role: 'ops_admin',
      label: 'Operations Admin',
      description: 'Full access to all WG operations, can assign operators and override SLA',
      color: '#dc2626'
    },
    {
      role: 'hub_tech',
      label: 'Hub Technician', 
      description: 'Can view assignments and OTPs for hub operations, cannot assign operators',
      color: '#f59e0b'
    },
    {
      role: 'wg_operator',
      label: 'WG Operator',
      description: 'Can view their own assignments and download briefs, limited access',
      color: '#22c55e'
    },
    {
      role: 'exec',
      label: 'Executive',
      description: 'High-level view and escalation powers, no operational access',
      color: '#7c3aed'
    }
  ];

  const permissionDetails = [
    { key: 'showAssignButton', label: 'Assign Operators', description: 'Create new WG assignments' },
    { key: 'showModifySchedule', label: 'Modify Schedules', description: 'Change existing schedules' },
    { key: 'showSLAOverride', label: 'SLA Override', description: 'Override SLA constraints with reason' },
    { key: 'showOTPCodes', label: 'View OTP Codes', description: 'Access verification codes' },
    { key: 'showEscalateButton', label: 'Escalate Sourcing', description: 'Escalate to external partners' },
    { key: 'showOperatorDetails', label: 'Operator Details', description: 'View operator information' },
    { key: 'showDownloadBrief', label: 'Download Briefs', description: 'Export operator briefs' },
    { key: 'showAuditLogs', label: 'Audit Logs', description: 'View system audit trail' },
    { key: 'isReadOnly', label: 'Read-Only Mode', description: 'Limited to viewing only', inverse: true }
  ];

  const simulateWGAssignment = () => {
    wgEventService.emitWGAssigned({
      shipmentId: 'SH001',
      operatorId: 'wg001',
      pickupAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      hubIntakeAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      deliveryAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
      tzs: {
        pickup: 'America/New_York',
        hub: 'America/New_York',
        delivery: 'America/New_York'
      },
      actorId: rbacContext.userId
    });
  };

  const simulateSourcingFlow = () => {
    // Start sourcing
    wgEventService.emitSourcingStarted({
      shipmentId: 'SH003',
      filter: {
        cities: ['Manhattan'],
        minValue: 950000,
        maxDistance: 50,
        urgency: 'premium'
      },
      slaTargetAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      actorId: rbacContext.userId
    });

    // Simulate assignment after delay
    setTimeout(() => {
      wgEventService.emitSourcingAssigned({
        shipmentId: 'SH003',
        operatorId: 'ext001',
        timeToAssignMs: 15 * 60 * 1000 // 15 minutes
      });
    }, 2000);
  };

  const simulateEscalation = () => {
    wgEventService.emitSourcingEscalated({
      shipmentId: 'SH002',
      reason: 'SLA risk - no operators available in standard network',
      channel: 'partner_vendors',
      actorId: rbacContext.userId
    });
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa' }}>
      {/* Header */}
      <div style={{
        background: '#fff',
        padding: '24px 0',
        borderBottom: '1px solid #e0e0e0',
        marginBottom: '32px'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <button
              onClick={() => router.back()}
              style={{
                background: 'none',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                padding: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 style={{
                fontSize: '28px',
                fontWeight: 300,
                letterSpacing: '-0.02em',
                marginBottom: '4px'
              }}>
                WG RBAC & Events Demo
              </h1>
              <p style={{ fontSize: '16px', color: '#666' }}>
                Role-Based Access Control and Event System demonstration
              </p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 40px' }}>
        {/* Role Selection */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid #e0e0e0',
          padding: '24px',
          marginBottom: '32px'
        }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: 600,
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <User size={20} />
            Select User Role
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            {roles.map((role) => (
              <div
                key={role.role}
                onClick={() => setSelectedRole(role.role)}
                style={{
                  padding: '16px',
                  border: `2px solid ${selectedRole === role.role ? role.color : '#e0e0e0'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: selectedRole === role.role ? `${role.color}10` : '#fff',
                  transition: 'all 0.3s'
                }}
              >
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: role.color,
                  marginBottom: '8px'
                }} />
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
                  {role.label}
                </h3>
                <p style={{ fontSize: '12px', color: '#666', lineHeight: 1.4 }}>
                  {role.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          {/* Permissions Matrix */}
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            border: '1px solid #e0e0e0',
            padding: '24px'
          }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 600,
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Shield size={20} />
              Role Permissions
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {permissionDetails.map((perm) => {
                const hasPermission = perm.inverse ? 
                  !permissions[perm.key as keyof typeof permissions] : 
                  permissions[perm.key as keyof typeof permissions];
                
                return (
                  <div key={perm.key} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    background: hasPermission ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${hasPermission ? '#bbf7d0' : '#fecaca'}`,
                    borderRadius: '6px'
                  }}>
                    <div>
                      <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '2px' }}>
                        {perm.label}
                      </h4>
                      <p style={{ fontSize: '11px', color: '#666' }}>
                        {perm.description}
                      </p>
                    </div>
                    {hasPermission ? (
                      <CheckCircle size={16} color="#22c55e" />
                    ) : (
                      <XCircle size={16} color="#dc2626" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Event Simulation */}
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            border: '1px solid #e0e0e0',
            padding: '24px'
          }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 600,
              marginBottom: '16px'
            }}>
              Event Simulation
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <button
                onClick={simulateWGAssignment}
                style={{
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500
                }}
              >
                Simulate WG Assignment
              </button>
              
              <button
                onClick={simulateSourcingFlow}
                style={{
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500
                }}
              >
                Simulate Sourcing Flow
              </button>
              
              <button
                onClick={simulateEscalation}
                style={{
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500
                }}
              >
                Simulate Escalation
              </button>
            </div>

            {/* Event Log */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                Recent Events ({eventLog.length})
              </h3>
              <div style={{
                maxHeight: '300px',
                overflowY: 'auto',
                border: '1px solid #e0e0e0',
                borderRadius: '6px'
              }}>
                {eventLog.length === 0 ? (
                  <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    color: '#666',
                    fontSize: '13px'
                  }}>
                    No events yet. Click buttons above to simulate events.
                  </div>
                ) : (
                  eventLog.map((event, idx) => (
                    <div key={idx} style={{
                      padding: '12px',
                      borderBottom: idx < eventLog.length - 1 ? '1px solid #f0f0f0' : 'none',
                      fontSize: '12px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, color: '#333' }}>
                          {event.event}
                        </span>
                        <span style={{ color: '#666' }}>
                          {new Date(event.data.ts).toLocaleTimeString()}
                        </span>
                      </div>
                      <div style={{ color: '#666' }}>
                        {event.data.shipmentId && `Shipment: ${event.data.shipmentId}`}
                        {event.data.operatorId && ` | Operator: ${event.data.operatorId}`}
                        {event.data.actorId && ` | Actor: ${event.data.actorId}`}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Definition of Done Checklist */}
        <div style={{
          marginTop: '32px',
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid #e0e0e0',
          padding: '24px'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
            Definition of Done - WG Assignment System
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            {[
              {
                title: '✅ Single Operator Assignment',
                description: 'Ops can assign one operator for pickup → hub → delivery chain'
              },
              {
                title: '✅ Constraint Validation',
                description: 'Slots obey Plan, time windows, Hub capacity, and SLA requirements'
              },
              {
                title: '✅ No Automatic DHL Fallback',
                description: 'Explicit escalation path with no automatic fallback to standard shipping'
              },
              {
                title: '✅ OTP Generation',
                description: 'Verification codes created and attached to shipment detail'
              },
              {
                title: '✅ Dashboard Queue Updates',
                description: '"WG to assign" count decreases, shows operator + first slot'
              },
              {
                title: '✅ Event Emission',
                description: 'Updates Dashboard, notifies Inventory/Hub, feeds Sprint 2 timeline'
              },
              {
                title: '✅ Audit Logging',
                description: 'All actions logged with user, timestamp, and details'
              },
              {
                title: '✅ RBAC Enforcement',
                description: 'Only Ops/Admin can assign; hub_tech can view but not assign'
              }
            ].map((item, idx) => (
              <div key={idx} style={{
                padding: '16px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px'
              }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#166534' }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: '12px', color: '#166534', lineHeight: 1.4 }}>
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WGRBACDemo;
