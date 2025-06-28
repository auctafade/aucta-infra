'use client';

import React, { useState, useEffect } from 'react';
import { 
  Copy, 
  ExternalLink, 
  QrCode, 
  Wallet,
  Shield,
  Download,
  RotateCcw,
  LogOut,
  TrendingUp,
  Calendar,
  Hash,
  Eye,
  EyeOff,
  DollarSign,
  Package,
  Activity,
  ChevronRight,
  Coins,
  X,
  ArrowUpRight,
  History
} from 'lucide-react';
import { api, auth } from '@/lib/api';

// MoneySBT Popup Component
const MoneySBTPopup = ({ isOpen, onClose, walletData, clientId, onWithdraw }: any) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && activeTab === 'transactions') {
      fetchTransactions();
    }
  }, [isOpen, activeTab, clientId]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const data = await api.getMoneySBTTransactions(clientId);
      setTransactions(data.transactions || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0 || amount > walletData.moneySbtBalance) {
      alert('Montant invalide');
      return;
    }

    try {
      setLoading(true);
      const result = await api.withdrawMoneySBT(clientId, amount);
      alert(result.message);
      onWithdraw(amount);
      setWithdrawAmount('');
      onClose();
    } catch (error) {
      console.error('Withdrawal error:', error);
      alert('Échec du retrait');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

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
      zIndex: 1000
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        width: '600px',
        maxHeight: '80vh',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Coins size={24} />
            <h2 style={{
              fontSize: '20px',
              fontWeight: 500,
              margin: 0
            }}>
              MoneySBT
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e0e0e0'
        }}>
          <button
            onClick={() => setActiveTab('overview')}
            style={{
              flex: 1,
              padding: '16px',
              background: activeTab === 'overview' ? '#f5f5f5' : 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === 'overview' ? 500 : 400
            }}
          >
            Aperçu
          </button>
          <button
            onClick={() => setActiveTab('withdraw')}
            style={{
              flex: 1,
              padding: '16px',
              background: activeTab === 'withdraw' ? '#f5f5f5' : 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === 'withdraw' ? 500 : 400
            }}
          >
            Retirer
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            style={{
              flex: 1,
              padding: '16px',
              background: activeTab === 'transactions' ? '#f5f5f5' : 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === 'transactions' ? 500 : 400
            }}
          >
            Historique
          </button>
        </div>

        {/* Content */}
        <div style={{
          padding: '24px',
          maxHeight: '400px',
          overflowY: 'auto'
        }}>
          {activeTab === 'overview' && (
            <div>
              <div style={{
                textAlign: 'center',
                marginBottom: '24px'
              }}>
                <p style={{
                  fontSize: '32px',
                  fontWeight: 600,
                  margin: '0 0 8px 0'
                }}>
                  {formatCurrency(walletData.moneySbtBalance)}
                </p>
                <p style={{
                  color: '#666',
                  fontSize: '14px'
                }}>
                  Solde disponible
                </p>
              </div>

              <div style={{
                background: '#f8f9fa',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '16px'
              }}>
                <h4 style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  marginBottom: '12px'
                }}>
                  Comment ça marche
                </h4>
                <ul style={{
                  fontSize: '13px',
                  color: '#666',
                  margin: 0,
                  paddingLeft: '16px'
                }}>
                  <li>2% de cashback sur chaque achat de produit</li>
                  <li>2% de cashback sur chaque revente si vous êtes le FB</li>
                  <li>Cumul automatique dans votre MoneySBT</li>
                  <li>Retrait possible à tout moment</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'withdraw' && (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  marginBottom: '8px',
                  display: 'block'
                }}>
                  Montant à retirer
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  max={walletData.moneySbtBalance}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '16px'
                  }}
                />
                <p style={{
                  fontSize: '12px',
                  color: '#666',
                  marginTop: '4px'
                }}>
                  Disponible: {formatCurrency(walletData.moneySbtBalance)}
                </p>
              </div>

              <button
                onClick={handleWithdraw}
                disabled={loading || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: loading ? '#ccc' : '#000',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Traitement...' : 'Retirer mon cashback'}
              </button>
            </div>
          )}

          {activeTab === 'transactions' && (
            <div>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    border: '2px solid #e0e0e0',
                    borderTopColor: '#000',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto'
                  }} />
                </div>
              ) : transactions.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px',
                  color: '#666'
                }}>
                  Aucune transaction pour le moment
                </div>
              ) : (
                <div>
                  {transactions.map((tx, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 0',
                        borderBottom: index < transactions.length - 1 ? '1px solid #f0f0f0' : 'none'
                      }}
                    >
                      <div>
                        <p style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          marginBottom: '4px'
                        }}>
                          {tx.description}
                        </p>
                        {tx.product && (
                          <p style={{
                            fontSize: '12px',
                            color: '#666'
                          }}>
                            {tx.product}
                          </p>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          color: '#22c55e'
                        }}>
                          +{formatCurrency(tx.amount)}
                        </p>
                        <p style={{
                          fontSize: '12px',
                          color: '#666'
                        }}>
                          {formatDate(tx.date)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function WalletDashboard() {
  const [walletData, setWalletData] = useState<any>(null);
  const [recentAssets, setRecentAssets] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [showFullAddress, setShowFullAddress] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showMoneySBTPopup, setShowMoneySBTPopup] = useState(false);

  useEffect(() => {
    const fetchWalletData = async () => {
      try {
        const client = auth.getClientData();
        if (!client) {
          throw new Error('No authenticated client found');
        }

        const [walletResponse, activity] = await Promise.all([
          api.getWalletData(client.id),
          api.getClientActivity(client.id, 5)
        ]);
        
        setWalletData(walletResponse.wallet);
        setRecentAssets(walletResponse.recentAssets || []);
        setRecentActivity(activity);
      } catch (error) {
        console.error('Error fetching wallet data:', error);
        // Set default data if API fails
        setWalletData({
          walletAddress: '0x742d35Cc6e0c8A4c1F7c',
          walletType: 'Custodial',
          soulboundId: 'SBT-0001',
          onboardingDate: new Date().toISOString(),
          vaultValue: 0,
          moneySbtBalance: 0,
          ethBalance: 0
        });
        setRecentAssets([]);
        setRecentActivity([]);
      } finally {
        setLoading(false);
      }
    };

    fetchWalletData();
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleMoneySBTWithdraw = (amount: number) => {
    setWalletData((prev: any) => ({
      ...prev,
      moneySbtBalance: prev.moneySbtBalance - amount
    }));
  };

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
          <p style={{ color: '#666', fontSize: '14px' }}>Loading wallet...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: 300,
          marginBottom: '8px',
          letterSpacing: '-0.02em'
        }}>
          Wallet
        </h1>
        <p style={{ color: '#666', fontSize: '16px' }}>
          Manage your digital assets and view transaction history
        </p>
      </div>

      {/* Wallet Overview Card */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e0e0e0',
        padding: '32px',
        marginBottom: '32px'
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
            gap: '12px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              background: 'linear-gradient(135deg, #000 0%, #333 100%)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Wallet size={24} color="#fff" />
            </div>
            <div>
              <h2 style={{
                fontSize: '20px',
                fontWeight: 500,
                marginBottom: '4px'
              }}>
                Your Wallet
              </h2>
              <p style={{ color: '#666', fontSize: '14px' }}>
                {walletData.walletType} • Created {formatDate(walletData.onboardingDate)}
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setShowQR(!showQR)}
            style={{
              padding: '8px 16px',
              background: 'none',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f5f5f5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
            }}
          >
            <QrCode size={16} />
            {showQR ? 'Hide QR' : 'Show QR'}
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: showQR ? '1fr 200px' : '1fr',
          gap: '32px',
          alignItems: 'start'
        }}>
          <div>
            {/* Wallet Address */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                fontSize: '14px',
                fontWeight: 500,
                color: '#333',
                marginBottom: '8px',
                display: 'block'
              }}>
                Wallet Address
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #e0e0e0'
              }}>
                <code style={{
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  flex: 1
                }}>
                  {showFullAddress ? walletData.walletAddress : shortenAddress(walletData.walletAddress)}
                </code>
                <button
                  onClick={() => setShowFullAddress(!showFullAddress)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    color: '#666'
                  }}
                >
                  {showFullAddress ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  onClick={() => copyToClipboard(walletData.walletAddress)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    color: copySuccess ? '#22c55e' : '#666'
                  }}
                >
                  <Copy size={16} />
                </button>
              </div>
              {copySuccess && (
                <p style={{
                  fontSize: '12px',
                  color: '#22c55e',
                  marginTop: '4px'
                }}>
                  Address copied!
                </p>
              )}
            </div>

            {/* Soulbound ID */}
            <div>
              <label style={{
                fontSize: '14px',
                fontWeight: 500,
                color: '#333',
                marginBottom: '8px',
                display: 'block'
              }}>
                Soulbound ID
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #e0e0e0'
              }}>
                <Shield size={16} color="#666" />
                <code style={{
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  flex: 1
                }}>
                  {walletData.soulboundId}
                </code>
                <button
                  onClick={() => copyToClipboard(walletData.soulboundId)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    color: '#666'
                  }}
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* QR Code */}
          {showQR && (
            <div style={{
              padding: '16px',
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '12px',
              textAlign: 'center'
            }}>
              <img
                src={walletData.qrCode}
                alt="Wallet QR Code"
                style={{
                  width: '160px',
                  height: '160px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  marginBottom: '12px'
                }}
              />
              <p style={{
                fontSize: '12px',
                color: '#666'
              }}>
                Scan to share wallet
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Asset Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '24px',
        marginBottom: '32px'
      }}>
        {/* Vault Value */}
        <div style={{
          background: 'linear-gradient(135deg, #000 0%, #333 100%)',
          borderRadius: '16px',
          padding: '24px',
          color: '#fff'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <Package size={20} />
            <span style={{ fontSize: '14px', opacity: 0.9 }}>Vault Value</span>
          </div>
          <p style={{
            fontSize: '32px',
            fontWeight: 600,
            marginBottom: '8px'
          }}>
            {formatCurrency(walletData.vaultValue)}
          </p>
          <p style={{
            fontSize: '14px',
            opacity: 0.7
          }}>
            {walletData.productCount} authenticated products
          </p>
        </div>

        {/* MoneySBT Balance - INTERACTIVE */}
        <div 
          onClick={() => setShowMoneySBTPopup(true)}
          style={{
            background: '#fff',
            borderRadius: '16px',
            border: '1px solid #e0e0e0',
            padding: '24px',
            cursor: 'pointer',
            transition: 'all 0.3s',
            position: 'relative'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <Coins size={20} color="#666" />
            <span style={{ fontSize: '14px', color: '#666' }}>MoneySBT</span>
            <ArrowUpRight size={16} color="#999" style={{ position: 'absolute', top: '16px', right: '16px' }} />
          </div>
          <p style={{
            fontSize: '32px',
            fontWeight: 600,
            marginBottom: '8px'
          }}>
            €{walletData.moneySbtBalance.toFixed(2)}
          </p>
          <p style={{
            fontSize: '14px',
            color: '#666'
          }}>
            Rewards & royalties • Click for details
          </p>
        </div>

        {/* ETH Balance */}
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          border: '1px solid #e0e0e0',
          padding: '24px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <DollarSign size={20} color="#666" />
            <span style={{ fontSize: '14px', color: '#666' }}>ETH Balance</span>
          </div>
          <p style={{
            fontSize: '32px',
            fontWeight: 600,
            marginBottom: '8px'
          }}>
            {walletData.ethBalance} ETH
          </p>
          <p style={{
            fontSize: '14px',
            color: '#666'
          }}>
            ≈ €{(walletData.ethBalance * 3200).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Recent Assets & Activity */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '32px',
        marginBottom: '32px'
      }}>
        {/* Recent Assets */}
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          border: '1px solid #e0e0e0',
          padding: '24px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 500
            }}>
              Recent Assets
            </h3>
          </div>
          <div style={{ gap: '16px' }}>
            {recentAssets.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#666'
              }}>
                <Package size={32} color="#e0e0e0" style={{ margin: '0 auto 16px' }} />
                <p style={{ fontSize: '14px' }}>No assets yet</p>
              </div>
            ) : (
              <>
                {recentAssets.slice(0, 3).map((asset, index) => (
                  <div
                    key={asset.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 0',
                      borderBottom: index < Math.min(recentAssets.length, 3) - 1 ? '1px solid #f0f0f0' : 'none'
                    }}
                  >
                    <div style={{
                      width: '40px',
                      height: '40px',
                      background: asset.image 
                        ? `url(http://localhost:4000${asset.image}) center/cover`
                        : 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)',
                      borderRadius: '8px',
                      border: '1px solid #e0e0e0'
                    }} />
                    <div style={{ flex: 1 }}>
                      <p style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        marginBottom: '4px'
                      }}>
                        {asset.brand}
                      </p>
                      <p style={{
                        fontSize: '12px',
                        color: '#666'
                      }}>
                        {asset.object_name}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{
                        fontSize: '14px',
                        fontWeight: 500
                      }}>
                        {formatCurrency(asset.value)}
                      </p>
                      <p style={{
                        fontSize: '12px',
                        color: '#666'
                      }}>
                        {asset.status}
                      </p>
                    </div>
                  </div>
                ))}
                {recentAssets.length > 3 && (
                  <button
                    onClick={() => window.location.href = '/sprint-2/vault-client'}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: 'none',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      marginTop: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.3s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'none';
                    }}
                  >
                    View All Assets ({recentAssets.length})
                    <ChevronRight size={16} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          border: '1px solid #e0e0e0',
          padding: '24px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 500
            }}>
              Recent Activity
            </h3>
            <Activity size={18} color="#666" />
          </div>
          <div style={{ gap: '16px' }}>
            {recentActivity.slice(0, 5).map((activity, index) => (
              <div
                key={activity.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 0',
                  borderBottom: index < 4 ? '1px solid #f0f0f0' : 'none'
                }}
              >
                <div>
                  <p style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    marginBottom: '4px'
                  }}>
                    {activity.action}
                  </p>
                  {activity.product && (
                    <p style={{
                      fontSize: '12px',
                      color: '#666'
                    }}>
                      {activity.product}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  {activity.value && (
                    <p style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: activity.action.includes('Received') || activity.action.includes('Withdrawn') ? '#22c55e' : '#000'
                    }}>
                      {activity.value >= 1 ? formatCurrency(activity.value) : `€${activity.value}`}
                    </p>
                  )}
                  <p style={{
                    fontSize: '12px',
                    color: '#666'
                  }}>
                    {formatTime(activity.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <button
            style={{
              width: '100%',
              padding: '12px',
              background: 'none',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: 'pointer',
              marginTop: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f5f5f5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
            }}
          >
            View All Activity
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Wallet Controls */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e0e0e0',
        padding: '24px'
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: 500,
          marginBottom: '20px'
        }}>
          Wallet Controls
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px'
        }}>
          <button
            onClick={async () => {
              try {
                const client = auth.getClientData();
                if (!client) return;
                
                const exportData = await api.exportWalletData(client.id);
                
                const dataStr = JSON.stringify(exportData, null, 2);
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `aucta-wallet-export-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
              } catch (error) {
                console.error('Export failed:', error);
                alert('Export failed. Please try again.');
              }
            }}
            style={{
              padding: '16px',
              background: 'none',
              border: '1px solid #e0e0e0',
              borderRadius: '12px',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.3s',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f5f5f5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
            }}
          >
            <Download size={18} />
            <div>
              <div style={{ fontWeight: 500 }}>Export Wallet Info</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Download wallet snapshot</div>
            </div>
          </button>

          <button
            onClick={async () => {
              try {
                const client = auth.getClientData();
                if (!client) return;
                
                if (confirm('Are you sure you want to rotate your wallet key? This will generate a new access key.')) {
                  const result = await api.rotateWalletKey(client.id);
                  alert('Wallet key rotated successfully!');
                  window.location.reload();
                }
              } catch (error) {
                console.error('Key rotation failed:', error);
                alert('Key rotation failed. Please try again.');
              }
            }}
            style={{
              padding: '16px',
              background: 'none',
              border: '1px solid #e0e0e0',
              borderRadius: '12px',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.3s',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f5f5f5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
            }}
          >
            <RotateCcw size={18} />
            <div>
              <div style={{ fontWeight: 500 }}>Rotate Key</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Generate new access key</div>
            </div>
          </button>

          <button
            onClick={() => {
              if (confirm('Are you sure you want to disconnect your wallet? You will be logged out.')) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('clientData');
                window.location.href = '/sprint-2/login';
              }
            }}
            style={{
              padding: '16px',
              background: 'none',
              border: '1px solid #ef4444',
              borderRadius: '12px',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.3s',
              textAlign: 'left',
              color: '#ef4444'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#fef2f2';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
            }}
          >
            <LogOut size={18} />
            <div>
              <div style={{ fontWeight: 500 }}>Disconnect Wallet</div>
              <div style={{ fontSize: '12px', opacity: 0.7 }}>Sign out securely</div>
            </div>
          </button>
        </div>
      </div>

      {/* MoneySBT Popup */}
      <MoneySBTPopup
        isOpen={showMoneySBTPopup}
        onClose={() => setShowMoneySBTPopup(false)}
        walletData={walletData}
        clientId={auth.getClientData()?.id}
        onWithdraw={handleMoneySBTWithdraw}
      />

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