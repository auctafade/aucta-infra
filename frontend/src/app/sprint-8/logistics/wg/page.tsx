// frontend/src/app/sprint-8/logistics/wg/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  Filter, 
  Clock, 
  MapPin, 
  User, 
  Car, 
  Shield, 
  Star, 
  Calendar,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Info,
  Truck
} from 'lucide-react';
import WGSourcingPipeline from '@/components/WGSourcingPipeline';
import { emitSourcingStart, emitSourcingSuccess, emitSourcingEscalation } from '@/lib/wgEvents';
import { createWGContext, canEscalateSourcing } from '@/lib/wgRBAC';
import wgBackendService, { WGOperator, WGShipment } from '@/lib/wgBackendService';

// Mock data for WG operators
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
    availability: {
      '2024-01-15': ['09:00-12:00', '14:00-18:00'],
      '2024-01-16': ['08:00-16:00'],
      '2024-01-17': ['10:00-15:00'],
      '2024-01-18': ['09:00-17:00'],
      '2024-01-19': ['08:00-12:00'],
    },
    specialSkills: ['Delicate Textiles', 'High Value Items'],
    location: 'Manhattan, NY'
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
    availability: {
      '2024-01-15': ['10:00-14:00'],
      '2024-01-16': ['09:00-17:00'],
      '2024-01-17': ['08:00-16:00'],
      '2024-01-18': ['11:00-15:00'],
      '2024-01-19': ['09:00-18:00'],
    },
    specialSkills: ['Airport Pickup'],
    location: 'Queens, NY'
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
    availability: {
      '2024-01-15': ['08:00-12:00', '15:00-19:00'],
      '2024-01-16': ['09:00-13:00'],
      '2024-01-17': ['07:00-18:00'],
      '2024-01-18': ['10:00-16:00'],
      '2024-01-19': ['08:00-14:00'],
    },
    specialSkills: ['Luxury Items', 'International Pickup'],
    location: 'Brooklyn, NY'
  }
];

// Mock pending shipments
const mockPendingShipments = [
  {
    id: 'SH001',
    productName: 'Hermès Birkin Bag',
    declaredValue: 125000,
    sender: 'Alice Thompson',
    buyer: 'Sarah Wilson',
    pickupLocation: 'Manhattan, NY',
    deliveryLocation: 'Brooklyn, NY',
    timeWindow: '2024-01-16 10:00-14:00',
    priority: 'high',
    language: 'English',
    slaDeadline: '2024-01-16T18:00:00',
    sender: {
      location: 'Manhattan, NY',
      timeWindow: '10:00-14:00'
    },
    buyer: {
      location: 'Brooklyn, NY', 
      timeWindow: '14:00-18:00'
    }
  },
  {
    id: 'SH002',
    productName: 'Rolex Daytona',
    declaredValue: 85000,
    sender: 'Carlos Mendez',
    buyer: 'David Kim',
    pickupLocation: 'Queens, NY',
    deliveryLocation: 'Manhattan, NY',
    timeWindow: '2024-01-17 09:00-13:00',
    priority: 'medium',
    language: 'Spanish',
    slaDeadline: '2024-01-17T19:00:00',
    sender: {
      location: 'Queens, NY',
      timeWindow: '09:00-13:00'
    },
    buyer: {
      location: 'Manhattan, NY',
      timeWindow: '15:00-19:00'
    }
  },
  {
    id: 'SH003',
    productName: 'Patek Philippe Grand Complication',
    declaredValue: 950000,
    sender: 'Victoria Sterling',
    buyer: 'James Anderson',
    pickupLocation: 'Manhattan, NY',
    deliveryLocation: 'Brooklyn, NY',
    timeWindow: '2024-01-16 14:00-17:00',
    priority: 'critical',
    language: 'English',
    slaDeadline: '2024-01-16T20:00:00',
    sender: {
      location: 'Manhattan, NY',
      timeWindow: '14:00-17:00'
    },
    buyer: {
      location: 'Brooklyn, NY',
      timeWindow: '16:00-20:00'
    }
  }
];

const WGSchedulingPage: React.FC = () => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({
    city: '',
    minValue: '',
    language: '',
    vehicle: ''
  });
  const [selectedOperator, setSelectedOperator] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedShipmentForSourcing, setSelectedShipmentForSourcing] = useState<string | null>(null);
  const [sourcingStartTimes, setSourcingStartTimes] = useState<Map<string, Date>>(new Map());
  
  // Backend data states
  const [operators, setOperators] = useState<WGOperator[]>([]);
  const [pendingShipments, setPendingShipments] = useState<WGShipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // RBAC Context
  const rbacContext = createWGContext('user123', 'ops_admin', 'session456');

  // Load data from backend
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Set authentication headers
        wgBackendService.setAuthHeaders(rbacContext.userId, rbacContext.role, rbacContext.sessionId);
        
        // Load operators and pending shipments in parallel
        const [operatorsResponse, shipmentsResponse] = await Promise.all([
          wgBackendService.getOperators(),
          wgBackendService.getPendingShipments()
        ]);
        
        if (!operatorsResponse.success) {
          throw new Error(operatorsResponse.error || 'Failed to load operators');
        }
        
        if (!shipmentsResponse.success) {
          throw new Error(shipmentsResponse.error || 'Failed to load shipments');
        }
        
        setOperators(operatorsResponse.data || []);
        setPendingShipments(shipmentsResponse.data || []);
        
      } catch (err) {
        console.error('Error loading WG data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [rbacContext.userId, rbacContext.role, rbacContext.sessionId]);

  const filteredOperators = operators.filter(operator => {
    // Handle potential null/undefined values and both camelCase and snake_case field names
    const areaCoverage = operator.area_coverage || operator.areaCoverage || [];
    const languages = operator.languages || [];
    const maxValueClearance = operator.max_value_clearance || operator.maxValueClearance || 0;
    const vehicleType = operator.vehicle_type || operator.vehicle || '';
    
    const matchesSearch = operator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         areaCoverage.some((area: string) => area.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCity = !selectedFilters.city || 
                       areaCoverage.some((area: string) => area.toLowerCase().includes(selectedFilters.city.toLowerCase()));
    
    const matchesValue = !selectedFilters.minValue || 
                        maxValueClearance >= parseInt(selectedFilters.minValue);
    
    const matchesLanguage = !selectedFilters.language || 
                           languages.some((lang: string) => lang.toLowerCase().includes(selectedFilters.language.toLowerCase()));
    
    const matchesVehicle = !selectedFilters.vehicle || 
                          vehicleType.toLowerCase() === selectedFilters.vehicle.toLowerCase();

    return matchesSearch && matchesCity && matchesValue && matchesLanguage && matchesVehicle;
  });

  const calculateCompatibilityScore = (operator: any, shipment: any) => {
    let score = 0;
    let factors = [];

    // Handle both backend data (snake_case) and mock data (camelCase)
    const maxValueClearance = operator.max_value_clearance || operator.maxValueClearance;
    const areaCoverage = operator.area_coverage || operator.areaCoverage || [];
    const languages = operator.languages || [];
    const specialSkills = operator.special_skills || operator.specialSkills || [];
    const rating = operator.rating || 0;
    
    // Value clearance compatibility
    const declaredValue = shipment.declaredValue || shipment.declared_value;
    if (maxValueClearance && maxValueClearance >= declaredValue) {
      score += 30;
      factors.push('Value clearance ✓');
    } else {
      factors.push('Value clearance ✗');
    }

    // Language match
    const shipmentLanguage = shipment.language || 'English'; // Default fallback
    if (languages.length > 0 && languages.some((lang: string) => lang.toLowerCase() === shipmentLanguage.toLowerCase())) {
      score += 25;
      factors.push('Language match ✓');
    } else {
      factors.push('Language mismatch');
    }

    // Area coverage
    const pickupLocation = shipment.pickupLocation || shipment.sender_address || '';
    const pickupArea = pickupLocation.split(',')[0];
    if (areaCoverage.length > 0 && areaCoverage.some((area: string) => area.includes(pickupArea))) {
      score += 25;
      factors.push('Area coverage ✓');
    } else {
      factors.push('Area coverage limited');
    }

    // Rating bonus
    if (rating >= 4.7) {
      score += 10;
      factors.push('High rating ✓');
    }

    // Special skills
    if (declaredValue > 100000 && specialSkills.length > 0 && specialSkills.includes('High Value Items')) {
      score += 10;
      factors.push('High value expertise ✓');
    }

    return { score: Math.min(score, 100), factors };
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const handleOperatorSelect = (operatorId: string, shipmentId?: string) => {
    if (shipmentId) {
      router.push(`/sprint-8/logistics/wg/${shipmentId}?operator=${operatorId}`);
    } else {
      setSelectedOperator(operatorId);
    }
  };

  const handleStartSourcing = (shipmentId: string) => {
    const shipment = mockPendingShipments.find(s => s.id === shipmentId);
    if (!shipment) return;

    // Record sourcing start time
    const startTime = new Date();
    setSourcingStartTimes(prev => new Map(prev.set(shipmentId, startTime)));

    // Emit sourcing started event
    emitSourcingStart(
      shipmentId,
      {
        cities: [shipment.sender.location.split(',')[0]],
        minValue: shipment.declaredValue,
        maxDistance: 50,
        urgency: shipment.priority === 'critical' ? 'premium' : 'standard'
      },
      120, // 2 hour SLA target
      rbacContext.userId
    );

    setSelectedShipmentForSourcing(shipmentId);
  };

  const handleSourcingAssignment = (operatorId: string) => {
    if (!selectedShipmentForSourcing) return;

    // Get sourcing start time
    const startTime = sourcingStartTimes.get(selectedShipmentForSourcing);
    if (startTime) {
      // Emit sourcing success event
      emitSourcingSuccess(selectedShipmentForSourcing, operatorId, startTime);
    }

    alert(`External operator ${operatorId} assigned to shipment ${selectedShipmentForSourcing}`);
    setSelectedShipmentForSourcing(null);
  };

  const handleEscalation = () => {
    if (!selectedShipmentForSourcing) return;

    // RBAC: Check if user can escalate sourcing
    if (!canEscalateSourcing(rbacContext, selectedShipmentForSourcing)) {
      alert('Access denied: You do not have permission to escalate sourcing');
      return;
    }

    // Emit escalation event
    emitSourcingEscalation(
      selectedShipmentForSourcing,
      'SLA risk detected - expanding partner vendor network',
      'partner_vendors',
      rbacContext.userId
    );

    alert('Escalation initiated: Contacting partner vendors and considering premium rates');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa' }}>
      {/* Page Header */}
      <div style={{
        background: '#fff',
        padding: '32px 0',
        borderBottom: '1px solid #e0e0e0',
        marginBottom: '32px'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #333 0%, #000 100%)',
              borderRadius: '12px',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Truck size={24} color="#fff" />
            </div>
            <div>
              <h1 style={{
                fontSize: '32px',
                fontWeight: 300,
                letterSpacing: '-0.02em',
                marginBottom: '8px'
              }}>
                              WG Scheduling
            </h1>
            <p style={{
              fontSize: '16px',
              color: '#666',
              lineHeight: 1.5,
              marginBottom: '16px'
            }}>
              Assign White-Glove operators for pickup → Hub → delivery chains
            </p>
            
            {/* Demo Links */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={() => router.push('/sprint-8/logistics/wg/demo')}
                style={{
                  background: '#f0f9ff',
                  color: '#0369a1',
                  border: '1px solid #0ea5e9',
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
                🎯 Sourcing Pipeline Demo
              </button>
              <button
                onClick={() => router.push('/sprint-8/logistics/wg/custody-demo')}
                style={{
                  background: '#f0fdf4',
                  color: '#166534',
                  border: '1px solid #22c55e',
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
                🔐 Chain of Custody Demo
              </button>
              <button
                onClick={() => router.push('/sprint-8/logistics/wg/rbac-demo')}
                style={{
                  background: '#fef2f2',
                  color: '#dc2626',
                  border: '1px solid #fecaca',
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
                🛡️ RBAC & Events Demo
              </button>
              <button
                onClick={() => router.push('/sprint-8/logistics/wg/ux-demo')}
                style={{
                  background: '#f0f9ff',
                  color: '#0369a1',
                  border: '1px solid #0ea5e9',
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
                ⚡ UX Excellence Demo
              </button>
              <button
                onClick={() => router.push('/sprint-8/logistics/wg/telemetry-demo')}
                style={{
                  background: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
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
                📊 Telemetry Analytics
              </button>
            </div>
            </div>
          </div>

          {/* Pending Shipments Alert */}
          {mockPendingShipments.length > 0 && (
            <div style={{
              background: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: '8px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <AlertTriangle size={20} color="#f59e0b" />
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
                  {mockPendingShipments.length} shipments awaiting WG assignment
                </h3>
                <p style={{ fontSize: '12px', color: '#92400e' }}>
                  High-priority shipments need immediate operator assignment
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#f59e0b' }}>
                  {mockPendingShipments.length}
                </div>
                <div style={{ fontSize: '10px', color: '#92400e', fontWeight: 600 }}>
                  WG TO ASSIGN
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 40px' }}>
        {/* Recently Assigned Shipments */}
        <div style={{ marginBottom: '40px' }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 500,
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <CheckCircle size={20} color="#22c55e" />
            Recently Assigned
          </h2>
          
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            border: '1px solid #e0e0e0',
            padding: '20px',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: '#22c55e'
                }} />
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>
                    SH001 • Hermès Birkin Bag
                  </h3>
                  <p style={{ fontSize: '14px', color: '#666' }}>
                    Assigned to <strong>Elena Rodriguez</strong> • Next: Pickup at 14:30
                  </p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  background: '#f0fdf4',
                  color: '#166534',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 600
                }}>
                  PICKUP SCHEDULED
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Shipments Section */}
        {mockPendingShipments.length > 0 && (
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: 500,
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Clock size={20} />
              Pending Assignments
            </h2>
            
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              {mockPendingShipments.map((shipment) => (
                <div key={shipment.id} style={{
                  background: '#fff',
                  borderRadius: '12px',
                  padding: '20px',
                  border: `2px solid ${shipment.priority === 'high' ? '#ef4444' : '#f59e0b'}`,
                  flex: '1',
                  minWidth: '300px',
                  maxWidth: '400px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>
                        {shipment.id}
                      </h3>
                      <p style={{ fontSize: '14px', color: '#666' }}>
                        {shipment.productName}
                      </p>
                    </div>
                    <span style={{
                      background: shipment.priority === 'high' ? '#fef2f2' : '#fef3c7',
                      color: shipment.priority === 'high' ? '#dc2626' : '#d97706',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 500
                    }}>
                      {shipment.priority.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Shield size={16} color="#666" />
                      <span style={{ fontSize: '14px' }}>
                        ${shipment.declaredValue.toLocaleString()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MapPin size={16} color="#666" />
                      <span style={{ fontSize: '14px' }}>
                        {shipment.pickupLocation} → {shipment.deliveryLocation}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={16} color="#666" />
                      <span style={{ fontSize: '14px' }}>
                        {shipment.timeWindow}
                      </span>
                    </div>
                  </div>

                  {/* Compatible Operators */}
                  <div style={{ marginBottom: '16px' }}>
                    {(() => {
                      const compatibleOps = filteredOperators
                        .map(op => ({ ...op, compatibility: calculateCompatibilityScore(op, shipment) }))
                        .filter(op => {
                          const maxValue = op.max_value_clearance || op.maxValueClearance || 0;
                          const shipmentValue = shipment.declaredValue || shipment.declared_value || 0;
                          return maxValue >= shipmentValue;
                        })
                        .sort((a, b) => b.compatibility.score - a.compatibility.score);
                      
                      if (compatibleOps.length === 0) {
                        return (
                          <div>
                            <h4 style={{ fontSize: '12px', fontWeight: 600, color: '#666', marginBottom: '8px' }}>
                              NO COMPATIBLE OPERATORS
                            </h4>
                            <div style={{
                              padding: '12px',
                              background: '#fef2f2',
                              border: '1px solid #fecaca',
                              borderRadius: '6px',
                              marginBottom: '8px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <AlertTriangle size={14} color="#dc2626" />
                                <span style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626' }}>
                                  Roster Coverage Gap
                                </span>
                              </div>
                              <p style={{ fontSize: '11px', color: '#991b1b' }}>
                                Current operators cannot handle this value/requirements
                              </p>
                            </div>
                            <button
                              onClick={() => handleStartSourcing(shipment.id)}
                              style={{
                                width: '100%',
                                background: '#3b82f6',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '8px 12px',
                                fontSize: '11px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                              }}
                            >
                              <Search size={12} />
                              Start Sourcing
                            </button>
                          </div>
                        );
                      }
                      
                      return (
                        <div>
                          <h4 style={{ fontSize: '12px', fontWeight: 600, color: '#666', marginBottom: '8px' }}>
                            COMPATIBLE OPERATORS
                          </h4>
                          {compatibleOps.slice(0, 2).map((operator) => (
                            <div key={operator.id} style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px',
                              background: '#f9f9f9',
                              borderRadius: '6px',
                              marginBottom: '4px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '50%',
                                  background: 'linear-gradient(135deg, #333 0%, #000 100%)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#fff',
                                  fontSize: '10px',
                                  fontWeight: 500
                                }}>
                                  {operator.avatar}
                                </div>
                                <span style={{ fontSize: '12px', fontWeight: 500 }}>
                                  {operator.name}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  color: getScoreColor(operator.compatibility.score)
                                }}>
                                  {operator.compatibility.score}%
                                </span>
                                <button
                                  onClick={() => handleOperatorSelect(operator.id, shipment.id)}
                                  style={{
                                    background: '#000',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Assign
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  <button
                    onClick={() => router.push(`/sprint-8/logistics/wg/${shipment.id}`)}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #333 0%, #000 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '12px',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    Schedule WG Assignment
                    <ChevronRight size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          border: '1px solid #e0e0e0'
        }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={20} style={{ position: 'absolute', left: '12px', top: '12px', color: '#666' }} />
              <input
                type="text"
                placeholder="Search operators by name, area coverage..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 44px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 16px',
                background: showFilters ? '#000' : '#f5f5f5',
                color: showFilters ? '#fff' : '#666',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              <Filter size={16} />
              Filters
            </button>
          </div>

          {showFilters && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              padding: '16px',
              background: '#f9f9f9',
              borderRadius: '8px'
            }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#666', marginBottom: '4px', display: 'block' }}>
                  CITY/AREA
                </label>
                <input
                  type="text"
                  placeholder="Manhattan, Brooklyn..."
                  value={selectedFilters.city}
                  onChange={(e) => setSelectedFilters(prev => ({ ...prev, city: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#666', marginBottom: '4px', display: 'block' }}>
                  MIN VALUE CLEARANCE
                </label>
                <input
                  type="number"
                  placeholder="50000"
                  value={selectedFilters.minValue}
                  onChange={(e) => setSelectedFilters(prev => ({ ...prev, minValue: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#666', marginBottom: '4px', display: 'block' }}>
                  LANGUAGE
                </label>
                <select
                  value={selectedFilters.language}
                  onChange={(e) => setSelectedFilters(prev => ({ ...prev, language: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">All languages</option>
                  <option value="english">English</option>
                  <option value="spanish">Spanish</option>
                  <option value="mandarin">Mandarin</option>
                  <option value="french">French</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#666', marginBottom: '4px', display: 'block' }}>
                  VEHICLE TYPE
                </label>
                <select
                  value={selectedFilters.vehicle}
                  onChange={(e) => setSelectedFilters(prev => ({ ...prev, vehicle: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">All vehicles</option>
                  <option value="car">Car</option>
                  <option value="van">Van</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Operator Roster */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid #e0e0e0'
        }}>
          <div style={{
            padding: '24px',
            borderBottom: '1px solid #e0e0e0'
          }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: 500,
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <User size={20} />
              Available Operators ({filteredOperators.length})
            </h2>
            <p style={{ fontSize: '14px', color: '#666' }}>
              Select the best single operator for the full chain: pickup → Hub → delivery
            </p>
          </div>

          <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredOperators.map((operator) => (
                <div key={operator.id} style={{
                  border: '1px solid #e0e0e0',
                  borderRadius: '12px',
                  padding: '20px',
                  transition: 'all 0.3s',
                  cursor: 'pointer',
                  background: selectedOperator === operator.id ? '#f5f5f5' : '#fff'
                }}
                onMouseEnter={(e) => {
                  if (selectedOperator !== operator.id) {
                    e.currentTarget.style.background = '#fafafa';
                    e.currentTarget.style.borderColor = '#ccc';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedOperator !== operator.id) {
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.borderColor = '#e0e0e0';
                  }
                }}
                onClick={() => setSelectedOperator(operator.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '16px', flex: 1 }}>
                      <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #333 0%, #000 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: '20px',
                        fontWeight: 500,
                        flexShrink: 0
                      }}>
                        {operator.avatar}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                          <h3 style={{ fontSize: '18px', fontWeight: 600 }}>
                            {operator.name}
                          </h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Star size={16} color="#f59e0b" fill="#f59e0b" />
                            <span style={{ fontSize: '14px', fontWeight: 500 }}>
                              {operator.rating}
                            </span>
                          </div>
                          <span style={{
                            background: '#22c55e',
                            color: '#fff',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 500
                          }}>
                            {operator.insurance}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#666' }}>AREA COVERAGE</span>
                            <p style={{ fontSize: '14px', marginTop: '2px' }}>
                              {(operator.area_coverage || operator.areaCoverage || []).join(', ')}
                            </p>
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#666' }}>LANGUAGES</span>
                            <p style={{ fontSize: '14px', marginTop: '2px' }}>
                              {(operator.languages || []).join(', ')}
                            </p>
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#666' }}>VEHICLE & VALUE</span>
                            <p style={{ fontSize: '14px', marginTop: '2px' }}>
                              {operator.vehicle_type || operator.vehicle} • ${(operator.max_value_clearance || operator.maxValueClearance || 0).toLocaleString()} max
                            </p>
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#666' }}>EXPERIENCE</span>
                            <p style={{ fontSize: '14px', marginTop: '2px' }}>
                              {operator.total_jobs || operator.pastJobs || 0} completed jobs
                            </p>
                          </div>
                        </div>

                        {((operator.special_skills || operator.specialSkills || []).length > 0) && (
                          <div style={{ marginBottom: '12px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#666' }}>SPECIAL SKILLS</span>
                            <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                              {(operator.special_skills || operator.specialSkills || []).map((skill: string) => (
                                <span key={skill} style={{
                                  background: '#e0e7ff',
                                  color: '#3730a3',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: 500
                                }}>
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Availability Preview */}
                        <div>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#666' }}>NEXT 3 DAYS AVAILABILITY</span>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                            {(() => {
                              const availability = operator.availability || {};
                              const availabilityEntries = Object.entries(availability);
                              
                              if (availabilityEntries.length === 0) {
                                return (
                                  <div style={{
                                    background: '#f9fafb',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px',
                                    padding: '6px 8px',
                                    fontSize: '11px',
                                    color: '#6b7280'
                                  }}>
                                    No availability data
                                  </div>
                                );
                              }
                              
                              return availabilityEntries.slice(0, 3).map(([date, slots]) => (
                                <div key={date} style={{
                                  background: '#f0f9ff',
                                  border: '1px solid #0ea5e9',
                                  borderRadius: '6px',
                                  padding: '6px 8px',
                                  fontSize: '11px'
                                }}>
                                  <div style={{ fontWeight: 600, marginBottom: '2px' }}>
                                    {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </div>
                                  <div style={{ color: '#0369a1' }}>
                                    {Array.isArray(slots) ? slots.length : 0} slots
                                  </div>
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/sprint-8/logistics/wg/schedule?operator=${operator.id}`);
                        }}
                        style={{
                          background: 'linear-gradient(135deg, #333 0%, #000 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '8px 16px',
                          fontSize: '14px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Calendar size={16} />
                        Schedule
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {filteredOperators.length === 0 && (
                <div style={{
                  textAlign: 'center',
                  padding: '60px 20px',
                  color: '#666'
                }}>
                  <User size={48} color="#ccc" style={{ marginBottom: '16px' }} />
                  <h3 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '8px' }}>
                    No operators found
                  </h3>
                  <p style={{ fontSize: '14px' }}>
                    Try adjusting your search criteria or filters
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sourcing Pipeline Modal */}
        {selectedShipmentForSourcing && (
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
            zIndex: 1000,
            padding: '20px'
          }}>
            <div style={{
              background: '#fff',
              borderRadius: '12px',
              maxWidth: '800px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              position: 'relative'
            }}>
              <button
                onClick={() => setSelectedShipmentForSourcing(null)}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  zIndex: 1001,
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#666'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                ×
              </button>
              
              <WGSourcingPipeline
                shipment={mockPendingShipments.find(s => s.id === selectedShipmentForSourcing)!}
                onAssignment={handleSourcingAssignment}
                onEscalation={handleEscalation}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WGSchedulingPage;
