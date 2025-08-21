// frontend/src/components/WGSourcingPipeline.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { 
  Radio,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle,
  Send,
  MapPin,
  Shield,
  Star,
  Phone,
  MessageCircle,
  FileText,
  TrendingUp,
  Globe,
  DollarSign,
  Building2,
  User,
  Calendar,
  Truck,
  Eye,
  RefreshCw,
  AlertCircle,
  Zap
} from 'lucide-react';

interface SourcingState {
  status: 'unassigned' | 'broadcast_sent' | 'candidates_replying' | 'validating' | 'assigned';
  startTime: Date;
  slaTarget: number; // minutes
  candidates: Candidate[];
  broadcastFilters: {
    cities: string[];
    minValue: number;
    maxDistance: number;
    date: string;
    urgency: 'standard' | 'premium';
  };
}

interface Candidate {
  id: string;
  name: string;
  rating: number;
  distance: string;
  estimatedArrival: string;
  vehicle: string;
  maxValue: number;
  phone: string;
  languages: string[];
  responseTime: Date;
  status: 'pending' | 'validated' | 'rejected' | 'assigned';
  validationChecks: {
    insurance: 'pending' | 'valid' | 'expired';
    clearance: 'pending' | 'sufficient' | 'insufficient';
    documents: 'pending' | 'complete' | 'missing';
  };
  availability: string[];
  specialSkills: string[];
  partnerVendor?: string;
  premiumRate?: number;
}

interface WGSourcingPipelineProps {
  shipment: {
    id: string;
    productName: string;
    declaredValue: number;
    priority: string;
    sender: {
      location: string;
      timeWindow: string;
    };
    buyer: {
      location: string;
      timeWindow: string;
    };
    slaDeadline: string;
  };
  onAssignment: (operatorId: string) => void;
  onEscalation: () => void;
}

const WGSourcingPipeline: React.FC<WGSourcingPipelineProps> = ({
  shipment,
  onAssignment,
  onEscalation
}) => {
  const [sourcingState, setSourcingState] = useState<SourcingState>({
    status: 'unassigned',
    startTime: new Date(),
    slaTarget: 120, // 2 hours
    candidates: [],
    broadcastFilters: {
      cities: [shipment.sender.location.split(',')[0]],
      minValue: shipment.declaredValue,
      maxDistance: 50,
      date: new Date().toISOString().split('T')[0],
      urgency: 'standard'
    }
  });

  const [timeToAssign, setTimeToAssign] = useState(0);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [showEscalationBanner, setShowEscalationBanner] = useState(false);

  // Mock candidates data
  const mockCandidates: Candidate[] = [
    {
      id: 'ext001',
      name: 'Michael Torres',
      rating: 4.7,
      distance: '8.2 miles',
      estimatedArrival: '35 minutes',
      vehicle: 'Van',
      maxValue: 300000,
      phone: '+1 (555) 777-8888',
      languages: ['English', 'Spanish'],
      responseTime: new Date(Date.now() - 15 * 60000), // 15 min ago
      status: 'pending',
      validationChecks: {
        insurance: 'valid',
        clearance: 'sufficient',
        documents: 'complete'
      },
      availability: ['09:00-17:00'],
      specialSkills: ['High Value Transport', 'Same-day Delivery'],
      partnerVendor: 'Elite Logistics NYC'
    },
    {
      id: 'ext002',
      name: 'Jessica Wang',
      rating: 4.9,
      distance: '12.1 miles',
      estimatedArrival: '45 minutes',
      vehicle: 'Car',
      maxValue: 150000,
      phone: '+1 (555) 999-0000',
      languages: ['English', 'Mandarin'],
      responseTime: new Date(Date.now() - 8 * 60000), // 8 min ago
      status: 'validated',
      validationChecks: {
        insurance: 'valid',
        clearance: 'sufficient',
        documents: 'complete'
      },
      availability: ['08:00-20:00'],
      specialSkills: ['Luxury Items', 'Multilingual'],
      partnerVendor: 'Metro Couriers'
    },
    {
      id: 'ext003',
      name: 'David Kim',
      rating: 4.5,
      distance: '15.8 miles',
      estimatedArrival: '55 minutes',
      vehicle: 'Van',
      maxValue: 500000,
      phone: '+1 (555) 111-3333',
      languages: ['English', 'Korean'],
      responseTime: new Date(Date.now() - 5 * 60000), // 5 min ago
      status: 'pending',
      validationChecks: {
        insurance: 'pending',
        clearance: 'sufficient',
        documents: 'pending'
      },
      availability: ['10:00-18:00'],
      specialSkills: ['High Value Transport', 'White Glove Service'],
      premiumRate: 1.5
    }
  ];

  // Update timer every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((new Date().getTime() - sourcingState.startTime.getTime()) / (1000 * 60));
      setTimeToAssign(elapsed);
      
      // Show escalation banner if approaching SLA
      if (elapsed >= sourcingState.slaTarget * 0.8) {
        setShowEscalationBanner(true);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [sourcingState.startTime, sourcingState.slaTarget]);

  // Initialize timer on mount
  useEffect(() => {
    const elapsed = Math.floor((new Date().getTime() - sourcingState.startTime.getTime()) / (1000 * 60));
    setTimeToAssign(elapsed);
  }, []);

  const getTimerColor = () => {
    const percentage = (timeToAssign / sourcingState.slaTarget) * 100;
    if (percentage >= 100) return '#dc2626'; // Red - SLA breached
    if (percentage >= 80) return '#f59e0b';  // Amber - approaching SLA
    return '#22c55e'; // Green - good
  };

  const getTimerStatus = () => {
    const remaining = sourcingState.slaTarget - timeToAssign;
    if (remaining <= 0) return `${Math.abs(remaining)}m BREACH`;
    if (remaining <= 30) return `${remaining}m CRITICAL`;
    return `${remaining}m remaining`;
  };

  const handleStartBroadcast = () => {
    setSourcingState(prev => ({
      ...prev,
      status: 'broadcast_sent',
      startTime: new Date()
    }));
    setShowBroadcastModal(false);
    
    // Simulate candidates responding over time
    setTimeout(() => {
      setSourcingState(prev => ({
        ...prev,
        status: 'candidates_replying',
        candidates: mockCandidates
      }));
    }, 2000);
  };

  const handleValidateCandidate = (candidateId: string) => {
    setSourcingState(prev => ({
      ...prev,
      status: 'validating',
      candidates: prev.candidates.map(c => 
        c.id === candidateId 
          ? { ...c, status: 'validated' as const }
          : c
      )
    }));
  };

  const handleAssignCandidate = (candidateId: string) => {
    setSourcingState(prev => ({
      ...prev,
      status: 'assigned'
    }));
    onAssignment(candidateId);
  };

  const renderStatusBadge = (status: string) => {
    const configs = {
      unassigned: { color: '#ef4444', bg: '#fef2f2', text: 'UNASSIGNED' },
      broadcast_sent: { color: '#f59e0b', bg: '#fef3c7', text: 'BROADCASTING' },
      candidates_replying: { color: '#3b82f6', bg: '#dbeafe', text: 'CANDIDATES REPLYING' },
      validating: { color: '#8b5cf6', bg: '#f3e8ff', text: 'VALIDATING' },
      assigned: { color: '#22c55e', bg: '#f0fdf4', text: 'ASSIGNED' }
    };
    
    const config = configs[status as keyof typeof configs] || configs.unassigned;
    
    return (
      <span style={{
        background: config.bg,
        color: config.color,
        padding: '4px 12px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 600,
        border: `1px solid ${config.color}20`
      }}>
        {config.text}
      </span>
    );
  };

  const renderValidationIcon = (check: 'pending' | 'valid' | 'expired' | 'sufficient' | 'insufficient' | 'complete' | 'missing') => {
    if (check === 'valid' || check === 'sufficient' || check === 'complete') {
      return <CheckCircle size={14} color="#22c55e" />;
    }
    if (check === 'expired' || check === 'insufficient' || check === 'missing') {
      return <AlertTriangle size={14} color="#dc2626" />;
    }
    return <Clock size={14} color="#f59e0b" />;
  };

  return (
    <div style={{
      background: '#fff',
      borderRadius: '12px',
      border: '1px solid #e0e0e0'
    }}>
      {/* Header with Status and Timer */}
      <div style={{
        padding: '24px',
        borderBottom: '1px solid #e0e0e0',
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{
              fontSize: '20px',
              fontWeight: 600,
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Radio size={20} />
              WG Sourcing Pipeline
            </h2>
            <p style={{ fontSize: '14px', color: '#666' }}>
              Finding qualified operators for {shipment.id}
            </p>
          </div>
          
          {renderStatusBadge(sourcingState.status)}
        </div>

        {/* SLA Timer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px',
          background: '#fff',
          borderRadius: '8px',
          border: `2px solid ${getTimerColor()}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: `${getTimerColor()}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Clock size={20} color={getTimerColor()} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '2px' }}>
                Time to Assign
              </h3>
              <p style={{ fontSize: '12px', color: '#666' }}>
                Target: ≤ {sourcingState.slaTarget} minutes
              </p>
            </div>
          </div>
          
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: '24px',
              fontWeight: 700,
              color: getTimerColor(),
              marginBottom: '2px'
            }}>
              {timeToAssign}m
            </div>
            <div style={{
              fontSize: '12px',
              fontWeight: 600,
              color: getTimerColor()
            }}>
              {getTimerStatus()}
            </div>
          </div>
        </div>

        {/* Escalation Banner */}
        {showEscalationBanner && (
          <div style={{
            marginTop: '16px',
            padding: '16px',
            background: '#fef2f2',
            border: '2px solid #dc2626',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AlertCircle size={20} color="#dc2626" />
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#dc2626', marginBottom: '2px' }}>
                  SLA Risk Detected
                </h4>
                <p style={{ fontSize: '12px', color: '#991b1b' }}>
                  Approaching assignment deadline. Consider escalation options.
                </p>
              </div>
            </div>
            <button
              onClick={onEscalation}
              style={{
                background: '#dc2626',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Zap size={14} />
              Escalate
            </button>
          </div>
        )}
      </div>

      {/* Pipeline Status Flow */}
      <div style={{ padding: '24px' }}>
        {sourcingState.status === 'unassigned' && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: '#f3f4f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <Users size={32} color="#9ca3af" />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
              No Immediate WG Match
            </h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px' }}>
              Current roster cannot cover this shipment. Start a broadcast to find qualified external operators.
            </p>
            
            <button
              onClick={() => setShowBroadcastModal(true)}
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                margin: '0 auto'
              }}
            >
              <Send size={16} />
              Start Broadcast
            </button>
          </div>
        )}

        {sourcingState.status === 'broadcast_sent' && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: '#fef3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              animation: 'pulse 2s infinite'
            }}>
              <Radio size={32} color="#f59e0b" />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
              Broadcast Sent
            </h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
              Notifying qualified operators in your area...
            </p>
            
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '24px',
              marginTop: '20px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 600, color: '#3b82f6' }}>
                  {sourcingState.broadcastFilters.cities.length}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>Cities</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 600, color: '#3b82f6' }}>
                  ${sourcingState.broadcastFilters.minValue.toLocaleString()}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>Min Value</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 600, color: '#3b82f6' }}>
                  {sourcingState.broadcastFilters.maxDistance}mi
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>Max Distance</div>
              </div>
            </div>
          </div>
        )}

        {(sourcingState.status === 'candidates_replying' || sourcingState.status === 'validating') && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <Users size={20} />
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>
                Candidate Responses ({sourcingState.candidates.length})
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {sourcingState.candidates.map((candidate) => (
                <div key={candidate.id} style={{
                  border: `2px solid ${selectedCandidate === candidate.id ? '#3b82f6' : '#e0e0e0'}`,
                  borderRadius: '12px',
                  padding: '20px',
                  background: selectedCandidate === candidate.id ? '#f8fafc' : '#fff',
                  transition: 'all 0.3s'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '16px', flex: 1 }}>
                      {/* Operator Info */}
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #333 0%, #000 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: '16px',
                        fontWeight: 600,
                        flexShrink: 0
                      }}>
                        {candidate.name.split(' ').map(n => n[0]).join('')}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                          <h4 style={{ fontSize: '16px', fontWeight: 600 }}>
                            {candidate.name}
                          </h4>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Star size={14} color="#f59e0b" fill="#f59e0b" />
                            <span style={{ fontSize: '14px' }}>{candidate.rating}</span>
                          </div>
                          {candidate.partnerVendor && (
                            <span style={{
                              background: '#e0e7ff',
                              color: '#3730a3',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 500
                            }}>
                              {candidate.partnerVendor}
                            </span>
                          )}
                          {candidate.premiumRate && (
                            <span style={{
                              background: '#fef3c7',
                              color: '#92400e',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 500
                            }}>
                              {candidate.premiumRate}x Premium
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                          <div>
                            <span style={{ fontSize: '12px', color: '#666' }}>DISTANCE & ETA</span>
                            <p style={{ fontSize: '14px', fontWeight: 500 }}>
                              {candidate.distance} • {candidate.estimatedArrival}
                            </p>
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', color: '#666' }}>VEHICLE & VALUE</span>
                            <p style={{ fontSize: '14px', fontWeight: 500 }}>
                              {candidate.vehicle} • ${candidate.maxValue.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', color: '#666' }}>LANGUAGES</span>
                            <p style={{ fontSize: '14px', fontWeight: 500 }}>
                              {candidate.languages.join(', ')}
                            </p>
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', color: '#666' }}>RESPONSE TIME</span>
                            <p style={{ fontSize: '14px', fontWeight: 500 }}>
                              {Math.floor((new Date().getTime() - candidate.responseTime.getTime()) / 60000)}m ago
                            </p>
                          </div>
                        </div>

                        {/* Validation Checks */}
                        <div style={{
                          background: '#f9f9f9',
                          borderRadius: '6px',
                          padding: '12px',
                          marginBottom: '12px'
                        }}>
                          <h5 style={{ fontSize: '12px', fontWeight: 600, color: '#666', marginBottom: '8px' }}>
                            VALIDATION STATUS
                          </h5>
                          <div style={{ display: 'flex', gap: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {renderValidationIcon(candidate.validationChecks.insurance)}
                              <span style={{ fontSize: '12px' }}>Insurance</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {renderValidationIcon(candidate.validationChecks.clearance)}
                              <span style={{ fontSize: '12px' }}>Clearance</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {renderValidationIcon(candidate.validationChecks.documents)}
                              <span style={{ fontSize: '12px' }}>Documents</span>
                            </div>
                          </div>
                        </div>

                        {/* Special Skills */}
                        {candidate.specialSkills.length > 0 && (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                            {candidate.specialSkills.map((skill) => (
                              <span key={skill} style={{
                                background: '#dcfce7',
                                color: '#166534',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 500
                              }}>
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '120px' }}>
                      {candidate.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleValidateCandidate(candidate.id)}
                            style={{
                              background: '#f59e0b',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '8px 12px',
                              fontSize: '12px',
                              fontWeight: 500,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px'
                            }}
                          >
                            <Eye size={14} />
                            Validate
                          </button>
                          <button
                            onClick={() => setSelectedCandidate(candidate.id)}
                            style={{
                              background: '#f3f4f6',
                              color: '#374151',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              padding: '8px 12px',
                              fontSize: '12px',
                              fontWeight: 500,
                              cursor: 'pointer'
                            }}
                          >
                            Details
                          </button>
                        </>
                      )}
                      
                      {candidate.status === 'validated' && (
                        <>
                          <button
                            onClick={() => handleAssignCandidate(candidate.id)}
                            style={{
                              background: '#22c55e',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '8px 12px',
                              fontSize: '12px',
                              fontWeight: 500,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px'
                            }}
                          >
                            <CheckCircle size={14} />
                            Assign
                          </button>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              style={{
                                background: '#f0f9ff',
                                color: '#0369a1',
                                border: '1px solid #0ea5e9',
                                borderRadius: '6px',
                                padding: '6px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                flex: 1
                              }}
                            >
                              <Phone size={12} />
                            </button>
                            <button
                              style={{
                                background: '#f0fdf4',
                                color: '#166534',
                                border: '1px solid #22c55e',
                                borderRadius: '6px',
                                padding: '6px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                flex: 1
                              }}
                            >
                              <MessageCircle size={12} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {sourcingState.status === 'assigned' && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: '#f0fdf4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <CheckCircle size={32} color="#22c55e" />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: '#22c55e' }}>
              Operator Assigned Successfully
            </h3>
            <p style={{ fontSize: '14px', color: '#666' }}>
              WG operator has been confirmed and will begin the pickup sequence.
            </p>
          </div>
        )}
      </div>

      {/* Broadcast Modal */}
      {showBroadcastModal && (
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
            padding: '32px',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: 600,
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Send size={20} />
              Configure Broadcast
            </h2>
            
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                background: '#f9f9f9',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px'
              }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Auto-Applied Filters:</h3>
                <div style={{ fontSize: '14px', lineHeight: 1.6 }}>
                  <p><strong>Cities:</strong> {sourcingState.broadcastFilters.cities.join(', ')}</p>
                  <p><strong>Min Value Clearance:</strong> ${sourcingState.broadcastFilters.minValue.toLocaleString()}</p>
                  <p><strong>Date:</strong> {new Date(sourcingState.broadcastFilters.date).toLocaleDateString()}</p>
                  <p><strong>Max Distance:</strong> {sourcingState.broadcastFilters.maxDistance} miles</p>
                </div>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', display: 'block' }}>
                  Urgency Level
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="radio"
                      name="urgency"
                      value="standard"
                      checked={sourcingState.broadcastFilters.urgency === 'standard'}
                      onChange={(e) => setSourcingState(prev => ({
                        ...prev,
                        broadcastFilters: { ...prev.broadcastFilters, urgency: e.target.value as 'standard' | 'premium' }
                      }))}
                    />
                    Standard Rate
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="radio"
                      name="urgency"
                      value="premium"
                      checked={sourcingState.broadcastFilters.urgency === 'premium'}
                      onChange={(e) => setSourcingState(prev => ({
                        ...prev,
                        broadcastFilters: { ...prev.broadcastFilters, urgency: e.target.value as 'standard' | 'premium' }
                      }))}
                    />
                    Premium Rate (1.5x)
                  </label>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowBroadcastModal(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#f5f5f5',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleStartBroadcast}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500
                }}
              >
                Send Broadcast
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WGSourcingPipeline;
