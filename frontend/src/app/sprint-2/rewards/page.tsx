'use client';

import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  TrendingUp, 
  Gift, 
  Users, 
  Building2, 
  Sparkles,
  ChevronRight,
  Check,
  Clock,
  Star,
  Shield,
  Zap,
  Crown,
  Phone,
  Mail,
  AlertCircle
} from 'lucide-react';
import { api, auth } from '@/lib/api';

// Tier thresholds
const TIER_THRESHOLDS = {
  TIER_I: 50000,
  TIER_II: 250000,
  TIER_III: 1000000
};

// Tier names
const TIER_NAMES = {
  TIER_I: 'Silver Access',
  TIER_II: 'Black Access',
  TIER_III: 'Centurion Access'
};

export default function RewardsPage() {
  const [vaultValue, setVaultValue] = useState(0);
  const [currentTier, setCurrentTier] = useState<string | null>(null);
  const [clientData, setClientData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribedTier, setSubscribedTier] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [cardInfo, setCardInfo] = useState<any>(null);
  const [cashbackBalance, setCashbackBalance] = useState(0);
  const [rewardsStats, setRewardsStats] = useState<any>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRewardsData = async () => {
      try {
        const client = auth.getClientData();
        if (!client) return;
        
        setClientData(client);
        
        // Fetch vault data to calculate tier
        const vaultProducts = await api.getClientVault(client.id);
        
        // Calculate total vault value
        const totalValue = vaultProducts.reduce((sum: number, product: any) => {
          const metadata = typeof product.metadata === 'string' 
            ? JSON.parse(product.metadata) 
            : product.metadata;
          
          const price = product.original_price || metadata?.original_price;
          
          if (price) {
            const numericPrice = parseFloat(price.toString().replace(/[^0-9.-]+/g, ''));
            return sum + (isNaN(numericPrice) ? 0 : numericPrice);
          }
          
          return sum;
        }, 0);
        
        setVaultValue(totalValue);
        
        // Determine current tier based on vault value
        if (totalValue >= TIER_THRESHOLDS.TIER_III) {
          setCurrentTier('TIER_III');
        } else if (totalValue >= TIER_THRESHOLDS.TIER_II) {
          setCurrentTier('TIER_II');
        } else if (totalValue >= TIER_THRESHOLDS.TIER_I) {
          setCurrentTier('TIER_I');
        }
        
        // Fetch rewards subscription status with error handling
        try {
          const subscriptionData = await api.getRewardsSubscription(client.id);
          
          if (subscriptionData && subscriptionData.subscribed) {
            setIsSubscribed(true);
            setSubscription(subscriptionData.subscription);
            setSubscribedTier(subscriptionData.subscription.tier);
            setCardInfo(subscriptionData.card);
            setCashbackBalance(subscriptionData.totalCashback || 0);
            
            // Fetch rewards statistics if subscribed
            try {
              const stats = await api.getRewardsStats(client.id);
              if (stats) {
                setRewardsStats(stats);
                setCashbackBalance(stats.cashback?.balance || 0);
              }
            } catch (statsError) {
              console.warn('Could not fetch rewards stats:', statsError);
              // Continue without stats
            }
          }
        } catch (subscriptionError: any) {
          console.warn('Rewards subscription not available yet:', subscriptionError?.message || subscriptionError);
          // Continue with default unsubscribed state
          setIsSubscribed(false);
          setSubscription(null);
          setSubscribedTier(null);
          setCardInfo(null);
          setCashbackBalance(0);
        }
        
      } catch (error) {
        console.error('Error fetching rewards data:', error);
        setError('Failed to load some rewards data. Some features may be limited.');
      } finally {
        setLoading(false);
      }
    };

    fetchRewardsData();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleSubscribe = async (tier: string) => {
    setIsSubscribing(true);
    setError(null);
    
    try {
      const result = await api.subscribeToRewards(clientData.id, tier as 'TIER_I' | 'TIER_II' | 'TIER_III');
      
      if (result.success) {
        setIsSubscribed(true);
        setSubscribedTier(tier);
        setSubscription(result.subscription);
        
        // Try to refresh subscription data
        try {
          const updatedData = await api.getRewardsSubscription(clientData.id);
          if (updatedData.subscribed) {
            setSubscription(updatedData.subscription);
            setCardInfo(updatedData.card);
          }
        } catch (refreshError) {
          console.warn('Could not refresh subscription data:', refreshError);
          // Continue with local state
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to subscribe to rewards program');
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleOrderCard = async () => {
    setError(null);
    
    try {
      const result = await api.orderRewardsCard(clientData.id);
      
      if (result.success) {
        setCardInfo({
          status: 'pending',
          lastFourDigits: result.card.lastFourDigits,
          estimatedDelivery: result.card.estimatedDelivery
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to order physical card');
    }
  };

  const handleServiceRequest = async (type: string) => {
    // These would open modals or navigate to dedicated forms
    switch (type) {
      case 'concierge':
        // Navigate to concierge request form
        window.location.href = `/sprint-2/rewards/concierge-request`;
        break;
      case 'update-tier':
        // Navigate to subscription management
        window.location.href = `/sprint-2/rewards/manage-subscription`;
        break;
      case 'family-access':
        // Navigate to family access application
        window.location.href = `/sprint-2/rewards/family-access`;
        break;
      case 'feedback':
        // Navigate to feedback form
        window.location.href = `/sprint-2/rewards/feedback`;
        break;
    }
  };

  const calculateProgress = () => {
    if (!currentTier || currentTier === 'TIER_III') return 100;
    
    const currentThreshold = TIER_THRESHOLDS[currentTier as keyof typeof TIER_THRESHOLDS];
    const nextTier = currentTier === 'TIER_I' ? 'TIER_II' : 'TIER_III';
    const nextThreshold = TIER_THRESHOLDS[nextTier as keyof typeof TIER_THRESHOLDS];
    
    const progress = ((vaultValue - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
    return Math.max(0, Math.min(100, progress));
  };

  const renderTierCard = (tier: string, benefits: string[], monthlyFee: number) => {
    const threshold = TIER_THRESHOLDS[tier as keyof typeof TIER_THRESHOLDS];
    const tierName = TIER_NAMES[tier as keyof typeof TIER_NAMES];
    const isEligible = vaultValue >= threshold;
    
    const cardStyles = {
      TIER_I: {
        background: 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)',
        color: '#333',
        borderColor: '#d0d0d0'
      },
      TIER_II: {
        background: 'linear-gradient(135deg, #2a2a2a 0%, #000 100%)',
        color: '#fff',
        borderColor: '#333'
      },
      TIER_III: {
        background: 'linear-gradient(135deg, #1a1a1a 0%, #000 50%, #1a1a1a 100%)',
        color: '#fff',
        borderColor: '#444',
        boxShadow: '0 0 20px rgba(255,255,255,0.1)'
      }
    };
    
    const style = cardStyles[tier as keyof typeof cardStyles];
    
    return (
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        padding: '32px',
        border: '1px solid #e0e0e0',
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Card Preview */}
        <div style={{
          ...style,
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          minHeight: '180px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start'
          }}>
            <div>
              <h3 style={{
                fontSize: '24px',
                fontWeight: 600,
                marginBottom: '4px',
                letterSpacing: '-0.02em'
              }}>
                AUCTA
              </h3>
              <p style={{
                fontSize: '14px',
                opacity: 0.8
              }}>
                {tierName}
              </p>
            </div>
            <div style={{
              width: '40px',
              height: '30px',
              background: tier === 'TIER_I' ? '#999' : '#ffd700',
              borderRadius: '4px',
              opacity: 0.7
            }} />
          </div>
          
          <div>
            <p style={{
              fontSize: '12px',
              opacity: 0.7,
              marginBottom: '4px'
            }}>
              Member since {new Date().getFullYear()}
            </p>
            <p style={{
              fontSize: '16px',
              letterSpacing: '0.1em'
            }}>
              •••• •••• •••• ••••
            </p>
          </div>
        </div>
        
        <h3 style={{
          fontSize: '20px',
          fontWeight: 600,
          marginBottom: '8px'
        }}>
          {tierName}
        </h3>
        
        <p style={{
          fontSize: '14px',
          color: '#666',
          marginBottom: '16px'
        }}>
          Requires {formatCurrency(threshold)} vault value
        </p>
        
        <div style={{
          flex: 1,
          marginBottom: '24px'
        }}>
          {benefits.map((benefit, index) => (
            <div key={index} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              marginBottom: '12px'
            }}>
              <Check size={16} color="#22c55e" style={{ marginTop: '2px', flexShrink: 0 }} />
              <span style={{
                fontSize: '14px',
                color: '#666'
              }}>
                {benefit}
              </span>
            </div>
          ))}
        </div>
        
        <div style={{
          borderTop: '1px solid #e0e0e0',
          paddingTop: '16px',
          marginTop: 'auto'
        }}>
          <p style={{
            fontSize: '14px',
            color: '#666',
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            €{monthlyFee}/month
          </p>
          
          <button
            onClick={() => handleSubscribe(tier)}
            disabled={!isEligible || isSubscribing}
            style={{
              width: '100%',
              padding: '12px',
              background: isEligible ? '#000' : '#e0e0e0',
              color: isEligible ? '#fff' : '#999',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: isEligible ? 'pointer' : 'not-allowed',
              transition: 'all 0.3s'
            }}
          >
            {isSubscribing 
              ? 'Processing...' 
              : isEligible 
                ? 'Subscribe to this tier' 
                : `${formatCurrency(threshold - vaultValue)} more needed`}
          </button>
        </div>
      </div>
    );
  };

  const renderDigitalCard = () => {
    const cardStyles = {
      TIER_I: {
        background: 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)',
        color: '#333'
      },
      TIER_II: {
        background: 'linear-gradient(135deg, #2a2a2a 0%, #000 100%)',
        color: '#fff'
      },
      TIER_III: {
        background: 'linear-gradient(135deg, #1a1a1a 0%, #000 50%, #1a1a1a 100%)',
        color: '#fff',
        boxShadow: '0 0 30px rgba(255,255,255,0.2)'
      }
    };
    
    const style = cardStyles[subscribedTier as keyof typeof cardStyles] || cardStyles.TIER_I;
    
    return (
      <div style={{
        ...style,
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '400px',
        aspectRatio: '1.6',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '24px'
          }}>
            <div>
              <h2 style={{
                fontSize: '28px',
                fontWeight: 600,
                marginBottom: '4px',
                letterSpacing: '-0.02em'
              }}>
                AUCTA
              </h2>
              <p style={{
                fontSize: '16px',
                opacity: 0.8
              }}>
                {TIER_NAMES[subscribedTier as keyof typeof TIER_NAMES]}
              </p>
            </div>
            <div style={{
              width: '50px',
              height: '40px',
              background: subscribedTier === 'TIER_I' ? '#999' : '#ffd700',
              borderRadius: '6px',
              opacity: 0.7
            }} />
          </div>
          
          <div style={{
            marginBottom: '24px'
          }}>
            <p style={{
              fontSize: '20px',
              letterSpacing: '0.1em',
              marginBottom: '16px'
            }}>
              •••• •••• •••• {cardInfo?.lastFourDigits || Math.floor(Math.random() * 9000) + 1000}
            </p>
          </div>
        </div>
        
        <div>
          <p style={{
            fontSize: '18px',
            marginBottom: '4px'
          }}>
            {clientData?.name}
          </p>
          <p style={{
            fontSize: '14px',
            opacity: 0.7
          }}>
            Member since {subscription ? new Date(subscription.subscribedAt).getFullYear() : new Date().getFullYear()} • ID: {clientData?.id.toString().padStart(6, '0')}
          </p>
        </div>
      </div>
    );
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
          <p style={{ color: '#666', fontSize: '14px' }}>Loading rewards...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '40px'
        }}>
          <AlertCircle size={48} color="#ef4444" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: '#ef4444', fontSize: '16px' }}>{error}</p>
        </div>
      </div>
    );
  }

  // Onboarding view
  if (!isSubscribed) {
    const tierBenefits = {
      TIER_I: [
        'Cashback benefits on verified resales',
        'Access to digital perks and exclusive content',
        'Physical AUCTA Rewards Card',
        'Invitation to limited private sales',
        'Priority customer support'
      ],
      TIER_II: [
        'All Silver Access benefits',
        'Premium vault support with dedicated manager',
        'Cut-the-line in participating luxury boutiques',
        'The Floorr partner perks and white-glove shipping',
        'Concierge revaluation requests',
        'Fast-track proxy handling'
      ],
      TIER_III: [
        'All Black Access benefits',
        'Access to exclusive pre-auction lots',
        'Private client collection drops from Maison partners',
        'Annual estate reporting and succession planning',
        '1:1 legacy advisor consultation',
        'Access to confidential museum consignments',
        'Priority onboarding for family members',
        'Ultra-fast treatment of all requests'
      ]
    };
    
    return (
      <div>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #000 0%, #333 100%)',
          borderRadius: '16px',
          padding: '48px',
          color: '#fff',
          marginBottom: '40px',
          textAlign: 'center'
        }}>
          <h1 style={{
            fontSize: '36px',
            fontWeight: 300,
            marginBottom: '16px',
            letterSpacing: '-0.02em'
          }}>
            AUCTA Rewards
          </h1>
          <p style={{
            fontSize: '18px',
            opacity: 0.9,
            marginBottom: '32px',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            Exclusive benefits for authenticated collectors. Your vault value determines your tier.
          </p>
          
          <div style={{
            display: 'inline-block',
            padding: '16px 32px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '8px',
            marginTop: '24px'
          }}>
            <p style={{ fontSize: '14px', opacity: 0.8, marginBottom: '4px' }}>Your Current Vault Value</p>
            <p style={{ fontSize: '28px', fontWeight: 500 }}>{formatCurrency(vaultValue)}</p>
          </div>
        </div>
        
        {/* Tier Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
          gap: '24px',
          marginBottom: '40px'
        }}>
          {renderTierCard('TIER_I', tierBenefits.TIER_I, 79)}
          {renderTierCard('TIER_II', tierBenefits.TIER_II, 149)}
          {renderTierCard('TIER_III', tierBenefits.TIER_III, 299)}
        </div>
      </div>
    );
  }

  // Subscribed dashboard view
  const nextTier = subscribedTier === 'TIER_I' ? 'TIER_II' : subscribedTier === 'TIER_II' ? 'TIER_III' : null;
  const nextThreshold = nextTier ? TIER_THRESHOLDS[nextTier as keyof typeof TIER_THRESHOLDS] : null;
  
  return (
    <div>
      {/* Status Header */}
      <div style={{
        background: 'linear-gradient(135deg, #000 0%, #333 100%)',
        borderRadius: '16px',
        padding: '48px',
        color: '#fff',
        marginBottom: '40px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '32px'
        }}>
          <div>
            <h1 style={{
              fontSize: '36px',
              fontWeight: 300,
              marginBottom: '16px',
              letterSpacing: '-0.02em'
            }}>
              Welcome to {TIER_NAMES[subscribedTier as keyof typeof TIER_NAMES]}
            </h1>
            <p style={{
              fontSize: '18px',
              opacity: 0.9,
              marginBottom: '24px'
            }}>
              Enjoy exclusive benefits tailored to your collection
            </p>
            
            {nextTier && (
              <div style={{ marginTop: '32px' }}>
                <p style={{ fontSize: '14px', opacity: 0.8, marginBottom: '8px' }}>
                  Progress to {TIER_NAMES[nextTier as keyof typeof TIER_NAMES]}
                </p>
                <div style={{
                  width: '300px',
                  height: '8px',
                  background: 'rgba(255,255,255,0.2)',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${calculateProgress()}%`,
                    height: '100%',
                    background: '#fff',
                    transition: 'width 0.5s ease'
                  }} />
                </div>
                <p style={{ fontSize: '12px', opacity: 0.7, marginTop: '8px' }}>
                  {formatCurrency(nextThreshold! - vaultValue)} more to unlock
                </p>
              </div>
            )}
          </div>
          
          {/* Digital Card */}
          {renderDigitalCard()}
        </div>
      </div>
      
      {/* Card Status */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '24px',
        marginBottom: '40px'
      }}>
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid #e0e0e0'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <CreditCard size={20} />
            <h3 style={{ fontSize: '18px', fontWeight: 500 }}>Physical Card Status</h3>
          </div>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
            {cardInfo?.status === 'pending' && 'Your physical card is being produced'}
            {cardInfo?.status === 'shipped' && 'Your physical card has been shipped'}
            {cardInfo?.status === 'delivered' && 'Your physical card has been delivered'}
            {!cardInfo && 'Order your physical AUCTA card'}
          </p>
          {cardInfo?.status === 'pending' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#f59e0b'
            }}>
              <Clock size={16} />
              <span style={{ fontSize: '14px' }}>Estimated delivery: 7-10 business days</span>
            </div>
          )}
          {cardInfo?.trackingNumber && (
            <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
              Tracking: {cardInfo.trackingNumber}
            </p>
          )}
          {!cardInfo && (
            <button 
              onClick={handleOrderCard}
              style={{
                padding: '8px 16px',
                background: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Order Physical Card
            </button>
          )}
        </div>
        
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid #e0e0e0'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <TrendingUp size={20} />
            <h3 style={{ fontSize: '18px', fontWeight: 500 }}>Cashback Earned</h3>
          </div>
          <p style={{ fontSize: '28px', fontWeight: 600, marginBottom: '8px' }}>
            {formatCurrency(cashbackBalance)}
          </p>
          <p style={{ fontSize: '14px', color: '#666' }}>
            From resales and partner purchases
          </p>
          {rewardsStats?.cashback && (
            <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
              {rewardsStats.cashback.transactionCount} transactions
            </p>
          )}
        </div>
        
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid #e0e0e0'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <Users size={20} />
            <h3 style={{ fontSize: '18px', fontWeight: 500 }}>Dedicated Support</h3>
          </div>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
            Your product manager
          </p>
          <p style={{ fontSize: '16px', fontWeight: 500 }}>Sophie Laurent</p>
          <a href="mailto:sophie.laurent@aucta.io" style={{
            fontSize: '14px',
            color: '#666',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginTop: '4px'
          }}>
            <Mail size={14} />
            sophie.laurent@aucta.io
          </a>
        </div>
      </div>
      
      {/* Active Benefits */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        padding: '32px',
        border: '1px solid #e0e0e0',
        marginBottom: '40px'
      }}>
        <h2 style={{
          fontSize: '24px',
          fontWeight: 500,
          marginBottom: '24px'
        }}>
          Your Active Benefits
        </h2>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px'
        }}>
          {subscribedTier && (
            <>
              <div style={{
                display: 'flex',
                gap: '16px',
                alignItems: 'flex-start'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  background: '#f3f4f6',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Sparkles size={20} />
                </div>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '4px' }}>
                    2% Cashback on Resales
                  </h4>
                  <p style={{ fontSize: '14px', color: '#666' }}>
                    Automatic rewards on all verified resales
                  </p>
                </div>
              </div>
              
              <div style={{
                display: 'flex',
                gap: '16px',
                alignItems: 'flex-start'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  background: '#f3f4f6',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Building2 size={20} />
                </div>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '4px' }}>
                    Boutique Fast-Track
                  </h4>
                  <p style={{ fontSize: '14px', color: '#666' }}>
                    Skip the line at partner stores
                  </p>
                </div>
              </div>
              
              {(subscribedTier === 'TIER_II' || subscribedTier === 'TIER_III') && (
                <>
                  <div style={{
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'flex-start'
                  }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      background: '#f3f4f6',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Gift size={20} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '4px' }}>
                        The Floorr Benefits
                      </h4>
                      <p style={{ fontSize: '14px', color: '#666' }}>
                        White-glove shipping and exclusive drops
                      </p>
                    </div>
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'flex-start'
                  }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      background: '#f3f4f6',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Zap size={20} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '4px' }}>
                        Priority Support
                      </h4>
                      <p style={{ fontSize: '14px', color: '#666' }}>
                        Dedicated manager and fast-track handling
                      </p>
                    </div>
                  </div>
                </>
              )}
              
              {subscribedTier === 'TIER_III' && (
                <>
                  <div style={{
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'flex-start'
                  }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      background: '#f3f4f6',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Crown size={20} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '4px' }}>
                        Pre-Auction Access
                      </h4>
                      <p style={{ fontSize: '14px', color: '#666' }}>
                        Exclusive preview of upcoming lots
                      </p>
                    </div>
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'flex-start'
                  }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      background: '#f3f4f6',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Shield size={20} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '4px' }}>
                        Legacy Planning
                      </h4>
                      <p style={{ fontSize: '14px', color: '#666' }}>
                        Estate reporting and succession advisory
                      </p>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
        
        {/* Benefits usage stats */}
        {rewardsStats?.benefitsUsage && rewardsStats.benefitsUsage.length > 0 && (
          <div style={{
            marginTop: '32px',
            paddingTop: '24px',
            borderTop: '1px solid #e0e0e0'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '16px' }}>
              Recent Benefits Usage
            </h3>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {rewardsStats.benefitsUsage.map((usage: any, index: number) => (
                <div key={index} style={{
                  padding: '8px 16px',
                  background: '#f3f4f6',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}>
                  {usage.benefit_type.replace(/_/g, ' ')}: {usage.usage_count}x
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Request Section */}
      <div style={{
        background: '#f9f9f9',
        borderRadius: '16px',
        padding: '32px',
        border: '1px solid #e0e0e0'
      }}>
        <h2 style={{
          fontSize: '24px',
          fontWeight: 500,
          marginBottom: '24px'
        }}>
          Service Requests
        </h2>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px'
        }}>
          <button 
            onClick={() => handleServiceRequest('concierge')}
            style={{
              padding: '20px',
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#000';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e0e0e0';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <span style={{ fontSize: '15px' }}>Request new concierge support</span>
            <ChevronRight size={18} />
          </button>
          
          <button 
            onClick={() => handleServiceRequest('update-tier')}
            style={{
              padding: '20px',
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#000';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e0e0e0';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <span style={{ fontSize: '15px' }}>Update card tier or subscription</span>
            <ChevronRight size={18} />
          </button>
          
          {subscribedTier === 'TIER_III' && (
            <button 
              onClick={() => handleServiceRequest('family-access')}
              style={{
                padding: '20px',
                background: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.3s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#000';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e0e0e0';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <span style={{ fontSize: '15px' }}>Apply for family access plan</span>
              <ChevronRight size={18} />
            </button>
          )}
          
          <button 
            onClick={() => handleServiceRequest('feedback')}
            style={{
              padding: '20px',
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#000';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e0e0e0';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <span style={{ fontSize: '15px' }}>Submit service feedback</span>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      
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