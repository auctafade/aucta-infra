// frontend/src/app/sprint-8/logistics/wg/demo/page.tsx
'use client';

import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import WGSourcingPipeline from '@/components/WGSourcingPipeline';

const mockHighValueShipment = {
  id: 'SH003',
  productName: 'Patek Philippe Grand Complication',
  declaredValue: 950000,
  priority: 'critical',
  sender: {
    location: 'Manhattan, NY',
    timeWindow: '14:00-17:00'
  },
  buyer: {
    location: 'Brooklyn, NY',
    timeWindow: '16:00-20:00'
  },
  slaDeadline: '2024-01-16T20:00:00'
};

const WGSourcingDemo: React.FC = () => {
  const router = useRouter();
  
  const handleAssignment = (operatorId: string) => {
    alert(`Demo: External operator ${operatorId} assigned to ${mockHighValueShipment.id}`);
  };

  const handleEscalation = () => {
    alert('Demo: Escalation initiated - contacting premium partner network');
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
                WG Sourcing Pipeline Demo
              </h1>
              <p style={{ fontSize: '16px', color: '#666' }}>
                Interactive demo of the sourcing pipeline for high-value shipments
              </p>
            </div>
          </div>

          {/* Demo Description */}
          <div style={{
            background: '#f0f9ff',
            border: '1px solid #0ea5e9',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#0369a1' }}>
              Demo Scenario
            </h3>
            <p style={{ fontSize: '14px', color: '#0369a1', lineHeight: 1.5 }}>
              This shipment ({mockHighValueShipment.productName} - ${mockHighValueShipment.declaredValue.toLocaleString()}) 
              exceeds our current roster's value clearance capabilities. The sourcing pipeline will automatically 
              broadcast to external operators and manage the validation/assignment process.
            </p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 40px' }}>
        <WGSourcingPipeline
          shipment={mockHighValueShipment}
          onAssignment={handleAssignment}
          onEscalation={handleEscalation}
        />
        
        {/* Feature Highlights */}
        <div style={{
          marginTop: '32px',
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid #e0e0e0',
          padding: '24px'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
            Sourcing Pipeline Features
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#3b82f6' }}>
                📡 Smart Broadcasting
              </h3>
              <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.5 }}>
                Auto-applies filters based on shipment requirements (city, value, date) and broadcasts to qualified external operators.
              </p>
            </div>
            
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#f59e0b' }}>
                ⏱️ SLA Timer
              </h3>
              <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.5 }}>
                Real-time "time-to-assign" tracking with color-coded urgency levels and automatic escalation alerts.
              </p>
            </div>
            
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#8b5cf6' }}>
                ✅ Validation Flow
              </h3>
              <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.5 }}>
                Comprehensive checks for insurance status, value clearance capability, and required documentation.
              </p>
            </div>
            
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#dc2626' }}>
                🚨 Escalation System
              </h3>
              <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.5 }}>
                Ops-only escalation to partner vendors, geographic expansion, or premium rate offerings. No auto-DHL fallback.
              </p>
            </div>
          </div>
        </div>

        {/* Pipeline States */}
        <div style={{
          marginTop: '24px',
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid #e0e0e0',
          padding: '24px'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
            Pipeline States
          </h2>
          
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {[
              { status: 'unassigned', label: 'Unassigned', color: '#ef4444', description: 'No roster coverage detected' },
              { status: 'broadcast_sent', label: 'Broadcasting', color: '#f59e0b', description: 'Notifying external operators' },
              { status: 'candidates_replying', label: 'Candidates Replying', color: '#3b82f6', description: 'External operators responding' },
              { status: 'validating', label: 'Validating', color: '#8b5cf6', description: 'Checking docs & clearance' },
              { status: 'assigned', label: 'Assigned', color: '#22c55e', description: 'Operator confirmed & ready' }
            ].map((state) => (
              <div key={state.status} style={{
                flex: '1',
                minWidth: '150px',
                background: `${state.color}10`,
                border: `1px solid ${state.color}30`,
                borderRadius: '8px',
                padding: '12px',
                textAlign: 'center'
              }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: state.color,
                  margin: '0 auto 8px'
                }} />
                <h4 style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: state.color }}>
                  {state.label.toUpperCase()}
                </h4>
                <p style={{ fontSize: '11px', color: '#666' }}>
                  {state.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WGSourcingDemo;
