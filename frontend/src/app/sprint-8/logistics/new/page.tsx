'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Package,
  Upload,
  AlertCircle,
  Info,
  ArrowLeft,
  ArrowRight,
  X,
  CheckCircle,
  Clock,
  Globe,
  FileText,
  AlertTriangle,
  User,
  MapPin,
  Shield,
  Zap,
  Star,
  Settings,
  Camera
} from 'lucide-react';
import { eventService, emitShipmentCreated, emitIntakeCompleted, emitIntakeAutosave, emitIntakeValidationError } from '@/lib/events';
import { useToast } from '@/hooks/useToast';
import ToastContainer from '@/components/ToastContainer';
import { api } from '@/lib/api';

interface TimeWindow {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  timezone: string;
}

interface ContactInfo {
  fullName: string;
  email: string;
  phone: string;
  phoneOriginal: string;
  street: string;
  city: string;
  zip: string;
  country: string;
  timeWindows: TimeWindow[];
  accessNotes: string;
  contactId?: string;
}

interface ShipmentFormData {
  // Product section
  reference: string;
  declaredValue: string;
  currency: string;
  weight: string;
  weightUnit: 'g' | 'kg';
  length: string;
  width: string;
  height: string;
  fragility: number;
  brand: string;
  category: string;
  hsCode: string;
  files: File[];
  
  // Participants
  sender: ContactInfo;
  buyer: ContactInfo;
  
  // Logistics
  urgency: 'standard' | 'expedited' | 'express';
  securityNotes: string;
  preferredTransport: 'no-preference' | 'air-only' | 'ground-only' | 'express-only';
  specialConditions: {
    highValue: boolean;
    temperatureSensitive: boolean;
    photoProofRequired: boolean;
  };
}

interface ValidationErrors {
  [key: string]: string | ValidationErrors;
}

interface EdgeCaseWarnings {
  duplicateReference: boolean;
  largeFiles: boolean;
  phoneFormatIssues: { sender: boolean; buyer: boolean };
  partialAddresses: { sender: boolean; buyer: boolean };
  timezoneMismatch: boolean;
}

const steps = [
  { id: 'product', title: 'Product Details', description: 'Product information and documentation' },
  { id: 'sender', title: 'Sender Information', description: 'Origin and pickup details' },
  { id: 'buyer', title: 'Buyer Information', description: 'Destination and delivery details' },
  { id: 'logistics', title: 'Logistics Preferences', description: 'Service level and special requirements' },
  { id: 'review', title: 'Review & Submit', description: 'Final review before submission' }
];

const initialTimeWindow: TimeWindow = {
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        timezone: 'Europe/London'
};

const initialContactInfo: ContactInfo = {
      fullName: '',
      email: '',
      phone: '',
  phoneOriginal: '',
      street: '',
      city: '',
      zip: '',
      country: '',
  timeWindows: [{ ...initialTimeWindow }],
      accessNotes: ''
};

const initialFormData: ShipmentFormData = {
  reference: '',
  declaredValue: '',
  currency: 'EUR',
  weight: '',
  weightUnit: 'kg',
  length: '',
  width: '',
  height: '',
  fragility: 3,
  brand: '',
  category: '',
  hsCode: '',
  files: [],
  sender: { ...initialContactInfo },
  buyer: { ...initialContactInfo },
    urgency: 'standard',
    securityNotes: '',
    preferredTransport: 'no-preference',
    specialConditions: {
      highValue: false,
      temperatureSensitive: false,
      photoProofRequired: true
    }
};

export default function NewShipmentPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<ShipmentFormData>(initialFormData);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [warnings, setWarnings] = useState<EdgeCaseWarnings>({
    duplicateReference: false,
    largeFiles: false,
    phoneFormatIssues: { sender: false, buyer: false },
    partialAddresses: { sender: false, buyer: false },
    timezoneMismatch: false
  });
  
  // Toast notifications
  const { toasts, showSuccess, showError, showWarning, removeToast } = useToast();

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

  const label: React.CSSProperties = {
    fontSize: "14px",
    fontWeight: 500,
    color: "#333",
    marginBottom: "8px",
    display: "block",
  };

  const input: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    fontSize: "14px",
    background: "#fff",
    transition: "border-color 0.2s",
  };

  const inputError: React.CSSProperties = {
    ...input,
    border: "1px solid #dc2626",
  };

  const select: React.CSSProperties = {
    ...input,
    appearance: "none",
    backgroundImage: "url('data:image/svg+xml;charset=US-ASCII,<svg width=\"12\" height=\"8\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M1.41.59 6 5.17 10.59.59 12 2 6 8 0 2z\" fill=\"%23666\"/></svg>')",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    paddingRight: "40px",
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

  const btnSecondary: React.CSSProperties = {
    ...btnBase,
    background: "none",
    color: "#000",
    border: "1px solid #e0e0e0",
  };

  const gridTwo: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
  };

  const gridThree: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "16px",
  };

  const gridFour: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "16px",
  };

  const banner = (type: "error" | "warn" | "success" | "info") => {
    const map = {
      error: { bg: "#fef2f2", border: "#fecaca", color: "#b91c1c", icon: AlertCircle },
      warn: { bg: "#fffbeb", border: "#fde68a", color: "#92400e", icon: AlertTriangle },
      success: { bg: "#ecfdf5", border: "#d1fae5", color: "#065f46", icon: CheckCircle },
      info: { bg: "#eff6ff", border: "#bfdbfe", color: "#1e40af", icon: Info },
    }[type];
    const Icon = map.icon;
    return {
      background: map.bg,
      border: `1px solid ${map.border}`,
      borderRadius: "8px",
      padding: "16px",
      color: map.color,
      fontSize: "14px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    } as React.CSSProperties;
  };

  const currencies = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CNY', 'AED'];
  const categories = ['Electronics', 'Clothing', 'Jewelry', 'Art', 'Documents', 'Other'];
  const countries = ['United Kingdom', 'France', 'Germany', 'Italy', 'Spain', 'Netherlands', 'Switzerland', 'United States', 'Japan', 'China', 'United Arab Emirates'];
  const timezones = ['Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome', 'Europe/Madrid', 'Europe/Amsterdam', 'Europe/Zurich', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Dubai'];

  const fragilityLevels = [
    { value: 1, label: '1 - Very Fragile', description: 'Glass, ceramics, electronics' },
    { value: 2, label: '2 - Fragile', description: 'Delicate items, small electronics' },
    { value: 3, label: '3 - Moderate', description: 'Most items, standard handling' },
    { value: 4, label: '4 - Sturdy', description: 'Robust items, minimal protection' },
    { value: 5, label: '5 - Very Sturdy', description: 'Industrial items, no protection needed' }
  ];
  
  // Edge case checking functions (defined first to avoid hoisting issues)
  const checkDuplicateReference = useCallback(async (reference: string) => {
    if (reference.length > 3) {
      try {
        const result = await api.checkDuplicateReference(reference);
        setWarnings(prev => ({ ...prev, duplicateReference: result.isDuplicate }));
      } catch (error) {
        console.error('Error checking duplicate reference:', error);
        // Fallback to false if API call fails
        setWarnings(prev => ({ ...prev, duplicateReference: false }));
      }
    }
  }, []);

  const checkLargeFiles = useCallback((files: File[]) => {
    const hasLargeFiles = files.some(file => file.size > 10 * 1024 * 1024); // 10MB
    setWarnings(prev => ({ ...prev, largeFiles: hasLargeFiles }));
  }, []);

  const checkPhoneFormats = useCallback((data: ShipmentFormData) => {
    const senderIssue = Boolean(data.sender.phone && !/^\+[1-9]\d{1,14}$/.test(data.sender.phone));
    const buyerIssue = Boolean(data.buyer.phone && !/^\+[1-9]\d{1,14}$/.test(data.buyer.phone));
    
    setWarnings(prev => ({
      ...prev,
      phoneFormatIssues: { sender: senderIssue, buyer: buyerIssue }
    }));
  }, []);

  const checkPartialAddresses = useCallback((data: ShipmentFormData) => {
    const senderPartial = Boolean(data.sender.city && data.sender.country && (!data.sender.street || !data.sender.zip));
    const buyerPartial = Boolean(data.buyer.city && data.buyer.country && (!data.buyer.street || !data.buyer.zip));
    
    setWarnings(prev => ({
      ...prev,
      partialAddresses: { sender: senderPartial, buyer: buyerPartial }
    }));
  }, []);

  const checkTimezoneMismatch = useCallback((data: ShipmentFormData) => {
    const mismatch = Boolean(
      data.sender.country && 
      data.buyer.country && 
      data.sender.country !== data.buyer.country
    );
    setWarnings(prev => ({ ...prev, timezoneMismatch: mismatch }));
  }, []);

  // Simplified form data setter without edge case checking that could cause re-renders
  const setFormDataWithTracking = useCallback((updater: (prev: ShipmentFormData) => ShipmentFormData, fieldName?: string) => {
    setFormData(updater);
    setHasUnsavedChanges(true);
  }, []);

  // Direct onChange handlers for immediate testing
  const handleSenderStreetChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      sender: { ...prev.sender, street: e.target.value }
    }));
    setHasUnsavedChanges(true);
  }, []);

  const handleSenderCityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      sender: { ...prev.sender, city: e.target.value }
    }));
    setHasUnsavedChanges(true);
  }, []);

  // Generic handlers for other fields
  const handleSenderChange = useCallback((field: keyof ContactInfo, value: string) => {
    setFormData(prev => ({
      ...prev,
      sender: { ...prev.sender, [field]: value }
    }));
    setHasUnsavedChanges(true);
  }, []);

  const handleBuyerChange = useCallback((field: keyof ContactInfo, value: string) => {
    setFormData(prev => ({
      ...prev,
      buyer: { ...prev.buyer, [field]: value }
    }));
    setHasUnsavedChanges(true);
  }, []);

  const handleFormFieldChange = useCallback((field: keyof ShipmentFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setHasUnsavedChanges(true);
  }, []);

  // Validation functions
  const validateCurrentStep = (): boolean => {
    const newErrors: ValidationErrors = {};
    
    switch (steps[currentStep].id) {
      case 'product':
    if (!formData.reference.trim()) {
      newErrors.reference = 'Reference/SKU is required';
    }
    if (!formData.declaredValue || parseFloat(formData.declaredValue) <= 0) {
      newErrors.declaredValue = 'Declared value must be greater than 0';
    }
    if (!formData.weight || parseFloat(formData.weight) <= 0) {
      newErrors.weight = 'Weight must be greater than 0';
    }
    if (!formData.length || parseFloat(formData.length) <= 0) {
      newErrors.length = 'Length must be greater than 0';
    }
    if (!formData.width || parseFloat(formData.width) <= 0) {
      newErrors.width = 'Width must be greater than 0';
    }
    if (!formData.height || parseFloat(formData.height) <= 0) {
      newErrors.height = 'Height must be greater than 0';
        }
        if (!formData.brand.trim()) {
          newErrors.brand = 'Brand is required';
        }
        if (!formData.category.trim()) {
          newErrors.category = 'Category is required';
        }
        break;
        
      case 'sender':
    if (!formData.sender.fullName.trim()) {
          newErrors.senderFullName = 'Full name is required';
    }
    if (!formData.sender.email.trim()) {
          newErrors.senderEmail = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.sender.email)) {
          newErrors.senderEmail = 'Invalid email format';
    }
    if (!formData.sender.phone.trim()) {
          newErrors.senderPhone = 'Phone is required';
    }
    if (!formData.sender.city.trim()) {
          newErrors.senderCity = 'City is required';
    }
    if (!formData.sender.country.trim()) {
          newErrors.senderCountry = 'Country is required';
    }
        break;

      case 'buyer':
    if (!formData.buyer.fullName.trim()) {
          newErrors.buyerFullName = 'Full name is required';
    }
    if (!formData.buyer.email.trim()) {
          newErrors.buyerEmail = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.buyer.email)) {
          newErrors.buyerEmail = 'Invalid email format';
    }
    if (!formData.buyer.phone.trim()) {
          newErrors.buyerPhone = 'Phone is required';
    }
    if (!formData.buyer.city.trim()) {
          newErrors.buyerCity = 'City is required';
    }
    if (!formData.buyer.country.trim()) {
          newErrors.buyerCountry = 'Country is required';
        }
          break;
        }

    setErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) {
      const errorCount = Object.keys(newErrors).length;
      showError(
        'Please Fix Form Errors',
        `${errorCount} field${errorCount > 1 ? 's need' : ' needs'} attention before continuing.`,
        5000
      );
      return false;
    }
    
    return true;
  };

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setFormDataWithTracking(prev => ({
      ...prev,
      files: [...prev.files, ...files]
    }), 'files');
  };

  const removeFile = (index: number) => {
    setFormDataWithTracking(prev => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index)
    }), 'files');
  };

  // Navigation handlers
  const nextStep = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  // Submit handler
  const handleSubmit = async () => {
    if (!validateCurrentStep()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Create shipment via API
      const result = await api.createShipment(formData, formData.files);
      const shipmentId = result.shipment.shipmentId;
      
      // Emit telemetry events
      emitShipmentCreated(shipmentId, 'user');
      const completenessScore = eventService.calculateCompletenessScore(formData);
      const hasDocs = eventService.hasSupportingDocuments(formData);
      emitIntakeCompleted(shipmentId, completenessScore, hasDocs);
      
      // Success notification
      showSuccess(
        'Shipment Created Successfully!',
        `Draft shipment ${shipmentId} has been created and is ready for classification.`,
        4000
      );
      
      setHasUnsavedChanges(false);
      
      // Redirect to classification
      setTimeout(() => {
        router.push(`/sprint-8/logistics/classify/${shipmentId}`);
      }, 1500);
      
    } catch (error) {
      console.error('Error creating shipment:', error);
      showError(
        'Failed to Create Shipment',
        error instanceof Error ? error.message : 'There was an error creating your shipment. Please check your information and try again.',
        6000
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-save functionality
  const autoSave = async () => {
    if (!hasUnsavedChanges) return;
    
    setIsAutoSaving(true);
    try {
      await api.saveShipmentDraft(formData);
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      
      showSuccess(
        'Changes Saved',
        'Your progress has been automatically saved.',
        2000
      );
    } catch (error) {
      console.error('Autosave failed:', error);
      setHasUnsavedChanges(true);
      showError(
        'Autosave Failed',
        error instanceof Error ? error.message : 'Could not save your changes automatically. Please save manually.',
        4000
      );
    } finally {
      setIsAutoSaving(false);
    }
  };

  // Debounced autosave effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (hasUnsavedChanges) {
        autoSave();
      }
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [hasUnsavedChanges, formData]);

  const renderStepContent = () => {
    switch (steps[currentStep].id) {
      case 'product':
        return ProductDetailsStep();
      case 'sender':
        return SenderInfoStep();
      case 'buyer':
        return BuyerInfoStep();
      case 'logistics':
        return LogisticsStep();
      case 'review':
        return ReviewStep();
      default:
        return null;
    }
  };

  const ProductDetailsStep = () => (
    <div style={{ marginBottom: "32px" }}>
      {/* Basic Product Info */}
      <div style={card}>
        <h3 style={sectionTitle}>
          <Package size={20} />
          Product Information
        </h3>
        <div style={{ marginBottom: "24px" }}>
          <div style={gridTwo}>
            <div>
              <label style={label}>
                Reference/SKU *
              </label>
              <input
                type="text"
                value={formData.reference}
                onChange={(e) => setFormDataWithTracking(prev => ({
                  ...prev,
                  reference: e.target.value
                }), 'reference')}
                style={errors.reference ? inputError : input}
                placeholder="Enter product reference"
              />
              {errors.reference && (
                <p style={{ marginTop: "4px", fontSize: "12px", color: "#dc2626" }}>{errors.reference as string}</p>
              )}
              
              {warnings.duplicateReference && (
                <div style={banner("warn")}>
                  <AlertTriangle size={16} />
                  <div>
                    <p style={{ fontWeight: "500", marginBottom: "4px" }}>
                      Duplicate Product Reference Detected
                    </p>
                    <p style={{ fontSize: "12px", lineHeight: "1.4" }}>
                      This reference already exists in the system. You can continue, but please verify this is a new shipment.
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            <div>
              <label style={label}>
                Brand *
              </label>
              <input
                type="text"
                value={formData.brand}
                onChange={(e) => handleFormFieldChange('brand', e.target.value)}
                style={errors.brand ? inputError : input}
                placeholder="Enter brand name"
              />
              {errors.brand && (
                <p style={{ marginTop: "4px", fontSize: "12px", color: "#dc2626" }}>{errors.brand as string}</p>
              )}
            </div>
        </div>
        
          <div style={gridTwo}>
            <div>
              <label style={label}>
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => handleFormFieldChange('category', e.target.value)}
                style={errors.category ? { ...select, border: "1px solid #dc2626" } : select}
              >
                <option value="">Select category</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              {errors.category && (
                <p style={{ marginTop: "4px", fontSize: "12px", color: "#dc2626" }}>{errors.category as string}</p>
              )}
          </div>
          
            <div>
              <label style={label}>
                HS Code
              </label>
              <input
                type="text"
                value={formData.hsCode}
                onChange={(e) => setFormDataWithTracking(prev => ({
                  ...prev,
                  hsCode: e.target.value
                }))}
                style={input}
                placeholder="Enter HS code"
              />
            </div>
            </div>

          <div style={gridTwo}>
            <div>
              <label style={label}>
                Declared Value *
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormDataWithTracking(prev => ({
                    ...prev,
                    currency: e.target.value
                  }))}
                  style={{ ...select, width: "auto", minWidth: "80px" }}
                >
                  {currencies.map(curr => (
                    <option key={curr} value={curr}>{curr}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={formData.declaredValue}
                  onChange={(e) => setFormDataWithTracking(prev => ({
                    ...prev,
                    declaredValue: e.target.value
                  }))}
                  style={{ ...input, flex: "1" }}
                  placeholder="0.00"
                />
              </div>
              {errors.declaredValue && (
                <p style={{ marginTop: "4px", fontSize: "12px", color: "#dc2626" }}>{errors.declaredValue as string}</p>
              )}
            </div>

            <div>
              <label style={label}>
                Fragility Level *
              </label>
              <select
                value={formData.fragility}
                onChange={(e) => setFormDataWithTracking(prev => ({
                  ...prev,
                  fragility: parseInt(e.target.value)
                }))}
                style={select}
              >
                {fragilityLevels.map(level => (
                  <option key={level.value} value={level.value}>
                    {level.label} - {level.description}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Dimensions & Weight */}
      <div style={card}>
        <h3 style={sectionTitle}>Dimensions & Weight</h3>
        <div style={{ marginBottom: "24px" }}>
          <div style={gridFour}>
            <div>
              <label style={label}>
                Length (cm) *
              </label>
              <input
                type="number"
                value={formData.length}
                onChange={(e) => setFormDataWithTracking(prev => ({
                  ...prev,
                  length: e.target.value
                }))}
                style={errors.length ? inputError : input}
                placeholder="0"
              />
              {errors.length && (
                <p style={{ marginTop: "4px", fontSize: "12px", color: "#dc2626" }}>{errors.length as string}</p>
              )}
            </div>
            
            <div>
              <label style={label}>
                Width (cm) *
              </label>
              <input
                type="number"
                value={formData.width}
                onChange={(e) => setFormDataWithTracking(prev => ({
                  ...prev,
                  width: e.target.value
                }))}
                style={errors.width ? inputError : input}
                placeholder="0"
              />
              {errors.width && (
                <p style={{ marginTop: "4px", fontSize: "12px", color: "#dc2626" }}>{errors.width as string}</p>
              )}
            </div>
            
            <div>
              <label style={label}>
                Height (cm) *
              </label>
              <input
                type="number"
                value={formData.height}
                onChange={(e) => setFormDataWithTracking(prev => ({
                  ...prev,
                  height: e.target.value
                }))}
                style={errors.height ? inputError : input}
                placeholder="0"
              />
              {errors.height && (
                <p style={{ marginTop: "4px", fontSize: "12px", color: "#dc2626" }}>{errors.height as string}</p>
              )}
            </div>

            <div>
              <label style={label}>
                Weight *
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="number"
                  value={formData.weight}
                  onChange={(e) => setFormDataWithTracking(prev => ({
                    ...prev,
                    weight: e.target.value
                  }))}
                  style={{ ...input, flex: "1" }}
                  placeholder="0"
                />
                <select
                  value={formData.weightUnit}
                  onChange={(e) => setFormDataWithTracking(prev => ({
                    ...prev,
                    weightUnit: e.target.value as 'g' | 'kg'
                  }))}
                  style={{ ...select, width: "auto", minWidth: "60px" }}
                >
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                </select>
              </div>
              {errors.weight && (
                <p style={{ marginTop: "4px", fontSize: "12px", color: "#dc2626" }}>{errors.weight as string}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* File Upload */}
      <div style={card}>
        <h3 style={sectionTitle}>
          <Camera size={20} />
          Documentation
        </h3>
        <div style={{ marginBottom: "24px" }}>
          <div style={{
            border: "2px dashed #d1d5db",
            borderRadius: "8px",
            padding: "24px",
            textAlign: "center",
            cursor: "pointer",
            transition: "border-color 0.2s"
          }}>
            <input
              type="file"
              multiple
              onChange={handleFileUpload}
              style={{ display: "none" }}
              id="file-upload"
              accept="image/*,.pdf,.doc,.docx"
            />
            <label htmlFor="file-upload" style={{ cursor: "pointer" }}>
              <Upload style={{ width: "32px", height: "32px", color: "#9ca3af", margin: "0 auto 8px auto" }} />
              <p style={{ fontSize: "14px", color: "#4b5563", marginBottom: "4px" }}>Click to upload files</p>
              <p style={{ fontSize: "12px", color: "#6b7280" }}>PNG, JPG, PDF, DOC up to 10MB each</p>
            </label>
          </div>

          {formData.files.length > 0 && (
            <div style={{ marginTop: "16px" }}>
              {formData.files.map((file, index) => (
                <div key={index} style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px",
                  background: "#f9fafb",
                  borderRadius: "8px",
                  marginBottom: "8px"
                }}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <FileText style={{ width: "16px", height: "16px", color: "#6b7280", marginRight: "8px" }} />
                    <span style={{ fontSize: "14px", color: "#111827" }}>{file.name}</span>
                    <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "8px" }}>
                      ({(file.size / 1024 / 1024).toFixed(1)} MB)
                    </span>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    style={{ color: "#ef4444", cursor: "pointer", background: "none", border: "none" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#dc2626")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#ef4444")}
                  >
                    <X style={{ width: "16px", height: "16px" }} />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {warnings.largeFiles && (
            <div style={banner("warn")}>
              <AlertTriangle size={16} />
              <div>
                <p style={{ fontWeight: "500", marginBottom: "4px" }}>
                  Large Files Detected
                </p>
                <p style={{ fontSize: "12px", lineHeight: "1.4" }}>
                  Some files exceed the recommended size limit. You can continue, but large files may take longer to process.
                </p>
              </div>
            </div>
          )}
                </div>
              </div>
    </div>
  );

  const SenderInfoStep = () => (
    <div style={{ marginBottom: "32px" }}>
      <div style={card}>
        <h3 style={sectionTitle}>
          <User size={20} />
          Sender Contact Information
        </h3>
        <div style={{ marginBottom: "24px" }}>
          <div style={gridTwo}>
                <div>
                  <label style={label}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={formData.sender.fullName}
                    onChange={(e) => setFormDataWithTracking(prev => ({
                      ...prev,
                      sender: { ...prev.sender, fullName: e.target.value }
                    }))}
                    style={errors.senderFullName ? inputError : input}
                    placeholder="Enter full name"
                  />
              {errors.senderFullName && (
                <p style={{ marginTop: "4px", fontSize: "12px", color: "#dc2626" }}>{errors.senderFullName as string}</p>
                  )}
                </div>

                  <div>
                    <label style={label}>
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={formData.sender.email}
                      onChange={(e) => setFormDataWithTracking(prev => ({
                        ...prev,
                        sender: { ...prev.sender, email: e.target.value }
                      }))}
                      style={errors.senderEmail ? inputError : input}
                      placeholder="Enter email address"
                    />
                    {errors.senderEmail && (
                      <p style={{ marginTop: "4px", fontSize: "12px", color: "#dc2626" }}>{errors.senderEmail as string}</p>
                    )}
                  </div>
          </div>

          <div>
            <label style={label}>
              Phone Number (E.164) *
            </label>
            <input
              type="tel"
              value={formData.sender.phone}
              onChange={(e) => setFormDataWithTracking(prev => ({
                ...prev,
                sender: { ...prev.sender, phone: e.target.value, phoneOriginal: e.target.value }
              }))}
              style={errors.senderPhone ? inputError : input}
              placeholder="+44123456789"
            />
            {errors.senderPhone && (
              <p style={{ marginTop: "4px", fontSize: "12px", color: "#dc2626" }}>{errors.senderPhone as string}</p>
            )}
            
            {warnings.phoneFormatIssues.sender && (
              <div style={banner("info")}>
                <Info size={16} />
                <div>
                  <p style={{ fontWeight: "500", marginBottom: "4px" }}>
                    Phone format detected: {formData.sender.phoneOriginal}
                  </p>
                  <p style={{ fontSize: "12px", lineHeight: "1.4" }}>
                    Normalized to E.164: {formData.sender.phone}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={card}>
        <h3 style={sectionTitle}>
          <MapPin size={20} />
          Pickup Address
        </h3>
        <div style={{ marginBottom: "24px" }}>
          <div>
            <label style={label}>
              Street Address
            </label>
            <input
              type="text"
              value={formData.sender.street}
              onChange={handleSenderStreetChange}
              style={input}
              placeholder="Enter street address"
            />
          </div>
          
          <div style={gridThree}>
            <div>
              <label style={label}>
                City *
              </label>
              <input
                type="text"
                value={formData.sender.city}
                onChange={handleSenderCityChange}
                style={errors.senderCity ? inputError : input}
                placeholder="City"
              />
              {errors.senderCity && (
                <p style={{ marginTop: "4px", fontSize: "12px", color: "#dc2626" }}>{errors.senderCity as string}</p>
              )}
            </div>
            
            <div>
              <label style={label}>
                ZIP/Postal Code
              </label>
              <input
                type="text"
                value={formData.sender.zip}
                onChange={(e) => setFormDataWithTracking(prev => ({
                  ...prev,
                  sender: { ...prev.sender, zip: e.target.value }
                }))}
                style={input}
                placeholder="ZIP"
              />
            </div>
            
            <div>
              <label style={label}>
                Country *
              </label>
              <select
                value={formData.sender.country}
                onChange={(e) => setFormDataWithTracking(prev => ({
                  ...prev,
                  sender: { ...prev.sender, country: e.target.value }
                }))}
                style={errors.senderCountry ? { ...select, border: "1px solid #dc2626" } : select}
              >
                <option value="">Select country</option>
                {countries.map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
              {errors.senderCountry && (
                <p style={{ marginTop: "4px", fontSize: "12px", color: "#dc2626" }}>{errors.senderCountry as string}</p>
              )}
            </div>
          </div>

          {warnings.partialAddresses.sender && (
            <div style={banner("warn")}>
              <AlertCircle size={16} />
              <div>
                <p style={{ fontWeight: "500", marginBottom: "4px" }}>
                  Partial Address Information
                </p>
                <p style={{ fontSize: "12px", lineHeight: "1.4", marginBottom: "8px" }}>
                  Some address fields are missing. You can continue, but complete information helps with accurate delivery planning.
                </p>
                <div style={{ fontSize: "11px", lineHeight: "1.3" }}>
                  {!formData.sender.street && <p>• Street address is missing</p>}
                  {!formData.sender.zip && <p>• ZIP/Postal code is missing</p>}
                  <p>• Required: City and Country ✓</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
              </div>
  );

  const BuyerInfoStep = () => (
    <div className="space-y-8">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <User className="mr-2 h-5 w-5" />
            Buyer Contact Information
          </h3>
                </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={formData.buyer.fullName}
                    onChange={(e) => setFormDataWithTracking(prev => ({
                      ...prev,
                      buyer: { ...prev.buyer, fullName: e.target.value }
                    }))}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                  errors.buyerFullName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter full name"
                  />
              {errors.buyerFullName && (
                <p className="mt-1 text-sm text-red-600">{errors.buyerFullName as string}</p>
                  )}
                </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
                    </label>
                    <input
                      type="email"
                      value={formData.buyer.email}
                      onChange={(e) => setFormDataWithTracking(prev => ({
                        ...prev,
                        buyer: { ...prev.buyer, email: e.target.value }
                      }))}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                  errors.buyerEmail ? 'border-red-500' : 'border-gray-300'
                      }`}
                placeholder="Enter email address"
                    />
              {errors.buyerEmail && (
                <p className="mt-1 text-sm text-red-600">{errors.buyerEmail as string}</p>
                  )}
                  </div>
          </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number (E.164) *
                    </label>
                    <input
                      type="tel"
                      value={formData.buyer.phone}
                      onChange={(e) => setFormDataWithTracking(prev => ({
                        ...prev,
                buyer: { ...prev.buyer, phone: e.target.value, phoneOriginal: e.target.value }
                      }))}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                errors.buyerPhone ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="+44123456789"
                    />
            {errors.buyerPhone && (
              <p className="mt-1 text-sm text-red-600">{errors.buyerPhone as string}</p>
            )}
            
            {warnings.phoneFormatIssues.buyer && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="text-blue-600 mt-0.5 flex-shrink-0" size={14} />
                  <div className="flex-1">
                    <p className="text-xs text-blue-800 mb-1">
                      Phone format detected: {formData.buyer.phoneOriginal}
                    </p>
                    <p className="text-xs text-blue-700">
                      Normalized to E.164: {formData.buyer.phone}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
                  </div>
                </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <MapPin className="mr-2 h-5 w-5" />
            Delivery Address
          </h3>
        </div>
        <div className="p-6 space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Street Address
                    </label>
                    <input
                      type="text"
                      value={formData.buyer.street}
                      onChange={(e) => setFormDataWithTracking(prev => ({
                        ...prev,
                        buyer: { ...prev.buyer, street: e.target.value }
                      }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="Enter street address"
                    />
                  </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        City *
                      </label>
                      <input
                        type="text"
                        value={formData.buyer.city}
                        onChange={(e) => setFormDataWithTracking(prev => ({
                          ...prev,
                          buyer: { ...prev.buyer, city: e.target.value }
                        }))}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                  errors.buyerCity ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="City"
                      />
              {errors.buyerCity && (
                <p className="mt-1 text-sm text-red-600">{errors.buyerCity as string}</p>
                      )}
                    </div>
            
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        ZIP/Postal Code
                      </label>
                      <input
                        type="text"
                        value={formData.buyer.zip}
                        onChange={(e) => setFormDataWithTracking(prev => ({
                          ...prev,
                          buyer: { ...prev.buyer, zip: e.target.value }
                        }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="ZIP"
                      />
                    </div>
            
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Country *
                      </label>
                      <select
                        value={formData.buyer.country}
                        onChange={(e) => setFormDataWithTracking(prev => ({
                          ...prev,
                          buyer: { ...prev.buyer, country: e.target.value }
                        }))}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                  errors.buyerCountry ? 'border-red-500' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select country</option>
                        {countries.map(country => (
                          <option key={country} value={country}>{country}</option>
                        ))}
                      </select>
              {errors.buyerCountry && (
                <p className="mt-1 text-sm text-red-600">{errors.buyerCountry as string}</p>
                      )}
                  </div>
                </div>

          {warnings.partialAddresses.buyer && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="text-yellow-600 mt-0.5 flex-shrink-0" size={16} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-800 mb-1">
                    Partial Address Information
                  </p>
                  <p className="text-yellow-700 text-sm mb-2">
                    Some address fields are missing. You can continue, but complete information helps with accurate delivery planning.
                  </p>
                  <div className="text-xs text-yellow-600 space-y-1">
                    {!formData.buyer.street && <p>• Street address is missing</p>}
                    {!formData.buyer.zip && <p>• ZIP/Postal code is missing</p>}
                    <p>• Required: City and Country ✓</p>
                      </div>
                        </div>
                        </div>
                        </div>
          )}
          
          {warnings.timezoneMismatch && (
            <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Clock className="text-purple-600 mt-0.5 flex-shrink-0" size={16} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-purple-800 mb-1">
                    Timezone Mismatch Detected
                  </p>
                  <p className="text-purple-700 text-sm mb-2">
                    Sender and Buyer are in different countries. Time coordination will be important for pickup and delivery.
                  </p>
                  <div className="text-xs text-purple-600 space-y-1">
                    <p>• Sender: {formData.sender.country}</p>
                    <p>• Buyer: {formData.buyer.country}</p>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
          </div>
          </div>
  );

  const LogisticsStep = () => (
    <div className="space-y-8">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Settings className="mr-2 h-5 w-5" />
            Service Level & Requirements
          </h3>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                Urgency Level
                </label>
              <div className="space-y-3">
                {[
                  { value: 'standard', label: 'Standard', description: '5-7 business days', icon: Package },
                  { value: 'expedited', label: 'Expedited', description: '3-5 business days', icon: Star },
                  { value: 'express', label: 'Express', description: '1-3 business days', icon: Zap }
                ].map(({ value, label, description, icon: Icon }) => (
                  <label key={value} className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="urgency"
                      value={value}
                      checked={formData.urgency === value}
                      onChange={(e) => setFormDataWithTracking(prev => ({
                        ...prev,
                        urgency: e.target.value as 'standard' | 'expedited' | 'express'
                      }))}
                      className="mr-3"
                    />
                    <Icon className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <div className="font-medium text-gray-900">{label}</div>
                      <div className="text-sm text-gray-500">{description}</div>
                    </div>
                  </label>
                ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                Transport Preference
                </label>
                <select
                  value={formData.preferredTransport}
                  onChange={(e) => setFormDataWithTracking(prev => ({ 
                    ...prev, 
                  preferredTransport: e.target.value as any
                  }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option value="no-preference">No Preference</option>
                <option value="air-only">Air Only</option>
                <option value="ground-only">Ground Only</option>
                <option value="express-only">Express Only</option>
                </select>
              </div>
            </div>

              <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
                  Special Conditions
                </label>
                <div className="space-y-3">
              {[
                { key: 'highValue', label: 'High Value Item', description: 'Extra security and handling' },
                { key: 'temperatureSensitive', label: 'Temperature Sensitive', description: 'Climate controlled transport' },
                { key: 'photoProofRequired', label: 'Photo Proof Required', description: 'Photo documentation at each step' }
              ].map(({ key, label, description }) => (
                <label key={key} className="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                    checked={formData.specialConditions[key as keyof typeof formData.specialConditions]}
                      onChange={(e) => setFormDataWithTracking(prev => ({
                        ...prev,
                        specialConditions: {
                          ...prev.specialConditions,
                        [key]: e.target.checked
                        }
                      }))}
                    className="mt-1 mr-3"
                    />
                    <div>
                    <div className="font-medium text-gray-900">{label}</div>
                    <div className="text-sm text-gray-500">{description}</div>
                    </div>
                  </label>
              ))}
            </div>
          </div>
          
                    <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Security Notes
                  </label>
            <textarea
              value={formData.securityNotes}
                      onChange={(e) => setFormDataWithTracking(prev => ({
                        ...prev,
                securityNotes: e.target.value
                      }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              rows={4}
              placeholder="Any special security requirements or handling instructions..."
                    />
                    </div>
                </div>
              </div>
    </div>
  );

  const ReviewStep = () => (
    <div className="space-y-8">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <CheckCircle className="mr-2 h-5 w-5" />
            Shipment Summary
          </h3>
              </div>
        <div className="p-6 space-y-6">
          {/* Product Summary */}
          <div className="border-l-4 border-blue-500 pl-4">
            <h4 className="font-semibold text-gray-900 mb-2">Product Details</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Reference:</span>
                <span className="ml-2 font-mono">{formData.reference}</span>
            </div>
              <div>
                <span className="text-gray-600">Brand:</span>
                <span className="ml-2">{formData.brand}</span>
              </div>
              <div>
                <span className="text-gray-600">Value:</span>
                <span className="ml-2 font-semibold text-green-600">
                  {formData.currency} {parseFloat(formData.declaredValue || '0').toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Weight:</span>
                <span className="ml-2">{formData.weight} {formData.weightUnit}</span>
              </div>
          </div>
        </div>

          {/* Route Summary */}
          <div className="border-l-4 border-green-500 pl-4">
            <h4 className="font-semibold text-gray-900 mb-2">Route</h4>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex-1">
                <div className="font-medium">{formData.sender.fullName}</div>
                <div className="text-gray-600">{formData.sender.city}, {formData.sender.country}</div>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400" />
              <div className="flex-1">
                <div className="font-medium">{formData.buyer.fullName}</div>
                <div className="text-gray-600">{formData.buyer.city}, {formData.buyer.country}</div>
              </div>
            </div>
          </div>
          
          {/* Service Summary */}
          <div className="border-l-4 border-purple-500 pl-4">
            <h4 className="font-semibold text-gray-900 mb-2">Service Level</h4>
            <div className="text-sm">
              <div className="flex items-center mb-2">
                {formData.urgency === 'express' && <Zap className="h-4 w-4 mr-2 text-yellow-500" />}
                {formData.urgency === 'expedited' && <Star className="h-4 w-4 mr-2 text-blue-500" />}
                {formData.urgency === 'standard' && <Package className="h-4 w-4 mr-2 text-gray-500" />}
                <span className="capitalize font-medium">{formData.urgency}</span>
              </div>
              {formData.specialConditions.highValue && (
                <div className="flex items-center text-orange-600 mb-1">
                  <Shield className="h-3 w-3 mr-1" />
                  <span>High Value Item</span>
                </div>
              )}
              {formData.specialConditions.temperatureSensitive && (
                <div className="flex items-center text-blue-600 mb-1">
                  <Globe className="h-3 w-3 mr-1" />
                  <span>Temperature Sensitive</span>
                </div>
              )}
              {formData.specialConditions.photoProofRequired && (
                <div className="flex items-center text-green-600 mb-1">
                  <Camera className="h-3 w-3 mr-1" />
                  <span>Photo Proof Required</span>
                </div>
              )}
                </div>
              </div>
              
          {/* Files Summary */}
          {formData.files.length > 0 && (
            <div className="border-l-4 border-yellow-500 pl-4">
              <h4 className="font-semibold text-gray-900 mb-2">Documentation</h4>
              <div className="text-sm space-y-1">
                {formData.files.map((file, index) => (
                  <div key={index} className="flex items-center">
                    <FileText className="h-3 w-3 mr-2 text-gray-500" />
                    <span>{file.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
                </div>
              </div>
              
      {/* Final Check */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start">
          <Info className="h-5 w-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-2">Ready to Submit</h4>
            <p className="text-blue-800 text-sm mb-3">
              Once submitted, your shipment will be created as a draft and immediately appear in the logistics dashboard 
              for tier classification. You'll be redirected to assign the appropriate service tier.
            </p>
            <ul className="text-blue-700 text-sm space-y-1">
              <li>• Draft shipment will be created instantly</li>
              <li>• Appears in "To Classify" queue within seconds</li>
              <li>• Must assign tier before proceeding to planning</li>
              <li>• All changes are auto-saved</li>
            </ul>
                </div>
              </div>
      </div>
    </div>
  );

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
          Create New Shipment
        </h1>
        <p style={{ color: "#666", fontSize: "16px", lineHeight: "1.5" }}>
          Secure logistics for luxury goods. Follow the steps below to create your shipment.
        </p>
      </div>
          
      {/* Progress Indicator */}
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: "8px", 
        marginBottom: "32px",
        padding: "16px",
        background: "#f8f9fa",
        borderRadius: "12px",
        border: "1px solid #e0e0e0"
      }}>
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "8px",
              color: index <= currentStep ? "#16a34a" : "#666"
            }}>
              <div style={{
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                background: index <= currentStep ? "#16a34a" : "#e0e0e0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "12px",
                fontWeight: "600"
              }}>
                {index < currentStep ? "✓" : index + 1}
              </div>
              <span style={{ fontWeight: "500", fontSize: "14px" }}>{step.title}</span>
            </div>
            {index < steps.length - 1 && <ArrowRight size={16} color="#ccc" />}
          </React.Fragment>
        ))}
      </div>
          
      {/* Main Content */}
      <div>
        {renderStepContent()}
        
        {/* Navigation */}
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between",
          marginTop: "32px",
          paddingTop: "24px",
          borderTop: "1px solid #e0e0e0"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {isAutoSaving && (
              <div style={{ display: "flex", alignItems: "center", color: "#2563eb", fontSize: "14px" }}>
                <div style={{
                  width: "16px",
                  height: "16px",
                  border: "2px solid #2563eb",
                  borderTop: "2px solid transparent",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                  marginRight: "8px"
                }}></div>
                Auto-saving...
              </div>
            )}
            {lastSaved && !isAutoSaving && (
              <div style={{ display: "flex", alignItems: "center", color: "#16a34a", fontSize: "14px" }}>
                <CheckCircle style={{ width: "16px", height: "16px", marginRight: "8px" }} />
                Last saved: {lastSaved?.toLocaleTimeString()}
              </div>
            )}
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {currentStep > 0 && (
              <button
                onClick={prevStep}
                style={{
                  ...btnSecondary,
                  padding: "12px 24px"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f5")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                Previous
              </button>
            )}
          
            {currentStep < steps.length - 1 ? (
              <button
                onClick={nextStep}
                style={{
                  ...btnPrimary,
                  padding: "12px 24px"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#333")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#000")}
              >
                Next
                <ArrowRight style={{ width: "16px", height: "16px", marginLeft: "8px" }} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                style={{
                  ...btnPrimary,
                  padding: "16px 32px",
                  fontSize: "16px",
                  fontWeight: "600",
                  background: isSubmitting ? "#9ca3af" : "#16a34a",
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  opacity: isSubmitting ? 0.7 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isSubmitting) {
                    e.currentTarget.style.background = "#15803d";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSubmitting) {
                    e.currentTarget.style.background = "#16a34a";
                  }
                }}
              >
                {isSubmitting ? (
                  <>
                    <div style={{
                      width: "16px",
                      height: "16px",
                      border: "2px solid #fff",
                      borderTop: "2px solid transparent",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                      marginRight: "8px"
                    }}></div>
                    Creating Shipment...
                  </>
                ) : (
                  <>
                    <CheckCircle style={{ width: "16px", height: "16px", marginRight: "8px" }} />
                    Create Shipment
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
      
    </div>
  );
}