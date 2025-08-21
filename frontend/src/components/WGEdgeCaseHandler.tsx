// frontend/src/components/WGEdgeCaseHandler.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { 
  Clock,
  AlertTriangle,
  MapPin,
  Plane,
  Car,
  Calendar,
  Timer,
  RefreshCw,
  Shield,
  Eye,
  EyeOff,
  Globe,
  Navigation
} from 'lucide-react';

interface CrossTimezoneDisplay {
  localTime: Date;
  timezone: string;
  utcTime: Date;
  utcOffset: string;
}

interface TravelLeg {
  from: string;
  to: string;
  distance: number; // km
  estimatedDuration: number; // minutes
  mode: 'drive' | 'flight';
  isIntercity: boolean;
  isSameDay: boolean;
}

interface HubSlotExpiry {
  currentSlot: { start: Date; end: Date };
  expiresAt: Date;
  minutesRemaining: number;
  alternativeSlots: Array<{ start: Date; end: Date; slaCompliant: boolean }>;
}

interface OperatorClash {
  operator: { id: string; name: string };
  conflictingSchedule: { start: Date; end: Date; description: string };
  suggestedAlternatives: {
    nextFreeWindow: { start: Date; end: Date } | null;
    alternativeOperators: Array<{ id: string; name: string; score: number; nextAvailable: Date }>;
  };
}

interface HighValueApproval {
  required: boolean;
  threshold: number;
  currentValue: number;
  approvers: Array<{ id: string; name: string; role: string }>;
  status: 'pending' | 'approved' | 'denied';
}

interface WGEdgeCaseHandlerProps {
  shipment: {
    id: string;
    declaredValue: number;
    route: {
      legs: TravelLeg[];
    };
    timezone: string;
  };
  operator: {
    id: string;
    name: string;
    conflicts?: Array<{ start: Date; end: Date; description: string }>;
  };
  schedule: Array<{
    type: 'pickup' | 'hub_arrival' | 'hub_departure' | 'delivery';
    time: Date;
    timezone: string;
  }>;
  hubSlot: HubSlotExpiry;
  onScheduleAdjustment: (newSchedule: any[]) => void;
  onOperatorChange: (operatorId: string) => void;
  onApprovalRequest: (approver: string) => void;
}

const WGEdgeCaseHandler: React.FC<WGEdgeCaseHandlerProps> = ({
  shipment,
  operator,
  schedule,
  hubSlot,
  onScheduleAdjustment,
  onOperatorChange,
  onApprovalRequest
}) => {
  const [showUTC, setShowUTC] = useState(false);
  const [piiMasked, setPiiMasked] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const [detectedIssues, setDetectedIssues] = useState<string[]>([]);
  const [highValueApproval, setHighValueApproval] = useState<HighValueApproval | null>(null);

  // Update countdown every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const remaining = Math.floor((hubSlot.expiresAt.getTime() - now.getTime()) / (1000 * 60));
      setCountdown(Math.max(0, remaining));
    }, 60000);

    // Initial calculation
    const now = new Date();
    const remaining = Math.floor((hubSlot.expiresAt.getTime() - now.getTime()) / (1000 * 60));
    setCountdown(Math.max(0, remaining));

    return () => clearInterval(interval);
  }, [hubSlot.expiresAt]);

  // Analyze edge cases
  useEffect(() => {
    const issues = analyzeEdgeCases();
    setDetectedIssues(issues);
    
    // Check high-value approval requirement
    if (shipment.declaredValue > 500000) {
      setHighValueApproval({
        required: true,
        threshold: 500000,
        currentValue: shipment.declaredValue,
        approvers: [
          { id: 'mgr001', name: 'Sarah Chen', role: 'Operations Manager' },
          { id: 'mgr002', name: 'Michael Torres', role: 'Regional Director' }
        ],
        status: 'pending'
      });
    }
  }, [schedule, operator, shipment]);

  const analyzeEdgeCases = (): string[] => {
    const issues: string[] = [];

    // 1. Cross-timezone complications
    const timezones = new Set(schedule.map(s => s.timezone));
    if (timezones.size > 1) {
      issues.push('cross_timezone');
    }

    // 2. Inter-city travel buffers
    shipment.route.legs.forEach(leg => {
      if (leg.isIntercity && leg.estimatedDuration > 180) { // 3+ hours
        issues.push('long_intercity_travel');
      }
      if (leg.mode === 'flight' && !leg.isSameDay) {
        issues.push('overnight_flight_required');
      }
    });

    // 3. Hub slot expiry risk
    if (countdown <= 30 && countdown > 0) {
      issues.push('hub_slot_expiring');
    }

    // 4. Operator conflicts
    if (operator.conflicts && operator.conflicts.length > 0) {
      const hasClash = operator.conflicts.some(conflict => {
        return schedule.some(slot => 
          slot.time >= conflict.start && slot.time <= conflict.end
        );
      });
      if (hasClash) {
        issues.push('operator_conflict');
      }
    }

    // 5. Same-day feasibility for long routes
    const totalTravelTime = shipment.route.legs.reduce((total, leg) => total + leg.estimatedDuration, 0);
    if (totalTravelTime > 480) { // 8+ hours total travel
      issues.push('same_day_infeasible');
    }

    return issues;
  };

  const formatCrossTimezoneDisplay = (time: Date, timezone: string): CrossTimezoneDisplay => {
    return {
      localTime: time,
      timezone,
      utcTime: new Date(time.toISOString()),
      utcOffset: new Intl.DateTimeFormat('en', {
        timeZoneName: 'short',
        timeZone: timezone
      }).formatToParts(time).find(part => part.type === 'timeZoneName')?.value || ''
    };
  };

  const suggestAlternativeHubSlot = () => {
    const bestAlternative = hubSlot.alternativeSlots
      .filter(slot => slot.slaCompliant)
      .sort((a, b) => a.start.getTime() - b.start.getTime())[0];

    if (bestAlternative) {
      const adjustedSchedule = schedule.map(slot => {
        if (slot.type === 'hub_arrival') {
          return { ...slot, time: bestAlternative.start };
        }
        if (slot.type === 'hub_departure') {
          return { ...slot, time: new Date(bestAlternative.start.getTime() + 90 * 60 * 1000) };
        }
        return slot;
      });
      
      onScheduleAdjustment(adjustedSchedule);
    }
  };

  const generateOperatorBrief = () => {
    const brief = {
      operatorInfo: {
        name: piiMasked ? operator.name.split(' ')[0] + ' ' + operator.name.split(' ')[1]?.[0] + '.' : operator.name,
        contact: piiMasked ? '555-***-4567' : '555-123-4567'
      },
      timeline: schedule.map(slot => ({
        type: slot.type,
        time: slot.time,
        timezone: slot.timezone,
        location: getLocationForSlot(slot.type)
      })),
      requirements: [
        'Valid ID and AUCTA credentials',
        'Smartphone with AUCTA app installed',
        'Seal kit for Tier 2/3 items (if applicable)',
        'Camera for mandatory photos at each checkpoint'
      ],
      restrictions: [
        'Never leave package unattended',
        'Verify OTP before any handoff',
        'Maintain chain of custody documentation'
      ]
    };

    return brief;
  };

  const getLocationForSlot = (type: string): string => {
    switch (type) {
      case 'pickup': return 'Sender Location (Park Ave, Manhattan)';
      case 'hub_arrival': return 'AUCTA Hub (Facility B, Newark)';
      case 'hub_departure': return 'AUCTA Hub (Facility B, Newark)';
      case 'delivery': return 'Buyer Location (Upper East Side, Manhattan)';
      default: return 'Unknown';
    }
  };

  return (
    <div style={{
      background: '#fff',
      borderRadius: '12px',
      border: '1px solid #e0e0e0',
      marginBottom: '16px'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid #e0e0e0'
      }}>
        <h3 style={{
          fontSize: '16px',
          fontWeight: 600,
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Navigation size={18} />
          Smart Edge Case Handling
        </h3>
        <p style={{ fontSize: '13px', color: '#666' }}>
          Advanced UX features and constraint management
        </p>
      </div>

      <div style={{ padding: '20px' }}>
        {/* Cross-Timezone Display */}
        {detectedIssues.includes('cross_timezone') && (
          <div style={{
            background: '#f0f9ff',
            border: '1px solid #0ea5e9',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Globe size={16} color="#0369a1" />
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#0369a1' }}>
                  Cross-Timezone Planning Detected
                </h4>
              </div>
              <button
                onClick={() => setShowUTC(!showUTC)}
                style={{
                  background: showUTC ? '#0369a1' : '#f0f9ff',
                  color: showUTC ? '#fff' : '#0369a1',
                  border: '1px solid #0ea5e9',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Globe size={12} />
                {showUTC ? 'Hide UTC' : 'Show UTC'}
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {schedule.map((slot, idx) => {
                const crossTZ = formatCrossTimezoneDisplay(slot.time, slot.timezone);
                return (
                  <div key={idx} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: '#fff',
                    borderRadius: '6px',
                    border: '1px solid #e0f2fe'
                  }}>
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                        {slot.type.replace('_', ' ')}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>
                        {crossTZ.localTime.toLocaleTimeString()} {crossTZ.timezone}
                      </div>
                      {showUTC && (
                        <div style={{ fontSize: '11px', color: '#666' }}>
                          UTC: {crossTZ.utcTime.toLocaleTimeString()} ({crossTZ.utcOffset})
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Inter-city Travel Warnings */}
        {(detectedIssues.includes('long_intercity_travel') || detectedIssues.includes('same_day_infeasible')) && (
          <div style={{
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Car size={16} color="#d97706" />
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#92400e' }}>
                Long-Distance Travel Detected
              </h4>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {shipment.route.legs.map((leg, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  background: '#fff',
                  borderRadius: '6px',
                  border: '1px solid #fde68a'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {leg.mode === 'flight' ? <Plane size={14} /> : <Car size={14} />}
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>
                        {leg.from} → {leg.to}
                      </div>
                      <div style={{ fontSize: '11px', color: '#92400e' }}>
                        {leg.distance}km • {Math.floor(leg.estimatedDuration / 60)}h {leg.estimatedDuration % 60}m
                      </div>
                    </div>
                  </div>
                  
                  {leg.estimatedDuration > 240 && (
                    <div style={{
                      background: '#f59e0b',
                      color: '#fff',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 600
                    }}>
                      {leg.mode === 'flight' ? 'FLIGHT REQUIRED' : 'LONG DRIVE'}
                    </div>
                  )}
                </div>
              ))}
              
              {detectedIssues.includes('same_day_infeasible') && (
                <div style={{
                  background: '#dc2626',
                  color: '#fff',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 500
                }}>
                  ⚠️ Same-day completion may not be feasible. Consider splitting into multi-day schedule.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hub Slot Expiry Warning */}
        {detectedIssues.includes('hub_slot_expiring') && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Timer size={16} color="#dc2626" />
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#dc2626' }}>
                  Hub Capacity Expiring Soon
                </h4>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#dc2626' }}>
                  {countdown}m
                </div>
                <div style={{ fontSize: '10px', color: '#991b1b', fontWeight: 600 }}>
                  REMAINING
                </div>
              </div>
            </div>
            
            <p style={{ fontSize: '12px', color: '#991b1b', marginBottom: '12px' }}>
              Current hub slot expires in {countdown} minutes. Alternative SLA-compliant slots available:
            </p>
            
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {hubSlot.alternativeSlots.filter(slot => slot.slaCompliant).slice(0, 3).map((altSlot, idx) => (
                <button
                  key={idx}
                  onClick={suggestAlternativeHubSlot}
                  style={{
                    background: '#22c55e',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  {altSlot.start.toLocaleTimeString()} - {altSlot.end.toLocaleTimeString()}
                </button>
              ))}
            </div>
            
            <button
              onClick={suggestAlternativeHubSlot}
              style={{
                background: '#dc2626',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RefreshCw size={12} />
              Use Next Available Slot
            </button>
          </div>
        )}

        {/* High-Value Approval Requirement */}
        {highValueApproval && (
          <div style={{
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Shield size={16} color="#d97706" />
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#92400e' }}>
                High-Value Shipment Approval Required
              </h4>
            </div>
            
            <div style={{
              background: '#fff',
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#666' }}>Declared Value:</span>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>
                  ${highValueApproval.currentValue.toLocaleString()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#666' }}>Approval Threshold:</span>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>
                  ${highValueApproval.threshold.toLocaleString()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: '#666' }}>Status:</span>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: highValueApproval.status === 'approved' ? '#22c55e' : '#f59e0b'
                }}>
                  {highValueApproval.status.toUpperCase()}
                </span>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              {highValueApproval.approvers.map((approver, idx) => (
                <button
                  key={idx}
                  onClick={() => onApprovalRequest(approver.id)}
                  style={{
                    background: '#f59e0b',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  Request from {approver.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PII-Minimized Operator Brief */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 600 }}>
              Operator Brief Preview
            </h4>
            <button
              onClick={() => setPiiMasked(!piiMasked)}
              style={{
                background: piiMasked ? '#fef2f2' : '#f0fdf4',
                color: piiMasked ? '#dc2626' : '#166534',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {piiMasked ? <EyeOff size={12} /> : <Eye size={12} />}
              {piiMasked ? 'PII Masked' : 'PII Visible'}
            </button>
          </div>
          
          <div style={{
            background: '#fff',
            border: '1px solid #e0e0e0',
            borderRadius: '6px',
            padding: '12px',
            fontSize: '12px',
            fontFamily: 'monospace',
            lineHeight: 1.5,
            whiteSpace: 'pre-line'
          }}>
            {JSON.stringify(generateOperatorBrief(), null, 2)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WGEdgeCaseHandler;
