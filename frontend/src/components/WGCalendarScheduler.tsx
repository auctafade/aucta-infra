// frontend/src/components/WGCalendarScheduler.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, 
  MapPin, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  Calendar,
  Building2,
  Navigation,
  Timer,
  Globe,
  ExternalLink,
  X,
  ChevronDown,
  Truck
} from 'lucide-react';

interface TimeSlot {
  id: string;
  type: 'pickup' | 'hub_arrival' | 'hub_departure' | 'delivery';
  time: Date;
  timezone: string;
  location: string;
  address: string;
  duration?: number; // in minutes
  constraints?: string[];
}

interface SLATarget {
  deadline: Date;
  timezone: string;
  delta: number; // minutes from now to deadline
}

interface HubCapacity {
  tierLevel: number;
  type: 'authenticator' | 'sewing';
  availableSlots: {
    start: Date;
    end: Date;
    timezone: string;
  }[];
}

interface OperatorConflict {
  jobId: string;
  start: Date;
  end: Date;
  description: string;
}

interface WGCalendarSchedulerProps {
  shipment: {
    id: string;
    productName: string;
    declaredValue: number;
    tierLevel: number;
    sender: {
      name: string;
      location: string;
      address: string;
      timeWindow: string;
      timezone: string;
    };
    buyer: {
      name: string;
      location: string;
      address: string;
      timeWindow: string;
      timezone: string;
    };
    route: {
      hubLocation: string;
      hubAddress: string;
      hubTimezone: string;
      leg1: { estimatedTime: string; distance: string };
      leg2: { estimatedTime: string; distance: string };
    };
    slaDeadline: string;
  };
  operator: {
    id: string;
    name: string;
    conflicts: OperatorConflict[];
  };
  onScheduleChange: (schedule: TimeSlot[]) => void;
  onValidationChange: (isValid: boolean, errors: string[]) => void;
}

const WGCalendarScheduler: React.FC<WGCalendarSchedulerProps> = ({
  shipment,
  operator,
  onScheduleChange,
  onValidationChange
}) => {
  const [schedule, setSchedule] = useState<TimeSlot[]>([]);
  const [hubCapacity, setHubCapacity] = useState<HubCapacity | null>(null);
  const [slaTarget, setSlaTarget] = useState<SLATarget | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [draggedSlot, setDraggedSlot] = useState<string | null>(null);
  const [showConstraintPopover, setShowConstraintPopover] = useState<string | null>(null);
  const [feasibilityScore, setFeasibilityScore] = useState<'green' | 'amber' | 'red'>('red');

  const popoverRef = useRef<HTMLDivElement>(null);

  // Mock hub capacity data based on tier level
  useEffect(() => {
    const mockHubCapacity: HubCapacity = {
      tierLevel: shipment.tierLevel,
      type: shipment.tierLevel === 3 ? 'sewing' : 'authenticator',
      availableSlots: shipment.tierLevel === 3 ? [
        // Sewing capacity - more restrictive
        { 
          start: new Date('2024-01-16T10:00:00'), 
          end: new Date('2024-01-16T12:00:00'),
          timezone: 'America/New_York'
        },
        { 
          start: new Date('2024-01-16T14:00:00'), 
          end: new Date('2024-01-16T16:00:00'),
          timezone: 'America/New_York'
        }
      ] : [
        // Authenticator capacity - more flexible
        { 
          start: new Date('2024-01-16T09:00:00'), 
          end: new Date('2024-01-16T17:00:00'),
          timezone: 'America/New_York'
        }
      ]
    };
    setHubCapacity(mockHubCapacity);
  }, [shipment.tierLevel]);

  // Calculate SLA target and delta
  useEffect(() => {
    const deadline = new Date(shipment.slaDeadline);
    const now = new Date();
    const delta = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60)); // minutes
    
    setSlaTarget({
      deadline,
      timezone: shipment.buyer.timezone,
      delta
    });
  }, [shipment.slaDeadline, shipment.buyer.timezone]);

  // Initialize schedule with default times
  useEffect(() => {
    const defaultSchedule = generateDefaultSchedule();
    setSchedule(defaultSchedule);
    onScheduleChange(defaultSchedule);
  }, []);

  // Validate schedule whenever it changes
  useEffect(() => {
    const errors = validateSchedule(schedule);
    setValidationErrors(errors);
    onValidationChange(errors.length === 0, errors);
    
    // Update feasibility score
    if (errors.length === 0) {
      setFeasibilityScore('green');
    } else if (errors.some(e => e.includes('breach') || e.includes('conflict'))) {
      setFeasibilityScore('red');
    } else {
      setFeasibilityScore('amber');
    }
  }, [schedule, hubCapacity, operator.conflicts]);

  const generateDefaultSchedule = (): TimeSlot[] => {
    const [senderStart] = shipment.sender.timeWindow.split('-');
    const pickupTime = new Date(`2024-01-16T${senderStart}:00`);
    
    const leg1Duration = parseInt(shipment.route.leg1.estimatedTime);
    const hubProcessingTime = shipment.tierLevel === 3 ? 45 : 30; // Sewing takes longer
    const leg2Duration = parseInt(shipment.route.leg2.estimatedTime);
    
    const hubArrival = new Date(pickupTime.getTime() + leg1Duration * 60000);
    const hubDeparture = new Date(hubArrival.getTime() + hubProcessingTime * 60000);
    const delivery = new Date(hubDeparture.getTime() + leg2Duration * 60000);

    return [
      {
        id: 'pickup',
        type: 'pickup',
        time: pickupTime,
        timezone: shipment.sender.timezone,
        location: shipment.sender.location,
        address: shipment.sender.address,
        duration: 15,
        constraints: [`Sender window: ${shipment.sender.timeWindow}`]
      },
      {
        id: 'hub_arrival',
        type: 'hub_arrival',
        time: hubArrival,
        timezone: shipment.route.hubTimezone,
        location: shipment.route.hubLocation,
        address: shipment.route.hubAddress,
        duration: 10,
        constraints: [`Travel time: ${shipment.route.leg1.estimatedTime}`]
      },
      {
        id: 'hub_departure',
        type: 'hub_departure',
        time: hubDeparture,
        timezone: shipment.route.hubTimezone,
        location: shipment.route.hubLocation,
        address: shipment.route.hubAddress,
        duration: 10,
        constraints: [
          `${hubCapacity?.type} processing: ${hubProcessingTime} min`,
          `Tier ${shipment.tierLevel} requirements`
        ]
      },
      {
        id: 'delivery',
        type: 'delivery',
        time: delivery,
        timezone: shipment.buyer.timezone,
        location: shipment.buyer.location,
        address: shipment.buyer.address,
        duration: 20,
        constraints: [`Buyer window: ${shipment.buyer.timeWindow}`, `SLA deadline: ${slaTarget?.deadline.toLocaleTimeString()}`]
      }
    ];
  };

  const validateSchedule = (currentSchedule: TimeSlot[]): string[] => {
    const errors: string[] = [];
    
    if (currentSchedule.length < 4) return ['Incomplete schedule'];

    const pickup = currentSchedule.find(s => s.type === 'pickup');
    const hubArrival = currentSchedule.find(s => s.type === 'hub_arrival');
    const hubDeparture = currentSchedule.find(s => s.type === 'hub_departure');
    const delivery = currentSchedule.find(s => s.type === 'delivery');

    if (!pickup || !hubArrival || !hubDeparture || !delivery) {
      errors.push('Missing required time slots');
      return errors;
    }

    // Check chronological order
    if (pickup.time >= hubArrival.time) {
      errors.push('Hub arrival must be after pickup');
    }
    if (hubArrival.time >= hubDeparture.time) {
      errors.push('Hub departure must be after arrival');
    }
    if (hubDeparture.time >= delivery.time) {
      errors.push('Delivery must be after hub departure');
    }

    // Check sender time window
    const [senderStart, senderEnd] = shipment.sender.timeWindow.split('-');
    const senderStartTime = new Date(`2024-01-16T${senderStart}:00`);
    const senderEndTime = new Date(`2024-01-16T${senderEnd}:00`);
    
    if (pickup.time < senderStartTime || pickup.time > senderEndTime) {
      errors.push(`Pickup outside sender window (${shipment.sender.timeWindow})`);
    }

    // Check buyer time window
    const [buyerStart, buyerEnd] = shipment.buyer.timeWindow.split('-');
    const buyerStartTime = new Date(`2024-01-16T${buyerStart}:00`);
    const buyerEndTime = new Date(`2024-01-16T${buyerEnd}:00`);
    
    if (delivery.time < buyerStartTime || delivery.time > buyerEndTime) {
      errors.push(`Delivery outside buyer window (${shipment.buyer.timeWindow})`);
    }

    // Check hub capacity windows
    if (hubCapacity && hubCapacity.availableSlots.length > 0) {
      const isWithinHubCapacity = hubCapacity.availableSlots.some(slot => 
        hubArrival.time >= slot.start && hubDeparture.time <= slot.end
      );
      
      if (!isWithinHubCapacity) {
        errors.push(`Hub processing outside ${hubCapacity.type} capacity window`);
      }
    }

    // Check SLA compliance
    if (slaTarget && delivery.time > slaTarget.deadline) {
      const breachMinutes = Math.floor((delivery.time.getTime() - slaTarget.deadline.getTime()) / (1000 * 60));
      errors.push(`SLA breach: ${breachMinutes} minutes past deadline`);
    }

    // Check operator conflicts
    operator.conflicts.forEach(conflict => {
      const conflictStart = conflict.start;
      const conflictEnd = conflict.end;
      
      // Check if any part of our schedule overlaps with conflicts
      const scheduleStart = pickup.time;
      const scheduleEnd = new Date(delivery.time.getTime() + (delivery.duration || 20) * 60000);
      
      if (scheduleStart < conflictEnd && scheduleEnd > conflictStart) {
        errors.push(`Operator conflict: ${conflict.description}`);
      }
    });

    // Check minimum travel buffers
    const leg1ActualTime = (hubArrival.time.getTime() - pickup.time.getTime()) / (1000 * 60);
    const leg1EstimatedTime = parseInt(shipment.route.leg1.estimatedTime);
    
    if (leg1ActualTime < leg1EstimatedTime) {
      errors.push(`Insufficient travel time to hub (need ${leg1EstimatedTime} min, have ${Math.floor(leg1ActualTime)} min)`);
    }

    const leg2ActualTime = (delivery.time.getTime() - hubDeparture.time.getTime()) / (1000 * 60);
    const leg2EstimatedTime = parseInt(shipment.route.leg2.estimatedTime);
    
    if (leg2ActualTime < leg2EstimatedTime) {
      errors.push(`Insufficient travel time to buyer (need ${leg2EstimatedTime} min, have ${Math.floor(leg2ActualTime)} min)`);
    }

    return errors;
  };

  const handleTimeChange = (slotId: string, newTime: Date) => {
    const updatedSchedule = schedule.map(slot => 
      slot.id === slotId ? { ...slot, time: newTime } : slot
    );
    
    // Auto-adjust dependent times
    const adjustedSchedule = autoAdjustDependentTimes(updatedSchedule, slotId);
    
    setSchedule(adjustedSchedule);
    onScheduleChange(adjustedSchedule);
  };

  const autoAdjustDependentTimes = (currentSchedule: TimeSlot[], changedSlotId: string): TimeSlot[] => {
    // When pickup changes, adjust hub arrival
    // When hub arrival changes, adjust hub departure
    // When hub departure changes, adjust delivery
    
    let adjusted = [...currentSchedule];
    
    if (changedSlotId === 'pickup') {
      const pickup = adjusted.find(s => s.id === 'pickup');
      const hubArrival = adjusted.find(s => s.id === 'hub_arrival');
      
      if (pickup && hubArrival) {
        const leg1Duration = parseInt(shipment.route.leg1.estimatedTime);
        const newHubArrival = new Date(pickup.time.getTime() + leg1Duration * 60000);
        
        adjusted = adjusted.map(slot => 
          slot.id === 'hub_arrival' ? { ...slot, time: newHubArrival } : slot
        );
        
        // Cascade to hub departure
        const hubDeparture = adjusted.find(s => s.id === 'hub_departure');
        if (hubDeparture) {
          const processingTime = shipment.tierLevel === 3 ? 45 : 30;
          const newHubDeparture = new Date(newHubArrival.getTime() + processingTime * 60000);
          
          adjusted = adjusted.map(slot => 
            slot.id === 'hub_departure' ? { ...slot, time: newHubDeparture } : slot
          );
          
          // Cascade to delivery
          const delivery = adjusted.find(s => s.id === 'delivery');
          if (delivery) {
            const leg2Duration = parseInt(shipment.route.leg2.estimatedTime);
            const newDelivery = new Date(newHubDeparture.getTime() + leg2Duration * 60000);
            
            adjusted = adjusted.map(slot => 
              slot.id === 'delivery' ? { ...slot, time: newDelivery } : slot
            );
          }
        }
      }
    }
    
    return adjusted;
  };

  const formatTimeWithTimezone = (time: Date, timezone: string) => {
    const localTime = time.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: timezone,
      hour12: false 
    });
    
    const utcTime = time.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: 'UTC',
      hour12: false 
    });
    
    const tzAbbr = new Intl.DateTimeFormat('en-US', { 
      timeZoneName: 'short',
      timeZone: timezone 
    }).formatToParts(time).find(part => part.type === 'timeZoneName')?.value || timezone;
    
    return {
      local: `${localTime} ${tzAbbr}`,
      utc: `${utcTime} UTC`
    };
  };

  const getFeasibilityColor = () => {
    switch (feasibilityScore) {
      case 'green': return '#22c55e';
      case 'amber': return '#f59e0b';
      case 'red': return '#ef4444';
    }
  };

  const getFeasibilityIcon = () => {
    switch (feasibilityScore) {
      case 'green': return <CheckCircle size={20} color="#22c55e" />;
      case 'amber': return <AlertTriangle size={20} color="#f59e0b" />;
      case 'red': return <AlertTriangle size={20} color="#ef4444" />;
    }
  };

  const getSlotIcon = (type: string) => {
    switch (type) {
      case 'pickup': return <MapPin size={20} />;
      case 'hub_arrival':
      case 'hub_departure': return <Building2 size={20} />;
      case 'delivery': return <Navigation size={20} />;
      default: return <Clock size={20} />;
    }
  };

  const getSlotLabel = (type: string) => {
    switch (type) {
      case 'pickup': return 'Pickup from Sender';
      case 'hub_arrival': return 'Arrive at Hub';
      case 'hub_departure': return 'Depart from Hub';
      case 'delivery': return 'Deliver to Buyer';
      default: return type;
    }
  };

  const renderConstraintPopover = (slot: TimeSlot) => {
    if (showConstraintPopover !== slot.id) return null;

    return (
      <div 
        ref={popoverRef}
        style={{
          position: 'absolute',
          top: '100%',
          left: '0',
          marginTop: '8px',
          background: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          padding: '16px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          zIndex: 1000,
          minWidth: '300px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 600 }}>Time Constraints</h4>
          <button
            onClick={() => setShowConstraintPopover(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={16} color="#666" />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {slot.constraints?.map((constraint, idx) => (
            <div key={idx} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px',
              background: '#f9f9f9',
              borderRadius: '6px',
              fontSize: '12px'
            }}>
              <Info size={14} color="#666" />
              <span>{constraint}</span>
            </div>
          ))}

          {slot.type === 'hub_arrival' && hubCapacity && (
            <div style={{
              padding: '8px',
              background: '#f0f9ff',
              borderRadius: '6px',
              fontSize: '12px'
            }}>
              <h5 style={{ fontWeight: 600, marginBottom: '4px' }}>
                {hubCapacity.type.charAt(0).toUpperCase() + hubCapacity.type.slice(1)} Capacity
              </h5>
              {hubCapacity.availableSlots.map((slot, idx) => (
                <div key={idx}>
                  {formatTimeWithTimezone(slot.start, slot.timezone).local} - {formatTimeWithTimezone(slot.end, slot.timezone).local}
                </div>
              ))}
            </div>
          )}

          {slot.type === 'delivery' && slaTarget && (
            <div style={{
              padding: '8px',
              background: slaTarget.delta < 0 ? '#fef2f2' : '#f0fdf4',
              borderRadius: '6px',
              fontSize: '12px'
            }}>
              <h5 style={{ fontWeight: 600, marginBottom: '4px' }}>SLA Target</h5>
              <div>Deadline: {formatTimeWithTimezone(slaTarget.deadline, slaTarget.timezone).local}</div>
              <div style={{ 
                color: slaTarget.delta < 0 ? '#dc2626' : slaTarget.delta < 120 ? '#f59e0b' : '#22c55e',
                fontWeight: 600
              }}>
                {slaTarget.delta < 0 ? `${Math.abs(slaTarget.delta)}m breach` : 
                 slaTarget.delta < 120 ? `${slaTarget.delta}m tight` : 
                 `${slaTarget.delta}m slack`}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      background: '#fff',
      borderRadius: '12px',
      border: '1px solid #e0e0e0'
    }}>
      {/* Header */}
      <div style={{
        padding: '24px',
        borderBottom: '1px solid #e0e0e0'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{
              fontSize: '20px',
              fontWeight: 600,
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Calendar size={20} />
              Schedule Builder
            </h2>
            <p style={{ fontSize: '14px', color: '#666' }}>
              Drag times or use pickers to schedule the three milestones
            </p>
          </div>

          {/* Feasibility Indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            background: feasibilityScore === 'green' ? '#f0fdf4' : 
                       feasibilityScore === 'amber' ? '#fef3c7' : '#fef2f2',
            border: `1px solid ${getFeasibilityColor()}`,
            borderRadius: '8px'
          }}>
            {getFeasibilityIcon()}
            <span style={{ 
              fontSize: '14px', 
              fontWeight: 600,
              color: getFeasibilityColor()
            }}>
              {feasibilityScore === 'green' ? 'Feasible' : 
               feasibilityScore === 'amber' ? 'Tight' : 'Issues'}
            </span>
          </div>
        </div>

        {/* SLA Summary */}
        {slaTarget && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            background: '#f9f9f9',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Timer size={16} color="#666" />
              <span style={{ fontSize: '14px' }}>
                SLA Deadline: {formatTimeWithTimezone(slaTarget.deadline, slaTarget.timezone).local}
              </span>
            </div>
            <span style={{
              fontSize: '14px',
              fontWeight: 600,
              color: slaTarget.delta < 0 ? '#dc2626' : slaTarget.delta < 120 ? '#f59e0b' : '#22c55e'
            }}>
              {slaTarget.delta < 0 ? `${Math.abs(slaTarget.delta)}m breach` : 
               slaTarget.delta < 120 ? `${slaTarget.delta}m tight` : 
               `${slaTarget.delta}m slack`}
            </span>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {schedule.map((slot, index) => (
            <div key={slot.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              padding: '20px',
              border: '1px solid #e0e0e0',
              borderRadius: '12px',
              background: '#fff',
              position: 'relative'
            }}>
              {/* Step Number */}
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #333 0%, #000 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 600,
                flexShrink: 0
              }}>
                {index + 1}
              </div>

              {/* Slot Info */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  {getSlotIcon(slot.type)}
                  <h3 style={{ fontSize: '16px', fontWeight: 600 }}>
                    {getSlotLabel(slot.type)}
                  </h3>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                  <MapPin size={14} color="#666" />
                  <span style={{ fontSize: '13px', color: '#666' }}>
                    {slot.location}
                  </span>
                </div>
                
                <div style={{ fontSize: '12px', color: '#999' }}>
                  {slot.address}
                </div>
              </div>

              {/* Time Picker */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '200px' }}>
                <input
                  type="time"
                  value={slot.time.toTimeString().slice(0, 5)}
                  onChange={(e) => {
                    const [hours, minutes] = e.target.value.split(':');
                    const newTime = new Date(slot.time);
                    newTime.setHours(parseInt(hours), parseInt(minutes));
                    handleTimeChange(slot.id, newTime);
                  }}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 500
                  }}
                />
                
                {/* Timezone Display */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ 
                    fontSize: '12px', 
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <Globe size={12} />
                    {formatTimeWithTimezone(slot.time, slot.timezone).local}
                  </div>
                  <div style={{ fontSize: '11px', color: '#999' }}>
                    {formatTimeWithTimezone(slot.time, slot.timezone).utc}
                  </div>
                </div>
              </div>

              {/* Constraints Button */}
              {slot.constraints && slot.constraints.length > 0 && (
                <button
                  onClick={() => setShowConstraintPopover(
                    showConstraintPopover === slot.id ? null : slot.id
                  )}
                  style={{
                    background: '#f0f9ff',
                    border: '1px solid #0ea5e9',
                    borderRadius: '6px',
                    padding: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#0369a1',
                    fontSize: '12px',
                    position: 'relative'
                  }}
                >
                  <Info size={14} />
                  {slot.constraints.length}
                  <ChevronDown size={12} />
                  {renderConstraintPopover(slot)}
                </button>
              )}

              {/* Connection Line */}
              {index < schedule.length - 1 && (
                <div style={{
                  position: 'absolute',
                  bottom: '-20px',
                  left: '35px',
                  width: '2px',
                  height: '20px',
                  background: '#e0e0e0'
                }} />
              )}
            </div>
          ))}
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div style={{
            marginTop: '24px',
            padding: '16px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <AlertTriangle size={16} color="#dc2626" />
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#dc2626' }}>
                Schedule Issues ({validationErrors.length})
              </h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {validationErrors.map((error, idx) => (
                <div key={idx} style={{
                  fontSize: '13px',
                  color: '#991b1b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <div style={{ 
                    width: '4px', 
                    height: '4px', 
                    borderRadius: '50%', 
                    background: '#dc2626',
                    flexShrink: 0
                  }} />
                  {error}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Schedule Summary */}
        <div style={{
          marginTop: '24px',
          padding: '16px',
          background: '#f9f9f9',
          borderRadius: '8px'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
            Schedule Summary
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div>
              <span style={{ fontSize: '12px', color: '#666' }}>TOTAL DURATION</span>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>
                {schedule.length >= 2 ? 
                  Math.floor((schedule[schedule.length - 1].time.getTime() - schedule[0].time.getTime()) / (1000 * 60)) + ' minutes'
                  : 'N/A'
                }
              </div>
            </div>
            <div>
              <span style={{ fontSize: '12px', color: '#666' }}>OPERATOR</span>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>
                {operator.name}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '12px', color: '#666' }}>FEASIBILITY</span>
              <div style={{ 
                fontSize: '14px', 
                fontWeight: 600,
                color: getFeasibilityColor()
              }}>
                {feasibilityScore.toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WGCalendarScheduler;
