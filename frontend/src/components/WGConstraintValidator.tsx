// frontend/src/components/WGConstraintValidator.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle,
  Clock,
  Shield,
  User,
  Building2,
  CheckCircle,
  XCircle,
  Timer,
  Lock,
  AlertCircle,
  Key
} from 'lucide-react';

interface HubHold {
  type: 'authenticator' | 'sewing';
  tierLevel: number;
  expiresAt: Date;
  capacitySlot: {
    start: Date;
    end: Date;
  };
}

interface SLAValidation {
  deadline: Date;
  wouldBeMissed: boolean;
  timeToDeadline: number; // minutes
  breachAmount?: number; // minutes over deadline
}

interface ConstraintValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  hubHoldStatus: {
    isExpiring: boolean;
    timeToExpiry: number; // minutes
    canProceed: boolean;
  };
  slaStatus: SLAValidation;
  operatorConsistency: {
    isConsistent: boolean;
    assignedOperator: string | null;
  };
}

interface WGConstraintValidatorProps {
  shipment: {
    id: string;
    declaredValue: number;
    tierLevel: number;
    slaDeadline: string;
  };
  operator: {
    id: string;
    name: string;
  } | null;
  schedule: Array<{
    type: 'pickup' | 'hub_arrival' | 'hub_departure' | 'delivery';
    time: Date;
  }>;
  userRole: 'ops_admin' | 'hub_tech' | 'wg_operator';
  onValidationChange: (validation: ConstraintValidation) => void;
  onOperatorOverride?: (reason: string) => void;
}

const WGConstraintValidator: React.FC<WGConstraintValidatorProps> = ({
  shipment,
  operator,
  schedule,
  userRole,
  onValidationChange,
  onOperatorOverride
}) => {
  const [validation, setValidation] = useState<ConstraintValidation>({
    isValid: false,
    errors: [],
    warnings: [],
    hubHoldStatus: {
      isExpiring: false,
      timeToExpiry: 0,
      canProceed: true
    },
    slaStatus: {
      deadline: new Date(shipment.slaDeadline),
      wouldBeMissed: false,
      timeToDeadline: 0
    },
    operatorConsistency: {
      isConsistent: false,
      assignedOperator: null
    }
  });

  const [showSLAOverride, setShowSLAOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [hubHoldCountdown, setHubHoldCountdown] = useState(0);

  // Mock hub hold data based on tier level
  const hubHold: HubHold = {
    type: shipment.tierLevel >= 3 ? 'sewing' : 'authenticator',
    tierLevel: shipment.tierLevel,
    expiresAt: new Date(Date.now() + (shipment.tierLevel >= 3 ? 2 * 60 * 60 * 1000 : 4 * 60 * 60 * 1000)), // 2h for sewing, 4h for auth
    capacitySlot: {
      start: new Date('2024-01-16T10:00:00'),
      end: new Date('2024-01-16T16:00:00')
    }
  };

  // Update countdown every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const timeToExpiry = Math.floor((hubHold.expiresAt.getTime() - now.getTime()) / (1000 * 60));
      setHubHoldCountdown(Math.max(0, timeToExpiry));
    }, 60000);

    // Initial calculation
    const now = new Date();
    const timeToExpiry = Math.floor((hubHold.expiresAt.getTime() - now.getTime()) / (1000 * 60));
    setHubHoldCountdown(Math.max(0, timeToExpiry));

    return () => clearInterval(interval);
  }, [hubHold.expiresAt]);

  // Validate constraints whenever inputs change
  useEffect(() => {
    validateConstraints();
  }, [shipment, operator, schedule, hubHoldCountdown]);

  const validateConstraints = () => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Operator Consistency Validation
    const operatorConsistency = validateOperatorConsistency();
    if (!operatorConsistency.isConsistent) {
      errors.push('Single operator must handle all three milestones (pickup → hub → delivery)');
    }

    // 2. Hub Hold Expiration Check
    const hubHoldStatus = validateHubHolds();
    if (!hubHoldStatus.canProceed) {
      errors.push(`Hub ${hubHold.type} capacity hold expired. Cannot proceed with current schedule.`);
    } else if (hubHoldStatus.isExpiring) {
      warnings.push(`Hub ${hubHold.type} capacity hold expires in ${hubHoldStatus.timeToExpiry} minutes`);
    }

    // 3. SLA Validation
    const slaStatus = validateSLA();
    if (slaStatus.wouldBeMissed && userRole !== 'ops_admin') {
      errors.push(`Schedule would miss SLA deadline by ${slaStatus.breachAmount} minutes. Ops Admin override required.`);
    } else if (slaStatus.wouldBeMissed && userRole === 'ops_admin') {
      warnings.push(`Schedule would miss SLA deadline by ${slaStatus.breachAmount} minutes. Override available.`);
    }

    // 4. Schedule Completeness
    if (schedule.length < 4) {
      errors.push('Complete schedule required: pickup, hub arrival, hub departure, delivery');
    }

    // 5. Time Window Validation
    const timeWindowErrors = validateTimeWindows();
    errors.push(...timeWindowErrors);

    const newValidation: ConstraintValidation = {
      isValid: errors.length === 0,
      errors,
      warnings,
      hubHoldStatus,
      slaStatus,
      operatorConsistency
    };

    setValidation(newValidation);
    onValidationChange(newValidation);
  };

  const validateOperatorConsistency = () => {
    return {
      isConsistent: operator !== null,
      assignedOperator: operator?.id || null
    };
  };

  const validateHubHolds = () => {
    const timeToExpiry = hubHoldCountdown;
    const isExpiring = timeToExpiry <= 30; // Warning at 30 minutes
    const canProceed = timeToExpiry > 0;

    return {
      isExpiring,
      timeToExpiry,
      canProceed
    };
  };

  const validateSLA = (): SLAValidation => {
    const deadline = new Date(shipment.slaDeadline);
    const deliverySlot = schedule.find(s => s.type === 'delivery');
    
    if (!deliverySlot) {
      return {
        deadline,
        wouldBeMissed: false,
        timeToDeadline: Math.floor((deadline.getTime() - Date.now()) / (1000 * 60))
      };
    }

    const wouldBeMissed = deliverySlot.time > deadline;
    const timeToDeadline = Math.floor((deadline.getTime() - Date.now()) / (1000 * 60));
    const breachAmount = wouldBeMissed ? Math.floor((deliverySlot.time.getTime() - deadline.getTime()) / (1000 * 60)) : undefined;

    return {
      deadline,
      wouldBeMissed,
      timeToDeadline,
      breachAmount
    };
  };

  const validateTimeWindows = (): string[] => {
    const errors: string[] = [];
    
    // Check if hub arrival falls within capacity slot
    const hubArrival = schedule.find(s => s.type === 'hub_arrival');
    const hubDeparture = schedule.find(s => s.type === 'hub_departure');
    
    if (hubArrival && hubDeparture) {
      if (hubArrival.time < hubHold.capacitySlot.start || hubDeparture.time > hubHold.capacitySlot.end) {
        errors.push(`Hub processing must occur within ${hubHold.type} capacity window`);
      }
    }

    return errors;
  };

  const handleSLAOverride = () => {
    if (overrideReason.trim().length < 10) {
      alert('Override reason must be at least 10 characters');
      return;
    }

    if (onOperatorOverride) {
      onOperatorOverride(overrideReason);
      setShowSLAOverride(false);
      setOverrideReason('');
    }
  };

  const getStatusIcon = (type: 'error' | 'warning' | 'success') => {
    switch (type) {
      case 'error': return <XCircle size={16} color="#dc2626" />;
      case 'warning': return <AlertTriangle size={16} color="#f59e0b" />;
      case 'success': return <CheckCircle size={16} color="#22c55e" />;
    }
  };

  const getStatusColor = (type: 'error' | 'warning' | 'success') => {
    switch (type) {
      case 'error': return { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' };
      case 'warning': return { bg: '#fef3c7', border: '#fde68a', text: '#f59e0b' };
      case 'success': return { bg: '#f0fdf4', border: '#bbf7d0', text: '#22c55e' };
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
        borderBottom: '1px solid #e0e0e0',
        background: validation.isValid ? '#f0fdf4' : validation.errors.length > 0 ? '#fef2f2' : '#fef3c7'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: validation.isValid ? '#22c55e' : validation.errors.length > 0 ? '#dc2626' : '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff'
          }}>
            {validation.isValid ? <CheckCircle size={16} /> : 
             validation.errors.length > 0 ? <XCircle size={16} /> : 
             <AlertTriangle size={16} />}
          </div>
          <div>
            <h3 style={{
              fontSize: '16px',
              fontWeight: 600,
              marginBottom: '2px',
              color: validation.isValid ? '#166534' : validation.errors.length > 0 ? '#dc2626' : '#92400e'
            }}>
              {validation.isValid ? 'All Constraints Satisfied' : 
               validation.errors.length > 0 ? 'Constraint Violations' : 
               'Warnings Detected'}
            </h3>
            <p style={{
              fontSize: '12px',
              color: validation.isValid ? '#166534' : validation.errors.length > 0 ? '#dc2626' : '#92400e'
            }}>
              {validation.isValid ? 'Ready to proceed with WG assignment' : 
               validation.errors.length > 0 ? 'Must resolve issues before proceeding' : 
               'Review warnings before proceeding'}
            </p>
          </div>
        </div>
      </div>

      <div style={{ padding: '20px' }}>
        {/* Operator Consistency Check */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{
            fontSize: '14px',
            fontWeight: 600,
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <User size={16} />
            Single Operator Requirement
          </h4>
          
          <div style={{
            ...getStatusColor(validation.operatorConsistency.isConsistent ? 'success' : 'error'),
            background: getStatusColor(validation.operatorConsistency.isConsistent ? 'success' : 'error').bg,
            border: `1px solid ${getStatusColor(validation.operatorConsistency.isConsistent ? 'success' : 'error').border}`,
            borderRadius: '8px',
            padding: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {getStatusIcon(validation.operatorConsistency.isConsistent ? 'success' : 'error')}
            <span style={{ fontSize: '13px', fontWeight: 500 }}>
              {validation.operatorConsistency.isConsistent 
                ? `${operator?.name} assigned for all milestones`
                : 'No operator selected - single operator must handle pickup → hub → delivery'
              }
            </span>
          </div>
        </div>

        {/* Hub Hold Status */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{
            fontSize: '14px',
            fontWeight: 600,
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Building2 size={16} />
            Hub Capacity Hold Status
          </h4>
          
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <span style={{ fontSize: '12px', color: '#666', fontWeight: 600 }}>
                  {hubHold.type.toUpperCase()} CAPACITY (TIER {hubHold.tierLevel})
                </span>
                <p style={{ fontSize: '14px', fontWeight: 500, marginTop: '2px' }}>
                  {hubHold.capacitySlot.start.toLocaleTimeString()} - {hubHold.capacitySlot.end.toLocaleTimeString()}
                </p>
              </div>
              
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: validation.hubHoldStatus.canProceed ? 
                         validation.hubHoldStatus.isExpiring ? '#f59e0b' : '#22c55e' : '#dc2626'
                }}>
                  {hubHoldCountdown}m
                </div>
                <div style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: validation.hubHoldStatus.canProceed ? 
                         validation.hubHoldStatus.isExpiring ? '#f59e0b' : '#22c55e' : '#dc2626'
                }}>
                  {validation.hubHoldStatus.canProceed ? 
                   validation.hubHoldStatus.isExpiring ? 'EXPIRING' : 'ACTIVE' : 'EXPIRED'}
                </div>
              </div>
            </div>
            
            {validation.hubHoldStatus.isExpiring && (
              <div style={{
                background: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: '6px',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <Timer size={14} color="#d97706" />
                <span style={{ fontSize: '12px', color: '#92400e', fontWeight: 500 }}>
                  Capacity hold expires in {validation.hubHoldStatus.timeToExpiry} minutes - proceed quickly
                </span>
              </div>
            )}
          </div>
        </div>

        {/* SLA Validation */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{
            fontSize: '14px',
            fontWeight: 600,
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Clock size={16} />
            SLA Compliance Check
          </h4>
          
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <span style={{ fontSize: '12px', color: '#666', fontWeight: 600 }}>
                  SLA DEADLINE
                </span>
                <p style={{ fontSize: '14px', fontWeight: 500, marginTop: '2px' }}>
                  {validation.slaStatus.deadline.toLocaleString()}
                </p>
              </div>
              
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: validation.slaStatus.wouldBeMissed ? '#dc2626' : '#22c55e'
                }}>
                  {validation.slaStatus.wouldBeMissed ? `+${validation.slaStatus.breachAmount}m` : `${validation.slaStatus.timeToDeadline}m`}
                </div>
                <div style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: validation.slaStatus.wouldBeMissed ? '#dc2626' : '#22c55e'
                }}>
                  {validation.slaStatus.wouldBeMissed ? 'BREACH' : 'COMPLIANT'}
                </div>
              </div>
            </div>
            
            {validation.slaStatus.wouldBeMissed && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} color="#dc2626" />
                  <div>
                    <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>
                      SLA Deadline Would Be Missed
                    </span>
                    <p style={{ fontSize: '11px', color: '#991b1b', marginTop: '2px' }}>
                      Delivery scheduled {validation.slaStatus.breachAmount} minutes past deadline
                    </p>
                  </div>
                </div>
                
                {userRole === 'ops_admin' && (
                  <button
                    onClick={() => setShowSLAOverride(true)}
                    style={{
                      background: '#dc2626',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Key size={12} />
                    Override
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Errors */}
        {validation.errors.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <h5 style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#dc2626',
              marginBottom: '8px',
              textTransform: 'uppercase'
            }}>
              Constraint Violations ({validation.errors.length})
            </h5>
            {validation.errors.map((error, idx) => (
              <div key={idx} style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                padding: '8px 12px',
                marginBottom: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <XCircle size={14} color="#dc2626" />
                <span style={{ fontSize: '12px', color: '#dc2626' }}>
                  {error}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Warnings */}
        {validation.warnings.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <h5 style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#f59e0b',
              marginBottom: '8px',
              textTransform: 'uppercase'
            }}>
              Warnings ({validation.warnings.length})
            </h5>
            {validation.warnings.map((warning, idx) => (
              <div key={idx} style={{
                background: '#fef3c7',
                border: '1px solid #fde68a',
                borderRadius: '6px',
                padding: '8px 12px',
                marginBottom: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertTriangle size={14} color="#f59e0b" />
                <span style={{ fontSize: '12px', color: '#92400e' }}>
                  {warning}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SLA Override Modal */}
      {showSLAOverride && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: 600,
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Shield size={16} />
              Ops Admin SLA Override
            </h3>
            
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
              This schedule would miss the SLA deadline by {validation.slaStatus.breachAmount} minutes. 
              Please provide a business justification for this override.
            </p>
            
            <textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Business justification for SLA override..."
              style={{
                width: '100%',
                height: '80px',
                padding: '12px',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '13px',
                resize: 'none',
                marginBottom: '16px'
              }}
            />
            
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowSLAOverride(false)}
                style={{
                  padding: '8px 16px',
                  background: '#f5f5f5',
                  border: '1px solid #e0e0e0',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSLAOverride}
                style={{
                  padding: '8px 16px',
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 500
                }}
              >
                Confirm Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WGConstraintValidator;
