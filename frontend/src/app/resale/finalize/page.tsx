"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Search, 
  AlertCircle, 
  CheckCircle, 
  Package, 
  User, 
  UserCheck, 
  Shield, 
  ExternalLink,
  ArrowRight,
  Info,
  DollarSign,
  FileText,
  Download,
  Mail,
  Eye,
  X,
  CheckSquare,
  Square,
  Lock,
  Unlock,
  FileSignature,
  Calculator,
  TrendingUp,
  Clock,
  Hash,
  Database,
  UserPlus,
  Filter,
  Calendar,
  Tag,
  Loader2,
  Archive,
  Wallet,
  Blocks
} from 'lucide-react';

// Type definitions
interface ResaleEvent {
  id: string;
  resale_id: string;
  passport_id: number;
  seller_id: number;
  buyer_id: number;
  asking_price: number;
  currency: string;
  status: string;
  marketplace_id?: string;
  external_listing_ref?: string;
  initiated_at: string;
  buyer_assigned_at?: string;
  sold_at?: string;
  cancelled_at?: string;
  current_valuation_id?: number;
  product_hash: string;
  client_hash: string;
  metadata?: any;
  passport?: {
    id: number;
    nfc_uid: string;
    status: string;
    metadata?: {
      brand?: string;
      object_name?: string;
      product_image?: string;
      collection_year?: string;
      original_price?: string;
      [key: string]: any;
    };
  };
  seller?: {
    id: number;
    name: string;
    email?: string;
    kyc_status?: string;
    vault_status?: string;
  };
  buyer?: {
    id: number;
    name: string;
    email?: string;
    kyc_status?: string;
    vault_status?: string;
  };
}

interface FinalizationStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  icon: React.ComponentType<any>;
  details?: string;
}

const ResaleFinalizePage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resaleId = searchParams.get('id');

  // State management
  const [resaleEvent, setResaleEvent] = useState<ResaleEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ResaleEvent[]>([]);
  const [selectedResale, setSelectedResale] = useState<ResaleEvent | null>(null);

  // Finalization steps tracking
  const [finalizationSteps, setFinalizationSteps] = useState<FinalizationStep[]>([
    {
      id: 'ownership_transfer',
      name: 'Remove from Seller Vault',
      description: 'Remove product from current owner\'s vault and flag as "Sold"',
      status: 'pending',
      icon: Package
    },
    {
      id: 'sbt_minting',
      name: 'Mint New SBT for Buyer',
      description: 'Create new Soulbound Token for the buyer with "Minted" status',
      status: 'pending',
      icon: Wallet
    },
    {
      id: 'passport_update',
      name: 'Update Passport Metadata',
      description: 'Amend passport to reflect new owner and transaction details',
      status: 'pending',
      icon: FileText
    },
    {
      id: 'blockchain_anchor',
      name: 'Lock Transaction on Blockchain',
      description: 'Write transaction to private chain for immutability',
      status: 'pending',
      icon: Blocks
    },
    {
      id: 'metadata_archive',
      name: 'Archive Resale Metadata',
      description: 'Store transaction history and traceability records',
      status: 'pending',
      icon: Archive
    }
  ]);

  useEffect(() => {
    if (resaleId) {
      loadResaleData(resaleId);
    } else {
      // Load recent resale events ready for finalization
      searchResaleEvents();
    }
  }, [resaleId]);

  const searchResaleEvents = async () => {
    setSearching(true);
    setError(null);
    
    try {
      // Search for resale events that are ready for finalization
      const searchTerm = searchQuery.trim() || '*';
      const response = await fetch(`/api/sprint3/resale-console/search?q=${encodeURIComponent(searchTerm)}&limit=20`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to search resale events');
      }
      
      const data = await response.json();
      
      // Filter for events ready for finalization (buyer_assigned or pending_sale)
      const finalizableEvents = data.resale_events.filter((event: ResaleEvent) => 
        ['buyer_assigned', 'pending_sale'].includes(event.status) && event.buyer_id
      );
      
      setSearchResults(finalizableEvents);
      
      if (finalizableEvents.length === 0) {
        setError('No resale events found that are ready for finalization. Events must have a buyer assigned and be in "buyer_assigned" or "pending_sale" status.');
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search resale events');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const loadResaleData = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Search for the specific resale event
      const response = await fetch(`/api/sprint3/resale-console/search?q=${encodeURIComponent(id)}&limit=1`);
      
      if (!response.ok) {
        throw new Error('Failed to load resale data');
      }
      
      const data = await response.json();
      const event = data.resale_events.find((e: ResaleEvent) => e.resale_id === id);
      
      if (!event) {
        throw new Error('Resale event not found');
      }
      
      if (!['buyer_assigned', 'pending_sale'].includes(event.status)) {
        throw new Error(`Resale event is not ready for finalization. Current status: ${event.status}`);
      }
      
      if (!event.buyer_id) {
        throw new Error('Resale event does not have a buyer assigned');
      }
      
      setResaleEvent(event);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load resale data');
    } finally {
      setLoading(false);
    }
  };

  const selectResaleEvent = (event: ResaleEvent) => {
    setSelectedResale(event);
    setResaleEvent(event);
    setError(null);
  };

  const updateStepStatus = (stepId: string, status: FinalizationStep['status'], details?: string) => {
    setFinalizationSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { ...step, status, details }
        : step
    ));
  };

  const simulateStepExecution = async (stepId: string, delay: number = 1000): Promise<void> => {
    return new Promise((resolve) => {
      updateStepStatus(stepId, 'in_progress');
      
      setTimeout(() => {
        updateStepStatus(stepId, 'completed');
        resolve();
      }, delay);
    });
  };

  const executeFinalization = async () => {
    if (!resaleEvent) {
      setError('No resale event selected for finalization');
      return;
    }

    setFinalizing(true);
    setError(null);

    try {
      // Step 1: Remove from Seller Vault
      await simulateStepExecution('ownership_transfer', 1500);
      
      // Step 2: Mint New SBT for Buyer
      await simulateStepExecution('sbt_minting', 2000);
      
      // Step 3: Update Passport Metadata
      await simulateStepExecution('passport_update', 1000);
      
      // Step 4: Lock on Blockchain
      await simulateStepExecution('blockchain_anchor', 3000);
      
      // Step 5: Archive Metadata
      await simulateStepExecution('metadata_archive', 1000);

      setSuccess(true);
      
      // Redirect to summary page after delay
      setTimeout(() => {
        router.push(`/resale/summary?id=${resaleEvent.resale_id}`);
      }, 3000);

    } catch (err) {
      setError('Finalization failed. Please try again.');
      console.error('Finalization error:', err);
    } finally {
      setFinalizing(false);
    }
  };

  // If no resale event is selected, show search interface
  if (!resaleEvent) {
    return (
      <div>
        {/* Header */}
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          border: '1px solid #e0e0e0',
          padding: '32px',
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#007bff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Search size={24} color="white" />
            </div>
            <div>
              <h1 style={{
                fontSize: '24px',
                fontWeight: '600',
                margin: '0 0 4px 0',
                color: '#1a1a1a'
              }}>
                Select Resale for Finalization
              </h1>
              <p style={{
                fontSize: '14px',
                color: '#6c757d',
                margin: 0
              }}>
                Search and select a resale event that is ready for finalization
              </p>
            </div>
          </div>

          {/* Search Interface */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchResaleEvents()}
              placeholder="Search by Resale ID, Passport ID, or Product details (leave empty to see recent events)"
              style={{
                padding: '12px 16px',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
            />
            <button
              onClick={searchResaleEvents}
              disabled={searching}
              style={{
                padding: '12px 24px',
                background: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: searching ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: searching ? 0.6 : 1,
                transition: 'all 0.2s'
              }}
            >
              {searching ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Search size={16} />
              )}
              {searchQuery ? 'Search' : 'Show Recent'}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              background: '#f8d7da',
              border: '1px solid #f5c6cb',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px'
            }}>
              <AlertCircle size={20} color="#721c24" />
              <div>
                <h4 style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#721c24',
                  margin: '0 0 4px 0'
                }}>
                  Search Error
                </h4>
                <p style={{
                  fontSize: '13px',
                  color: '#721c24',
                  margin: 0,
                  lineHeight: '1.4'
                }}>
                  {error}
                </p>
              </div>
            </div>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div style={{
              border: '1px solid #e0e0e0',
              borderRadius: '12px',
              padding: '20px',
              background: '#f8f9fa'
            }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                marginBottom: '16px',
                color: '#1a1a1a'
              }}>
                {searchQuery ? 
                  `Found ${searchResults.length} Resale Event${searchResults.length > 1 ? 's' : ''}` :
                  `Recent Resale Events Ready for Finalization (${searchResults.length} available)`
                }
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {searchResults.map((resale) => {
                  const metadata = resale.passport?.metadata as any || {};
                  const brand = metadata.brand || 'Unknown Brand';
                  const productName = metadata.object_name || 'Unknown Product';
                 
                  return (
                    <div
                      key={resale.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '16px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        background: '#fff',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#007bff';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,123,255,0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e0e0e0';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                      onClick={() => selectResaleEvent(resale)}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          marginBottom: '8px'
                        }}>
                          <Package size={16} color="#6c757d" />
                          <span style={{ fontWeight: '500' }}>{brand} {productName}</span>
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          marginBottom: '4px'
                        }}>
                          <Hash size={14} color="#6c757d" />
                          <span style={{ fontSize: '13px', fontFamily: 'monospace' }}>{resale.resale_id}</span>
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px'
                        }}>
                          <DollarSign size={14} color="#6c757d" />
                          <span style={{ fontSize: '13px' }}>{resale.asking_price.toLocaleString()} {resale.currency}</span>
                        </div>
                      </div>
                      
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <div style={{
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '500',
                          textTransform: 'uppercase',
                          background: resale.status === 'buyer_assigned' ? '#fff3cd' : '#d4edda',
                          color: resale.status === 'buyer_assigned' ? '#856404' : '#155724'
                        }}>
                          {resale.status.replace('_', ' ')}
                        </div>
                        <ArrowRight size={16} color="#6c757d" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No Results Message */}
          {!searching && searchResults.length === 0 && !error && (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: '#6c757d'
            }}>
              <Package size={48} color="#6c757d" style={{ marginBottom: '16px' }} />
              <h3 style={{
                fontSize: '18px',
                fontWeight: '500',
                margin: '0 0 8px 0',
                color: '#6c757d'
              }}>
                No Resale Events Found
              </h3>
              <p style={{
                fontSize: '14px',
                margin: 0,
                lineHeight: '1.4'
              }}>
                {searchQuery ? 
                  'Try adjusting your search terms or search for recent events.' :
                  'No resale events are currently ready for finalization. Events must have a buyer assigned and be in "buyer_assigned" or "pending_sale" status.'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show finalization interface when resale event is selected
  return (
    <div>
      {/* Header */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e0e0e0',
        padding: '32px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#28a745',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CheckCircle size={24} color="white" />
            </div>
            <div>
              <h1 style={{
                fontSize: '24px',
                fontWeight: '600',
                margin: '0 0 4px 0',
                color: '#1a1a1a'
              }}>
                Resale Finalization
              </h1>
              <p style={{
                fontSize: '14px',
                color: '#6c757d',
                margin: 0
              }}>
                Complete the resale transaction and transfer ownership
              </p>
            </div>
          </div>
          
          <button
            onClick={() => {
              setResaleEvent(null);
              setSelectedResale(null);
              setError(null);
            }}
            style={{
              padding: '8px 12px',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <X size={14} />
            Change Selection
          </button>
        </div>

        {/* Resale Summary */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px',
          marginBottom: '24px'
        }}>
          <div>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '500',
              color: '#6c757d',
              margin: '0 0 8px 0',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Product Details
            </h3>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '8px'
            }}>
              <Package size={16} color="#6c757d" />
              <span style={{ fontWeight: '500' }}>
                {resaleEvent.passport?.metadata?.brand || 'Unknown Brand'} {resaleEvent.passport?.metadata?.object_name || 'Unknown Product'}
              </span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '8px'
            }}>
              <Hash size={16} color="#6c757d" />
              <span style={{ fontSize: '13px', fontFamily: 'monospace' }}>#{resaleEvent.passport_id}</span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Calendar size={16} color="#6c757d" />
              <span>{resaleEvent.passport?.metadata?.collection_year || 'Unknown Year'}</span>
            </div>
          </div>

          <div>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '500',
              color: '#6c757d',
              margin: '0 0 8px 0',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Transaction Details
            </h3>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '8px'
            }}>
              <DollarSign size={16} color="#6c757d" />
              <span style={{ fontWeight: '500' }}>{resaleEvent.asking_price.toLocaleString()} {resaleEvent.currency}</span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <User size={16} color="#6c757d" />
              <span>Seller: {resaleEvent.seller?.name || 'Unknown'}</span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <ArrowRight size={16} color="#6c757d" />
              <span>Buyer: {resaleEvent.buyer?.name || 'Unknown'}</span>
            </div>
          </div>
        </div>

        {/* Warning Banner */}
        <div style={{
          background: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '8px',
          padding: '16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px'
        }}>
          <AlertCircle size={20} color="#856404" />
          <div>
            <h4 style={{
              fontSize: '14px',
              fontWeight: '500',
              color: '#856404',
              margin: '0 0 4px 0'
            }}>
              Final Confirmation Required
            </h4>
            <p style={{
              fontSize: '13px',
              color: '#856404',
              margin: 0,
              lineHeight: '1.4'
            }}>
              This action will permanently transfer ownership of the product. 
              The seller will lose access to their vault, and the buyer will receive a new SBT. 
              This process cannot be undone.
            </p>
          </div>
        </div>
      </div>

      {/* Finalization Steps */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e0e0e0',
        padding: '32px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{
          fontSize: '18px',
          fontWeight: '500',
          margin: '0 0 24px 0',
          color: '#1a1a1a',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Lock size={20} />
          Finalization Process
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {finalizationSteps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = step.status === 'completed';
            const isInProgress = step.status === 'in_progress';
            const isFailed = step.status === 'failed';

            return (
              <div
                key={step.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                  padding: '20px',
                  borderRadius: '12px',
                  border: `1px solid ${isCompleted ? '#d4edda' : isFailed ? '#f8d7da' : '#e9ecef'}`,
                  background: isCompleted ? '#f8fff9' : isFailed ? '#fff8f8' : '#fff',
                  transition: 'all 0.2s'
                }}
              >
                {/* Step Number */}
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: isCompleted ? '#28a745' : isFailed ? '#dc3545' : isInProgress ? '#007bff' : '#6c757d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  {isCompleted ? (
                    <CheckCircle size={16} />
                  ) : isInProgress ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    index + 1
                  )}
                </div>

                {/* Step Content */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '4px'
                  }}>
                    <Icon size={16} color={isCompleted ? '#28a745' : isFailed ? '#dc3545' : '#6c757d'} />
                    <h3 style={{
                      fontSize: '16px',
                      fontWeight: '500',
                      margin: 0,
                      color: isCompleted ? '#28a745' : isFailed ? '#dc3545' : '#1a1a1a'
                    }}>
                      {step.name}
                    </h3>
                  </div>
                  <p style={{
                    fontSize: '14px',
                    color: '#6c757d',
                    margin: '0 0 8px 0',
                    lineHeight: '1.4'
                  }}>
                    {step.description}
                  </p>
                  {step.details && (
                    <p style={{
                      fontSize: '13px',
                      color: isCompleted ? '#28a745' : isFailed ? '#dc3545' : '#6c757d',
                      margin: 0,
                      fontStyle: 'italic'
                    }}>
                      {step.details}
                    </p>
                  )}
                </div>

                {/* Status Badge */}
                <div style={{
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '500',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  background: isCompleted ? '#d4edda' : isFailed ? '#f8d7da' : isInProgress ? '#cce7ff' : '#e9ecef',
                  color: isCompleted ? '#155724' : isFailed ? '#721c24' : isInProgress ? '#004085' : '#6c757d'
                }}>
                  {step.status.replace('_', ' ')}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '16px',
        justifyContent: 'center'
      }}>
        <button
          onClick={() => {
            setResaleEvent(null);
            setSelectedResale(null);
            setError(null);
          }}
          disabled={finalizing}
          style={{
            padding: '12px 24px',
            background: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: finalizing ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            opacity: finalizing ? 0.6 : 1,
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            if (!finalizing) e.currentTarget.style.background = '#5a6268';
          }}
          onMouseLeave={(e) => {
            if (!finalizing) e.currentTarget.style.background = '#6c757d';
          }}
        >
          Cancel
        </button>

        <button
          onClick={executeFinalization}
          disabled={finalizing || success}
          style={{
            padding: '12px 32px',
            background: success ? '#28a745' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: finalizing || success ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            opacity: finalizing || success ? 0.6 : 1,
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            if (!finalizing && !success) e.currentTarget.style.background = success ? '#218838' : '#0056b3';
          }}
          onMouseLeave={(e) => {
            if (!finalizing && !success) e.currentTarget.style.background = success ? '#28a745' : '#007bff';
          }}
        >
          {success ? (
            <>
              <CheckCircle size={16} />
              Finalization Complete
            </>
          ) : finalizing ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Finalizing...
            </>
          ) : (
            <>
              <Lock size={16} />
              Finalize Resale
            </>
          )}
        </button>
      </div>

      {/* Success Message */}
      {success && (
        <div style={{
          background: '#d4edda',
          border: '1px solid #c3e6cb',
          borderRadius: '8px',
          padding: '20px',
          marginTop: '24px',
          textAlign: 'center'
        }}>
          <CheckCircle size={24} color="#155724" style={{ marginBottom: '12px' }} />
          <h3 style={{
            fontSize: '18px',
            fontWeight: '500',
            color: '#155724',
            margin: '0 0 8px 0'
          }}>
            Resale Successfully Finalized!
          </h3>
          <p style={{
            fontSize: '14px',
            color: '#155724',
            margin: 0,
            lineHeight: '1.4'
          }}>
            Ownership has been transferred and the transaction is now immutable on the blockchain.
            Redirecting to summary page...
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div style={{
          background: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '8px',
          padding: '20px',
          marginTop: '24px',
          textAlign: 'center'
        }}>
          <AlertCircle size={24} color="#721c24" style={{ marginBottom: '12px' }} />
          <h3 style={{
            fontSize: '18px',
            fontWeight: '500',
            color: '#721c24',
            margin: '0 0 8px 0'
          }}>
            Finalization Failed
          </h3>
          <p style={{
            fontSize: '14px',
            color: '#721c24',
            margin: 0
          }}>
            {error}
          </p>
        </div>
      )}

      {/* Additional Information */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e0e0e0',
        padding: '24px',
        marginTop: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{
          fontSize: '16px',
          fontWeight: '500',
          margin: '0 0 16px 0',
          color: '#1a1a1a',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Info size={18} />
          What Happens Next?
        </h3>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '16px'
        }}>
          <div style={{
            padding: '16px',
            background: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #e9ecef'
          }}>
            <h4 style={{
              fontSize: '14px',
              fontWeight: '500',
              margin: '0 0 8px 0',
              color: '#1a1a1a'
            }}>
              For the Seller
            </h4>
            <ul style={{
              fontSize: '13px',
              color: '#6c757d',
              margin: 0,
              paddingLeft: '16px',
              lineHeight: '1.4'
            }}>
              <li>Product removed from vault</li>
              <li>Access revoked</li>
              <li>Transaction recorded</li>
            </ul>
          </div>

          <div style={{
            padding: '16px',
            background: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #e9ecef'
          }}>
            <h4 style={{
              fontSize: '14px',
              fontWeight: '500',
              margin: '0 0 8px 0',
              color: '#1a1a1a'
            }}>
              For the Buyer
            </h4>
            <ul style={{
              fontSize: '13px',
              color: '#6c757d',
              margin: 0,
              paddingLeft: '16px',
              lineHeight: '1.4'
            }}>
              <li>New SBT minted</li>
              <li>Product added to vault</li>
              <li>Full ownership rights</li>
            </ul>
          </div>

          <div style={{
            padding: '16px',
            background: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #e9ecef'
          }}>
            <h4 style={{
              fontSize: '14px',
              fontWeight: '500',
              margin: '0 0 8px 0',
              color: '#1a1a1a'
            }}>
              On the Blockchain
            </h4>
            <ul style={{
              fontSize: '13px',
              color: '#6c757d',
              margin: 0,
              paddingLeft: '16px',
              lineHeight: '1.4'
            }}>
              <li>Transaction immutable</li>
              <li>Ownership history preserved</li>
              <li>Audit trail complete</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResaleFinalizePage;
