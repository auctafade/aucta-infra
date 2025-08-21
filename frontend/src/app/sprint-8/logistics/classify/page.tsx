'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Package,
  MapPin,
  Clock,
  User,
  Info,
  CheckCircle,
  ArrowRight,
  Globe
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import ToastContainer from '@/components/ToastContainer';

interface ShipmentItem {
  id: number;
  shipment_id: string;
  reference_sku: string;
  brand: string;
  declared_value: string;
  currency: string;
  urgency_level: string;
  status: string;
  created_at: string;
  sender_name: string;
  sender_city: string;
  sender_country: string;
  buyer_name: string;
  buyer_city: string;
  buyer_country: string;
  document_count: string;
  product_image?: string;
  category?: string;
}

export default function ClassifyPage() {
  const router = useRouter();
  const { toasts, showSuccess, showError, removeToast } = useToast();
  
  const [shipments, setShipments] = useState<ShipmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Add spin animation for loading state
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Shared styles - wallet-like design pattern
  const card: React.CSSProperties = {
    background: "#fff",
    borderRadius: "16px",
    border: "1px solid #e0e0e0",
    padding: "24px",
    marginBottom: "24px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: "18px",
    fontWeight: 500,
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#1a1a1a",
  };

  const btnBase: React.CSSProperties = {
    padding: "12px 20px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s",
    border: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  };

  const btnPrimary: React.CSSProperties = {
    ...btnBase,
    background: "#000",
    color: "#fff",
  };

  useEffect(() => {
    const fetchShipments = async () => {
      try {
        setLoading(true);
        const response = await api.getShipmentsToClassify();
        setShipments(response.shipments || []);
      } catch (error) {
        console.error('Error fetching shipments:', error);
        showError(
          'Failed to Load Shipments',
          error instanceof Error ? error.message : 'Could not load shipments for classification'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchShipments();
  }, []);

  const formatCurrency = (value: string, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(parseFloat(value));
  };

  const getUrgencyGradient = (urgency: string) => {
    switch (urgency) {
      case 'express': return 'from-red-500 to-orange-500';
      case 'expedited': return 'from-amber-500 to-yellow-500';
      default: return 'from-blue-500 to-cyan-500';
    }
  };

  const getUrgencyLabel = (urgency: string) => {
    switch (urgency) {
      case 'express': return 'Express Delivery';
      case 'expedited': return 'Priority Shipping';
      default: return 'Standard Delivery';
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px" }}>
        <div style={{ margin: "32px 0" }}>
          <div style={{ textAlign: "center", paddingTop: "80px" }}>
            <div style={{
              width: "40px",
              height: "40px",
              border: "3px solid #e0e0e0",
              borderTop: "3px solid #000",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px auto"
            }}></div>
            <p style={{ color: "#666", fontSize: "16px" }}>Loading shipments...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px" }}>
      {/* Header */}
      <div style={{ margin: "32px 0" }}>
        <Link 
          href="/sprint-8/logistics/dashboard" 
          style={{
            display: "inline-flex",
            alignItems: "center",
            color: "#666",
            textDecoration: "none",
            fontSize: "14px",
            marginBottom: "16px",
            transition: "color 0.2s"
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#000")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#666")}
        >
          <ArrowLeft style={{ width: "16px", height: "16px", marginRight: "4px" }} />
          Back to Dashboard
        </Link>
        <h1
          style={{
            fontSize: "32px",
            fontWeight: 300,
            marginBottom: "8px",
            letterSpacing: "-0.02em",
            color: "#1a1a1a",
          }}
        >
          Tier Gate Classification
        </h1>
        <p style={{ color: "#666", fontSize: "16px", lineHeight: "1.5" }}>
          Classify shipments for intelligent routing and resource allocation.
        </p>
      </div>

      {/* Process Info */}
      <div style={card}>
        <h3 style={sectionTitle}>
          <Info size={20} />
          Intelligent Tier Assignment
        </h3>
        <p style={{ color: "#666", fontSize: "14px", lineHeight: "1.5" }}>
          Select processing tiers (T1/T2/T3) based on shipment characteristics. 
          Routing and resource allocation are optimized in the next step.
        </p>
        <div style={{ 
          marginTop: "16px", 
          padding: "12px 16px", 
          background: "#f8f9fa", 
          borderRadius: "8px",
          color: "#333",
          fontSize: "14px",
          fontWeight: "500"
        }}>
          Pending Shipments: {shipments.length}
        </div>
      </div>

      {/* Shipments List */}
      {shipments.length === 0 ? (
        <div style={card}>
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <CheckCircle style={{ width: "48px", height: "48px", color: "#16a34a", margin: "0 auto 16px auto" }} />
            <h3 style={{ fontSize: "20px", fontWeight: "600", color: "#1a1a1a", marginBottom: "8px" }}>
              All Clear!
            </h3>
            <p style={{ color: "#666", fontSize: "14px" }}>
              Every shipment has been classified. Great job keeping the queue empty!
            </p>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: "32px" }}>
          {shipments.map((shipment) => (
            <Link
              key={shipment.shipment_id}
              href={`/sprint-8/logistics/classify/${shipment.shipment_id}`}
              style={{ textDecoration: "none" }}
            >
              <div style={{
                ...card,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 8px 25px rgba(0,0,0,0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
              }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
                  {/* Product Image */}
                  <div style={{ flexShrink: 0 }}>
                    <div style={{
                      width: "80px",
                      height: "80px",
                      background: "#f5f5f5",
                      borderRadius: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px solid #e0e0e0"
                    }}>
                      {shipment.product_image ? (
                        <img 
                          src={shipment.product_image} 
                          alt={shipment.brand}
                          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "12px" }}
                        />
                      ) : (
                        <Package style={{ width: "32px", height: "32px", color: "#999" }} />
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                      <div>
                        <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#1a1a1a", marginBottom: "4px" }}>
                          {shipment.brand}
                        </h3>
                        <p style={{ 
                          fontSize: "12px", 
                          color: "#666", 
                          fontFamily: "monospace",
                          background: "#f5f5f5",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          display: "inline-block"
                        }}>
                          {shipment.reference_sku}
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: "12px", color: "#666", marginBottom: "2px" }}>Declared Value</p>
                        <p style={{ fontSize: "18px", fontWeight: "600", color: "#16a34a" }}>
                          {formatCurrency(shipment.declared_value, shipment.currency)}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
                      <div style={{ 
                        background: "#f8f9fa", 
                        borderRadius: "8px", 
                        padding: "12px",
                        border: "1px solid #e9ecef"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}>
                          <User style={{ width: "14px", height: "14px", marginRight: "6px", color: "#666" }} />
                          <span style={{ fontSize: "12px", fontWeight: "500", color: "#666" }}>From</span>
                        </div>
                        <p style={{ fontWeight: "500", color: "#1a1a1a", fontSize: "13px" }}>{shipment.sender_name}</p>
                        <p style={{ fontSize: "11px", color: "#666" }}>{shipment.sender_city}, {shipment.sender_country}</p>
                      </div>
                      
                      <div style={{ 
                        background: "#f8f9fa", 
                        borderRadius: "8px", 
                        padding: "12px",
                        border: "1px solid #e9ecef"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}>
                          <Globe style={{ width: "14px", height: "14px", marginRight: "6px", color: "#666" }} />
                          <span style={{ fontSize: "12px", fontWeight: "500", color: "#666" }}>To</span>
                        </div>
                        <p style={{ fontWeight: "500", color: "#1a1a1a", fontSize: "13px" }}>{shipment.buyer_name}</p>
                        <p style={{ fontSize: "11px", color: "#666" }}>{shipment.buyer_city}, {shipment.buyer_country}</p>
                      </div>
                      
                      <div style={{ 
                        background: "#f8f9fa", 
                        borderRadius: "8px", 
                        padding: "12px",
                        border: "1px solid #e9ecef"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}>
                          <Clock style={{ width: "14px", height: "14px", marginRight: "6px", color: "#666" }} />
                          <span style={{ fontSize: "12px", fontWeight: "500", color: "#666" }}>Timeline</span>
                        </div>
                        <p style={{ fontWeight: "500", color: "#1a1a1a", fontSize: "13px" }}>
                          {new Date(shipment.created_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                        <p style={{ fontSize: "11px", color: "#666" }}>{getUrgencyLabel(shipment.urgency_level)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div style={{ flexShrink: 0 }}>
                    <div style={{
                      background: "#000",
                      borderRadius: "8px",
                      padding: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      <ArrowRight style={{ width: "16px", height: "16px", color: "#fff" }} />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </div>
  );
}