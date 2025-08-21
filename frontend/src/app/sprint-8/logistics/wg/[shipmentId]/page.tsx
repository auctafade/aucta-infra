// frontend/src/app/sprint-8/logistics/wg/[shipmentId]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { 
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  User,
  Shield,
  Truck,
  AlertTriangle,
  CheckCircle,
  Info,
  ChevronLeft,
  ChevronRight,
  Star,
  Car,
  Building2,
  Phone,
  MessageCircle,
  Route,
  Navigation
} from 'lucide-react';
import WGCalendarScheduler from '@/components/WGCalendarScheduler';
import ChainOfCustodyPrep from '@/components/ChainOfCustodyPrep';
import WGConstraintValidator from '@/components/WGConstraintValidator';
import WGAssignmentResult from '@/components/WGAssignmentResult';
import WGEdgeCaseHandler from '@/components/WGEdgeCaseHandler';
import WGPerformanceTimer from '@/components/WGPerformanceTimer';
import { emitWGAssignment } from '@/lib/wgEvents';
import { createWGContext, canAssignWG, canModifyWGSchedule, canOverrideSLA, canViewOTP, getWGUIPermissions } from '@/lib/wgRBAC';
import { 
  trackWGViewOpen, 
  trackOperatorSuggestion, 
  trackSlotConflict, 
  trackStageComplete, 
  trackConfirmTime, 
  trackTimeToAssign 
} from '@/lib/wgTelemetry';

// Mock data
const mockShipmentData = {
  'SH001': {
    id: 'SH001',
    productName: 'Hermès Birkin Bag',
    declaredValue: 125000,
    sender: {
      name: 'Alice Thompson',
      location: 'Manhattan, NY',
      address: '432 Park Ave, Manhattan, NY 10022',
      timeWindow: '10:00-14:00',
      timezone: 'America/New_York',
      phone: '+1 (555) 123-4567',
      preferences: ['English', 'Morning pickup preferred']
    },
    buyer: {
      name: 'Sarah Wilson',
      location: 'Brooklyn, NY',
      address: '876 Fifth Avenue, Brooklyn, NY 11215',
      timeWindow: '14:00-18:00',
      timezone: 'America/New_York',
      phone: '+1 (555) 987-6543',
      preferences: ['English', 'Flexible delivery time']
    },
    route: {
      distance: '12.4 miles',
      estimatedTime: '45 minutes',
      hubLocation: 'AUCTA Hub - LIC',
      hubAddress: '34-12 36th Street, Long Island City, NY 11106',
      hubTimezone: 'America/New_York',
      leg1: { estimatedTime: '25', distance: '8.2 miles' },
      leg2: { estimatedTime: '20', distance: '4.2 miles' }
    },
    priority: 'high',
    language: 'English',
    tierLevel: 3,
    specialRequirements: ['Temperature controlled', 'Delicate handling'],
    slaDeadline: '2024-01-16 18:00',
    plannedRoute: {
      leg1: { from: 'Sender', to: 'Hub', estimatedTime: '25 min', distance: '8.2 miles' },
      leg2: { from: 'Hub', to: 'Buyer', estimatedTime: '20 min', distance: '4.2 miles' }
    }
  },
  'SH002': {
    id: 'SH002',
    productName: 'Rolex Daytona',
    declaredValue: 85000,
    sender: {
      name: 'Carlos Mendez',
      location: 'Queens, NY',
      address: '123 Northern Blvd, Queens, NY 11354',
      timeWindow: '09:00-13:00',
      timezone: 'America/New_York',
      phone: '+1 (555) 234-5678',
      preferences: ['Spanish', 'English', 'Early pickup preferred']
    },
    buyer: {
      name: 'David Kim',
      location: 'Manhattan, NY',
      address: '567 Lexington Ave, Manhattan, NY 10017',
      timeWindow: '15:00-19:00',
      timezone: 'America/New_York',
      phone: '+1 (555) 876-5432',
      preferences: ['English', 'After 3 PM delivery']
    },
    route: {
      distance: '15.8 miles',
      estimatedTime: '55 minutes',
      hubLocation: 'AUCTA Hub - LIC',
      hubAddress: '34-12 36th Street, Long Island City, NY 11106',
      hubTimezone: 'America/New_York',
      leg1: { estimatedTime: '30', distance: '9.2 miles' },
      leg2: { estimatedTime: '25', distance: '6.6 miles' }
    },
    priority: 'medium',
    language: 'Spanish',
    tierLevel: 2,
    specialRequirements: ['High value security'],
    slaDeadline: '2024-01-17 19:00',
    plannedRoute: {
      leg1: { from: 'Sender', to: 'Hub', estimatedTime: '30 min', distance: '9.2 miles' },
      leg2: { from: 'Hub', to: 'Buyer', estimatedTime: '25 min', distance: '6.6 miles' }
    }
  }
};

const mockOperators = [
  {
    id: 'wg001',
    name: 'Sarah Chen',
    languages: ['English', 'Mandarin'],
    areaCoverage: ['Manhattan', 'Brooklyn', 'Queens'],
    vehicle: 'Van',
    maxValueClearance: 500000,
    insurance: 'Active',
    rating: 4.8,
    pastJobs: 247,
    avatar: 'SC',
    phone: '+1 (555) 111-2222',
    availability: {
      '2024-01-15': [
        { start: '09:00', end: '12:00', status: 'available' },
        { start: '14:00', end: '18:00', status: 'available' }
      ],
      '2024-01-16': [
        { start: '08:00', end: '16:00', status: 'available' }
      ],
      '2024-01-17': [
        { start: '10:00', end: '15:00', status: 'available' }
      ]
    },
    specialSkills: ['Delicate Textiles', 'High Value Items'],
    location: 'Manhattan, NY',
    conflicts: [
      {
        jobId: 'JOB123',
        start: new Date('2024-01-16T12:00:00'),
        end: new Date('2024-01-16T13:00:00'),
        description: 'Lunch break (scheduled)'
      }
    ]
  },
  {
    id: 'wg002',
    name: 'Marcus Johnson',
    languages: ['English', 'Spanish'],
    areaCoverage: ['Manhattan', 'Bronx', 'JFK Airport'],
    vehicle: 'Car',
    maxValueClearance: 250000,
    insurance: 'Active',
    rating: 4.6,
    pastJobs: 189,
    avatar: 'MJ',
    phone: '+1 (555) 333-4444',
    availability: {
      '2024-01-15': [
        { start: '10:00', end: '14:00', status: 'available' }
      ],
      '2024-01-16': [
        { start: '09:00', end: '17:00', status: 'available' }
      ],
      '2024-01-17': [
        { start: '08:00', end: '16:00', status: 'available' }
      ]
    },
    specialSkills: ['Airport Pickup'],
    location: 'Queens, NY',
    conflicts: [
      {
        jobId: 'JOB456',
        start: new Date('2024-01-16T15:30:00'),
        end: new Date('2024-01-16T17:00:00'),
        description: 'Existing delivery (SH098)'
      }
    ]
  },
  {
    id: 'wg003',
    name: 'Elena Rodriguez',
    languages: ['English', 'Spanish', 'French'],
    areaCoverage: ['Manhattan', 'Brooklyn', 'LGA Airport'],
    vehicle: 'Van',
    maxValueClearance: 750000,
    insurance: 'Active',
    rating: 4.9,
    pastJobs: 312,
    avatar: 'ER',
    phone: '+1 (555) 555-6666',
    availability: {
      '2024-01-15': [
        { start: '08:00', end: '12:00', status: 'available' },
        { start: '15:00', end: '19:00', status: 'available' }
      ],
      '2024-01-16': [
        { start: '09:00', end: '13:00', status: 'available' }
      ],
      '2024-01-17': [
        { start: '07:00', end: '18:00', status: 'available' }
      ]
    },
    specialSkills: ['Luxury Items', 'International Pickup'],
    location: 'Brooklyn, NY',
    conflicts: []
  }
];

const ShipmentWGSchedulePage: React.FC = () => {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const shipmentId = params.shipmentId as string;
  const preselectedOperator = searchParams.get('operator');

  const [selectedOperator, setSelectedOperator] = useState<string>(preselectedOperator || '');
  const [selectedDate, setSelectedDate] = useState('2024-01-16');
  const [schedule, setSchedule] = useState<any[]>([]);
  const [isScheduleValid, setIsScheduleValid] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showChainOfCustody, setShowChainOfCustody] = useState(false);
  const [isScheduleConfirmed, setIsScheduleConfirmed] = useState(false);
  const [constraintValidation, setConstraintValidation] = useState<any>(null);
  const [showAssignmentResult, setShowAssignmentResult] = useState(false);
  const [finalAssignmentResult, setFinalAssignmentResult] = useState<any>(null);
  const [userRole] = useState<'ops_admin' | 'hub_tech' | 'wg_operator'>('ops_admin'); // Mock role
  const [showPerformanceTimer, setShowPerformanceTimer] = useState(false);
  const [showEdgeCaseHandler, setShowEdgeCaseHandler] = useState(true);
  
  // RBAC Context
  const rbacContext = createWGContext('user123', userRole, 'session456');
  const uiPermissions = getWGUIPermissions(rbacContext);

  const shipment = mockShipmentData[shipmentId as keyof typeof mockShipmentData];
  const operator = mockOperators.find(op => op.id === selectedOperator);

  // Track page view on mount
  useEffect(() => {
    if (shipmentId && typeof shipmentId === 'string') {
      trackWGViewOpen(shipmentId, rbacContext.userId, rbacContext.sessionId);
    }
  }, [shipmentId, rbacContext.userId, rbacContext.sessionId]);

  const handleScheduleChange = (newSchedule: any[]) => {
    setSchedule(newSchedule);
  };

  const handleValidationChange = (isValid: boolean, errors: string[]) => {
    setIsScheduleValid(isValid);
    setValidationErrors(errors);
  };

  const calculateCompatibilityScore = (op: any) => {
    let score = 0;
    let factors = [];

    // Value clearance
    if (op.maxValueClearance >= shipment.declaredValue) {
      score += 30;
      factors.push('Value clearance ✓');
    } else {
      factors.push('Value clearance ✗');
    }

    // Language match
    if (op.languages.some((lang: string) => lang.toLowerCase() === shipment.language.toLowerCase())) {
      score += 25;
      factors.push('Language match ✓');
    }

    // Area coverage
    const pickupArea = shipment.sender.location.split(',')[0];
    if (op.areaCoverage.some((area: string) => area.includes(pickupArea))) {
      score += 25;
      factors.push('Area coverage ✓');
    }

    // Rating
    if (op.rating >= 4.7) {
      score += 10;
      factors.push('High rating ✓');
    }

    // Special skills
    if (shipment.declaredValue > 100000 && op.specialSkills.includes('High Value Items')) {
      score += 10;
      factors.push('High value expertise ✓');
    }

    return { score: Math.min(score, 100), factors };
  };

  const handleConfirmAssignment = () => {
    // RBAC: Check if user can assign operators
    if (!canAssignWG(rbacContext)) {
      alert('Access denied: You do not have permission to assign WG operators');
      return;
    }

    // RBAC: Check if user can modify schedules  
    if (!canModifyWGSchedule(rbacContext, shipment.id)) {
      alert('Access denied: You do not have permission to modify schedules');
      return;
    }

    if (constraintValidation?.isValid && selectedOperator) {
      // Track stage completion
      if (shipmentId && typeof shipmentId === 'string') {
        trackStageComplete(shipmentId, 'validation');
      }
      setShowChainOfCustody(true);
    }
  };

  const handleConstraintValidation = (validation: any) => {
    setConstraintValidation(validation);
  };

  const handleOperatorOverride = (reason: string) => {
    // RBAC: Check if user can override SLA
    if (!canOverrideSLA(rbacContext, shipment.id, reason)) {
      alert('Access denied: You do not have permission to override SLA constraints');
      return;
    }

    console.log('SLA Override approved:', reason);
    // Override is logged in RBAC system automatically
  };

  const handleChainOfCustodyConfirm = (otpCodes: any, livenessChecks: any) => {
    // RBAC: Final permission check for OTP viewing
    if (!canViewOTP(rbacContext, shipment.id)) {
      alert('Access denied: You do not have permission to view OTP codes');
      return;
    }

    setIsScheduleConfirmed(true);
    
    // Track final confirmation timing
    if (shipmentId && typeof shipmentId === 'string') {
      trackConfirmTime(shipmentId, rbacContext.userId);
      
      // Track time to assign from plan creation (mock plan created 1 hour ago)
      const mockPlanCreatedAt = new Date(Date.now() - 60 * 60 * 1000);
      trackTimeToAssign(shipmentId, mockPlanCreatedAt, rbacContext.userId);
    }
    
    // Get schedule times
    const pickupSlot = schedule.find(s => s.type === 'pickup');
    const hubArrivalSlot = schedule.find(s => s.type === 'hub_arrival');
    const deliverySlot = schedule.find(s => s.type === 'delivery');
    
    // Emit WG assignment event for Dashboard, Inventory/Hub, and Sprint 2 updates
    emitWGAssignment(
      shipment.id,
      operator!.id,
      {
        pickup: { 
          time: pickupSlot?.time || new Date(),
          timezone: shipment.sender.timezone
        },
        hubIntake: { 
          time: hubArrivalSlot?.time || new Date(),
          timezone: shipment.route.hubTimezone
        },
        delivery: { 
          time: deliverySlot?.time || new Date(),
          timezone: shipment.buyer.timezone
        }
      },
      rbacContext.userId
    );
    
    // Create assignment result
    const result = {
      shipmentId: shipment.id,
      operator: {
        id: operator!.id,
        name: operator!.name,
        phone: operator!.phone
      },
      schedule: {
        pickup: { 
          time: pickupSlot?.time || new Date(),
          location: shipment.sender.location
        },
        hubIntake: { 
          time: hubArrivalSlot?.time || new Date(),
          location: shipment.route.hubLocation
        },
        delivery: { 
          time: deliverySlot?.time || new Date(),
          location: shipment.buyer.location
        }
      },
      otpCodes,
      statusProgression: {
        from: 'WG to assign',
        to: 'Pickup scheduled',
        queuePosition: 3
      }
    };
    
    setFinalAssignmentResult(result);
    setShowAssignmentResult(true);
    setShowChainOfCustody(false);
  };

  const handleFinalConfirm = () => {
    // In real app, would make API call to save assignment
    alert(`WG Assignment confirmed for ${shipment.id} with operator ${operator?.name}`);
    router.push('/sprint-8/logistics/wg');
  };

  if (!shipment) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h1>Shipment not found</h1>
        <button onClick={() => router.back()}>Go back</button>
      </div>
    );
  }

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
                WG Assignment: {shipment.id}
              </h1>
              <p style={{ fontSize: '16px', color: '#666' }}>
                Schedule White-Glove operator for {shipment.productName}
              </p>
            </div>
          </div>

          {/* Shipment Overview */}
          <div style={{
            background: '#f9f9f9',
            borderRadius: '8px',
            padding: '16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px'
          }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#666' }}>DECLARED VALUE</span>
              <p style={{ fontSize: '16px', fontWeight: 600, marginTop: '2px' }}>
                ${shipment.declaredValue.toLocaleString()}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#666' }}>ROUTE</span>
              <p style={{ fontSize: '14px', marginTop: '2px' }}>
                {shipment.sender.location} → Hub → {shipment.buyer.location}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#666' }}>SLA DEADLINE</span>
              <p style={{ fontSize: '14px', marginTop: '2px' }}>
                {new Date(shipment.slaDeadline).toLocaleString()}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#666' }}>PRIORITY</span>
              <span style={{
                background: shipment.priority === 'high' ? '#fef2f2' : '#fef3c7',
                color: shipment.priority === 'high' ? '#dc2626' : '#d97706',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 500,
                marginTop: '2px',
                display: 'inline-block'
              }}>
                {shipment.priority.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          {/* Left Column - Operator Selection */}
          <div>
            <div style={{
              background: '#fff',
              borderRadius: '12px',
              border: '1px solid #e0e0e0',
              marginBottom: '24px'
            }}>
              <div style={{
                padding: '20px',
                borderBottom: '1px solid #e0e0e0'
              }}>
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <User size={20} />
                  Select Operator
                </h2>
                <p style={{ fontSize: '14px', color: '#666' }}>
                  Choose the best operator for this assignment
                </p>
              </div>

              <div style={{ padding: '20px' }}>
                {mockOperators
                  .filter(op => op.maxValueClearance >= shipment.declaredValue)
                  .map((op) => {
                    const compatibility = calculateCompatibilityScore(op);
                    const isSelected = selectedOperator === op.id;
                    
                    return (
                      <div key={op.id} style={{
                        border: `2px solid ${isSelected ? '#000' : '#e0e0e0'}`,
                        borderRadius: '8px',
                        padding: '16px',
                        marginBottom: '12px',
                        cursor: 'pointer',
                        background: isSelected ? '#f5f5f5' : '#fff',
                        transition: 'all 0.3s'
                      }}
                      onClick={() => setSelectedOperator(op.id)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', gap: '12px', flex: 1 }}>
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #333 0%, #000 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              fontSize: '14px',
                              fontWeight: 500
                            }}>
                              {op.avatar}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>
                                  {op.name}
                                </h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                  <Star size={14} color="#f59e0b" fill="#f59e0b" />
                                  <span style={{ fontSize: '12px' }}>{op.rating}</span>
                                </div>
                              </div>
                              <p style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>
                                {op.vehicle} • {op.languages.join(', ')} • ${op.maxValueClearance.toLocaleString()} max
                              </p>
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {compatibility.factors.slice(0, 3).map((factor, idx) => (
                                  <span key={idx} style={{
                                    fontSize: '10px',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: factor.includes('✓') ? '#dcfce7' : '#fef2f2',
                                    color: factor.includes('✓') ? '#166534' : '#dc2626'
                                  }}>
                                    {factor}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: compatibility.score >= 80 ? '#22c55e' : compatibility.score >= 60 ? '#f59e0b' : '#ef4444'
                          }}>
                            {compatibility.score}%
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Route Details */}
            <div style={{
              background: '#fff',
              borderRadius: '12px',
              border: '1px solid #e0e0e0'
            }}>
              <div style={{
                padding: '20px',
                borderBottom: '1px solid #e0e0e0'
              }}>
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Route size={20} />
                  Planned Route
                </h2>
              </div>

              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Leg 1: Pickup → Hub */}
                  <div style={{
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    padding: '16px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <MapPin size={16} color="#666" />
                      <span style={{ fontSize: '14px', fontWeight: 600 }}>Leg 1: Pickup → Hub</span>
                    </div>
                    <div style={{ marginLeft: '24px' }}>
                      <p style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                        FROM: {shipment.sender.address}
                      </p>
                      <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                        TO: {shipment.route.hubAddress}
                      </p>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <span style={{ fontSize: '12px' }}>
                          ⏱️ {shipment.plannedRoute.leg1.estimatedTime}
                        </span>
                        <span style={{ fontSize: '12px' }}>
                          📍 {shipment.plannedRoute.leg1.distance}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Hub Processing */}
                  <div style={{
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    padding: '16px',
                    background: '#f0f9ff'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Building2 size={16} color="#0369a1" />
                      <span style={{ fontSize: '14px', fontWeight: 600 }}>Hub Processing</span>
                    </div>
                    <div style={{ marginLeft: '24px' }}>
                      <p style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                        Tier {shipment.tierLevel} processing required
                      </p>
                      <p style={{ fontSize: '12px', color: '#666' }}>
                        Estimated: 30 minutes (includes sewing capacity check)
                      </p>
                    </div>
                  </div>

                  {/* Leg 2: Hub → Delivery */}
                  <div style={{
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    padding: '16px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Navigation size={16} color="#666" />
                      <span style={{ fontSize: '14px', fontWeight: 600 }}>Leg 2: Hub → Delivery</span>
                    </div>
                    <div style={{ marginLeft: '24px' }}>
                      <p style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                        FROM: {shipment.route.hubAddress}
                      </p>
                      <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                        TO: {shipment.buyer.address}
                      </p>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <span style={{ fontSize: '12px' }}>
                          ⏱️ {shipment.plannedRoute.leg2.estimatedTime}
                        </span>
                        <span style={{ fontSize: '12px' }}>
                          📍 {shipment.plannedRoute.leg2.distance}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Schedule */}
          <div>
            {/* Date Selection */}
            <div style={{
              background: '#fff',
              borderRadius: '12px',
              border: '1px solid #e0e0e0',
              marginBottom: '24px'
            }}>
              <div style={{
                padding: '20px',
                borderBottom: '1px solid #e0e0e0'
              }}>
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Calendar size={20} />
                  Schedule Date
                </h2>
              </div>

              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['2024-01-15', '2024-01-16', '2024-01-17'].map((date) => (
                    <button key={date}
                      onClick={() => setSelectedDate(date)}
                      style={{
                        padding: '12px 16px',
                        border: `2px solid ${selectedDate === date ? '#000' : '#e0e0e0'}`,
                        borderRadius: '8px',
                        background: selectedDate === date ? '#f5f5f5' : '#fff',
                        cursor: 'pointer',
                        flex: 1,
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '2px' }}>
                        {new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>
                        {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Calendar Scheduler */}
            {selectedOperator && operator && (
              <div style={{ marginBottom: '24px' }}>
                <WGCalendarScheduler
                  shipment={shipment}
                  operator={{
                    id: operator.id,
                    name: operator.name,
                    conflicts: operator.conflicts
                  }}
                  onScheduleChange={handleScheduleChange}
                  onValidationChange={handleValidationChange}
                />
                
                {/* Constraint Validator */}
                {schedule.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <WGConstraintValidator
                      shipment={{
                        id: shipment.id,
                        declaredValue: shipment.declaredValue,
                        tierLevel: shipment.tierLevel,
                        slaDeadline: shipment.slaDeadline
                      }}
                      operator={operator}
                      schedule={schedule}
                      userRole={userRole}
                      onValidationChange={handleConstraintValidation}
                      onOperatorOverride={handleOperatorOverride}
                    />
                  </div>
                )}
                
                {/* Confirm Button */}
                {!showChainOfCustody && (
                  <div style={{
                    background: '#fff',
                    borderRadius: '12px',
                    border: '1px solid #e0e0e0',
                    padding: '20px',
                    marginTop: '16px'
                  }}>
                    {!uiPermissions.showAssignButton ? (
                      <div style={{
                        width: '100%',
                        padding: '16px',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '8px',
                        textAlign: 'center'
                      }}>
                        <div style={{ 
                          fontSize: '14px', 
                          fontWeight: 600, 
                          color: '#dc2626',
                          marginBottom: '4px'
                        }}>
                          Access Restricted
                        </div>
                        <div style={{ fontSize: '12px', color: '#991b1b' }}>
                          Role '{userRole}' cannot assign WG operators. Contact ops_admin for assistance.
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={handleConfirmAssignment}
                        disabled={!constraintValidation?.isValid || !selectedOperator}
                        style={{
                          width: '100%',
                          padding: '16px',
                          background: constraintValidation?.isValid && selectedOperator 
                            ? 'linear-gradient(135deg, #333 0%, #000 100%)' 
                            : '#e5e5e5',
                          color: constraintValidation?.isValid && selectedOperator ? '#fff' : '#999',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '16px',
                          fontWeight: 600,
                          cursor: constraintValidation?.isValid && selectedOperator ? 'pointer' : 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}
                      >
                        <CheckCircle size={20} />
                        Proceed to Chain of Custody
                      </button>
                    )}
                  </div>
                )}

                {/* Chain of Custody Preparation */}
                {showChainOfCustody && (
                  <div style={{ marginTop: '16px' }}>
                    <ChainOfCustodyPrep
                      shipment={shipment}
                      operator={{
                        id: operator!.id,
                        name: operator!.name,
                        phone: operator!.phone
                      }}
                      schedule={schedule}
                      onConfirm={handleChainOfCustodyConfirm}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Operator Contact Info */}
            {operator && (
              <div style={{
                background: '#fff',
                borderRadius: '12px',
                border: '1px solid #e0e0e0'
              }}>
                <div style={{
                  padding: '20px',
                  borderBottom: '1px solid #e0e0e0'
                }}>
                  <h2 style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    marginBottom: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <User size={20} />
                    Operator Details
                  </h2>
                </div>

                <div style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #333 0%, #000 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: '18px',
                      fontWeight: 500
                    }}>
                      {operator.avatar}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '2px' }}>
                        {operator.name}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Star size={14} color="#f59e0b" fill="#f59e0b" />
                        <span style={{ fontSize: '14px' }}>{operator.rating}</span>
                        <span style={{ fontSize: '12px', color: '#666' }}>
                          ({operator.pastJobs} jobs)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flex: 1, gap: '8px', marginBottom: '16px' }}>
                    <button style={{
                      flex: 1,
                      padding: '12px',
                      background: '#f0f9ff',
                      border: '1px solid #0ea5e9',
                      borderRadius: '8px',
                      color: '#0369a1',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      fontSize: '14px',
                      fontWeight: 500
                    }}>
                      <Phone size={16} />
                      Call
                    </button>
                    <button style={{
                      flex: 1,
                      padding: '12px',
                      background: '#f0fdf4',
                      border: '1px solid #22c55e',
                      borderRadius: '8px',
                      color: '#166534',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      fontSize: '14px',
                      fontWeight: 500
                    }}>
                      <MessageCircle size={16} />
                      Message
                    </button>
                  </div>

                  <div style={{ fontSize: '12px', color: '#666' }}>
                    <p style={{ marginBottom: '4px' }}>
                      <strong>Vehicle:</strong> {operator.vehicle}
                    </p>
                    <p style={{ marginBottom: '4px' }}>
                      <strong>Max Value:</strong> ${operator.maxValueClearance.toLocaleString()}
                    </p>
                    <p style={{ marginBottom: '4px' }}>
                      <strong>Languages:</strong> {operator.languages.join(', ')}
                    </p>
                    <p>
                      <strong>Coverage:</strong> {operator.areaCoverage.join(', ')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
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
              fontSize: '24px',
              fontWeight: 600,
              marginBottom: '16px',
              textAlign: 'center'
            }}>
              Confirm WG Assignment
            </h2>
            
            <div style={{ marginBottom: '24px' }}>
              <p style={{ fontSize: '16px', marginBottom: '16px', textAlign: 'center' }}>
                You're about to assign <strong>{operator?.name}</strong> to handle shipment <strong>{shipment.id}</strong>
              </p>
              
              <div style={{
                background: '#f9f9f9',
                borderRadius: '8px',
                padding: '16px'
              }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Schedule Summary:</h3>
                <div style={{ fontSize: '14px', lineHeight: 1.6 }}>
                  <p><strong>Date:</strong> {new Date(selectedDate).toLocaleDateString()}</p>
                  {schedule.length > 0 && (
                    <>
                      <p><strong>Pickup:</strong> {schedule.find(s => s.type === 'pickup')?.time.toTimeString().slice(0, 5)}</p>
                      <p><strong>Delivery:</strong> {schedule.find(s => s.type === 'delivery')?.time.toTimeString().slice(0, 5)}</p>
                    </>
                  )}
                  <p><strong>Operator:</strong> {operator?.name} ({operator?.phone})</p>
                </div>
              </div>
              
              <p style={{
                fontSize: '12px',
                color: '#666',
                textAlign: 'center',
                marginTop: '16px'
              }}>
                This will generate OTP codes and prepare liveness checkpoints for Chain of Custody tracking.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowConfirmation(false)}
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
                onClick={handleFinalConfirm}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'linear-gradient(135deg, #333 0%, #000 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500
                }}
              >
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Result Modal */}
      {showAssignmentResult && finalAssignmentResult && (
        <WGAssignmentResult
          result={finalAssignmentResult}
          onClose={() => {
            setShowAssignmentResult(false);
            router.push('/sprint-8/logistics/wg');
          }}
          onViewDetails={() => {
            setShowAssignmentResult(false);
            // In real app, would navigate to shipment detail page
            alert(`Viewing shipment details for ${finalAssignmentResult.shipmentId}`);
          }}
        />
      )}
    </div>
  );
};

export default ShipmentWGSchedulePage;
