// frontend/src/app/sprint-2/documents/page.jsx
'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Download, Shield, Calendar, Hash, Lock, CheckCircle, AlertCircle, Archive, FileCheck } from 'lucide-react';
import { api, auth } from '@/lib/api';

export default function DocumentsClient() {
  type Document = {
    id: string;
    name: string;
    type: string;
    category: string;
    size: string;
    date: string;
    status: string;
    format?: string;
    downloadable: boolean;
    url?: string;
    productId?: string;
    productInfo?: {
      brand?: string;
      name?: string;
      image?: string;
      value?: any;
      year?: any;
    };
    hash?: string;
    txHash?: string;
    details?: {
      role?: string;
      relationship?: string;
    };
  };

  type DocumentsState = {
    identity: Document[];
    products: Document[];
    legal: Document[];
    blockchain: Document[];
  };

  const [documents, setDocuments] = useState<DocumentsState>({
    identity: [],
    products: [],
    legal: [],
    blockchain: []
  });
  const [loading, setLoading] = useState(true);
  type ClientData = {
    id: string;
    name: string;
    [key: string]: any;
  };
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const client = auth.getClientData();
        if (!client) return;
        
        setClientData(client);
        
        // Fetch all relevant data to build document structure
        const [clientDetails, vaultProducts, activityLogs, proxyResponse] = await Promise.all([
          api.getClient(client.id),
          api.getClientVault(client.id),
          api.getClientActivity(client.id, 1000), // Get more logs for document generation
          api.getProxyAssignments(client.id).catch(() => [])
        ]);

        // Ensure proxyData is always an array
        const proxyData = Array.isArray(proxyResponse) ? proxyResponse : (proxyResponse?.data || []);

        // Build document structure from real data
        const identityDocs: any[] = [];
        const productDocs: {
          id: string;
          name: string;
          type: string;
          productId?: string;
          category: string;
          size: string;
          date: string;
          status: string;
          format?: string;
          downloadable: boolean;
          productInfo?: {
            brand?: string;
            name?: string;
            image?: string;
            value?: any;
            year?: any;
          };
        }[] = [];
        const legalDocs: any[] = [];
        const blockchainDocs: any[] = [];

        // Identity Documents
        if (clientDetails?.kyc_info?.selfie) {
          identityDocs.push({
            id: `kyc-selfie-${client.id}`,
            name: 'KYC Verification Photo',
            type: 'identity',
            category: 'KYC Document',
            size: '2.4 MB',
            date: clientDetails.created_at,
            status: 'verified',
            url: clientDetails.kyc_info.selfie,
            downloadable: true
          });
        }

        identityDocs.push({
          id: `kyc-cert-${client.id}`,
          name: 'KYC Verification Certificate',
          type: 'identity',
          category: 'Official Certificate',
          size: '156 KB',
          date: clientDetails?.created_at || new Date().toISOString(),
          status: 'verified',
          format: 'PDF',
          downloadable: true
        });

        if (clientDetails?.proof_of_address_status === 'Verified') {
          identityDocs.push({
            id: `poa-${client.id}`,
            name: 'Proof of Address',
            type: 'identity',
            category: 'Residence Verification',
            size: '3.1 MB',
            date: clientDetails.created_at,
            status: 'verified',
            format: 'PDF',
            downloadable: true
          });
        }

        // Product Documents
        if (Array.isArray(vaultProducts)) {
          vaultProducts.forEach(product => {
            let metadata: {
              brand?: string;
              object_name?: string;
              product_image?: string;
              original_price?: any;
              collection_year?: any;
              [key: string]: any;
            } = {};
            try {
              metadata = typeof product.metadata === 'string' 
                ? JSON.parse(product.metadata) 
                : (product.metadata || {});
            } catch (e) {
              console.warn('Error parsing product metadata:', e);
              metadata = {};
            }

            const brand = metadata.brand || 'Unknown Brand';
            const objectName = metadata.object_name || 'Unknown Item';

            // Product Passport
            productDocs.push({
              id: `passport-${product.id}`,
              name: `${brand} ${objectName} - Digital Passport`,
              type: 'product',
              productId: product.id,
              category: 'Product Authentication',
              size: '4.2 MB',
              date: product.created_at || new Date().toISOString(),
              status: 'active',
              format: 'PDF',
              downloadable: true,
              productInfo: {
                brand: brand,
                name: objectName,
                image: metadata.product_image,
                value: product.original_price || metadata.original_price,
                year: product.collection_year || metadata.collection_year
              }
            });

            // Authenticity Certificate
            productDocs.push({
              id: `auth-cert-${product.id}`,
              name: `${brand} - Certificate of Authenticity`,
              type: 'product',
              productId: product.id,
              category: 'Authenticity',
              size: '1.8 MB',
              date: product.created_at || new Date().toISOString(),
              status: 'verified',
              format: 'PDF',
              downloadable: true,
              productInfo: {
                brand: brand,
                name: objectName
              }
            });

            // Invoice if available
            if (metadata.original_price || product.original_price) {
              productDocs.push({
                id: `invoice-${product.id}`,
                name: `${brand} - Purchase Invoice`,
                type: 'product',
                productId: product.id,
                category: 'Financial Record',
                size: '512 KB',
                date: product.created_at || new Date().toISOString(),
                status: 'verified',
                format: 'PDF',
                downloadable: true,
                productInfo: {
                  brand: brand,
                  name: objectName,
                  value: metadata.original_price || product.original_price
                }
              });
            }

            // Blockchain proof if minted
            if (product.sbt_hash) {
              blockchainDocs.push({
                id: `blockchain-${product.id}`,
                name: `SBT Certificate - ${brand} ${objectName}`,
                type: 'blockchain',
                productId: product.id,
                category: 'Blockchain Record',
                size: '89 KB',
                date: product.minted_at || product.created_at || new Date().toISOString(),
                status: 'immutable',
                format: 'JSON',
                downloadable: true,
                hash: product.sbt_hash,
                txHash: product.blockchain_tx_hash
              });
            }
          });
        }

        // Legal Documents - Proxy assignments
        if (Array.isArray(proxyData)) {
          proxyData.forEach(proxy => {
            if (proxy?.status === 'active') {
              legalDocs.push({
                id: `proxy-${proxy.id}`,
                name: `Proxy Authorization - ${proxy.proxy_name || 'Unknown Proxy'}`,
                type: 'legal',
                category: 'Legal Agreement',
                size: '245 KB',
                date: proxy.activated_at || proxy.requested_at || new Date().toISOString(),
                status: 'active',
                format: 'PDF',
                downloadable: true,
                details: {
                  role: proxy.role,
                  relationship: proxy.relationship
                }
              });
            }
          });
        }

        // Add inheritance plan if exists
        if (Array.isArray(activityLogs)) {
          const inheritanceLog = activityLogs.find(log => 
            log?.action === 'INHERITANCE_PLAN_CREATED' || 
            (log?.action === 'PROXY_REQUEST_SUBMITTED' && log.details?.role === 'inheritance_heir')
          );
          
          if (inheritanceLog) {
            legalDocs.push({
              id: `inheritance-plan-${client.id}`,
              name: 'Digital Inheritance Plan',
              type: 'legal',
              category: 'Estate Planning',
              size: '1.2 MB',
              date: inheritanceLog.timestamp || new Date().toISOString(),
              status: 'active',
              format: 'PDF',
              downloadable: true
            });
          }
        }

        setDocuments({
          identity: identityDocs,
          products: productDocs,
          legal: legalDocs,
          blockchain: blockchainDocs
        });

      } catch (error) {
        console.error('Error fetching documents:', error);
        // Set empty documents on error to prevent crashes
        setDocuments({
          identity: [],
          products: [],
          legal: [],
          blockchain: []
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  // Export functions
  const exportAsPDF = async () => {
    setExportLoading(true);
    try {
      // In production, this would generate a real PDF
      if (!clientData) {
        throw new Error('Client data is not loaded.');
      }
      const exportData = await api.exportClientData(Number(clientData.id));
      
      // Create a blob and download
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AUCTA_Documents_${clientData.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Log the export
      console.log('Documents exported as PDF');
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExportLoading(false);
    }
  };

  const exportAsZIP = async () => {
    setExportLoading(true);
    try {
      // In production, this would create a real ZIP file with all documents
      console.log('Preparing ZIP export...');
      
      // Simulate ZIP creation
      setTimeout(() => {
        alert('ZIP export would download all documents in a compressed folder. This feature requires backend implementation.');
        setExportLoading(false);
      }, 1000);
    } catch (error) {
      console.error('ZIP export failed:', error);
      setExportLoading(false);
    }
  };

  const exportAsCSV = async () => {
    setExportLoading(true);
    try {
      // Create CSV data
      const csvRows = ['Document Name,Type,Category,Status,Date,Size'];
      
      [...documents.identity, ...documents.products, ...documents.legal, ...documents.blockchain].forEach(doc => {
        csvRows.push(`"${doc.name}","${doc.type}","${doc.category}","${doc.status}","${new Date(doc.date).toLocaleDateString()}","${doc.size}"`);
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AUCTA_Documents_Metadata_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log('Documents metadata exported as CSV');
    } catch (error) {
      console.error('CSV export failed:', error);
    } finally {
      setExportLoading(false);
    }
  };

  const downloadDocument = (doc: Document) => {
    // In production, this would download the actual document
    console.log('Downloading document:', doc.name);
    alert(`Document download: ${doc.name}\n\nIn production, this would download the actual file from the server.`);
  };

  const downloadProductDocuments = (productId: string) => {
    const productDocs = documents.products.filter(doc => doc.productId === productId);
    const blockchainDoc = documents.blockchain.find(doc => doc.productId === productId);
    
    const allProductDocs = [...productDocs];
    if (blockchainDoc) allProductDocs.push(blockchainDoc);

    console.log('Downloading all documents for product:', productId);
    alert(`Downloading ${allProductDocs.length} documents for this product as ZIP.\n\nIn production, this would create a ZIP file with all related documents.`);
  };

  // Group products by ID
  const groupedProducts = documents.products.reduce((acc, doc) => {
    if (!doc.productId) {
      // Skip documents without a productId
      return acc;
    }
    if (!acc[doc.productId]) {
      acc[doc.productId] = {
        info: doc.productInfo,
        documents: []
      };
    }
    acc[doc.productId].documents.push(doc);
    return acc;
  }, {} as Record<string, { info: any; documents: any[] }>);

  // Add blockchain docs to grouped products
  documents.blockchain.forEach(doc => {
    if (doc.productId && groupedProducts[doc.productId]) {
      groupedProducts[doc.productId].documents.push(doc);
    }
  });

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
            border: '2px solid #e0e0e0',
            borderTopColor: '#000',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: '#666', fontSize: '14px' }}>Loading your documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header with Export Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '40px'
      }}>
        <div>
          <h1 style={{
            fontSize: '36px',
            fontWeight: 300,
            marginBottom: '8px',
            letterSpacing: '-0.02em'
          }}>
            Document Vault
          </h1>
          <p style={{
            fontSize: '16px',
            color: '#666'
          }}>
            Secure access to all your certificates, contracts, and blockchain records
          </p>
        </div>

        <div style={{
          display: 'flex',
          gap: '12px'
        }}>
          <button
            onClick={exportAsPDF}
            disabled={exportLoading}
            style={{
              padding: '10px 20px',
              background: '#000',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: exportLoading ? 'not-allowed' : 'pointer',
              opacity: exportLoading ? 0.6 : 1,
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <FileText size={16} />
            Export My Documents (PDF)
          </button>

          <button
            onClick={exportAsZIP}
            disabled={exportLoading}
            style={{
              padding: '10px 20px',
              background: 'none',
              color: '#000',
              border: '1px solid #000',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: exportLoading ? 'not-allowed' : 'pointer',
              opacity: exportLoading ? 0.6 : 1,
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Archive size={16} />
            Download Vault as ZIP
          </button>

          <button
            onClick={exportAsCSV}
            disabled={exportLoading}
            style={{
              padding: '10px 20px',
              background: 'none',
              color: '#000',
              border: '1px solid #000',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: exportLoading ? 'not-allowed' : 'pointer',
              opacity: exportLoading ? 0.6 : 1,
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <FileCheck size={16} />
            Export as CSV
          </button>
        </div>
      </div>

      {/* Identity Documents Section */}
      {documents.identity.length > 0 && (
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 500,
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Shield size={20} />
            Identity & Verification
          </h2>

          <div style={{
            display: 'grid',
            gap: '16px'
          }}>
            {documents.identity.map(doc => (
              <div
                key={doc.id}
                style={{
                  background: '#fff',
                  border: '1px solid #e0e0e0',
                  borderRadius: '12px',
                  padding: '24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.3s',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    background: '#f5f5f5',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <FileText size={24} color="#666" />
                  </div>
                  
                  <div>
                    <h3 style={{
                      fontSize: '16px',
                      fontWeight: 500,
                      marginBottom: '4px'
                    }}>
                      {doc.name}
                    </h3>
                    <div style={{
                      display: 'flex',
                      gap: '16px',
                      fontSize: '14px',
                      color: '#666'
                    }}>
                      <span>{doc.category}</span>
                      <span>•</span>
                      <span>{new Date(doc.date).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{doc.size}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    background: doc.status === 'verified' ? '#e8f5e9' : '#fff3e0',
                    borderRadius: '20px',
                    fontSize: '13px',
                    color: doc.status === 'verified' ? '#2e7d32' : '#f57c00'
                  }}>
                    {doc.status === 'verified' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                    {doc.status}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadDocument(doc);
                    }}
                    style={{
                      padding: '8px 16px',
                      background: 'none',
                      border: '1px solid #e0e0e0',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.3s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#000';
                      e.currentTarget.style.background = '#000';
                      e.currentTarget.style.color = '#fff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e0e0e0';
                      e.currentTarget.style.background = 'none';
                      e.currentTarget.style.color = '#000';
                    }}
                  >
                    <Download size={14} />
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Product Documents Section */}
      {Object.keys(groupedProducts).length > 0 && (
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 500,
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Lock size={20} />
            Product Authentication
          </h2>

          <div style={{
            display: 'grid',
            gap: '24px'
          }}>
            {Object.entries(groupedProducts).map(([productId, productData]) => (
              <div
                key={productId}
                style={{
                  background: '#fff',
                  border: '1px solid #e0e0e0',
                  borderRadius: '12px',
                  overflow: 'hidden'
                }}
              >
                {/* Product Header */}
                <div style={{
                  padding: '24px',
                  borderBottom: '1px solid #f0f0f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#fafafa'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {productData.info.image && (
                      <div style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '8px',
                        background: `url(http://localhost:4000${productData.info.image}) center/cover`,
                        border: '1px solid #e0e0e0'
                      }} />
                    )}
                    <div>
                      <h3 style={{
                        fontSize: '18px',
                        fontWeight: 500,
                        marginBottom: '4px'
                      }}>
                        {productData.info.brand} {productData.info.name}
                      </h3>
                      <p style={{
                        fontSize: '14px',
                        color: '#666'
                      }}>
                        {productData.info.year} • {productData.documents.length} documents
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => downloadProductDocuments(productId)}
                    style={{
                      padding: '10px 20px',
                      background: '#000',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.3s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#333';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#000';
                    }}
                  >
                    <Archive size={16} />
                    Download All
                  </button>
                </div>

                {/* Product Documents */}
                <div style={{ padding: '16px' }}>
                  {productData.documents.map((doc, index) => (
                    <div
                      key={doc.id}
                      style={{
                        padding: '16px',
                        borderBottom: index < productData.documents.length - 1 ? '1px solid #f0f0f0' : 'none',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          background: doc.type === 'blockchain' ? '#000' : '#f5f5f5',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {doc.type === 'blockchain' ? (
                            <Hash size={20} color="#fff" />
                          ) : (
                            <FileText size={20} color="#666" />
                          )}
                        </div>
                        
                        <div>
                          <p style={{
                            fontSize: '15px',
                            fontWeight: 500,
                            marginBottom: '2px'
                          }}>
                            {doc.name}
                          </p>
                          <p style={{
                            fontSize: '13px',
                            color: '#666'
                          }}>
                            {doc.format} • {doc.size}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => downloadDocument(doc)}
                        style={{
                          padding: '6px 12px',
                          background: 'none',
                          border: '1px solid #e0e0e0',
                          borderRadius: '6px',
                          fontSize: '13px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.3s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#000';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#e0e0e0';
                        }}
                      >
                        <Download size={12} />
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legal Documents Section */}
      {documents.legal.length > 0 && (
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 500,
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <FileText size={20} />
            Legal & Agreements
          </h2>

          <div style={{
            display: 'grid',
            gap: '16px'
          }}>
            {documents.legal.map(doc => (
              <div
                key={doc.id}
                style={{
                  background: '#fff',
                  border: '1px solid #e0e0e0',
                  borderRadius: '12px',
                  padding: '24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.3s',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    background: '#f5f5f5',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <FileText size={24} color="#666" />
                  </div>
                  
                  <div>
                    <h3 style={{
                      fontSize: '16px',
                      fontWeight: 500,
                      marginBottom: '4px'
                    }}>
                      {doc.name}
                    </h3>
                    <div style={{
                      display: 'flex',
                      gap: '16px',
                      fontSize: '14px',
                      color: '#666'
                    }}>
                      <span>{doc.category}</span>
                      <span>•</span>
                      <span>{new Date(doc.date).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{doc.size}</span>
                      {doc.details && (
                        <>
                          <span>•</span>
                          <span>{doc.details.role || doc.details.relationship}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    background: '#e8f5e9',
                    borderRadius: '20px',
                    fontSize: '13px',
                    color: '#2e7d32'
                  }}>
                    <CheckCircle size={14} />
                    {doc.status}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadDocument(doc);
                    }}
                    style={{
                      padding: '8px 16px',
                      background: 'none',
                      border: '1px solid #e0e0e0',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.3s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#000';
                      e.currentTarget.style.background = '#000';
                      e.currentTarget.style.color = '#fff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e0e0e0';
                      e.currentTarget.style.background = 'none';
                      e.currentTarget.style.color = '#000';
                    }}
                  >
                    <Download size={14} />
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {documents.identity.length === 0 && 
       documents.products.length === 0 && 
       documents.legal.length === 0 && 
       documents.blockchain.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '80px 40px',
          background: '#fff',
          borderRadius: '16px',
          border: '1px solid #e0e0e0'
        }}>
          <FileText size={64} color="#e0e0e0" style={{ margin: '0 auto 24px' }} />
          <h2 style={{
            fontSize: '24px',
            fontWeight: 400,
            marginBottom: '16px',
            color: '#333'
          }}>
            No documents yet
          </h2>
          <p style={{
            fontSize: '16px',
            color: '#666',
            maxWidth: '400px',
            margin: '0 auto'
          }}>
            Your identity certificates, product passports, and legal documents will appear here once generated.
          </p>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}