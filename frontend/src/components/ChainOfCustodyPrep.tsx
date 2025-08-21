// frontend/src/components/ChainOfCustodyPrep.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { 
  Shield,
  Key,
  Camera,
  Eye,
  MapPin,
  Phone,
  AlertTriangle,
  CheckCircle,
  Copy,
  Lock,
  Truck,
  Building2,
  Navigation,
  FileText,
  User,
  Clock,
  Package,
  Fingerprint,
  QrCode,
  Download,
  Printer
} from 'lucide-react';

interface OTPCodes {
  pickup: string;
  hubIntake: string;
  delivery: string;
  sealId?: string;
}

interface LivenessChecks {
  pickup: boolean;
  hubIntake: boolean;
  delivery: boolean;
}

interface OperatorBrief {
  operatorName: string;
  operatorPhone: string;
  shipmentId: string;
  productName: string;
  declaredValue: number;
  tierLevel: number;
  schedule: {
    pickup: { time: string; location: string; contact: string; phone: string };
    hubIntake: { time: string; location: string; contact: string };
    delivery: { time: string; location: string; contact: string; phone: string };
  };
  safetyNotes: string[];
  handlingInstructions: string[];
  photosRequired: string[];
  privacyNotes: string[];
  sealRequired: boolean;
  sealId?: string;
}

interface ChainOfCustodyPrepProps {
  shipment: {
    id: string;
    productName: string;
    declaredValue: number;
    tierLevel: number;
    sender: {
      name: string;
      location: string;
      address: string;
      phone: string;
      timeWindow: string;
    };
    buyer: {
      name: string;
      location: string;
      address: string;
      phone: string;
      timeWindow: string;
    };
    route: {
      hubLocation: string;
      hubAddress: string;
    };
  };
  operator: {
    id: string;
    name: string;
    phone: string;
  };
  schedule: Array<{
    id: string;
    type: 'pickup' | 'hub_arrival' | 'hub_departure' | 'delivery';
    time: Date;
    location: string;
    address: string;
  }>;
  onConfirm: (otpCodes: OTPCodes, livenessChecks: LivenessChecks) => void;
}

const ChainOfCustodyPrep: React.FC<ChainOfCustodyPrepProps> = ({
  shipment,
  operator,
  schedule,
  onConfirm
}) => {
  const [otpCodes, setOtpCodes] = useState<OTPCodes>({
    pickup: '',
    hubIntake: '',
    delivery: '',
    sealId: ''
  });
  
  const [livenessChecks, setLivenessChecks] = useState<LivenessChecks>({
    pickup: shipment.declaredValue > 100000, // Default on for high-value
    hubIntake: shipment.tierLevel >= 3,     // Default on for T3
    delivery: shipment.declaredValue > 100000
  });

  const [operatorBrief, setOperatorBrief] = useState<OperatorBrief | null>(null);
  const [showOTPCodes, setShowOTPCodes] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  // Generate OTP codes and operator brief on mount
  useEffect(() => {
    generateOTPCodes();
    generateOperatorBrief();
  }, []);

  const generateOTPCodes = () => {
    const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();
    const generateSealId = () => `SEAL-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
    
    setOtpCodes({
      pickup: generateOTP(),
      hubIntake: generateOTP(),
      delivery: generateOTP(),
      sealId: shipment.tierLevel >= 2 ? generateSealId() : undefined
    });
  };

  const generateOperatorBrief = () => {
    const pickupSlot = schedule.find(s => s.type === 'pickup');
    const hubSlot = schedule.find(s => s.type === 'hub_arrival');
    const deliverySlot = schedule.find(s => s.type === 'delivery');

    const brief: OperatorBrief = {
      operatorName: operator.name,
      operatorPhone: operator.phone,
      shipmentId: shipment.id,
      productName: shipment.productName,
      declaredValue: shipment.declaredValue,
      tierLevel: shipment.tierLevel,
      schedule: {
        pickup: {
          time: pickupSlot?.time.toLocaleTimeString() || '',
          location: shipment.sender.address,
          contact: shipment.sender.name.split(' ')[0] + ' S.', // Privacy filtering
          phone: shipment.sender.phone.replace(/(\d{3})\d{3}(\d{4})/, '$1-***-$2') // Masked phone
        },
        hubIntake: {
          time: hubSlot?.time.toLocaleTimeString() || '',
          location: shipment.route.hubAddress,
          contact: 'Hub Operations'
        },
        delivery: {
          time: deliverySlot?.time.toLocaleTimeString() || '',
          location: shipment.buyer.address,
          contact: shipment.buyer.name.split(' ')[0] + ' B.', // Privacy filtering
          phone: shipment.buyer.phone.replace(/(\d{3})\d{3}(\d{4})/, '$1-***-$2') // Masked phone
        }
      },
      safetyNotes: [
        'High-value item requires secure handling at all times',
        'Never leave package unattended',
        'Verify identity at each handoff',
        shipment.declaredValue > 500000 ? 'Extreme high-value - consider security escort' : null
      ].filter(Boolean) as string[],
      handlingInstructions: [
        shipment.tierLevel >= 3 ? 'Temperature controlled transport required' : null,
        'Do not fold, bend, or compress package',
        'Handle with white gloves only',
        'Keep package upright and stable'
      ].filter(Boolean) as string[],
      photosRequired: [
        'Package condition at pickup',
        'Seal placement (if applicable)',
        'Package condition at hub intake',
        'Package condition at delivery',
        'Recipient verification photo'
      ],
      privacyNotes: [
        'Contact names abbreviated for privacy',
        'Phone numbers partially masked',
        'Full details available via secure operator app',
        'Do not share customer information with unauthorized parties'
      ],
      sealRequired: shipment.tierLevel >= 2,
      sealId: otpCodes.sealId
    };

    setOperatorBrief(brief);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    alert(`${label} copied to clipboard`);
  };

  const handleConfirmSchedule = () => {
    setIsConfirmed(true);
    setShowOTPCodes(true);
    onConfirm(otpCodes, livenessChecks);
  };

  const renderOTPCard = (type: string, code: string, icon: React.ReactNode, description: string) => (
    <div style={{
      background: '#fff',
      border: '2px solid #e0e0e0',
      borderRadius: '12px',
      padding: '20px',
      textAlign: 'center',
      position: 'relative'
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #333 0%, #000 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 12px',
        color: '#fff'
      }}>
        {icon}
      </div>
      
      <h3 style={{
        fontSize: '14px',
        fontWeight: 600,
        marginBottom: '8px',
        color: '#333'
      }}>
        {type.toUpperCase()}
      </h3>
      
      <div style={{
        fontSize: '24px',
        fontWeight: 700,
        fontFamily: 'monospace',
        color: '#000',
        marginBottom: '8px',
        letterSpacing: '2px'
      }}>
        {code}
      </div>
      
      <p style={{
        fontSize: '12px',
        color: '#666',
        marginBottom: '12px'
      }}>
        {description}
      </p>
      
      <button
        onClick={() => copyToClipboard(code, type)}
        style={{
          background: '#f0f9ff',
          color: '#0369a1',
          border: '1px solid #0ea5e9',
          borderRadius: '6px',
          padding: '6px 12px',
          fontSize: '12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          margin: '0 auto'
        }}
      >
        <Copy size={12} />
        Copy
      </button>
    </div>
  );

  const renderLivenessToggle = (type: keyof LivenessChecks, label: string, description: string) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px',
      background: livenessChecks[type] ? '#f0fdf4' : '#f9f9f9',
      border: `1px solid ${livenessChecks[type] ? '#22c55e' : '#e0e0e0'}`,
      borderRadius: '8px',
      marginBottom: '12px'
    }}>
      <div style={{ flex: 1 }}>
        <h4 style={{
          fontSize: '14px',
          fontWeight: 600,
          marginBottom: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Eye size={16} />
          {label}
        </h4>
        <p style={{ fontSize: '12px', color: '#666' }}>
          {description}
        </p>
      </div>
      
      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={livenessChecks[type]}
          onChange={(e) => setLivenessChecks(prev => ({
            ...prev,
            [type]: e.target.checked
          }))}
          style={{ marginRight: '8px' }}
        />
        <span style={{
          fontSize: '12px',
          fontWeight: 600,
          color: livenessChecks[type] ? '#166534' : '#666'
        }}>
          {livenessChecks[type] ? 'ENABLED' : 'DISABLED'}
        </span>
      </label>
    </div>
  );

  return (
    <div style={{
      background: '#fff',
      borderRadius: '12px',
      border: '1px solid #e0e0e0'
    }}>
      {/* Header */}
      <div style={{
        padding: '24px',
        borderBottom: '1px solid #e0e0e0',
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #333 0%, #000 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff'
          }}>
            <Shield size={20} />
          </div>
          <div>
            <h2 style={{
              fontSize: '20px',
              fontWeight: 600,
              marginBottom: '4px'
            }}>
              Chain of Custody Preparation
            </h2>
            <p style={{ fontSize: '14px', color: '#666' }}>
              Secure handoff protocols for {shipment.id} • Tier {shipment.tierLevel} • ${shipment.declaredValue.toLocaleString()}
            </p>
          </div>
        </div>

        {isConfirmed && (
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #22c55e',
            borderRadius: '8px',
            padding: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '16px'
          }}>
            <Lock size={16} color="#22c55e" />
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#166534' }}>
              Schedule Confirmed & Locked • Chain of Custody Activated
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: '24px' }}>
        {/* OTP Codes Section */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: 600,
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Key size={20} />
            OTP Verification Codes
          </h3>
          
          {!showOTPCodes ? (
            <div style={{
              background: '#f9f9f9',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              padding: '24px',
              textAlign: 'center'
            }}>
              <Lock size={32} color="#999" style={{ marginBottom: '12px' }} />
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
                OTP codes will be generated when schedule is confirmed
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px'
            }}>
              {renderOTPCard(
                'Pickup',
                otpCodes.pickup,
                <Truck size={20} />,
                'Verify sender identity'
              )}
              {renderOTPCard(
                'Hub Intake',
                otpCodes.hubIntake,
                <Building2 size={20} />,
                'Confirm hub handoff'
              )}
              {renderOTPCard(
                'Delivery',
                otpCodes.delivery,
                <Navigation size={20} />,
                'Verify buyer identity'
              )}
            </div>
          )}
        </div>

        {/* Liveness Checks */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: 600,
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Fingerprint size={20} />
            Liveness Check Requirements
          </h3>
          
          <div style={{
            background: '#f9f9f9',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.5 }}>
              Liveness checks use facial recognition to verify operator identity at each checkpoint. 
              Automatically enabled for high-value shipments (${(100000).toLocaleString()}+) and Tier 3 processing.
            </p>
          </div>

          {renderLivenessToggle(
            'pickup',
            'Pickup Liveness Check',
            'Verify operator identity when collecting from sender'
          )}
          {renderLivenessToggle(
            'hubIntake',
            'Hub Intake Liveness Check',
            'Verify operator identity during hub handoff'
          )}
          {renderLivenessToggle(
            'delivery',
            'Delivery Liveness Check',
            'Verify operator identity when delivering to buyer'
          )}
        </div>

        {/* Seal Kit Reminder */}
        {shipment.tierLevel >= 2 && (
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 600,
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Package size={20} />
              Seal Kit Requirement
            </h3>
            
            <div style={{
              background: '#fef3c7',
              border: '2px solid #f59e0b',
              borderRadius: '12px',
              padding: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <AlertTriangle size={20} color="#d97706" />
                <h4 style={{ fontSize: '16px', fontWeight: 600, color: '#92400e' }}>
                  Tier {shipment.tierLevel} Seal Required
                </h4>
              </div>
              
              <p style={{ fontSize: '14px', color: '#92400e', marginBottom: '16px' }}>
                This shipment requires tamper-evident sealing. Seal must be applied at hub intake and verified at delivery.
              </p>
              
              <div style={{
                background: '#fff',
                borderRadius: '8px',
                padding: '16px',
                border: '1px solid #f59e0b'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h5 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
                      Seal ID (to be filled at intake):
                    </h5>
                    <div style={{
                      fontSize: '18px',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      color: '#000',
                      letterSpacing: '1px'
                    }}>
                      {otpCodes.sealId || 'SEAL-XXXX-XXXX'}
                    </div>
                  </div>
                  
                  {otpCodes.sealId && (
                    <button
                      onClick={() => copyToClipboard(otpCodes.sealId!, 'Seal ID')}
                      style={{
                        background: '#f59e0b',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Copy size={12} />
                      Copy
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Operator Brief */}
        {operatorBrief && (
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 600,
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <FileText size={20} />
              Operator Brief
            </h3>
            
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '24px'
            }}>
              {/* Operator Info */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
                  Assignment Details
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: '#666', fontWeight: 600 }}>OPERATOR</span>
                    <p style={{ fontSize: '14px', fontWeight: 500 }}>{operatorBrief.operatorName}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: '#666', fontWeight: 600 }}>CONTACT</span>
                    <p style={{ fontSize: '14px', fontWeight: 500 }}>{operatorBrief.operatorPhone}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: '#666', fontWeight: 600 }}>SHIPMENT</span>
                    <p style={{ fontSize: '14px', fontWeight: 500 }}>{operatorBrief.shipmentId}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: '#666', fontWeight: 600 }}>VALUE</span>
                    <p style={{ fontSize: '14px', fontWeight: 500 }}>${operatorBrief.declaredValue.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Schedule */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
                  Schedule & Contacts
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    { type: 'Pickup', data: operatorBrief.schedule.pickup, icon: <Truck size={16} /> },
                    { type: 'Hub Intake', data: operatorBrief.schedule.hubIntake, icon: <Building2 size={16} /> },
                    { type: 'Delivery', data: operatorBrief.schedule.delivery, icon: <Navigation size={16} /> }
                  ].map((item) => (
                    <div key={item.type} style={{
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '16px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        {item.icon}
                        <h5 style={{ fontSize: '14px', fontWeight: 600 }}>{item.type}</h5>
                        <span style={{ fontSize: '12px', color: '#666' }}>{item.data.time}</span>
                      </div>
                      <p style={{ fontSize: '13px', marginBottom: '4px' }}>
                        <strong>Location:</strong> {item.data.location}
                      </p>
                      <p style={{ fontSize: '13px' }}>
                        <strong>Contact:</strong> {item.data.contact} 
                        {item.data.phone && ` • ${item.data.phone}`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Safety & Handling */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#dc2626' }}>
                    Safety Notes
                  </h4>
                  <ul style={{ fontSize: '12px', color: '#666', paddingLeft: '16px' }}>
                    {operatorBrief.safetyNotes.map((note, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>{note}</li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#7c3aed' }}>
                    Handling Instructions
                  </h4>
                  <ul style={{ fontSize: '12px', color: '#666', paddingLeft: '16px' }}>
                    {operatorBrief.handlingInstructions.map((instruction, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>{instruction}</li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#0369a1' }}>
                    Required Photos
                  </h4>
                  <ul style={{ fontSize: '12px', color: '#666', paddingLeft: '16px' }}>
                    {operatorBrief.photosRequired.slice(0, 3).map((photo, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>{photo}</li>
                    ))}
                    {operatorBrief.photosRequired.length > 3 && (
                      <li style={{ fontStyle: 'italic' }}>+{operatorBrief.photosRequired.length - 3} more...</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Privacy Notes */}
              <div style={{
                background: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: '8px',
                padding: '12px'
              }}>
                <h4 style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: '#92400e' }}>
                  PRIVACY & CONFIDENTIALITY
                </h4>
                <ul style={{ fontSize: '11px', color: '#92400e', paddingLeft: '16px', margin: 0 }}>
                  {operatorBrief.privacyNotes.map((note, idx) => (
                    <li key={idx} style={{ marginBottom: '2px' }}>{note}</li>
                  ))}
                </ul>
              </div>

              {/* Download/Print Actions */}
              <div style={{
                display: 'flex',
                gap: '12px',
                marginTop: '20px',
                justifyContent: 'flex-end'
              }}>
                <button style={{
                  background: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Download size={14} />
                  Download PDF
                </button>
                <button style={{
                  background: '#0ea5e9',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Printer size={14} />
                  Print Brief
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Schedule Button */}
        {!isConfirmed && (
          <div style={{
            background: '#f8fafc',
            border: '2px dashed #cbd5e1',
            borderRadius: '12px',
            padding: '32px',
            textAlign: 'center'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
              Ready to Activate Chain of Custody?
            </h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '24px', maxWidth: '500px', margin: '0 auto 24px' }}>
              Confirming will generate OTP codes, lock the operator schedule, and activate all security protocols. 
              This action cannot be undone.
            </p>
            
            <button
              onClick={handleConfirmSchedule}
              style={{
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                padding: '16px 32px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                margin: '0 auto',
                boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)'
              }}
            >
              <Shield size={20} />
              Confirm Schedule & Activate Chain of Custody
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChainOfCustodyPrep;
