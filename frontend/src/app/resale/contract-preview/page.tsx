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
  Tag
} from 'lucide-react';
import { api } from '@/lib/api';

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
  current_valuation_id?: number;
  product_hash?: string;
  client_hash?: string;
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
  resale_config?: {
    resale_type: string;
    royalties_enabled: boolean;
    cashback_enabled: boolean;
    brand_participation: boolean;
    brand_revenue_share: number;
    ownership_depth: number;
    royalty_tiers: any;
    cashback_tiers: any;
  };
  valuation?: {
    id: number;
    valuation_amount: number;
    currency: string;
    valuation_date: string;
    valuation_source: string;
    appreciation_percentage?: number;
  };
}

interface FinancialBreakdown {
  resale_amount: number;
  aucta_fee: number;
  marketplace_fee: number;
  cashback_amount: number;
  net_to_seller: number;
  appreciation_amount: number;
  appreciation_percentage: number;
  // Editable percentages
  aucta_fee_percentage: number;
  marketplace_fee_percentage: number;
  fb_royalty_percentage: number;
  cashback_percentage: number;
}

interface SmartContractData {
  passport_id: number;
  seller_address: string;
  buyer_address: string;
  sale_price: number;
  currency: string;
  royalty_model: string;
  split_json: string;
  timestamp: string;
  contract_hash: string;
}

// Contract Selection Component
const ContractSelection: React.FC<{
  onContractSelect: (resaleId: string) => void;
}> = ({ onContractSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [recentContracts, setRecentContracts] = useState<ResaleEvent[]>([]);
  const [searchResults, setSearchResults] = useState<ResaleEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'recent' | 'search'>('recent');

  useEffect(() => {
    loadRecentContracts();
  }, []);

  const loadRecentContracts = async () => {
    setLoading(true);
    try {
      const response = await api.getRecentContracts(10);
      if (response.success) {
        setRecentContracts(response.contracts);
      } else {
        console.error('Failed to load recent contracts:', response.error);
        setRecentContracts([]);
      }
    } catch (error) {
      console.error('Error loading recent contracts:', error);
      setRecentContracts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setSelectedFilter('recent');
      return;
    }

    setSearching(true);
    try {
      const response = await api.searchContracts(searchTerm, undefined, 20);
      if (response.success) {
        setSearchResults(response.contracts);
        setSelectedFilter('search');
      } else {
        console.error('Search failed:', response.error);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching contracts:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready_for_resale':
        return { bg: '#e7f3ff', color: '#0056b3', text: 'Ready for Resale' };
      case 'initiated':
        return { bg: '#fff3cd', color: '#856404', text: 'Initiated' };
      case 'buyer_assigned':
        return { bg: '#d1ecf1', color: '#0c5460', text: 'Buyer Assigned' };
      case 'listed':
        return { bg: '#d4edda', color: '#155724', text: 'Listed' };
      case 'sold':
        return { bg: '#c3e6cb', color: '#155724', text: 'Sold' };
      case 'cancelled':
        return { bg: '#f8d7da', color: '#721c24', text: 'Cancelled' };
      default:
        return { bg: '#f8f9fa', color: '#6c757d', text: status };
    }
  };

  const getFilteredContracts = () => {
    if (selectedFilter === 'recent') return recentContracts;
    if (selectedFilter === 'search') return searchResults;
    return recentContracts;
  };

  const ContractCard: React.FC<{ contract: ResaleEvent; isSearchResult?: boolean }> = ({ 
    contract, 
    isSearchResult = false 
  }) => {
    const statusStyle = getStatusColor(contract.status);
    
    return (
                      <div 
          className="contract-card"
          style={{
            background: '#fff',
            border: '1px solid #e9ecef',
            borderRadius: '12px',
            padding: '20px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onClick={() => onContractSelect(contract.resale_id)}
        >
        <div style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '16px'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '8px',
            overflow: 'hidden',
            flexShrink: 0
          }}>
            <img
              src={contract.passport?.metadata?.product_image 
                ? `http://localhost:4000${contract.passport.metadata.product_image}`
                : 'https://via.placeholder.com/60x60/f8f9fa/6c757d?text=No+Image'
              }
              alt={`${contract.passport?.metadata?.brand || 'Product'} ${contract.passport?.metadata?.object_name || ''}`}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = 'https://via.placeholder.com/60x60/f8f9fa/6c757d?text=No+Image';
              }}
            />
          </div>
          
          <div style={{ flex: 1 }}>
            <h4 style={{
              fontSize: '16px',
              fontWeight: '600',
              margin: '0 0 4px 0',
              color: '#212529'
            }}>
              {contract.passport?.metadata?.brand} {contract.passport?.metadata?.object_name}
            </h4>
            <p style={{
              fontSize: '14px',
              color: '#6c757d',
              margin: '0 0 4px 0'
            }}>
              {contract.passport?.metadata?.collection_year} Collection
            </p>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: '#495057'
            }}>
              <Hash size={12} />
              {contract.resale_id}
            </div>
          </div>
        </div>
        
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px'
        }}>
          <div style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#28a745'
          }}>
            {contract.asking_price.toLocaleString()} {contract.currency}
          </div>
          <div style={{
            padding: '4px 8px',
            background: statusStyle.bg,
            color: statusStyle.color,
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '500'
          }}>
            {statusStyle.text}
          </div>
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          fontSize: '12px',
          color: '#6c757d'
        }}>
          <div>
            <span style={{ fontWeight: '500' }}>Seller:</span> {contract.seller?.name}
          </div>
          <div>
            <span style={{ fontWeight: '500' }}>Buyer:</span> {contract.buyer?.name}
          </div>
          <div>
            <span style={{ fontWeight: '500' }}>Initiated:</span> {new Date(contract.initiated_at).toLocaleDateString()}
          </div>
          <div>
            <span style={{ fontWeight: '500' }}>Marketplace:</span> {contract.marketplace_id === 'internal' ? 'Internal' : 'External'}
          </div>
        </div>
        
        {isSearchResult && (
          <div style={{
            marginTop: '12px',
            padding: '8px 12px',
            background: '#e7f3ff',
            border: '1px solid #b3d9ff',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#0056b3',
            textAlign: 'center'
          }}>
            Click to view contract preview
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        textAlign: 'center',
        marginBottom: '40px'
      }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: '600',
          margin: '0 0 16px 0',
          color: '#212529'
        }}>
          Contract Preview
        </h1>
        <p style={{
          fontSize: '18px',
          color: '#6c757d',
          margin: 0
        }}>
          Select a resale contract to preview and manage
        </p>
      </div>

      {/* Search Section */}
      <div style={{
        background: '#fff',
        border: '1px solid #e9ecef',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '32px'
      }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: '600',
          margin: '0 0 20px 0',
          color: '#212529',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Search size={20} />
          Search Contracts
        </h2>
        
        <div style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '20px'
        }}>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              placeholder="Search by resale ID, brand, product name, seller, or buyer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                              style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #e9ecef',
                  borderRadius: '8px',
                  fontSize: '16px',
                  outline: 'none'
                }}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !searchTerm.trim()}
            style={{
              padding: '12px 24px',
              background: searching || !searchTerm.trim() ? '#e9ecef' : '#007bff',
              color: searching || !searchTerm.trim() ? '#6c757d' : 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: searching || !searchTerm.trim() ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {searching ? (
              <>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #fff',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                Searching...
              </>
            ) : (
              <>
                <Search size={16} />
                Search
              </>
            )}
          </button>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              margin: '0 0 16px 0',
              color: '#212529'
            }}>
              Search Results ({searchResults.length})
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
              gap: '20px'
            }}>
              {searchResults.map((contract) => (
                <ContractCard key={contract.id} contract={contract} isSearchResult={true} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent Contracts Section */}
      <div style={{
        background: '#fff',
        border: '1px solid #e9ecef',
        borderRadius: '12px',
        padding: '24px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '600',
            margin: 0,
            color: '#212529',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Clock size={20} />
            Recent Contracts
          </h2>
          
          {/* Filter Tabs */}
          <div style={{
            display: 'flex',
            gap: '8px'
          }}>
            {[
              { id: 'recent' as const, label: 'Recent', count: recentContracts.length },
              { id: 'search' as const, label: 'Search Results', count: searchResults.length }
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setSelectedFilter(filter.id)}
                style={{
                  padding: '8px 16px',
                  background: selectedFilter === filter.id ? '#007bff' : '#f8f9fa',
                  color: selectedFilter === filter.id ? 'white' : '#6c757d',
                  border: '1px solid #e9ecef',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {filter.label}
                <span style={{
                  background: selectedFilter === filter.id ? 'rgba(255,255,255,0.2)' : '#e9ecef',
                  color: selectedFilter === filter.id ? 'white' : '#6c757d',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  minWidth: '20px',
                  textAlign: 'center'
                }}>
                  {filter.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '200px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '2px solid #e9ecef',
                borderTopColor: '#343a40',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px'
              }} />
              <p style={{ color: '#6c757d' }}>Loading recent contracts...</p>
            </div>
          </div>
        ) : selectedFilter === 'search' && searching ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '200px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '2px solid #e9ecef',
                borderTopColor: '#343a40',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px'
              }} />
              <p style={{ color: '#6c757d' }}>Searching contracts...</p>
            </div>
          </div>
        ) : getFilteredContracts().length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '20px'
          }}>
            {getFilteredContracts().map((contract) => (
              <ContractCard key={contract.id} contract={contract} />
            ))}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#6c757d'
          }}>
            <Package size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <h3 style={{ marginBottom: '8px' }}>
              {selectedFilter === 'search' ? 'No search results' : 'No contracts found'}
            </h3>
            <p>
              {selectedFilter === 'search' 
                ? 'No contracts match your search criteria. Try a different search term.'
                : 'No contracts available at the moment.'
              }
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .contract-card:hover {
          border-color: #007bff !important;
          box-shadow: 0 4px 12px rgba(0, 123, 255, 0.15);
        }
        
        input:focus {
          border-color: #007bff !important;
        }
      `}</style>
    </div>
  );
};

// Deal Overview Tab Component
const DealOverviewTab: React.FC<{ resaleEvent: ResaleEvent }> = ({ resaleEvent }) => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
      {/* Item Information */}
      <div style={{
        background: '#fff',
        border: '1px solid #e9ecef',
        borderRadius: '12px',
        padding: '24px'
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '600',
          margin: '0 0 20px 0',
          color: '#212529',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Package size={20} />
          Item Details
        </h3>
        
        <div style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '20px'
        }}>
          <div style={{
            width: '120px',
            height: '120px',
            borderRadius: '12px',
            overflow: 'hidden',
            flexShrink: 0,
            border: '2px solid #e9ecef'
          }}>
            <img
              src={resaleEvent.passport?.metadata?.product_image 
                ? `http://localhost:4000${resaleEvent.passport.metadata.product_image}`
                : 'https://via.placeholder.com/120x120/f8f9fa/6c757d?text=No+Image'
              }
              alt={`${resaleEvent.passport?.metadata?.brand || 'Product'} ${resaleEvent.passport?.metadata?.object_name || ''}`}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = 'https://via.placeholder.com/120x120/f8f9fa/6c757d?text=No+Image';
              }}
            />
          </div>
          
          <div style={{ flex: 1 }}>
            <h4 style={{
              fontSize: '16px',
              fontWeight: '600',
              margin: '0 0 4px 0',
              color: '#212529'
            }}>
              {resaleEvent.passport?.metadata?.brand} {resaleEvent.passport?.metadata?.object_name}
            </h4>
            <p style={{
              fontSize: '14px',
              color: '#6c757d',
              margin: '0 0 4px 0'
            }}>
              Collection: {resaleEvent.passport?.metadata?.collection_year}
            </p>
            <p style={{
              fontSize: '14px',
              color: '#6c757d',
              margin: '0 0 4px 0'
            }}>
              Original Price: {resaleEvent.passport?.metadata?.original_price} {resaleEvent.currency}
            </p>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: '#495057',
              background: '#f8f9fa',
              padding: '4px 8px',
              borderRadius: '4px',
              width: 'fit-content'
            }}>
              <Hash size={12} />
              Passport ID: {resaleEvent.passport_id}
            </div>
          </div>
        </div>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          color: '#6c757d'
        }}>
          <Database size={16} />
          NFC UID: {resaleEvent.passport?.nfc_uid}
        </div>
      </div>

      {/* Transaction Details */}
      <div style={{
        background: '#fff',
        border: '1px solid #e9ecef',
        borderRadius: '12px',
        padding: '24px'
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '600',
          margin: '0 0 20px 0',
          color: '#212529',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <DollarSign size={20} />
          Transaction Details
        </h3>
        
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '14px', color: '#6c757d' }}>Resale Amount:</span>
            <span style={{ fontSize: '18px', fontWeight: '600', color: '#212529' }}>
              {resaleEvent.asking_price.toLocaleString()} {resaleEvent.currency}
            </span>
          </div>
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '14px', color: '#6c757d' }}>Channel:</span>
            <span style={{ fontSize: '14px', color: '#212529' }}>
              {resaleEvent.marketplace_id === 'internal' ? 'Internal' : 'External Marketplace'}
            </span>
          </div>
          
          {resaleEvent.external_listing_ref && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px'
            }}>
              <span style={{ fontSize: '14px', color: '#6c757d' }}>Reference:</span>
              <span style={{ fontSize: '14px', color: '#212529' }}>
                {resaleEvent.external_listing_ref}
              </span>
            </div>
          )}
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '14px', color: '#6c757d' }}>Initiated:</span>
            <span style={{ fontSize: '14px', color: '#212529' }}>
              {new Date(resaleEvent.initiated_at).toLocaleDateString()}
            </span>
          </div>
          
          {resaleEvent.buyer_assigned_at && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '14px', color: '#6c757d' }}>Buyer Assigned:</span>
              <span style={{ fontSize: '14px', color: '#212529' }}>
                {new Date(resaleEvent.buyer_assigned_at).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Seller Information */}
      <div style={{
        background: '#fff',
        border: '1px solid #e9ecef',
        borderRadius: '12px',
        padding: '24px'
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '600',
          margin: '0 0 20px 0',
          color: '#212529',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <User size={20} />
          Previous Owner (Seller)
        </h3>
        
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{
            fontSize: '16px',
            fontWeight: '600',
            margin: '0 0 8px 0',
            color: '#212529'
          }}>
            {resaleEvent.seller?.name}
          </h4>
          <p style={{
            fontSize: '14px',
            color: '#6c757d',
            margin: '0 0 8px 0'
          }}>
            Client ID: {resaleEvent.seller_id}
          </p>
          {resaleEvent.seller?.email && (
            <p style={{
              fontSize: '14px',
              color: '#6c757d',
              margin: '0 0 8px 0'
            }}>
              {resaleEvent.seller.email}
            </p>
          )}
        </div>
        
        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            background: resaleEvent.seller?.kyc_status === 'verified' ? '#d4edda' : '#f8d7da',
            color: resaleEvent.seller?.kyc_status === 'verified' ? '#155724' : '#721c24',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '500'
          }}>
            <UserCheck size={12} />
            KYC: {resaleEvent.seller?.kyc_status?.toUpperCase() || 'PENDING'}
          </div>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            background: resaleEvent.seller?.vault_status === 'active' ? '#d4edda' : '#f8d7da',
            color: resaleEvent.seller?.vault_status === 'active' ? '#155724' : '#721c24',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '500'
          }}>
            <Shield size={12} />
            Vault: {resaleEvent.seller?.vault_status?.toUpperCase() || 'INACTIVE'}
          </div>
        </div>
      </div>

      {/* Buyer Information */}
      <div style={{
        background: '#fff',
        border: '1px solid #e9ecef',
        borderRadius: '12px',
        padding: '24px'
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '600',
          margin: '0 0 20px 0',
          color: '#212529',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <UserPlus size={20} />
          Buyer (2B)
        </h3>
        
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{
            fontSize: '16px',
            fontWeight: '600',
            margin: '0 0 8px 0',
            color: '#212529'
          }}>
            {resaleEvent.buyer?.name}
          </h4>
          <p style={{
            fontSize: '14px',
            color: '#6c757d',
            margin: '0 0 8px 0'
          }}>
            Client ID: {resaleEvent.buyer_id}
          </p>
          {resaleEvent.buyer?.email && (
            <p style={{
              fontSize: '14px',
              color: '#6c757d',
              margin: '0 0 8px 0'
            }}>
              {resaleEvent.buyer.email}
            </p>
          )}
        </div>
        
        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            background: resaleEvent.buyer?.kyc_status === 'verified' ? '#d4edda' : '#f8d7da',
            color: resaleEvent.buyer?.kyc_status === 'verified' ? '#155724' : '#721c24',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '500'
          }}>
            <UserCheck size={12} />
            KYC: {resaleEvent.buyer?.kyc_status?.toUpperCase() || 'PENDING'}
          </div>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            background: resaleEvent.buyer?.vault_status === 'active' ? '#d4edda' : '#f8d7da',
            color: resaleEvent.buyer?.vault_status === 'active' ? '#155724' : '#721c24',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '500'
          }}>
            <Shield size={12} />
            Vault: {resaleEvent.buyer?.vault_status?.toUpperCase() || 'INACTIVE'}
          </div>
        </div>
      </div>
    </div>
  );
};

// Financial Breakdown Tab Component
const FinancialBreakdownTab: React.FC<{ 
  financialBreakdown: FinancialBreakdown | null;
  resaleEvent: ResaleEvent;
  feeOverrides: {
    auctaFeePercentage: number;
    marketplaceFeePercentage: number;
    fbRoyaltyPercentage: number;
    cashbackPercentage: number;
  };
  onFeeUpdate: (field: 'auctaFeePercentage' | 'marketplaceFeePercentage' | 'fbRoyaltyPercentage' | 'cashbackPercentage', value: number) => void;
}> = ({ financialBreakdown, resaleEvent, feeOverrides, onFeeUpdate }) => {
  if (!financialBreakdown) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '200px',
        color: '#6c757d'
      }}>
        <Info size={24} style={{ marginRight: '8px' }} />
        Financial breakdown not available
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
      {/* Fee Override Controls */}
      <div style={{
        background: '#fff',
        border: '1px solid #e9ecef',
        borderRadius: '12px',
        padding: '24px',
        gridColumn: '1 / -1',
        marginBottom: '16px'
      }}>
        <h4 style={{
          fontSize: '16px',
          fontWeight: '600',
          margin: '0 0 16px 0',
          color: '#212529'
        }}>
          Fee Configuration (Editable)
        </h4>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px'
        }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              color: '#6c757d',
              marginBottom: '4px'
            }}>
              AUCTA Fee (%)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={feeOverrides.auctaFeePercentage}
              onChange={(e) => onFeeUpdate('auctaFeePercentage', parseFloat(e.target.value) || 0)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ced4da',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              color: '#6c757d',
              marginBottom: '4px'
            }}>
              Marketplace Fee (%)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={feeOverrides.marketplaceFeePercentage}
              onChange={(e) => onFeeUpdate('marketplaceFeePercentage', parseFloat(e.target.value) || 0)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ced4da',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              color: '#6c757d',
              marginBottom: '4px'
            }}>
              FB Royalties (%)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={feeOverrides.fbRoyaltyPercentage}
              onChange={(e) => onFeeUpdate('fbRoyaltyPercentage', parseFloat(e.target.value) || 0)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ced4da',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              color: '#6c757d',
              marginBottom: '4px'
            }}>
              2B Cashback (%)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={feeOverrides.cashbackPercentage}
              onChange={(e) => onFeeUpdate('cashbackPercentage', parseFloat(e.target.value) || 0)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ced4da',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>
        </div>
      </div>

      {/* Resale Amount */}
      <div style={{
        background: '#fff',
        border: '1px solid #e9ecef',
        borderRadius: '12px',
        padding: '24px',
        gridColumn: '1 / -1'
      }}>
        <h3 style={{
          fontSize: '20px',
          fontWeight: '600',
          margin: '0 0 16px 0',
          color: '#212529',
          textAlign: 'center'
        }}>
          Total Resale Amount
        </h3>
        <div style={{
          fontSize: '32px',
          fontWeight: '700',
          color: '#28a745',
          textAlign: 'center',
          marginBottom: '16px'
        }}>
          {financialBreakdown.resale_amount.toLocaleString()} {resaleEvent.currency}
        </div>
        
        {financialBreakdown.appreciation_amount > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '14px',
            color: '#28a745'
          }}>
            <TrendingUp size={16} />
            +{financialBreakdown.appreciation_percentage.toFixed(1)}% appreciation
            ({financialBreakdown.appreciation_amount.toLocaleString()} {resaleEvent.currency})
          </div>
        )}
      </div>

      {/* Commission Breakdown */}
      <div style={{
        background: '#fff',
        border: '1px solid #e9ecef',
        borderRadius: '12px',
        padding: '24px'
      }}>
        <h4 style={{
          fontSize: '16px',
          fontWeight: '600',
          margin: '0 0 16px 0',
          color: '#212529'
        }}>
          Commissions & Fees
        </h4>
        
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '14px', color: '#6c757d' }}>AUCTA Fee ({feeOverrides.auctaFeePercentage}%):</span>
            <span style={{ fontSize: '14px', color: '#212529', fontWeight: '500' }}>
              -{financialBreakdown.aucta_fee.toLocaleString()} {resaleEvent.currency}
            </span>
          </div>
          
          {financialBreakdown.marketplace_fee > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px'
            }}>
              <span style={{ fontSize: '14px', color: '#6c757d' }}>Marketplace Fee ({feeOverrides.marketplaceFeePercentage}%):</span>
              <span style={{ fontSize: '14px', color: '#212529', fontWeight: '500' }}>
                -{financialBreakdown.marketplace_fee.toLocaleString()} {resaleEvent.currency}
              </span>
            </div>
          )}
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '8px',
            borderTop: '1px solid #e9ecef',
            fontWeight: '600'
          }}>
            <span style={{ fontSize: '14px', color: '#6c757d' }}>Total Fees:</span>
            <span style={{ fontSize: '14px', color: '#dc3545', fontWeight: '600' }}>
              -{(financialBreakdown.aucta_fee + financialBreakdown.marketplace_fee).toLocaleString()} {resaleEvent.currency}
            </span>
          </div>
        </div>
      </div>

      {/* Royalty Breakdown */}
      <div style={{
        background: '#fff',
        border: '1px solid #e9ecef',
        borderRadius: '12px',
        padding: '24px'
      }}>
        <h4 style={{
          fontSize: '16px',
          fontWeight: '600',
          margin: '0 0 16px 0',
          color: '#212529'
        }}>
          Royalties & Cashback
        </h4>
        
        <div style={{ marginBottom: '16px' }}>

          
          {financialBreakdown.cashback_amount > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px'
            }}>
              <span style={{ fontSize: '14px', color: '#6c757d' }}>Cashback (2B) ({feeOverrides.cashbackPercentage}%):</span>
              <span style={{ fontSize: '14px', color: '#28a745', fontWeight: '500' }}>
                +{financialBreakdown.cashback_amount.toLocaleString()} {resaleEvent.currency}
              </span>
            </div>
          )}
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '8px',
            borderTop: '1px solid #e9ecef',
            fontWeight: '600'
          }}>
            <span style={{ fontSize: '14px', color: '#6c757d' }}>Net Royalty:</span>
            <span style={{ 
              fontSize: '14px', 
              color: '#28a745',
              fontWeight: '600'
            }}>
              +{financialBreakdown.cashback_amount.toLocaleString()} {resaleEvent.currency}
            </span>
          </div>
        </div>
      </div>

      {/* Net to Seller */}
      <div style={{
        background: '#fff',
        border: '1px solid #e9ecef',
        borderRadius: '12px',
        padding: '24px',
        gridColumn: '1 / -1'
      }}>
        <h4 style={{
          fontSize: '18px',
          fontWeight: '600',
          margin: '0 0 16px 0',
          color: '#212529',
          textAlign: 'center'
        }}>
          Net Amount to Seller
        </h4>
        <div style={{
          fontSize: '24px',
          fontWeight: '700',
          color: '#212529',
          textAlign: 'center',
          marginBottom: '16px'
        }}>
          {financialBreakdown.net_to_seller.toLocaleString()} {resaleEvent.currency}
        </div>
        
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '14px',
          color: '#6c757d',
          maxWidth: '400px',
          margin: '0 auto'
        }}>
          <span>Resale Amount:</span>
          <span>{financialBreakdown.resale_amount.toLocaleString()} {resaleEvent.currency}</span>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '14px',
          color: '#6c757d',
          maxWidth: '400px',
          margin: '0 auto'
        }}>
          <span>Total Deductions:</span>
          <span style={{ color: '#dc3545' }}>
            -{(financialBreakdown.resale_amount - financialBreakdown.net_to_seller).toLocaleString()} {resaleEvent.currency}
          </span>
        </div>
      </div>
    </div>
  );
};

// Smart Contract Tab Component
const SmartContractTab: React.FC<{ 
  smartContractData: SmartContractData | null;
  resaleEvent: ResaleEvent;
}> = ({ smartContractData, resaleEvent }) => {
  if (!smartContractData) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '200px',
        color: '#6c757d'
      }}>
        <Info size={24} style={{ marginRight: '8px' }} />
        Smart contract data not available
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
      {/* Smart Contract Fields */}
      <div style={{
        background: '#fff',
        border: '1px solid #e9ecef',
        borderRadius: '12px',
        padding: '24px'
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '600',
          margin: '0 0 20px 0',
          color: '#212529',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Database size={20} />
          On-Chain Fields
        </h3>
        
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '14px', color: '#6c757d' }}>Passport ID:</span>
            <span style={{ fontSize: '14px', color: '#212529', fontWeight: '500' }}>
              {smartContractData.passport_id}
            </span>
          </div>
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '14px', color: '#6c757d' }}>Seller Address:</span>
            <span style={{ 
              fontSize: '12px', 
              color: '#212529', 
              fontWeight: '500',
              fontFamily: 'monospace',
              maxWidth: '200px',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {smartContractData.seller_address}
            </span>
          </div>
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '14px', color: '#6c757d' }}>Buyer Address:</span>
            <span style={{ 
              fontSize: '12px', 
              color: '#212529', 
              fontWeight: '500',
              fontFamily: 'monospace',
              maxWidth: '200px',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {smartContractData.buyer_address}
            </span>
          </div>
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '14px', color: '#6c757d' }}>Sale Price:</span>
            <span style={{ fontSize: '14px', color: '#212529', fontWeight: '500' }}>
              {smartContractData.sale_price.toLocaleString()} {smartContractData.currency}
            </span>
          </div>
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '14px', color: '#6c757d' }}>Royalty Model:</span>
            <span style={{ fontSize: '14px', color: '#212529', fontWeight: '500' }}>
              {smartContractData.royalty_model}
            </span>
          </div>
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '14px', color: '#6c757d' }}>Timestamp:</span>
            <span style={{ fontSize: '14px', color: '#212529', fontWeight: '500' }}>
              {new Date(smartContractData.timestamp).toLocaleString()}
            </span>
          </div>
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '14px', color: '#6c757d' }}>Contract Hash:</span>
            <span style={{ 
              fontSize: '12px', 
              color: '#212529', 
              fontWeight: '500',
              fontFamily: 'monospace',
              maxWidth: '200px',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {smartContractData.contract_hash}
            </span>
          </div>
        </div>
      </div>

      {/* Split Configuration */}
      <div style={{
        background: '#fff',
        border: '1px solid #e9ecef',
        borderRadius: '12px',
        padding: '24px'
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '600',
          margin: '0 0 20px 0',
          color: '#212529',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Calculator size={20} />
          Split Configuration
        </h3>
        
        <div style={{
          background: '#f8f9fa',
          border: '1px solid #e9ecef',
          borderRadius: '8px',
          padding: '16px',
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#495057',
          maxHeight: '300px',
          overflow: 'auto'
        }}>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
            {smartContractData.split_json}
          </pre>
        </div>
      </div>

      {/* Legal Contract Text */}
      <div style={{
        background: '#fff',
        border: '1px solid #e9ecef',
        borderRadius: '12px',
        padding: '24px',
        gridColumn: '1 / -1'
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '600',
          margin: '0 0 20px 0',
          color: '#212529',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <FileText size={20} />
          Legal Contract Text
        </h3>
        
        <div style={{
          background: '#f8f9fa',
          border: '1px solid #e9ecef',
          borderRadius: '8px',
          padding: '20px',
          fontSize: '14px',
          lineHeight: '1.6',
          color: '#495057'
        }}>
          <p style={{ margin: '0 0 16px 0' }}>
            <strong>RESALE AGREEMENT</strong>
          </p>
          
          <p style={{ margin: '0 0 16px 0' }}>
            This agreement is entered into on {new Date(smartContractData.timestamp).toLocaleDateString()} between:
          </p>
          
          <p style={{ margin: '0 0 16px 0' }}>
            <strong>SELLER:</strong> {resaleEvent.seller?.name} (Client ID: {resaleEvent.seller_id})<br/>
            <strong>BUYER:</strong> {resaleEvent.buyer?.name} (Client ID: {resaleEvent.buyer_id})
          </p>
          
          <p style={{ margin: '0 0 16px 0' }}>
            <strong>ITEM:</strong> {resaleEvent.passport?.metadata?.brand} {resaleEvent.passport?.metadata?.object_name} 
            (Passport ID: {smartContractData.passport_id})
          </p>
          
          <p style={{ margin: '0 0 16px 0' }}>
            <strong>RESALE PRICE:</strong> {smartContractData.sale_price.toLocaleString()} {smartContractData.currency}
          </p>
          
          <p style={{ margin: '0 0 16px 0' }}>
            <strong>TERMS:</strong> The seller hereby transfers ownership of the above-described item to the buyer 
            for the agreed resale price. This transaction is governed by AUCTA's smart contract system and 
            includes all applicable royalties, fees, and cashback mechanisms as configured in the split configuration above.
          </p>
          
          <p style={{ margin: '0 0 16px 0' }}>
            <strong>BLOCKCHAIN RECORD:</strong> This agreement will be permanently recorded on the blockchain 
            with contract hash {smartContractData.contract_hash} and timestamp {new Date(smartContractData.timestamp).toISOString()}.
          </p>
          
          <p style={{ margin: '0 0 16px 0' }}>
            <strong>PASSPORT LINK:</strong> Post-mint, this item will be accessible via the updated Passport record 
            at the same Passport ID, reflecting the new ownership and transaction history.
          </p>
        </div>
      </div>
    </div>
  );
};

// Resale Report Tab Component
const ResaleReportTab: React.FC<{
  resaleEvent: ResaleEvent;
  financialBreakdown: FinancialBreakdown | null;
  onDownload: () => void;
  onSendSecure: () => void;
}> = ({ resaleEvent, financialBreakdown, onDownload, onSendSecure }) => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
      {/* Report Summary */}
      <div style={{
        background: '#fff',
        border: '1px solid #e9ecef',
        borderRadius: '12px',
        padding: '24px',
        gridColumn: '1 / -1'
      }}>
        <h3 style={{
          fontSize: '20px',
          fontWeight: '600',
          margin: '0 0 16px 0',
          color: '#212529',
          textAlign: 'center'
        }}>
          Resale Report Summary
        </h3>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#28a745' }}>
              {resaleEvent.asking_price.toLocaleString()}
            </div>
            <div style={{ fontSize: '14px', color: '#6c757d' }}>Resale Amount ({resaleEvent.currency})</div>
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#007bff' }}>
              {resaleEvent.passport_id}
            </div>
            <div style={{ fontSize: '14px', color: '#6c757d' }}>Passport ID</div>
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#6f42c1' }}>
              {resaleEvent.seller?.name}
            </div>
            <div style={{ fontSize: '14px', color: '#6c757d' }}>Seller</div>
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#fd7e14' }}>
              {resaleEvent.buyer?.name}
            </div>
            <div style={{ fontSize: '14px', color: '#6c757d' }}>Buyer</div>
          </div>
        </div>
        
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '16px'
        }}>
          <button
            onClick={onDownload}
            style={{
              padding: '12px 24px',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            <Download size={16} />
            Download PDF Report
          </button>
          
          <button
            onClick={onSendSecure}
            style={{
              padding: '12px 24px',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            <Mail size={16} />
            Send Secure Report
          </button>
        </div>
      </div>

      {/* Report Details */}
      <div style={{
        background: '#fff',
        border: '1px solid #e9ecef',
        borderRadius: '12px',
        padding: '24px'
      }}>
        <h4 style={{
          fontSize: '16px',
          fontWeight: '600',
          margin: '0 0 16px 0',
          color: '#212529'
        }}>
          Report Contents
        </h4>
        
        <ul style={{
          margin: 0,
          paddingLeft: '20px',
          color: '#495057',
          lineHeight: '1.6'
        }}>
          <li>Complete transaction details</li>
          <li>Financial breakdown and fees</li>
          <li>Smart contract information</li>
          <li>Legal agreement text</li>
          <li>Passport and ownership details</li>
          <li>Valuation and appreciation data</li>
          <li>Royalty and cashback calculations</li>
          <li>Blockchain transaction records</li>
        </ul>
      </div>

      {/* Report Features */}
      <div style={{
        background: '#fff',
        border: '1px solid #e9ecef',
        borderRadius: '12px',
        padding: '24px'
      }}>
        <h4 style={{
          fontSize: '16px',
          fontWeight: '600',
          margin: '0 0 16px 0',
          color: '#212529'
        }}>
          Report Features
        </h4>
        
        <div style={{ color: '#495057', lineHeight: '1.6' }}>
          <div style={{ marginBottom: '12px' }}>
            <strong>PDF Format:</strong> Professional, printable document
          </div>
          <div style={{ marginBottom: '12px' }}>
            <strong>Secure Sharing:</strong> Encrypted delivery via secure channels
          </div>
          <div style={{ marginBottom: '12px' }}>
            <strong>Audit Trail:</strong> Complete transaction history
          </div>
          <div style={{ marginBottom: '12px' }}>
            <strong>Compliance:</strong> Meets regulatory requirements
          </div>
        </div>
      </div>
    </div>
  );
};

// Admin Approval Section Component
const AdminApprovalSection: React.FC<{
  sellerSigned: boolean;
  buyerSigned: boolean;
  contractApproved: boolean;
  approving: boolean;
  onSignatureToggle: (type: 'seller' | 'buyer') => void;
  onContractApproval: () => void;
  onProceedToFinalize: () => void;
  resaleEvent: ResaleEvent;
}> = ({
  sellerSigned,
  buyerSigned,
  contractApproved,
  approving,
  onSignatureToggle,
  onContractApproval,
  onProceedToFinalize,
  resaleEvent
}) => {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e9ecef',
      borderRadius: '12px',
      padding: '24px',
      marginTop: '32px'
    }}>
      <h3 style={{
        fontSize: '20px',
        fontWeight: '600',
        margin: '0 0 20px 0',
        color: '#212529',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <FileSignature size={20} />
        Admin Approval & Contract Finalization
      </h3>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px',
        marginBottom: '24px'
      }}>
        {/* Signature Status */}
        <div>
          <h4 style={{
            fontSize: '16px',
            fontWeight: '600',
            margin: '0 0 16px 0',
            color: '#212529'
          }}>
            Digital Signature Status
          </h4>
          
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px'
            }}>
              <span style={{ fontSize: '14px', color: '#6c757d' }}>
                Seller: {resaleEvent.seller?.name}
              </span>
              <button
                onClick={() => onSignatureToggle('seller')}
                style={{
                  padding: '6px 12px',
                  background: sellerSigned ? '#d4edda' : '#f8f9fa',
                  color: sellerSigned ? '#155724' : '#6c757d',
                  border: `1px solid ${sellerSigned ? '#c3e6cb' : '#e9ecef'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {sellerSigned ? <CheckSquare size={12} /> : <Square size={12} />}
                {sellerSigned ? 'Signed' : 'Mark as Signed'}
              </button>
            </div>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: '14px', color: '#6c757d' }}>
                Buyer: {resaleEvent.buyer?.name}
              </span>
              <button
                onClick={() => onSignatureToggle('buyer')}
                style={{
                  padding: '6px 12px',
                  background: buyerSigned ? '#d4edda' : '#f8f9fa',
                  color: buyerSigned ? '#155724' : '#6c757d',
                  border: `1px solid ${buyerSigned ? '#c3e6cb' : '#e9ecef'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {buyerSigned ? <CheckSquare size={12} /> : <Square size={12} />}
                {buyerSigned ? 'Signed' : 'Mark as Signed'}
              </button>
            </div>
          </div>
        </div>
        
        {/* Contract Status */}
        <div>
          <h4 style={{
            fontSize: '16px',
            fontWeight: '600',
            margin: '0 0 16px 0',
            color: '#212529'
          }}>
            Contract Status
          </h4>
          
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px'
            }}>
              {contractApproved ? (
                <CheckCircle size={20} style={{ color: '#28a745' }} />
              ) : (
                <Clock size={20} style={{ color: '#ffc107' }} />
              )}
              <span style={{
                fontSize: '14px',
                color: contractApproved ? '#28a745' : '#ffc107',
                fontWeight: '500'
              }}>
                {contractApproved ? 'Contract Approved' : 'Pending Approval'}
              </span>
            </div>
            
            {!contractApproved && (
              <button
                onClick={onContractApproval}
                disabled={!sellerSigned || !buyerSigned || approving}
                style={{
                  padding: '8px 16px',
                  background: (!sellerSigned || !buyerSigned) ? '#e9ecef' : '#28a745',
                  color: (!sellerSigned || !buyerSigned) ? '#6c757d' : 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: (!sellerSigned || !buyerSigned || approving) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {approving ? (
                  <>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid #fff',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    Approve Contract
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Finalization */}
      {contractApproved && (
        <div style={{
          padding: '20px',
          background: '#d4edda',
          border: '1px solid #c3e6cb',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <h4 style={{
            fontSize: '18px',
            fontWeight: '600',
            margin: '0 0 12px 0',
            color: '#155724'
          }}>
            Contract Ready for Finalization
          </h4>
          <p style={{
            fontSize: '14px',
            color: '#155724',
            margin: '0 0 16px 0'
          }}>
            All approvals are complete. You can now proceed to finalize the resale contract.
          </p>
          <button
            onClick={onProceedToFinalize}
            style={{
              padding: '12px 24px',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              margin: '0 auto'
            }}
          >
            <ArrowRight size={16} />
            Proceed to Finalize
          </button>
        </div>
      )}
    </div>
  );
};

const ContractPreviewPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resaleId = searchParams.get('resale_id');
  
  // State management
  const [resaleEvent, setResaleEvent] = useState<ResaleEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [financialBreakdown, setFinancialBreakdown] = useState<FinancialBreakdown | null>(null);
  const [smartContractData, setSmartContractData] = useState<SmartContractData | null>(null);
  
  // Admin approval state
  const [sellerSigned, setSellerSigned] = useState(false);
  const [buyerSigned, setBuyerSigned] = useState(false);
  const [contractApproved, setContractApproved] = useState(false);
  const [approving, setApproving] = useState(false);
  
  // UI state
  const [activeTab, setActiveTab] = useState<'overview' | 'financial' | 'contract' | 'report'>('overview');
  
  // Fee override state
  const [feeOverrides, setFeeOverrides] = useState({
    auctaFeePercentage: 6.0,
    marketplaceFeePercentage: 2.0,
    fbRoyaltyPercentage: 1.80,
    cashbackPercentage: 0.80
  });

  useEffect(() => {
    if (resaleId) {
      loadResaleEvent();
    }
  }, [resaleId]);

  const handleContractSelect = (selectedResaleId: string) => {
    router.push(`/resale/contract-preview?resale_id=${selectedResaleId}`);
  };

  const loadResaleEvent = async () => {
    if (!resaleId) return;
    
    try {
      setLoading(true);
      setError('');
      
      const response = await api.getContract(resaleId);
      if (response.success) {
        const contractData = response.contract;
        
        // Transform the API response to match our ResaleEvent interface
        const transformedData: ResaleEvent = {
          id: contractData.id.toString(),
          resale_id: contractData.resale_id,
          passport_id: contractData.passport_id,
          seller_id: contractData.seller_id,
          buyer_id: contractData.buyer_id || 0,
          asking_price: contractData.asking_price,
          currency: contractData.currency,
          status: contractData.status,
          marketplace_id: contractData.marketplace_id,
          external_listing_ref: contractData.external_listing_ref,
          initiated_at: contractData.initiated_at,
          passport: {
            id: contractData.passport.id,
            nfc_uid: contractData.passport.nfc_uid,
            status: contractData.passport.status,
            metadata: contractData.passport.metadata || {}
          },
          seller: {
            id: contractData.seller.id,
            name: contractData.seller.name,
            email: contractData.seller.email,
            kyc_status: 'verified',
            vault_status: 'active'
          },
          buyer: contractData.buyer ? {
            id: contractData.buyer.id,
            name: contractData.buyer.name,
            email: contractData.buyer.email,
            kyc_status: 'verified',
            vault_status: 'active'
          } : undefined,
          resale_config: contractData.resale_config ? {
            resale_type: contractData.resale_config.resale_type,
            royalties_enabled: contractData.resale_config.royalties_enabled,
            cashback_enabled: contractData.resale_config.cashback_enabled,
            brand_participation: contractData.resale_config.brand_participation,
            brand_revenue_share: contractData.resale_config.brand_revenue_share || 0,
            ownership_depth: 1,
            royalty_tiers: {},
            cashback_tiers: {}
          } : undefined,
          valuation: contractData.valuation ? {
            id: 1,
            valuation_amount: contractData.valuation.amount,
            currency: contractData.valuation.currency,
            valuation_date: contractData.valuation.date,
            valuation_source: 'AUCTA Valuation Engine',
            appreciation_percentage: 0
          } : undefined
        };
        
        setResaleEvent(transformedData);
        calculateFinancialBreakdown(transformedData, feeOverrides);
        generateSmartContractData(transformedData);
      } else {
        setError('Failed to load contract data');
        console.error('API error:', response.error);
      }
    } catch (error) {
      setError('Failed to load resale event');
      console.error('Error loading resale event:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateFinancialBreakdown = (resale: ResaleEvent, overrides?: {
    auctaFeePercentage?: number;
    marketplaceFeePercentage?: number;
    fbRoyaltyPercentage?: number;
    cashbackPercentage?: number;
  }) => {
    const resaleAmount = resale.asking_price;
    
    // Use overrides or default values
    const auctaFeePercentage = overrides?.auctaFeePercentage ?? 6.0; // Default 6%
    const marketplaceFeePercentage = overrides?.marketplaceFeePercentage ?? 2.0; // Default 2%
    const fbRoyaltyPercentage = overrides?.fbRoyaltyPercentage ?? 1.80; // Default 1.80%
    const cashbackPercentage = overrides?.cashbackPercentage ?? 0.80; // Default 0.80%
    
    const auctaFee = resaleAmount * (auctaFeePercentage / 100);
    const marketplaceFee = resaleAmount * (marketplaceFeePercentage / 100);
    const cashbackAmount = resale.resale_config?.cashback_enabled ? (resaleAmount * (cashbackPercentage / 100)) : 0;
    
    const netToSeller = resaleAmount - auctaFee - marketplaceFee;
    const appreciationAmount = resaleAmount - (resale.valuation?.valuation_amount || 0);
    const appreciationPercentage = resale.valuation?.appreciation_percentage || 0;

    setFinancialBreakdown({
      resale_amount: resaleAmount,
      aucta_fee: auctaFee,
      marketplace_fee: marketplaceFee,
      cashback_amount: cashbackAmount,
      net_to_seller: netToSeller,
      appreciation_amount: appreciationAmount,
      appreciation_percentage: appreciationPercentage,
      // Editable percentages
      aucta_fee_percentage: auctaFeePercentage,
      marketplace_fee_percentage: marketplaceFeePercentage,
      fb_royalty_percentage: fbRoyaltyPercentage,
      cashback_percentage: cashbackPercentage
    });
  };

  const handleFeeUpdate = (field: keyof typeof feeOverrides, value: number) => {
    const newOverrides = { ...feeOverrides, [field]: value };
    setFeeOverrides(newOverrides);
    
    // Recalculate financial breakdown with new fees
    if (resaleEvent) {
      calculateFinancialBreakdown(resaleEvent, newOverrides);
    }
  };

  const generateSmartContractData = (resale: ResaleEvent) => {
    const contractData: SmartContractData = {
      passport_id: resale.passport_id,
      seller_address: `0x${resale.seller_id.toString().padStart(40, '0')}`,
      buyer_address: `0x${resale.buyer_id.toString().padStart(40, '0')}`,
      sale_price: resale.asking_price,
      currency: resale.currency,
      royalty_model: resale.resale_config?.royalties_enabled ? 'dynamic_tiered' : 'none',
      split_json: JSON.stringify({
        aucta_fee: feeOverrides.auctaFeePercentage,
        marketplace_fee: feeOverrides.marketplaceFeePercentage,
        brand_royalty: resale.resale_config?.brand_revenue_share || 0,
        cashback: feeOverrides.cashbackPercentage,
        ownership_depth: resale.resale_config?.ownership_depth || 1
      }, null, 2),
      timestamp: new Date().toISOString(),
      contract_hash: `0x${crypto.randomUUID().replace(/-/g, '').substring(0, 40)}`
    };
    
    setSmartContractData(contractData);
  };

  const handleSignatureToggle = (type: 'seller' | 'buyer') => {
    if (type === 'seller') {
      setSellerSigned(!sellerSigned);
    } else {
      setBuyerSigned(!buyerSigned);
    }
  };

  const handleContractApproval = async () => {
    if (!sellerSigned || !buyerSigned) {
      setError('Both signatures must be confirmed before approval');
      return;
    }

    try {
      setApproving(true);
      // TODO: API call to approve contract
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
      
      setContractApproved(true);
      setError('');
    } catch (error) {
      setError('Failed to approve contract');
    } finally {
      setApproving(false);
    }
  };

  const handleProceedToFinalize = () => {
    if (!contractApproved) {
      setError('Contract must be approved before proceeding');
      return;
    }
    
    router.push(`/resale/finalize?resale_id=${resaleId}`);
  };

  const downloadResaleReport = () => {
    if (!resaleEvent || !financialBreakdown) {
      console.error('No resale event or financial breakdown available');
      return;
    }

    try {
      // Import jsPDF dynamically to avoid SSR issues
      import('jspdf').then(({ default: jsPDF }) => {
        const doc = new jsPDF();
        
        // Set document properties
        doc.setProperties({
          title: `Resale Report - ${resaleEvent.resale_id}`,
          subject: 'Contract Financial Breakdown',
          author: 'AUCTA Platform',
          creator: 'AUCTA Resale System'
        });

        // Add header
        doc.setFontSize(20);
        doc.setTextColor(0, 123, 255);
        doc.text('AUCTA Resale Report', 105, 20, { align: 'center' });
        
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`Contract ID: ${resaleEvent.resale_id}`, 20, 35);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 45);

        // Product Information
        doc.setFontSize(16);
        doc.setTextColor(0);
        doc.text('Product Details', 20, 65);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        if (resaleEvent.passport?.metadata) {
          const metadata = resaleEvent.passport.metadata;
          doc.text(`Brand: ${metadata.brand || 'N/A'}`, 20, 80);
          doc.text(`Product: ${metadata.object_name || 'N/A'}`, 20, 90);
          doc.text(`Collection Year: ${metadata.collection_year || 'N/A'}`, 20, 100);
        }

        // Financial Summary
        doc.setFontSize(16);
        doc.setTextColor(0);
        doc.text('Financial Summary', 20, 125);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Resale Amount: ${resaleEvent.currency} ${financialBreakdown.resale_amount.toLocaleString()}`, 20, 140);
        doc.text(`AUCTA Fee (${financialBreakdown.aucta_fee_percentage}%): ${resaleEvent.currency} ${financialBreakdown.aucta_fee.toLocaleString()}`, 20, 150);
        doc.text(`Marketplace Fee (${financialBreakdown.marketplace_fee_percentage}%): ${resaleEvent.currency} ${financialBreakdown.marketplace_fee.toLocaleString()}`, 20, 160);
        

        
        if (financialBreakdown.cashback_amount > 0) {
          doc.text(`Cashback (${financialBreakdown.cashback_percentage}%): ${resaleEvent.currency} ${financialBreakdown.cashback_amount.toLocaleString()}`, 20, 180);
        }
        
        doc.text(`Net to Seller: ${resaleEvent.currency} ${financialBreakdown.net_to_seller.toLocaleString()}`, 20, 195);

        // Fee Configuration
        doc.setFontSize(16);
        doc.setTextColor(0);
        doc.text('Fee Configuration', 20, 215);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`AUCTA Fee: ${feeOverrides.auctaFeePercentage}%`, 20, 230);
        doc.text(`Marketplace Fee: ${feeOverrides.marketplaceFeePercentage}%`, 20, 240);
        doc.text(`FB Royalties: ${feeOverrides.fbRoyaltyPercentage}%`, 20, 250);
        doc.text(`2B Cashback: ${feeOverrides.cashbackPercentage}%`, 20, 260);

        // Save the PDF
        const filename = `resale_report_${resaleEvent.resale_id}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(filename);
      }).catch(error => {
        console.error('Failed to load jsPDF:', error);
        alert('Failed to generate PDF. Please try again.');
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  const sendSecureReport = () => {
    // TODO: Implement secure sending
    console.log('Sending secure report...');
  };

  // Show contract selection if no contract is selected
  if (!resaleId) {
    return <ContractSelection onContractSelect={handleContractSelect} />;
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '2px solid #e9ecef',
            borderTopColor: '#343a40',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: '#6c757d' }}>Loading contract preview...</p>
        </div>
      </div>
    );
  }

  if (error && !resaleEvent) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <AlertCircle size={48} style={{ color: '#dc3545', marginBottom: '16px' }} />
          <h3 style={{ color: '#dc3545', marginBottom: '8px' }}>Error Loading Contract</h3>
          <p style={{ color: '#6c757d', marginBottom: '16px' }}>{error}</p>
          <button
            onClick={() => router.back()}
            style={{
              padding: '8px 16px',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!resaleEvent) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <AlertCircle size={48} style={{ color: '#6c757d', marginBottom: '16px' }} />
          <h3 style={{ color: '#6c757d', marginBottom: '8px' }}>No Resale Event Found</h3>
          <p style={{ color: '#6c757d', marginBottom: '16px' }}>Please provide a valid resale ID</p>
          <button
            onClick={() => router.push('/resale/assign-buyer')}
            style={{
              padding: '8px 16px',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Go to Assign Buyer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '32px',
        paddingBottom: '16px',
        borderBottom: '1px solid #e9ecef'
      }}>
        <div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '600',
            margin: '0 0 8px 0',
            color: '#212529'
          }}>
            Contract Preview
          </h1>
          <p style={{
            fontSize: '16px',
            color: '#6c757d',
            margin: 0
          }}>
            Review and approve the resale contract before finalization
          </p>
        </div>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            padding: '8px 16px',
            background: '#f8f9fa',
            borderRadius: '8px',
            fontSize: '14px',
            color: '#495057'
          }}>
            Resale ID: {resaleEvent.resale_id}
          </div>
          <div style={{
            padding: '8px 16px',
            background: '#e7f3ff',
            borderRadius: '8px',
            fontSize: '14px',
            color: '#0056b3'
          }}>
            Status: {resaleEvent.status.replace(/_/g, ' ').toUpperCase()}
          </div>
        </div>
      </div>

      {/* Product Image Header */}
      {resaleEvent.passport?.metadata?.product_image && (
        <div style={{
          background: '#fff',
          border: '1px solid #e9ecef',
          borderRadius: '12px',
          padding: '32px',
          marginBottom: '24px',
          textAlign: 'center'
        }}>
          <div style={{
            display: 'inline-block',
            position: 'relative'
          }}>
            <img
              src={`http://localhost:4000${resaleEvent.passport.metadata.product_image}`}
              alt={`${resaleEvent.passport.metadata.brand || 'Product'} ${resaleEvent.passport.metadata.object_name || ''}`}
              style={{
                width: '200px',
                height: '200px',
                objectFit: 'cover',
                borderRadius: '16px',
                border: '3px solid #e9ecef',
                boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
              }}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
            <div style={{
              position: 'absolute',
              bottom: '-10px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#007bff',
              color: 'white',
              padding: '6px 16px',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: '600',
              boxShadow: '0 4px 12px rgba(0,123,255,0.3)'
            }}>
              {resaleEvent.passport.metadata.brand} {resaleEvent.passport.metadata.object_name}
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div style={{
          padding: '16px',
          background: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '8px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: '#721c24'
        }}>
          <AlertCircle size={20} />
          <span>{error}</span>
          <button
            onClick={() => setError('')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              marginLeft: 'auto',
              color: '#721c24'
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #e9ecef',
        marginBottom: '24px'
      }}>
        {[
          { id: 'overview', label: 'Deal Overview', icon: Eye },
          { id: 'financial', label: 'Financial Breakdown', icon: Calculator },
          { id: 'contract', label: 'Smart Contract', icon: FileText },
          { id: 'report', label: 'Resale Report', icon: Download }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '12px 24px',
                background: 'none',
                border: 'none',
                borderBottom: `3px solid ${isActive ? '#007bff' : 'transparent'}`,
                color: isActive ? '#007bff' : '#6c757d',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: isActive ? '500' : '400',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <DealOverviewTab resaleEvent={resaleEvent} />
      )}
      
      {activeTab === 'financial' && (
        <FinancialBreakdownTab 
          financialBreakdown={financialBreakdown} 
          resaleEvent={resaleEvent}
          feeOverrides={feeOverrides}
          onFeeUpdate={handleFeeUpdate}
        />
      )}
      
      {activeTab === 'contract' && (
        <SmartContractTab 
          smartContractData={smartContractData}
          resaleEvent={resaleEvent}
        />
      )}
      
      {activeTab === 'report' && (
        <ResaleReportTab 
          resaleEvent={resaleEvent}
          financialBreakdown={financialBreakdown}
          onDownload={downloadResaleReport}
          onSendSecure={sendSecureReport}
        />
      )}

      {/* Admin Approval Section */}
      <AdminApprovalSection
        sellerSigned={sellerSigned}
        buyerSigned={buyerSigned}
        contractApproved={contractApproved}
        approving={approving}
        onSignatureToggle={handleSignatureToggle}
        onContractApproval={handleContractApproval}
        onProceedToFinalize={handleProceedToFinalize}
        resaleEvent={resaleEvent}
      />

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ContractPreviewPage;
