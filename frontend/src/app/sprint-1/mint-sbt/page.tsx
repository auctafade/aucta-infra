// frontend/src/app/sprint-1/mint-sbt/page.tsx
'use client';

import { useState } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/lib/api';

interface Transaction {
  details: { transactionId: string };
  passport_id: number;
  client_id: number;
  timestamp: string;
}

interface Passport {
  id: number;
  nfc_uid: string;
  metadata: any;
  status: string;
  collection_year?: string;
}

interface Client {
  id: number;
  name: string;
  wallet_address: string;
  email?: string;
  kyc_info?: any;
}

interface MintResult {
  success: boolean;
  sbt: any;
  blockchainTxHash: string;
  sbtHash: string;
  message: string;
}

export default function MintSBT() {
  const [transactionId, setTransactionId] = useState('');
  const [currentTransaction, setCurrentTransaction] = useState<Transaction | null>(null);
  const [currentPassport, setCurrentPassport] = useState<Passport | null>(null);
  const [currentClient, setCurrentClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [minting, setMinting] = useState(false);
  const [mintResult, setMintResult] = useState<MintResult | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const fixImagePath = (imagePath: string | null): string | null => {
    if (!imagePath) return null;
    
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    
    if (imagePath.startsWith('/uploads/')) {
      return `${API_BASE_URL}${imagePath}`;
    }
    
    return `${API_BASE_URL}/uploads/${imagePath}`;
  };

  const handleTransactionSubmit = async () => {
    if (!transactionId.trim()) {
      setError('Please enter a transaction ID');
      return;
    }
    
    setError('');
    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/assignment/${transactionId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Transaction not found or invalid');
          return;
        }
        throw new Error('Failed to fetch assignment');
      }
      
      const assignmentData = await response.json();
      
      // Parse passport metadata
      let passportMetadata = {};
      try {
        passportMetadata = typeof assignmentData.passport.metadata === 'string' 
          ? JSON.parse(assignmentData.passport.metadata) 
          : assignmentData.passport.metadata;
      } catch (e) {
        console.warn('Failed to parse passport metadata:', e);
      }
      
      // Store the data
      setCurrentTransaction({
        details: { transactionId: assignmentData.transactionId },
        passport_id: assignmentData.passport.id,
        client_id: assignmentData.client.id,
        timestamp: new Date().toISOString()
      });
      
      setCurrentPassport({
        id: assignmentData.passport.id,
        nfc_uid: assignmentData.passport.nfc_uid,
        metadata: passportMetadata,
        status: assignmentData.passport.status,
        collection_year: assignmentData.passport.collection_year
      });
      
      setCurrentClient({
        id: assignmentData.client.id,
        name: assignmentData.client.name,
        wallet_address: assignmentData.client.wallet_address,
        email: assignmentData.client.email,
        kyc_info: assignmentData.client.kyc_info
      });
      
      // Check if already minted
      if (assignmentData.passport.status === 'MINTED') {
        setError('This passport has already been minted as an SBT');
        return;
      }
      
    } catch (error) {
      console.error('Error fetching transaction:', error);
      setError('Failed to verify transaction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMintSBT = async () => {
    if (!currentPassport) return;
    
    setMinting(true);
    
    try {
      const result = await api.mintSBT(currentPassport.id);
      setMintResult(result);
      setShowConfirmation(true);
    } catch (error) {
      console.error('Error minting SBT:', error);
      setError('Failed to mint SBT. Please try again.');
    } finally {
      setMinting(false);
    }
  };

  const formatWalletAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Initial transaction input screen
  if (!currentTransaction) {
    return (
      <Layout title="Mint Soulbound Token">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-gray-600 mb-8">Official blockchain inscription interface for AUCTA</p>
          
          <div className="space-y-4">
            <input 
              type="text" 
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleTransactionSubmit()}
              className="form-input text-center font-mono"
              placeholder="AUCTA-1750230722159-C32F6C65"
              spellCheck={false}
            />
            
            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-lg">
                {error}
              </div>
            )}
            
            <button 
              onClick={handleTransactionSubmit}
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Verifying...' : 'Verify Transaction'}
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // Confirmation screen
  if (showConfirmation && mintResult) {
    const metadata = currentPassport!.metadata;
    const productImage = metadata.product_image ? fixImagePath(metadata.product_image) : null;
    const clientPhoto = currentClient!.kyc_info?.selfie ? fixImagePath(currentClient!.kyc_info.selfie) : null;

    return (
      <Layout title="Minting Successful">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-3xl font-light mb-8">Soulbound Token Successfully Minted</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Product Info */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              {productImage ? (
                <img 
                  src={productImage} 
                  alt={metadata.object_name || 'Product'}
                  className="w-20 h-20 object-cover rounded"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.parentElement!.insertAdjacentHTML('afterbegin', '<span class="text-3xl">🏆</span>');
                  }}
                />
              ) : (
                <span className="text-3xl">🏆</span>
              )}
              <div className="text-left">
                <h3 className="font-medium">{metadata.brand || ''} {metadata.object_name || ''}</h3>
                <p className="text-sm text-gray-600">UID: {currentPassport!.nfc_uid}</p>
              </div>
            </div>

            {/* Client Info */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              {clientPhoto ? (
                <img 
                  src={clientPhoto} 
                  alt={currentClient!.name}
                  className="w-20 h-20 object-cover rounded-full"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const initials = getInitials(currentClient!.name);
                    target.parentElement!.insertAdjacentHTML(
                      'afterbegin', 
                      `<div class="w-20 h-20 rounded-full bg-gray-300 flex items-center justify-center text-2xl">${initials}</div>`
                    );
                  }}
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-300 flex items-center justify-center text-2xl">
                  {getInitials(currentClient!.name)}
                </div>
              )}
              <div className="text-left">
                <h3 className="font-medium">{currentClient!.name}</h3>
                <p className="text-sm text-gray-600">Wallet: {formatWalletAddress(currentClient!.wallet_address)}</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Blockchain Hash */}
            <div className="p-6 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Blockchain Transaction Hash</p>
              <p className="font-mono text-sm break-all mb-3">{mintResult.blockchainTxHash}</p>
              <button 
                onClick={() => copyToClipboard(mintResult.blockchainTxHash)}
                className="btn btn-secondary btn-sm"
              >
                Copy Hash
              </button>
            </div>

            {/* AUCTA Transaction ID */}
            <div className="p-6 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">AUCTA Transaction ID</p>
              <p className="font-mono">{currentTransaction!.details.transactionId}</p>
            </div>
          </div>

          <p className="mt-8 text-gray-600">
            This object has now been sealed into the AUCTA chain of custody. 
            Ownership has been cryptographically recorded.
          </p>
        </div>
      </Layout>
    );
  }

  // Preview screen
  const metadata = currentPassport!.metadata;
  const productImage = metadata.product_image ? fixImagePath(metadata.product_image) : null;
  const clientPhoto = currentClient!.kyc_info?.selfie ? fixImagePath(currentClient!.kyc_info.selfie) : null;

  return (
    <Layout title="Transaction Verification">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <p className="font-mono text-lg mb-2">{currentTransaction!.details.transactionId}</p>
          <p className="text-gray-600">Review the details before minting to the AUCTA blockchain</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Product Passport Card */}
          <div className="card">
            <h2 className="text-xl font-medium mb-6">Product Passport</h2>
            
            <div className="mb-6">
              {productImage ? (
                <img 
                  src={productImage} 
                  alt={metadata.object_name || 'Product'} 
                  className="w-full h-64 object-cover rounded-lg"
                  onError={(e) => {
                    console.error('Failed to load product image:', productImage);
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.parentElement!.insertAdjacentHTML(
                      'afterbegin', 
                      '<div class="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center"><span class="text-6xl">🏆</span></div>'
                    );
                  }}
                />
              ) : (
                <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                  <span className="text-6xl">🏆</span>
                  <p className="text-gray-500 ml-4">No image available</p>
                </div>
              )}
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Brand</span>
                <span className="font-medium">{metadata.brand || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Model</span>
                <span className="font-medium">{metadata.object_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Type</span>
                <span className="font-medium">{metadata.shape || 'Luxury Item'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Collection Year</span>
                <span className="font-medium">{currentPassport!.collection_year || metadata.collection_year || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">NFC UID</span>
                <span className="font-mono text-xs">{currentPassport!.nfc_uid}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Serial Number</span>
                <span className="font-medium">{metadata.serial_number || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Client Profile Card */}
          <div className="card">
            <h2 className="text-xl font-medium mb-6">Client Profile</h2>
            
            <div className="flex justify-center mb-6">
              {clientPhoto ? (
                <img 
                  src={clientPhoto} 
                  alt={currentClient!.name} 
                  className="w-32 h-32 rounded-full object-cover"
                  onError={(e) => {
                    console.error('Failed to load client photo:', clientPhoto);
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const initials = getInitials(currentClient!.name);
                    target.parentElement!.insertAdjacentHTML(
                      'afterbegin', 
                      `<div class="w-32 h-32 rounded-full bg-gray-300 flex items-center justify-center text-3xl">${initials}</div>`
                    );
                  }}
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-gray-300 flex items-center justify-center text-3xl">
                  {getInitials(currentClient!.name)}
                </div>
              )}
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Name</span>
                <span className="font-medium">{currentClient!.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Status</span>
                <span className="text-green-600 font-medium">KYC Verified</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Client ID</span>
                <span className="font-medium">#{currentClient!.id}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Email</span>
                <span className="font-medium">{currentClient!.email || currentClient!.kyc_info?.email || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Wallet Address</span>
                <span className="font-mono text-xs">{formatWalletAddress(currentClient!.wallet_address)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Assigned Date</span>
                <span className="font-medium">{formatDate(currentTransaction!.timestamp)}</span>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-lg text-center">
            {error}
          </div>
        )}

        <div className="mt-8 text-center">
          <button 
            onClick={handleMintSBT}
            className="btn btn-primary"
            disabled={minting}
          >
            {minting ? (
              <>
                <span className="inline-block animate-spin mr-2">⟳</span>
                Minting...
              </>
            ) : (
              'Mint Soulbound Token on AUCTA Blockchain'
            )}
          </button>
        </div>
      </div>
    </Layout>
  );
}