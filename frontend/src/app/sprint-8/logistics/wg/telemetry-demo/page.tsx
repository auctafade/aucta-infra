// frontend/src/app/sprint-8/logistics/wg/telemetry-demo/page.tsx
'use client';

import React, { useState } from 'react';
import { ArrowLeft, BarChart3, Activity, Timer, AlertTriangle, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import WGTelemetryDashboard from '@/components/WGTelemetryDashboard';
import { 
  trackWGViewOpen, 
  trackOperatorSuggestion, 
  trackSlotConflict, 
  trackConfirmTime, 
  trackTimeToAssign,
  wgTelemetryService
} from '@/lib/wgTelemetry';

const WGTelemetryDemo: React.FC = () => {
  const router = useRouter();
  const [selectedDemo, setSelectedDemo] = useState<string>('individual');
  const [isSimulating, setIsSimulating] = useState(false);

  const simulateUserJourney = async () => {
    setIsSimulating(true);
    
    try {
      // Simulate complete user journey with realistic timing
      const shipmentId = 'SH001';
      const userId = 'demo-user';
      const sessionId = 'demo-session-' + Date.now();

      console.log('🚀 Starting telemetry simulation...');

      // 1. User opens WG assignment page
      trackWGViewOpen(shipmentId, userId, sessionId);
      await delay(1000);

      // 2. System suggests multiple operators with scores
      const operators = [
        { id: 'wg001', score: 92, factors: { proximity: 25, language: 20, valueClearance: 30, rating: 12, availability: 5 } },
        { id: 'wg002', score: 78, factors: { proximity: 15, language: 20, valueClearance: 30, rating: 8, availability: 5 } },
        { id: 'wg003', score: 85, factors: { proximity: 20, language: 20, valueClearance: 30, rating: 10, availability: 5 } }
      ];

      for (const op of operators) {
        trackOperatorSuggestion(shipmentId, op.id, op.score, op.factors);
        await delay(500);
      }

      // 3. User encounters various conflicts during scheduling
      const conflicts = [
        { type: 'window' as const, details: { requested: '2024-01-16T09:00:00Z', constraint: 'Sender available 10:00-14:00', suggestion: 'Reschedule to 10:00' } },
        { type: 'hub' as const, details: { requested: '2024-01-16T15:00:00Z', constraint: 'Hub capacity full until 16:00', suggestion: 'Use 16:00 slot' } },
        { type: 'calendar' as const, details: { requested: '2024-01-16T17:00:00Z', constraint: 'Operator has conflicting assignment', suggestion: 'Use alternative operator' } }
      ];

      for (const conflict of conflicts) {
        trackSlotConflict(shipmentId, conflict.type, conflict.details, 'wg001');
        await delay(800);
      }

      // 4. Final confirmation timing (simulate 2.5 minute journey)
      await delay(2000);
      wgTelemetryService.trackStageComplete(shipmentId, 'operatorSelection');
      await delay(1000);
      wgTelemetryService.trackStageComplete(shipmentId, 'scheduling');
      await delay(800);
      wgTelemetryService.trackStageComplete(shipmentId, 'validation');
      await delay(500);
      wgTelemetryService.trackStageComplete(shipmentId, 'chainOfCustody');
      
      trackConfirmTime(shipmentId, userId);

      // 5. Track time to assign from original plan
      const planCreatedAt = new Date(Date.now() - 45 * 60 * 1000); // 45 minutes ago
      trackTimeToAssign(shipmentId, planCreatedAt, userId);

      console.log('✅ Telemetry simulation complete!');
    } catch (error) {
      console.error('❌ Simulation error:', error);
    } finally {
      setIsSimulating(false);
    }
  };

  const simulateMultipleUsers = async () => {
    setIsSimulating(true);
    
    try {
      console.log('🚀 Starting multi-user simulation...');
      
      // Simulate 5 different users with varying performance
      const users = [
        { id: 'user1', performance: 'excellent', timeMultiplier: 0.7 },
        { id: 'user2', performance: 'good', timeMultiplier: 1.0 },
        { id: 'user3', performance: 'slow', timeMultiplier: 2.5 },
        { id: 'user4', performance: 'average', timeMultiplier: 1.3 },
        { id: 'user5', performance: 'fast', timeMultiplier: 0.8 }
      ];

      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const shipmentId = `SH00${i + 1}`;
        const sessionId = `session-${user.id}-${Date.now()}`;
        
        // Simulate user journey with different performance characteristics
        trackWGViewOpen(shipmentId, user.id, sessionId);
        
        await delay(500 * user.timeMultiplier);
        
        // Suggest operators
        trackOperatorSuggestion(shipmentId, 'wg001', 85 + Math.random() * 15, {
          proximity: 20 + Math.random() * 5,
          language: 18 + Math.random() * 2,
          valueClearance: 25 + Math.random() * 5,
          rating: 12 + Math.random() * 3,
          availability: 8 + Math.random() * 2
        });
        
        await delay(300 * user.timeMultiplier);
        
        // Some users encounter conflicts
        if (Math.random() > 0.6) {
          trackSlotConflict(shipmentId, 'window', {
            requested: '2024-01-16T14:00:00Z',
            constraint: 'Outside time window',
            suggestion: 'Adjust to 15:00'
          });
        }
        
        await delay(1000 * user.timeMultiplier);
        
        // Complete stages
        wgTelemetryService.trackStageComplete(shipmentId, 'operatorSelection');
        wgTelemetryService.trackStageComplete(shipmentId, 'scheduling');
        wgTelemetryService.trackStageComplete(shipmentId, 'validation');
        wgTelemetryService.trackStageComplete(shipmentId, 'chainOfCustody');
        
        trackConfirmTime(shipmentId, user.id);
        
        await delay(200);
      }
      
      console.log('✅ Multi-user simulation complete!');
    } catch (error) {
      console.error('❌ Multi-user simulation error:', error);
    } finally {
      setIsSimulating(false);
    }
  };

  const clearTelemetryData = () => {
    wgTelemetryService.clearData();
    console.log('🗑️ Telemetry data cleared');
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const demoScenarios = [
    {
      id: 'individual',
      title: 'Individual Shipment',
      description: 'View analytics for a specific shipment assignment',
      color: '#3b82f6',
      icon: <BarChart3 size={16} />
    },
    {
      id: 'global',
      title: 'Global Analytics',
      description: 'View system-wide performance and behavior patterns',
      color: '#22c55e',
      icon: <Activity size={16} />
    }
  ];

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
                WG Telemetry Analytics Demo
              </h1>
              <p style={{ fontSize: '16px', color: '#666' }}>
                Real-time performance tracking and behavioral analytics
              </p>
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={simulateUserJourney}
              disabled={isSimulating}
              style={{
                background: isSimulating ? '#6b7280' : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: isSimulating ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Timer size={14} />
              {isSimulating ? 'Simulating...' : 'Simulate User Journey'}
            </button>
            
            <button
              onClick={simulateMultipleUsers}
              disabled={isSimulating}
              style={{
                background: isSimulating ? '#6b7280' : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: isSimulating ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Users size={14} />
              {isSimulating ? 'Simulating...' : 'Simulate 5 Users'}
            </button>

            <button
              onClick={clearTelemetryData}
              style={{
                background: '#f59e0b',
                color: '#fff',
                border: 'none',
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
              <AlertTriangle size={14} />
              Clear Data
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 40px' }}>
        {/* Demo Scenario Selection */}
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
            marginBottom: '16px'
          }}>
            Analytics View
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            {demoScenarios.map((scenario) => (
              <div
                key={scenario.id}
                onClick={() => setSelectedDemo(scenario.id)}
                style={{
                  padding: '16px',
                  border: `2px solid ${selectedDemo === scenario.id ? scenario.color : '#e0e0e0'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: selectedDemo === scenario.id ? `${scenario.color}10` : '#fff',
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
              </div>
            ))}
          </div>
        </div>

        {/* Telemetry Events Tracked */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid #e0e0e0',
          padding: '24px',
          marginBottom: '32px'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
            Telemetry Events Tracked
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {[
              {
                event: 'wg.view.open',
                description: 'User opens WG assignment page',
                data: 'shipmentId, actor, timestamp, session',
                color: '#3b82f6'
              },
              {
                event: 'wg.operator.suggested',
                description: 'System suggests operator with compatibility score',
                data: 'operatorId, score, factors breakdown',
                color: '#22c55e'
              },
              {
                event: 'wg.slot.conflict',
                description: 'Scheduling conflict detected',
                data: 'conflict type, details, suggestions',
                color: '#f59e0b'
              },
              {
                event: 'wg.confirm.time_ms',
                description: 'Time from page open to assignment confirmation',
                data: 'total time, stage breakdown',
                color: '#8b5cf6'
              },
              {
                event: 'wg.time_to_assign_ms',
                description: 'Time from Plan creation to WG assignment',
                data: 'plan timestamp, assignment timestamp',
                color: '#06b6d4'
              }
            ].map((telemetry, idx) => (
              <div key={idx} style={{
                padding: '16px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px'
                }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: telemetry.color
                  }} />
                  <h3 style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    fontFamily: 'monospace',
                    color: telemetry.color
                  }}>
                    {telemetry.event}
                  </h3>
                </div>
                <p style={{ fontSize: '12px', color: '#333', marginBottom: '8px' }}>
                  {telemetry.description}
                </p>
                <div style={{
                  fontSize: '11px',
                  color: '#666',
                  fontFamily: 'monospace',
                  background: '#f0f0f0',
                  padding: '6px 8px',
                  borderRadius: '4px'
                }}>
                  {telemetry.data}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Analytics Dashboard */}
        <WGTelemetryDashboard 
          shipmentId={selectedDemo === 'individual' ? 'SH001' : undefined}
        />
      </div>
    </div>
  );
};

export default WGTelemetryDemo;
