// frontend/src/components/WGAssignmentResult.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle,
  Calendar,
  User,
  Key,
  Printer,
  Download,
  ArrowRight,
  Clock,
  MapPin,
  Truck,
  Building2,
  Navigation,
  Copy,
  QrCode,
  FileText,
  Eye
} from 'lucide-react';

interface AssignmentResult {
  shipmentId: string;
  operator: {
    id: string;
    name: string;
    phone: string;
  };
  schedule: {
    pickup: { time: Date; location: string };
    hubIntake: { time: Date; location: string };
    delivery: { time: Date; location: string };
  };
  otpCodes: {
    pickup: string;
    hubIntake: string;
    delivery: string;
    sealId?: string;
  };
  statusProgression: {
    from: string;
    to: string;
    queuePosition: number;
  };
}

interface WGAssignmentResultProps {
  result: AssignmentResult;
  onClose: () => void;
  onViewDetails: () => void;
}

const WGAssignmentResult: React.FC<WGAssignmentResultProps> = ({
  result,
  onClose,
  onViewDetails
}) => {
  const [showOTPCodes, setShowOTPCodes] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(label);
    setTimeout(() => setCopySuccess(null), 2000);
  };

  const generateOperatorBrief = () => {
    const brief = `
AUCTA WG OPERATOR BRIEF
======================

SHIPMENT: ${result.shipmentId}
OPERATOR: ${result.operator.name}
CONTACT: ${result.operator.phone}

SCHEDULE:
--------
Pickup:    ${result.schedule.pickup.time.toLocaleString()}
           ${result.schedule.pickup.location}
           
Hub Intake: ${result.schedule.hubIntake.time.toLocaleString()}
            ${result.schedule.hubIntake.location}
            
Delivery:   ${result.schedule.delivery.time.toLocaleString()}
            ${result.schedule.delivery.location}

VERIFICATION CODES:
------------------
Pickup OTP:    ${result.otpCodes.pickup}
Hub Intake:    ${result.otpCodes.hubIntake}
Delivery OTP:  ${result.otpCodes.delivery}
${result.otpCodes.sealId ? `Seal ID:       ${result.otpCodes.sealId}` : ''}

IMPORTANT:
- Verify identity at each checkpoint using OTP
- Never leave package unattended
- Take photos at pickup, hub, and delivery
- Maintain chain of custody at all times

Generated: ${new Date().toLocaleString()}
    `.trim();
    
    return brief;
  };

  const downloadBrief = () => {
    const brief = generateOperatorBrief();
    const blob = new Blob([brief], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WG-Brief-${result.shipmentId}-${result.operator.name.replace(' ', '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const printBrief = () => {
    const brief = generateOperatorBrief();
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>WG Operator Brief - ${result.shipmentId}</title>
            <style>
              body { font-family: monospace; padding: 20px; line-height: 1.4; }
              .header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
              .section { margin-bottom: 15px; }
              .important { background: #f0f0f0; padding: 10px; border-left: 4px solid #000; }
              @media print { body { margin: 0; } }
            </style>
          </head>
          <body>
            <pre>${brief}</pre>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
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
        borderRadius: '16px',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        {/* Success Header */}
        <div style={{
          background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
          color: '#fff',
          padding: '32px',
          borderRadius: '16px 16px 0 0',
          textAlign: 'center'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <CheckCircle size={32} />
          </div>
          <h2 style={{
            fontSize: '24px',
            fontWeight: 600,
            marginBottom: '8px'
          }}>
            WG Assignment Confirmed
          </h2>
          <p style={{ fontSize: '16px', opacity: 0.9 }}>
            {result.shipmentId} • {result.operator.name}
          </p>
        </div>

        <div style={{ padding: '32px' }}>
          {/* Assignment Summary */}
          <div style={{
            background: '#f8fafc',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '24px'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: 600,
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Calendar size={18} />
              Assignment Summary
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { 
                  type: 'Pickup', 
                  time: result.schedule.pickup.time, 
                  location: result.schedule.pickup.location,
                  icon: <Truck size={16} />
                },
                { 
                  type: 'Hub Intake', 
                  time: result.schedule.hubIntake.time, 
                  location: result.schedule.hubIntake.location,
                  icon: <Building2 size={16} />
                },
                { 
                  type: 'Delivery', 
                  time: result.schedule.delivery.time, 
                  location: result.schedule.delivery.location,
                  icon: <Navigation size={16} />
                }
              ].map((item, idx) => (
                <div key={item.type} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  background: '#fff',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: '#000',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 600
                  }}>
                    {idx + 1}
                  </div>
                  {item.icon}
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '2px' }}>
                      {item.type}
                    </h4>
                    <p style={{ fontSize: '12px', color: '#666' }}>
                      {item.time.toLocaleString()} • {item.location}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* OTP Codes */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Key size={18} />
                OTP Verification Codes
              </h3>
              <button
                onClick={() => setShowOTPCodes(!showOTPCodes)}
                style={{
                  background: showOTPCodes ? '#f3f4f6' : '#000',
                  color: showOTPCodes ? '#374151' : '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Eye size={14} />
                {showOTPCodes ? 'Hide' : 'Show'} Codes
              </button>
            </div>
            
            {showOTPCodes && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '12px'
              }}>
                {[
                  { label: 'Pickup', code: result.otpCodes.pickup },
                  { label: 'Hub Intake', code: result.otpCodes.hubIntake },
                  { label: 'Delivery', code: result.otpCodes.delivery }
                ].map((otp) => (
                  <div key={otp.label} style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px',
                    textAlign: 'center'
                  }}>
                    <h5 style={{ fontSize: '11px', fontWeight: 600, color: '#666', marginBottom: '6px' }}>
                      {otp.label.toUpperCase()}
                    </h5>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      marginBottom: '8px'
                    }}>
                      {otp.code}
                    </div>
                    <button
                      onClick={() => copyToClipboard(otp.code, otp.label)}
                      style={{
                        background: copySuccess === otp.label ? '#22c55e' : '#f0f9ff',
                        color: copySuccess === otp.label ? '#fff' : '#0369a1',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        margin: '0 auto'
                      }}
                    >
                      <Copy size={10} />
                      {copySuccess === otp.label ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                ))}
                
                {result.otpCodes.sealId && (
                  <div style={{
                    background: '#fef3c7',
                    border: '1px solid #f59e0b',
                    borderRadius: '8px',
                    padding: '12px',
                    textAlign: 'center'
                  }}>
                    <h5 style={{ fontSize: '11px', fontWeight: 600, color: '#92400e', marginBottom: '6px' }}>
                      SEAL ID
                    </h5>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      marginBottom: '8px',
                      color: '#92400e'
                    }}>
                      {result.otpCodes.sealId}
                    </div>
                    <button
                      onClick={() => copyToClipboard(result.otpCodes.sealId!, 'Seal ID')}
                      style={{
                        background: copySuccess === 'Seal ID' ? '#22c55e' : '#f59e0b',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        margin: '0 auto'
                      }}
                    >
                      <Copy size={10} />
                      {copySuccess === 'Seal ID' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Status Progression */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: 600,
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <ArrowRight size={18} />
              Status Update
            </h3>
            
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #22c55e',
              borderRadius: '8px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    background: '#fef2f2',
                    color: '#dc2626',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600
                  }}>
                    {result.statusProgression.from}
                  </span>
                  <ArrowRight size={16} color="#666" />
                  <span style={{
                    background: '#f0fdf4',
                    color: '#166534',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600
                  }}>
                    {result.statusProgression.to}
                  </span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#166534' }}>
                  Queue Position: #{result.statusProgression.queuePosition}
                </div>
                <div style={{ fontSize: '11px', color: '#16a34a' }}>
                  Dashboard updated
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={downloadBrief}
              style={{
                flex: 1,
                minWidth: '140px',
                background: '#f0f9ff',
                color: '#0369a1',
                border: '1px solid #0ea5e9',
                borderRadius: '8px',
                padding: '12px 16px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Download size={16} />
              Download Brief
            </button>
            
            <button
              onClick={printBrief}
              style={{
                flex: 1,
                minWidth: '140px',
                background: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                padding: '12px 16px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Printer size={16} />
              Print Brief
            </button>
            
            <button
              onClick={onViewDetails}
              style={{
                flex: 1,
                minWidth: '140px',
                background: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 16px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <FileText size={16} />
              View Shipment
            </button>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            style={{
              width: '100%',
              marginTop: '16px',
              padding: '12px',
              background: '#f9fafb',
              color: '#6b7280',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default WGAssignmentResult;
