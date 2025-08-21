// frontend/src/app/sprint-8/logistics/wg/custody-demo/page.tsx
'use client';

import React, { useState } from 'react';
import { ArrowLeft, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ChainOfCustodyPrep from '@/components/ChainOfCustodyPrep';

const mockShipment = {
  id: 'SH003',
  productName: 'Patek Philippe Grand Complication',
  declaredValue: 950000,
  tierLevel: 3,
  sender: {
    name: 'Victoria Sterling',
    location: 'Manhattan, NY',
    address: '432 Park Ave, Manhattan, NY 10022',
    phone: '+1 (555) 123-4567',
    timeWindow: '14:00-17:00'
  },
  buyer: {
    name: 'James Anderson',
    location: 'Brooklyn, NY',
    address: '876 Fifth Avenue, Brooklyn, NY 11215',
    phone: '+1 (555) 987-6543',
    timeWindow: '16:00-20:00'
  },
  route: {
    hubLocation: 'AUCTA Hub - LIC',
    hubAddress: '34-12 36th Street, Long Island City, NY 11106'
  }
};

const mockOperator = {
  id: 'wg003',
  name: 'Elena Rodriguez',
  phone: '+1 (555) 555-6666'
};

const mockSchedule = [
  {
    id: 'pickup',
    type: 'pickup' as const,
    time: new Date('2024-01-16T14:30:00'),
    location: 'Manhattan, NY',
    address: '432 Park Ave, Manhattan, NY 10022'
  },
  {
    id: 'hub_arrival',
    type: 'hub_arrival' as const,
    time: new Date('2024-01-16T15:00:00'),
    location: 'AUCTA Hub - LIC',
    address: '34-12 36th Street, Long Island City, NY 11106'
  },
  {
    id: 'hub_departure',
    type: 'hub_departure' as const,
    time: new Date('2024-01-16T15:45:00'),
    location: 'AUCTA Hub - LIC',
    address: '34-12 36th Street, Long Island City, NY 11106'
  },
  {
    id: 'delivery',
    type: 'delivery' as const,
    time: new Date('2024-01-16T16:10:00'),
    location: 'Brooklyn, NY',
    address: '876 Fifth Avenue, Brooklyn, NY 11215'
  }
];

const ChainOfCustodyDemo: React.FC = () => {
  const router = useRouter();
  const [activationCount, setActivationCount] = useState(0);
  
  const handleChainOfCustodyConfirm = (otpCodes: any, livenessChecks: any) => {
    setActivationCount(prev => prev + 1);
    console.log('Demo Chain of Custody activated:', { otpCodes, livenessChecks, activationCount: activationCount + 1 });
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
                Chain of Custody Demo
              </h1>
              <p style={{ fontSize: '16px', color: '#666' }}>
                Complete security protocol preparation for high-value shipments
              </p>
            </div>
          </div>

          {/* Demo Stats */}
          {activationCount > 0 && (
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #22c55e',
              borderRadius: '8px',
              padding: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={16} color="#22c55e" />
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#166534' }}>
                  Demo Activations: {activationCount} • Latest OTP codes generated successfully
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 40px' }}>
        {/* Demo Scenario */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid #e0e0e0',
          padding: '24px',
          marginBottom: '32px'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>
            Demo Scenario
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#7c3aed' }}>
                High-Value Shipment
              </h3>
              <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.5 }}>
                <strong>{mockShipment.productName}</strong><br />
                Value: ${mockShipment.declaredValue.toLocaleString()}<br />
                Tier: {mockShipment.tierLevel} (Maximum Security)
              </p>
            </div>
            
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#0369a1' }}>
                Operator Assignment
              </h3>
              <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.5 }}>
                <strong>{mockOperator.name}</strong><br />
                Contact: {mockOperator.phone}<br />
                Specialized in luxury items
              </p>
            </div>
            
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#dc2626' }}>
                Security Requirements
              </h3>
              <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.5 }}>
                • OTP verification required<br />
                • Liveness checks enabled<br />
                • Tamper-evident sealing<br />
                • Complete photo documentation
              </p>
            </div>
            
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#f59e0b' }}>
                Privacy Compliance
              </h3>
              <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.5 }}>
                • Names abbreviated<br />
                • Phone numbers masked<br />
                • Minimal PII exposure<br />
                • Secure operator app integration
              </p>
            </div>
          </div>
        </div>

        {/* Chain of Custody Component */}
        <ChainOfCustodyPrep
          shipment={mockShipment}
          operator={mockOperator}
          schedule={mockSchedule}
          onConfirm={handleChainOfCustodyConfirm}
        />
        
        {/* Feature Overview */}
        <div style={{
          marginTop: '32px',
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid #e0e0e0',
          padding: '24px'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
            Chain of Custody Features
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#3b82f6' }}>
                🔐 OTP Generation
              </h3>
              <ul style={{ fontSize: '13px', color: '#666', lineHeight: 1.6, paddingLeft: '16px' }}>
                <li>Unique 6-digit codes for each checkpoint</li>
                <li>Pickup, Hub Intake, and Delivery verification</li>
                <li>One-click copy functionality</li>
                <li>Secure generation with timestamp validation</li>
              </ul>
            </div>
            
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#8b5cf6' }}>
                👁️ Liveness Checks
              </h3>
              <ul style={{ fontSize: '13px', color: '#666', lineHeight: 1.6, paddingLeft: '16px' }}>
                <li>Facial recognition at each handoff</li>
                <li>Auto-enabled for high-value shipments (${(100000).toLocaleString()}+)</li>
                <li>Configurable per checkpoint</li>
                <li>Tier 3 hub intake requirements</li>
              </ul>
            </div>
            
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#f59e0b' }}>
                📦 Seal Kit Management
              </h3>
              <ul style={{ fontSize: '13px', color: '#666', lineHeight: 1.6, paddingLeft: '16px' }}>
                <li>Required for Tier 2+ shipments</li>
                <li>Unique seal ID generation</li>
                <li>Tamper-evident verification</li>
                <li>Hub intake validation protocols</li>
              </ul>
            </div>
            
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#22c55e' }}>
                📋 Operator Brief
              </h3>
              <ul style={{ fontSize: '13px', color: '#666', lineHeight: 1.6, paddingLeft: '16px' }}>
                <li>Auto-generated with privacy filtering</li>
                <li>Contact info with minimal PII</li>
                <li>Safety and handling instructions</li>
                <li>Required photo documentation</li>
              </ul>
            </div>
            
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#dc2626' }}>
                🔒 Privacy Protection
              </h3>
              <ul style={{ fontSize: '13px', color: '#666', lineHeight: 1.6, paddingLeft: '16px' }}>
                <li>Names abbreviated (e.g., "Victoria S.")</li>
                <li>Phone numbers masked (555-***-4567)</li>
                <li>Minimal contact information exposure</li>
                <li>Secure app integration for full details</li>
              </ul>
            </div>
            
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#0369a1' }}>
                📄 Documentation
              </h3>
              <ul style={{ fontSize: '13px', color: '#666', lineHeight: 1.6, paddingLeft: '16px' }}>
                <li>Downloadable PDF briefs</li>
                <li>Printable operator instructions</li>
                <li>Photo requirement checklists</li>
                <li>Compliance documentation</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Security Protocol Overview */}
        <div style={{
          marginTop: '24px',
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid #e0e0e0',
          padding: '24px'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
            Security Protocol Workflow
          </h2>
          
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {[
              { step: '1', action: 'Schedule Confirmation', description: 'Operator and time slots validated', color: '#3b82f6' },
              { step: '2', action: 'OTP Generation', description: 'Unique codes created for each checkpoint', color: '#8b5cf6' },
              { step: '3', action: 'Liveness Setup', description: 'Facial recognition requirements configured', color: '#f59e0b' },
              { step: '4', action: 'Seal Assignment', description: 'Tamper-evident seal ID generated (T2/T3)', color: '#22c55e' },
              { step: '5', action: 'Brief Creation', description: 'Privacy-filtered operator instructions', color: '#dc2626' },
              { step: '6', action: 'Chain Activation', description: 'All protocols locked and active', color: '#000' }
            ].map((item) => (
              <div key={item.step} style={{
                flex: '1',
                minWidth: '180px',
                background: `${item.color}10`,
                border: `1px solid ${item.color}30`,
                borderRadius: '8px',
                padding: '16px',
                textAlign: 'center'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: item.color,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 8px',
                  fontSize: '14px',
                  fontWeight: 600
                }}>
                  {item.step}
                </div>
                <h4 style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: item.color }}>
                  {item.action.toUpperCase()}
                </h4>
                <p style={{ fontSize: '11px', color: '#666' }}>
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

export default ChainOfCustodyDemo;
