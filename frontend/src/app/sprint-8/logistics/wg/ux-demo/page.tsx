// frontend/src/app/sprint-8/logistics/wg/ux-demo/page.tsx
'use client';

import React, { useState } from 'react';
import { ArrowLeft, Zap, Clock, Globe, AlertTriangle, Shield, Target } from 'lucide-react';
import { useRouter } from 'next/navigation';
import WGEdgeCaseHandler from '@/components/WGEdgeCaseHandler';
import WGPerformanceTimer from '@/components/WGPerformanceTimer';

const WGUXDemo: React.FC = () => {
  const router = useRouter();
  const [selectedScenario, setSelectedScenario] = useState<string>('optimal');
  const [showTimer, setShowTimer] = useState(false);

  const scenarios = [
    {
      id: 'optimal',
      title: 'Optimal Flow',
      description: 'Perfect conditions - operator available, same timezone, no conflicts',
      color: '#22c55e',
      icon: <Target size={16} />,
      mockData: {
        shipment: {
          id: 'SH001',
          declaredValue: 125000,
          route: {
            legs: [
              {
                from: 'Manhattan Pickup',
                to: 'Newark Hub',
                distance: 25,
                estimatedDuration: 45,
                mode: 'drive' as const,
                isIntercity: false,
                isSameDay: true
              }
            ]
          },
          timezone: 'America/New_York'
        },
        hubSlot: {
          currentSlot: { start: new Date('2024-01-16T14:00:00'), end: new Date('2024-01-16T16:00:00') },
          expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
          minutesRemaining: 240,
          alternativeSlots: []
        }
      }
    },
    {
      id: 'cross_timezone',
      title: 'Cross-Timezone Complexity',
      description: 'Multi-timezone route with UTC display requirements',
      color: '#3b82f6',
      icon: <Globe size={16} />,
      mockData: {
        shipment: {
          id: 'SH002',
          declaredValue: 300000,
          route: {
            legs: [
              {
                from: 'Los Angeles',
                to: 'New York Hub',
                distance: 4500,
                estimatedDuration: 360,
                mode: 'flight' as const,
                isIntercity: true,
                isSameDay: false
              }
            ]
          },
          timezone: 'America/Los_Angeles'
        },
        hubSlot: {
          currentSlot: { start: new Date('2024-01-16T14:00:00'), end: new Date('2024-01-16T16:00:00') },
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
          minutesRemaining: 120,
          alternativeSlots: [
            { start: new Date('2024-01-16T17:00:00'), end: new Date('2024-01-16T19:00:00'), slaCompliant: true },
            { start: new Date('2024-01-17T09:00:00'), end: new Date('2024-01-17T11:00:00'), slaCompliant: true }
          ]
        }
      }
    },
    {
      id: 'high_value',
      title: 'High-Value Approval Flow',
      description: 'Million-dollar shipment requiring secondary approval',
      color: '#f59e0b',
      icon: <Shield size={16} />,
      mockData: {
        shipment: {
          id: 'SH003',
          declaredValue: 1200000,
          route: {
            legs: [
              {
                from: 'Geneva',
                to: 'Manhattan',
                distance: 6000,
                estimatedDuration: 480,
                mode: 'flight' as const,
                isIntercity: true,
                isSameDay: false
              }
            ]
          },
          timezone: 'Europe/Zurich'
        },
        hubSlot: {
          currentSlot: { start: new Date('2024-01-16T10:00:00'), end: new Date('2024-01-16T12:00:00') },
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          minutesRemaining: 30,
          alternativeSlots: [
            { start: new Date('2024-01-16T15:00:00'), end: new Date('2024-01-16T17:00:00'), slaCompliant: true }
          ]
        }
      }
    },
    {
      id: 'complex_edge',
      title: 'Maximum Complexity',
      description: 'All edge cases combined - stress test scenario',
      color: '#dc2626',
      icon: <AlertTriangle size={16} />,
      mockData: {
        shipment: {
          id: 'SH004',
          declaredValue: 2500000,
          route: {
            legs: [
              {
                from: 'Tokyo',
                to: 'Los Angeles Hub',
                distance: 8800,
                estimatedDuration: 720,
                mode: 'flight' as const,
                isIntercity: true,
                isSameDay: false
              },
              {
                from: 'Los Angeles Hub',
                to: 'New York Delivery',
                distance: 4500,
                estimatedDuration: 360,
                mode: 'flight' as const,
                isIntercity: true,
                isSameDay: false
              }
            ]
          },
          timezone: 'Asia/Tokyo'
        },
        hubSlot: {
          currentSlot: { start: new Date('2024-01-16T14:00:00'), end: new Date('2024-01-16T16:00:00') },
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          minutesRemaining: 15,
          alternativeSlots: [
            { start: new Date('2024-01-16T18:00:00'), end: new Date('2024-01-16T20:00:00'), slaCompliant: false },
            { start: new Date('2024-01-17T10:00:00'), end: new Date('2024-01-17T12:00:00'), slaCompliant: true }
          ]
        }
      }
    }
  ];

  const currentScenario = scenarios.find(s => s.id === selectedScenario)!;

  const mockOperator = {
    id: 'wg001',
    name: 'Elena Rodriguez',
    conflicts: selectedScenario === 'complex_edge' ? [
      { start: new Date('2024-01-16T15:00:00'), end: new Date('2024-01-16T17:00:00'), description: 'SH005 Delivery' }
    ] : []
  };

  const mockSchedule = [
    { type: 'pickup' as const, time: new Date('2024-01-16T09:00:00'), timezone: currentScenario.mockData.shipment.timezone },
    { type: 'hub_arrival' as const, time: new Date('2024-01-16T14:30:00'), timezone: 'America/New_York' },
    { type: 'hub_departure' as const, time: new Date('2024-01-16T15:30:00'), timezone: 'America/New_York' },
    { type: 'delivery' as const, time: new Date('2024-01-16T18:00:00'), timezone: 'America/New_York' }
  ];

  const handleStageChange = (stage: string) => {
    console.log(`Timer: Advanced to ${stage}`);
  };

  const handleTargetExceeded = () => {
    console.log('Timer: 2-minute target exceeded - UX optimization needed');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa' }}>
      {/* Performance Timer */}
      {showTimer && (
        <WGPerformanceTimer
          onStageChange={handleStageChange}
          onTargetExceeded={handleTargetExceeded}
        />
      )}

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
                WG UX Excellence Demo
              </h1>
              <p style={{ fontSize: '16px', color: '#666' }}>
                Edge case handling and performance optimization showcase
              </p>
            </div>
          </div>

          {/* Timer Control */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={() => setShowTimer(!showTimer)}
              style={{
                background: showTimer ? '#22c55e' : '#f0f9ff',
                color: showTimer ? '#fff' : '#0369a1',
                border: `1px solid ${showTimer ? '#22c55e' : '#0ea5e9'}`,
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Clock size={14} />
              {showTimer ? 'Timer Active' : 'Start 2-Min Timer'}
            </button>
            
            {showTimer && (
              <div style={{
                background: '#fef3c7',
                color: '#92400e',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 500
              }}>
                Target: Operator selection + slot confirmation in under 2 minutes
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 40px' }}>
        {/* Scenario Selection */}
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
            <Zap size={20} />
            UX Scenario Selection
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {scenarios.map((scenario) => (
              <div
                key={scenario.id}
                onClick={() => setSelectedScenario(scenario.id)}
                style={{
                  padding: '16px',
                  border: `2px solid ${selectedScenario === scenario.id ? scenario.color : '#e0e0e0'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: selectedScenario === scenario.id ? `${scenario.color}10` : '#fff',
                  transition: 'all 0.3s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ color: scenario.color }}>
                    {scenario.icon}
                  </div>
                  <h3 style={{ fontSize: '14px', fontWeight: 600 }}>
                    {scenario.title}
                  </h3>
                </div>
                <p style={{ fontSize: '12px', color: '#666', lineHeight: 1.4 }}>
                  {scenario.description}
                </p>
                
                {/* Scenario Stats */}
                <div style={{ marginTop: '12px', display: 'flex', gap: '12px', fontSize: '10px' }}>
                  <div>
                    <span style={{ color: '#666' }}>Value: </span>
                    <span style={{ fontWeight: 600 }}>
                      ${scenario.mockData.shipment.declaredValue.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#666' }}>Legs: </span>
                    <span style={{ fontWeight: 600 }}>
                      {scenario.mockData.shipment.route.legs.length}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#666' }}>Hub: </span>
                    <span style={{ fontWeight: 600 }}>
                      {scenario.mockData.hubSlot.minutesRemaining}m
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* UX Expectations */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid #e0e0e0',
          padding: '24px',
          marginBottom: '32px'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
            UX Expectations (How It Should Feel)
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            {[
              {
                title: '⚡ Under 2 Minutes',
                description: 'Operator selection + slot confirmation when roster has a match',
                status: 'performance'
              },
              {
                title: '🎯 Clarity Over Feasibility', 
                description: 'User always sees where a constraint fails and what to change',
                status: 'feedback'
              },
              {
                title: '🤝 Confident Handoff',
                description: 'Generated brief makes it obvious what the operator will do and when',
                status: 'communication'
              }
            ].map((expectation, idx) => (
              <div key={idx} style={{
                padding: '16px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px'
              }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                  {expectation.title}
                </h3>
                <p style={{ fontSize: '12px', color: '#666', lineHeight: 1.4 }}>
                  {expectation.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Edge Case Handler */}
        <WGEdgeCaseHandler
          shipment={currentScenario.mockData.shipment}
          operator={mockOperator}
          schedule={mockSchedule}
          hubSlot={currentScenario.mockData.hubSlot}
          onScheduleAdjustment={(newSchedule) => {
            console.log('Schedule adjusted:', newSchedule);
          }}
          onOperatorChange={(operatorId) => {
            console.log('Operator changed:', operatorId);
          }}
          onApprovalRequest={(approver) => {
            console.log('Approval requested from:', approver);
          }}
        />

        {/* Edge Cases Covered */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid #e0e0e0',
          padding: '24px'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
            Edge Cases & Handling Demonstrated
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {[
              {
                title: '🌍 Cross-timezone Planning',
                description: 'Always display Local + UTC; prevent AM/PM confusions',
                implemented: '✅ Dual timezone display with UTC hints'
              },
              {
                title: '✈️ Inter-city Legs',
                description: 'Inject realistic travel buffers; warn if impractical same day',
                implemented: '✅ Travel mode detection and buffer calculation'
              },
              {
                title: '⏰ Hub Slot Expiring',
                description: 'Show countdown; offer nearest valid alt slot within SLA',
                implemented: '✅ Real-time countdown with alternative slot suggestions'
              },
              {
                title: '📅 Operator Calendar Clash',
                description: 'Block save; suggest next free window or comparable operator',
                implemented: '✅ Conflict detection with alternative suggestions'
              },
              {
                title: '💎 High-value Shipments',
                description: 'Require secondary approval before final confirm',
                implemented: '✅ Configurable approval workflow for value thresholds'
              },
              {
                title: '🔄 Reschedule After Confirm',
                description: 'Single source of truth; new OTPs invalidate old ones',
                implemented: '✅ Version-controlled OTP management'
              },
              {
                title: '🛡️ PII Minimization',
                description: 'Brief shows only what operator needs; mask sensitive data',
                implemented: '✅ Privacy-filtered operator briefs with toggle'
              }
            ].map((edge, idx) => (
              <div key={idx} style={{
                padding: '16px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px'
              }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#166534' }}>
                  {edge.title}
                </h3>
                <p style={{ fontSize: '12px', color: '#166534', marginBottom: '8px', lineHeight: 1.4 }}>
                  {edge.description}
                </p>
                <div style={{
                  fontSize: '11px',
                  color: '#15803d',
                  fontWeight: 500,
                  background: '#dcfce7',
                  padding: '4px 8px',
                  borderRadius: '4px'
                }}>
                  {edge.implemented}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WGUXDemo;
