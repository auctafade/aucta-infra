// frontend/src/app/sprint-8/logistics/wg/backend-demo/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogisticsDashboardLayout } from '@/components/LogisticsDashboardLayout';
import wgBackendService, { WGOperator, WGShipment } from '@/lib/wgBackendService';

const WGBackendDemo: React.FC = () => {
  const router = useRouter();
  const [operators, setOperators] = useState<WGOperator[]>([]);
  const [pendingShipments, setPendingShipments] = useState<WGShipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'operators' | 'shipments' | 'assignments'>('operators');
  const [selectedOperator, setSelectedOperator] = useState<WGOperator | null>(null);
  const [selectedShipment, setSelectedShipment] = useState<WGShipment | null>(null);

  // Load data from backend
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Set authentication headers
        wgBackendService.setAuthHeaders('demo_user', 'ops_admin', 'demo_session');
        
        // Test health check first
        const healthResponse = await wgBackendService.healthCheck();
        if (!healthResponse.success) {
          throw new Error('Backend service is not available');
        }
        
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
  }, []);

  const handleCreateAssignment = async () => {
    if (!selectedOperator || !selectedShipment) {
      alert('Please select both an operator and a shipment');
      return;
    }

    try {
      setIsLoading(true);
      
      // Create assignment
      const assignmentData = {
        shipment_id: selectedShipment.id,
        operator_id: selectedOperator.id,
        assigned_by: 'demo_user',
        assignment_type: 'direct',
        pickup_scheduled_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
        hub_arrival_scheduled_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours from now
        delivery_scheduled_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // 6 hours from now
        liveness_check_pickup: true,
        liveness_check_hub: true,
        liveness_check_delivery: selectedShipment.declared_value >= 1000000, // High value items
      };

      const response = await wgBackendService.createAssignment(assignmentData);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to create assignment');
      }

      alert(`Assignment created successfully! 
        Shipment: ${selectedShipment.shipment_code}
        Operator: ${selectedOperator.name}
        Pickup OTP: ${response.data?.pickup_otp}
        Hub OTP: ${response.data?.hub_intake_otp}
        Delivery OTP: ${response.data?.delivery_otp}
        ${response.data?.seal_id ? `Seal ID: ${response.data.seal_id}` : ''}
      `);

      // Reset selections and reload data
      setSelectedOperator(null);
      setSelectedShipment(null);
      
      // Reload pending shipments
      const shipmentsResponse = await wgBackendService.getPendingShipments();
      if (shipmentsResponse.success) {
        setPendingShipments(shipmentsResponse.data || []);
      }

    } catch (err) {
      console.error('Error creating assignment:', err);
      alert(`Failed to create assignment: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return (cents / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <LogisticsDashboardLayout>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '400px',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #f3f4f6',
            borderLeft: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ color: '#666', fontSize: '16px' }}>Loading WG system data...</p>
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </LogisticsDashboardLayout>
    );
  }

  if (error) {
    return (
      <LogisticsDashboardLayout>
        <div style={{ 
          padding: '40px',
          textAlign: 'center',
          background: '#fef2f2',
          margin: '40px',
          borderRadius: '12px',
          border: '1px solid #fecaca'
        }}>
          <h2 style={{ color: '#dc2626', marginBottom: '16px' }}>Connection Error</h2>
          <p style={{ color: '#b91c1c', marginBottom: '24px' }}>{error}</p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#dc2626',
                color: '#fff',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              Retry Connection
            </button>
            <button
              onClick={() => router.push('/sprint-8/logistics/wg')}
              style={{
                background: '#fff',
                color: '#dc2626',
                border: '1px solid #dc2626',
                padding: '12px 24px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              Back to Mock Demo
            </button>
          </div>
        </div>
      </LogisticsDashboardLayout>
    );
  }

  return (
    <LogisticsDashboardLayout>
      <div style={{ padding: '40px' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ 
            fontSize: '32px', 
            fontWeight: 300, 
            marginBottom: '8px',
            color: '#333'
          }}>
            WG Backend Integration Demo
          </h1>
          <p style={{ color: '#666', fontSize: '16px', marginBottom: '16px' }}>
            Real-time data from PostgreSQL database via REST API
          </p>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{
              background: '#10b981',
              color: '#fff',
              padding: '4px 12px',
              borderRadius: '16px',
              fontSize: '12px',
              fontWeight: 500
            }}>
              ✅ Backend Connected
            </div>
            <div style={{
              background: '#f3f4f6',
              color: '#666',
              padding: '4px 12px',
              borderRadius: '16px',
              fontSize: '12px'
            }}>
              {operators.length} operators loaded
            </div>
            <div style={{
              background: '#f3f4f6',
              color: '#666',
              padding: '4px 12px',
              borderRadius: '16px',
              fontSize: '12px'
            }}>
              {pendingShipments.length} pending shipments
            </div>
            <button
              onClick={() => router.push('/sprint-8/logistics/wg')}
              style={{
                background: '#3b82f6',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 500
              }}
            >
              ← Back to Main Demo
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ 
          display: 'flex', 
          gap: '2px', 
          marginBottom: '32px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          {(['operators', 'shipments', 'assignments'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: activeTab === tab ? '#fff' : 'transparent',
                color: activeTab === tab ? '#3b82f6' : '#6b7280',
                border: activeTab === tab ? '1px solid #e5e7eb' : 'none',
                borderBottom: activeTab === tab ? '1px solid #fff' : '1px solid #e5e7eb',
                padding: '12px 24px',
                borderRadius: '8px 8px 0 0',
                cursor: 'pointer',
                fontWeight: activeTab === tab ? 600 : 400,
                textTransform: 'capitalize',
                marginBottom: '-1px'
              }}
            >
              {tab} {tab === 'operators' ? `(${operators.length})` : 
                     tab === 'shipments' ? `(${pendingShipments.length})` : ''}
            </button>
          ))}
        </div>

        {/* Operators Tab */}
        {activeTab === 'operators' && (
          <div>
            <h2 style={{ marginBottom: '24px', color: '#333' }}>Available WG Operators</h2>
            <div style={{ display: 'grid', gap: '16px' }}>
              {operators.map((operator) => (
                <div
                  key={operator.id}
                  onClick={() => setSelectedOperator(operator)}
                  style={{
                    background: selectedOperator?.id === operator.id ? '#eff6ff' : '#fff',
                    border: selectedOperator?.id === operator.id ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                    borderRadius: '12px',
                    padding: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#333' }}>
                          {operator.name}
                        </h3>
                        <span style={{
                          background: operator.status === 'active' ? '#10b981' : '#6b7280',
                          color: '#fff',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 500
                        }}>
                          {operator.status}
                        </span>
                      </div>
                      <p style={{ color: '#666', marginBottom: '12px' }}>
                        {operator.operator_code} • {operator.email} • {operator.phone}
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                        <div>
                          <p style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Max Value Clearance</p>
                          <p style={{ fontWeight: 600, color: '#333' }}>
                            {formatCurrency(operator.max_value_clearance)}
                          </p>
                        </div>
                        <div>
                          <p style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Vehicle</p>
                          <p style={{ fontWeight: 500, color: '#333', textTransform: 'capitalize' }}>
                            {operator.vehicle_type}
                          </p>
                        </div>
                        <div>
                          <p style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Rating</p>
                          <p style={{ fontWeight: 600, color: '#333' }}>
                            ⭐ {operator.rating} ({operator.successful_jobs}/{operator.total_jobs} successful)
                          </p>
                        </div>
                        <div>
                          <p style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Languages</p>
                          <p style={{ color: '#333' }}>
                            {operator.languages.join(', ')}
                          </p>
                        </div>
                      </div>
                      <div style={{ marginTop: '12px' }}>
                        <p style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Coverage Areas</p>
                        <p style={{ color: '#333' }}>
                          {operator.area_coverage.join(', ')}
                        </p>
                      </div>
                      {operator.special_skills.length > 0 && (
                        <div style={{ marginTop: '12px' }}>
                          <p style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Special Skills</p>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {operator.special_skills.map((skill, index) => (
                              <span
                                key={index}
                                style={{
                                  background: '#f3f4f6',
                                  color: '#374151',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '12px'
                                }}
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {selectedOperator?.id === operator.id && (
                      <div style={{
                        background: '#3b82f6',
                        color: '#fff',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600
                      }}>
                        SELECTED
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shipments Tab */}
        {activeTab === 'shipments' && (
          <div>
            <h2 style={{ marginBottom: '24px', color: '#333' }}>Pending Shipments</h2>
            <div style={{ display: 'grid', gap: '16px' }}>
              {pendingShipments.map((shipment) => (
                <div
                  key={shipment.id}
                  onClick={() => setSelectedShipment(shipment)}
                  style={{
                    background: selectedShipment?.id === shipment.id ? '#eff6ff' : '#fff',
                    border: selectedShipment?.id === shipment.id ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                    borderRadius: '12px',
                    padding: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#333' }}>
                          {shipment.shipment_code}: {shipment.product_name}
                        </h3>
                        <span style={{
                          background: shipment.priority === 'critical' ? '#dc2626' : 
                                   shipment.priority === 'urgent' ? '#f59e0b' : '#10b981',
                          color: '#fff',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 500,
                          textTransform: 'uppercase'
                        }}>
                          {shipment.priority}
                        </span>
                        <span style={{
                          background: '#f3f4f6',
                          color: '#374151',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 500
                        }}>
                          Tier {shipment.tier_level}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
                        <div>
                          <p style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Declared Value</p>
                          <p style={{ fontWeight: 600, color: '#333', fontSize: '16px' }}>
                            {formatCurrency(shipment.declared_value)}
                          </p>
                        </div>
                        <div>
                          <p style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Category</p>
                          <p style={{ fontWeight: 500, color: '#333', textTransform: 'capitalize' }}>
                            {shipment.product_category}
                          </p>
                        </div>
                        <div>
                          <p style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>SLA Deadline</p>
                          <p style={{ fontWeight: 500, color: '#dc2626' }}>
                            {formatDate(shipment.sla_deadline)}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
                        <div>
                          <p style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Pickup</p>
                          <p style={{ color: '#333', fontSize: '14px' }}>
                            <strong>{shipment.sender_name}</strong><br />
                            {shipment.sender_address}<br />
                            {shipment.sender_time_window && (
                              <span style={{ color: '#666' }}>Window: {shipment.sender_time_window}</span>
                            )}
                          </p>
                        </div>
                        <div>
                          <p style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Delivery</p>
                          <p style={{ color: '#333', fontSize: '14px' }}>
                            <strong>{shipment.buyer_name}</strong><br />
                            {shipment.buyer_address}<br />
                            {shipment.buyer_time_window && (
                              <span style={{ color: '#666' }}>Window: {shipment.buyer_time_window}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      {shipment.special_instructions && (
                        <div style={{ 
                          background: '#f9fafb', 
                          padding: '12px', 
                          borderRadius: '8px',
                          marginTop: '12px'
                        }}>
                          <p style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Special Instructions</p>
                          <p style={{ color: '#374151', fontSize: '14px' }}>
                            {shipment.special_instructions}
                          </p>
                        </div>
                      )}
                    </div>
                    {selectedShipment?.id === shipment.id && (
                      <div style={{
                        background: '#3b82f6',
                        color: '#fff',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600
                      }}>
                        SELECTED
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assignment Tab */}
        {activeTab === 'assignments' && (
          <div>
            <h2 style={{ marginBottom: '24px', color: '#333' }}>Create Assignment</h2>
            
            {selectedOperator && selectedShipment ? (
              <div style={{
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                padding: '24px'
              }}>
                <h3 style={{ marginBottom: '16px', color: '#333' }}>Assignment Preview</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', marginBottom: '24px' }}>
                  <div>
                    <h4 style={{ color: '#666', marginBottom: '8px' }}>Selected Operator</h4>
                    <div style={{ background: '#fff', padding: '16px', borderRadius: '8px' }}>
                      <p style={{ fontWeight: 600, marginBottom: '4px' }}>{selectedOperator.name}</p>
                      <p style={{ color: '#666', fontSize: '14px' }}>{selectedOperator.operator_code}</p>
                      <p style={{ color: '#666', fontSize: '14px' }}>
                        Max Value: {formatCurrency(selectedOperator.max_value_clearance)}
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 style={{ color: '#666', marginBottom: '8px' }}>Selected Shipment</h4>
                    <div style={{ background: '#fff', padding: '16px', borderRadius: '8px' }}>
                      <p style={{ fontWeight: 600, marginBottom: '4px' }}>{selectedShipment.shipment_code}</p>
                      <p style={{ color: '#666', fontSize: '14px' }}>{selectedShipment.product_name}</p>
                      <p style={{ color: '#666', fontSize: '14px' }}>
                        Value: {formatCurrency(selectedShipment.declared_value)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Compatibility Check */}
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ color: '#666', marginBottom: '8px' }}>Compatibility Analysis</h4>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{
                      background: selectedOperator.max_value_clearance >= selectedShipment.declared_value ? '#dcfce7' : '#fee2e2',
                      color: selectedOperator.max_value_clearance >= selectedShipment.declared_value ? '#166534' : '#dc2626',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 500
                    }}>
                      {selectedOperator.max_value_clearance >= selectedShipment.declared_value ? '✅' : '❌'} Value Clearance
                    </div>
                    
                    <div style={{
                      background: wgBackendService.isOperatorCompatible(selectedOperator, selectedShipment) ? '#dcfce7' : '#fef3c7',
                      color: wgBackendService.isOperatorCompatible(selectedOperator, selectedShipment) ? '#166534' : '#d97706',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 500
                    }}>
                      {wgBackendService.isOperatorCompatible(selectedOperator, selectedShipment) ? '✅' : '⚠️'} Area Coverage
                    </div>
                    
                    <div style={{
                      background: '#dcfce7',
                      color: '#166534',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 500
                    }}>
                      📊 Score: {wgBackendService.calculateCompatibilityScore(selectedOperator, selectedShipment).toFixed(1)}%
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCreateAssignment}
                  disabled={isLoading}
                  style={{
                    background: isLoading ? '#9ca3af' : '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: '16px'
                  }}
                >
                  {isLoading ? 'Creating Assignment...' : 'Create WG Assignment'}
                </button>
              </div>
            ) : (
              <div style={{
                background: '#f9fafb',
                border: '2px dashed #d1d5db',
                borderRadius: '12px',
                padding: '40px',
                textAlign: 'center'
              }}>
                <p style={{ color: '#6b7280', fontSize: '16px', marginBottom: '16px' }}>
                  Select an operator and a shipment to create an assignment
                </p>
                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                  <button
                    onClick={() => setActiveTab('operators')}
                    style={{
                      background: selectedOperator ? '#10b981' : '#3b82f6',
                      color: '#fff',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    {selectedOperator ? '✅ Operator Selected' : '1. Select Operator'}
                  </button>
                  <button
                    onClick={() => setActiveTab('shipments')}
                    style={{
                      background: selectedShipment ? '#10b981' : '#3b82f6',
                      color: '#fff',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    {selectedShipment ? '✅ Shipment Selected' : '2. Select Shipment'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </LogisticsDashboardLayout>
  );
};

export default WGBackendDemo;
