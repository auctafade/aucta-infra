// frontend/src/app/sprint-2/messages/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Search, Clock, AlertCircle, FileText, Shield, Package, User, Check, X, ChevronRight, Plus, Send } from 'lucide-react';
import { api, auth } from '@/lib/api';

// Message types
interface Message {
  id: number;
  client_id: number;
  sender_type: 'client' | 'admin' | 'system';
  sender_id?: number;
  sender_name?: string;
  subject?: string;
  content: string;
  message_type: 'general' | 'transfer' | 'valuation' | 'security' | 'document' | 'authentication';
  status: 'active' | 'archived';
  is_read: boolean;
  is_actionable: boolean;
  action_options?: string[];
  client_response?: string;
  passport_id?: number;
  transfer_request_id?: number;
  attachments?: Array<{ url: string; name: string; type: string }>;
  metadata?: any;
  created_at: string;
  read_at?: string;
  responded_at?: string;
}

export default function Messages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientData, setClientData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showCompose, setShowCompose] = useState(false);
  const [composeData, setComposeData] = useState({
    recipient_type: '',
    subject: '',
    content: '',
    message_category: '',
    passport_id: undefined as number | undefined,
    urgency: 'normal' as 'normal' | 'high' | 'urgent'
  });

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const client = auth.getClientData();
        if (!client) return;
        
        setClientData(client);
        
        // TODO: Replace with actual messages endpoint when available
        // const messagesData = await api.getClientMessages(client.id);
        
        // For now, we'll use action logs as a proxy for messages
        // This will be replaced when the messages endpoint is ready
        const activityData = await api.getClientActivity(client.id, 50);
        
        // Transform activity logs into message-like format temporarily
        const transformedMessages: Message[] = activityData
          .filter((activity: any) => {
            // Filter for message-worthy activities
            return [
              'TRANSFER_REQUEST_SUBMITTED',
              'PROXY_REQUEST_SUBMITTED',
              'SECURITY_REQUEST',
              'KYC_CHANGE_REQUEST',
              'DOCUMENT_GENERATED',
              'VALUATION_COMPLETED',
              'TRANSFER_STATUS_UPDATED_BY_ADMIN'
            ].includes(activity.action);
          })
          .map((activity: any, index: number) => {
            // Map activities to message format
            let subject = '';
            let content = '';
            let message_type: Message['message_type'] = 'general';
            let is_actionable = false;
            let action_options: string[] = [];
            
            switch (activity.action) {
              case 'TRANSFER_REQUEST_SUBMITTED':
                subject = 'Transfer Request Confirmation';
                content = `Your transfer request for ${activity.product || 'product'} has been received and is under review.`;
                message_type = 'transfer';
                break;
              case 'PROXY_REQUEST_SUBMITTED':
                subject = 'Proxy Assignment Under Review';
                content = `Your proxy request for ${activity.details?.proxy_name || 'proxy'} is being processed. AUCTA will contact both parties.`;
                message_type = 'security';
                break;
              case 'SECURITY_REQUEST':
                subject = 'Security Request Received';
                content = 'Your security request has been logged and will be reviewed by our team.';
                message_type = 'security';
                is_actionable = true;
                action_options = ['Acknowledge', 'Request Call'];
                break;
              case 'TRANSFER_STATUS_UPDATED_BY_ADMIN':
                subject = 'Transfer Status Update';
                content = `Your transfer request status has been updated to: ${activity.details?.new_status || 'in progress'}`;
                message_type = 'transfer';
                is_actionable = true;
                action_options = ['Acknowledge', 'Contact Support'];
                break;
              default:
                subject = 'AUCTA Notification';
                content = activity.action.replace(/_/g, ' ').toLowerCase();
                break;
            }
            
            return {
              id: activity.id,
              client_id: parseInt(client.id),
              sender_type: 'system' as const,
              subject,
              content,
              message_type,
              status: 'active' as const,
              is_read: false,
              is_actionable,
              action_options,
              created_at: activity.timestamp,
              metadata: activity.details
            };
          });
        
        setMessages(transformedMessages);
        setUnreadCount(transformedMessages.filter(m => !m.is_read).length);
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, []);

  // Filter messages based on search
  const filteredMessages = messages.filter(message => {
    const searchLower = searchQuery.toLowerCase();
    return (
      message.subject?.toLowerCase().includes(searchLower) ||
      message.content.toLowerCase().includes(searchLower) ||
      message.message_type.toLowerCase().includes(searchLower)
    );
  });

  // Mark message as read
  const markAsRead = async (messageId: number) => {
    try {
      // TODO: Call actual endpoint when available
      // await api.markMessageAsRead(clientData.id, messageId);
      
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, is_read: true, read_at: new Date().toISOString() } : msg
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  // Handle message response
  const handleMessageResponse = async (messageId: number, response: string) => {
    try {
      // TODO: Call actual endpoint when available
      // await api.respondToMessage(clientData.id, messageId, response);
      
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, client_response: response, responded_at: new Date().toISOString() } 
          : msg
      ));
      
      setSelectedMessage(null);
    } catch (error) {
      console.error('Error responding to message:', error);
    }
  };

  // Send new message
  const handleSendMessage = async () => {
    try {
      if (!composeData.recipient_type || !composeData.content || !composeData.message_category) {
        alert('Please fill in all required fields');
        return;
      }

      // TODO: Call actual endpoint when available
      // const response = await api.sendClientMessage(clientData.id, composeData);
      
      // For now, simulate message creation
      const newMessage: Message = {
        id: Date.now(),
        client_id: clientData.id,
        sender_type: 'client',
        subject: composeData.subject || `New ${composeData.recipient_type} request`,
        content: composeData.content,
        message_type: 'general',
        status: 'active',
        is_read: true,
        is_actionable: false,
        created_at: new Date().toISOString()
      };

      setMessages(prev => [newMessage, ...prev]);
      setShowCompose(false);
      setComposeData({
        recipient_type: '',
        subject: '',
        content: '',
        message_category: '',
        passport_id: undefined,
        urgency: 'normal'
      });

      // Show success message
      console.log('Message sent successfully');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  // Get icon for message type
  const getMessageIcon = (type: Message['message_type']) => {
    switch (type) {
      case 'transfer': return <Package size={16} />;
      case 'security': return <Shield size={16} />;
      case 'document': return <FileText size={16} />;
      case 'valuation': return <AlertCircle size={16} />;
      default: return <User size={16} />;
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffHours < 48) return 'Yesterday';
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
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
          <p style={{ color: '#666', fontSize: '14px' }}>Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header Section */}
      <div style={{
        background: 'linear-gradient(135deg, #000 0%, #333 100%)',
        borderRadius: '16px',
        padding: '48px',
        color: '#fff',
        marginBottom: '40px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: '-50%',
          right: '-10%',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
          borderRadius: '50%'
        }} />
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{
            fontSize: '36px',
            fontWeight: 300,
            marginBottom: '16px',
            letterSpacing: '-0.02em'
          }}>
            Secure Messages
          </h1>
          <p style={{
            fontSize: '18px',
            opacity: 0.9,
            marginBottom: '32px'
          }}>
            Official communications from AUCTA regarding your luxury assets
          </p>
          
          <div style={{
            display: 'flex',
            gap: '32px',
            flexWrap: 'wrap'
          }}>
            <div>
              <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '4px' }}>Total Messages</p>
              <p style={{ fontSize: '24px', fontWeight: 500 }}>{messages.length}</p>
            </div>
            <div>
              <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '4px' }}>Unread</p>
              <p style={{ fontSize: '24px', fontWeight: 500 }}>{unreadCount}</p>
            </div>
            <div>
              <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '4px' }}>Action Required</p>
              <p style={{ fontSize: '24px', fontWeight: 500 }}>
                {messages.filter(m => m.is_actionable && !m.client_response).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar and Compose Button */}
      <div style={{
        marginBottom: '32px',
        display: 'flex',
        gap: '16px',
        alignItems: 'center'
      }}>
        <div style={{
          flex: 1,
          position: 'relative'
        }}>
          <Search 
            size={20} 
            style={{
              position: 'absolute',
              left: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#666'
            }} 
          />
          <input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px 12px 48px',
              fontSize: '16px',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              outline: 'none',
              transition: 'border-color 0.3s',
              background: '#fff'
            }}
            onFocus={(e) => e.target.style.borderColor = '#000'}
            onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
          />
        </div>
        
        <button
          onClick={() => setShowCompose(true)}
          style={{
            padding: '12px 24px',
            background: '#000',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.3s',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#333';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#000';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <Plus size={20} />
          New Message
        </button>
      </div>

      {/* Messages List */}
      {filteredMessages.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '80px 40px',
          background: '#fff',
          borderRadius: '16px',
          border: '1px solid #e0e0e0'
        }}>
          <AlertCircle size={64} color="#e0e0e0" style={{ margin: '0 auto 24px' }} />
          <h2 style={{
            fontSize: '24px',
            fontWeight: 400,
            marginBottom: '16px',
            color: '#333'
          }}>
            {searchQuery ? 'No messages found' : 'No messages yet'}
          </h2>
          <p style={{
            fontSize: '16px',
            color: '#666',
            maxWidth: '400px',
            margin: '0 auto'
          }}>
            {searchQuery 
              ? 'Try adjusting your search terms'
              : 'Important communications from AUCTA will appear here'}
          </p>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {filteredMessages.map((message) => (
            <div
              key={message.id}
              style={{
                background: '#fff',
                borderRadius: '12px',
                border: '1px solid #e0e0e0',
                padding: '24px',
                cursor: 'pointer',
                transition: 'all 0.3s',
                position: 'relative',
                overflow: 'hidden'
              }}
              onClick={() => {
                setSelectedMessage(message);
                if (!message.is_read) {
                  markAsRead(message.id);
                }
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
              {/* Unread indicator */}
              {!message.is_read && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: '4px',
                  background: '#000'
                }} />
              )}

              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px'
              }}>
                {/* Message Type Icon */}
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  background: '#f5f5f5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {getMessageIcon(message.message_type)}
                </div>

                {/* Message Content */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px'
                  }}>
                    <h3 style={{
                      fontSize: '18px',
                      fontWeight: !message.is_read ? 600 : 500,
                      color: '#000',
                      margin: 0
                    }}>
                      {message.subject || 'AUCTA Notification'}
                    </h3>
                    <span style={{
                      fontSize: '14px',
                      color: '#666',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Clock size={14} />
                      {formatDate(message.created_at)}
                    </span>
                  </div>

                  <p style={{
                    fontSize: '16px',
                    color: '#666',
                    margin: '0 0 12px 0',
                    lineHeight: 1.5
                  }}>
                    {message.content}
                  </p>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    flexWrap: 'wrap'
                  }}>
                    {/* Sender Badge */}
                    <span style={{
                      fontSize: '12px',
                      padding: '4px 12px',
                      background: '#f5f5f5',
                      borderRadius: '16px',
                      color: '#666',
                      textTransform: 'capitalize'
                    }}>
                      {message.sender_type === 'system' ? 'AUCTA System' : message.sender_type}
                    </span>

                    {/* Action Required Badge */}
                    {message.is_actionable && !message.client_response && (
                      <span style={{
                        fontSize: '12px',
                        padding: '4px 12px',
                        background: '#000',
                        color: '#fff',
                        borderRadius: '16px',
                        fontWeight: 500
                      }}>
                        Action Required
                      </span>
                    )}

                    {/* Response Badge */}
                    {message.client_response && (
                      <span style={{
                        fontSize: '12px',
                        padding: '4px 12px',
                        background: '#e8f5e9',
                        color: '#4caf50',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <Check size={12} />
                        {message.client_response}
                      </span>
                    )}
                  </div>
                </div>

                {/* Arrow Icon */}
                <ChevronRight 
                  size={20} 
                  style={{
                    color: '#999',
                    flexShrink: 0,
                    marginTop: '12px'
                  }} 
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Message Detail Modal */}
      {selectedMessage && (
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
            maxHeight: '80vh',
            overflow: 'auto',
            position: 'relative'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '32px 32px 24px',
              borderBottom: '1px solid #e0e0e0'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                marginBottom: '16px'
              }}>
                <h2 style={{
                  fontSize: '24px',
                  fontWeight: 500,
                  margin: 0
                }}>
                  {selectedMessage.subject || 'AUCTA Notification'}
                </h2>
                <button
                  onClick={() => setSelectedMessage(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '8px',
                    transition: 'background 0.3s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                fontSize: '14px',
                color: '#666'
              }}>
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  {getMessageIcon(selectedMessage.message_type)}
                  {selectedMessage.message_type.charAt(0).toUpperCase() + selectedMessage.message_type.slice(1)}
                </span>
                <span>•</span>
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <Clock size={14} />
                  {new Date(selectedMessage.created_at).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '32px' }}>
              <p style={{
                fontSize: '16px',
                lineHeight: 1.6,
                color: '#333',
                marginBottom: '24px'
              }}>
                {selectedMessage.content}
              </p>

              {/* Additional Details */}
              {selectedMessage.metadata && (
                <div style={{
                  padding: '16px',
                  background: '#f9f9f9',
                  borderRadius: '8px',
                  marginBottom: '24px'
                }}>
                  <h4 style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    marginBottom: '12px',
                    color: '#666'
                  }}>
                    Additional Information
                  </h4>
                  <pre style={{
                    fontSize: '14px',
                    color: '#666',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'inherit'
                  }}>
                    {JSON.stringify(selectedMessage.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {/* Attachments */}
              {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    marginBottom: '12px',
                    color: '#666'
                  }}>
                    Attachments
                  </h4>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    {selectedMessage.attachments.map((attachment, index) => (
                      <a
                        key={index}
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '12px',
                          background: '#f5f5f5',
                          borderRadius: '8px',
                          textDecoration: 'none',
                          color: '#333',
                          transition: 'background 0.3s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#e8e8e8'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#f5f5f5'}
                      >
                        <FileText size={16} />
                        <span style={{ fontSize: '14px' }}>{attachment.name}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Options */}
              {selectedMessage.is_actionable && !selectedMessage.client_response && (
                <div>
                  <h4 style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    marginBottom: '12px',
                    color: '#666'
                  }}>
                    Please select your response:
                  </h4>
                  <div style={{
                    display: 'flex',
                    gap: '12px',
                    flexWrap: 'wrap'
                  }}>
                    {selectedMessage.action_options?.map((option) => (
                      <button
                        key={option}
                        onClick={() => handleMessageResponse(selectedMessage.id, option)}
                        style={{
                          padding: '12px 24px',
                          background: '#000',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.3s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#333';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#000';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Response Confirmation */}
              {selectedMessage.client_response && (
                <div style={{
                  padding: '16px',
                  background: '#e8f5e9',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Check size={20} color="#4caf50" />
                  <div>
                    <p style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#4caf50',
                      margin: '0 0 4px 0'
                    }}>
                      Response Submitted
                    </p>
                    <p style={{
                      fontSize: '14px',
                      color: '#666',
                      margin: 0
                    }}>
                      You responded: "{selectedMessage.client_response}" on {new Date(selectedMessage.responded_at!).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Compose Message Modal */}
      {showCompose && (
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
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '32px 32px 24px',
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h2 style={{
                fontSize: '24px',
                fontWeight: 500,
                margin: 0
              }}>
                New Message
              </h2>
              <button
                onClick={() => setShowCompose(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '8px',
                  transition: 'background 0.3s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '32px' }}>
              {/* Recipient Selection */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  marginBottom: '8px',
                  color: '#333'
                }}>
                  Who would you like to contact? *
                </label>
                <select
                  value={composeData.recipient_type}
                  onChange={(e) => setComposeData(prev => ({ ...prev, recipient_type: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '16px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    outline: 'none',
                    background: '#fff',
                    cursor: 'pointer'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#000'}
                  onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                >
                  <option value="">Select recipient...</option>
                  <option value="support">General Support</option>
                  <option value="authenticator">Nearest Authenticator</option>
                  <option value="advisor">Personal Advisor</option>
                  <option value="security">Security Team</option>
                  <option value="valuation">Valuation Expert</option>
                </select>
              </div>

              {/* Category Selection */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  marginBottom: '8px',
                  color: '#333'
                }}>
                  What is this about? *
                </label>
                <select
                  value={composeData.message_category}
                  onChange={(e) => setComposeData(prev => ({ ...prev, message_category: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '16px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    outline: 'none',
                    background: '#fff',
                    cursor: 'pointer'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#000'}
                  onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                >
                  <option value="">Select category...</option>
                  <option value="product_authentication">Product Authentication</option>
                  <option value="transfer_assistance">Transfer Assistance</option>
                  <option value="valuation_request">Valuation Request</option>
                  <option value="security_concern">Security Concern</option>
                  <option value="documentation">Documentation Request</option>
                  <option value="technical_support">Technical Support</option>
                  <option value="general_inquiry">General Inquiry</option>
                </select>
              </div>

              {/* Urgency Selection */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  marginBottom: '8px',
                  color: '#333'
                }}>
                  Urgency
                </label>
                <div style={{
                  display: 'flex',
                  gap: '12px'
                }}>
                  {(['normal', 'high', 'urgent'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setComposeData(prev => ({ ...prev, urgency: level }))}
                      style={{
                        flex: 1,
                        padding: '12px',
                        border: `1px solid ${composeData.urgency === level ? '#000' : '#e0e0e0'}`,
                        background: composeData.urgency === level ? '#000' : '#fff',
                        color: composeData.urgency === level ? '#fff' : '#333',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                        textTransform: 'capitalize'
                      }}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  marginBottom: '8px',
                  color: '#333'
                }}>
                  Subject (optional)
                </label>
                <input
                  type="text"
                  value={composeData.subject}
                  onChange={(e) => setComposeData(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Brief description of your request"
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '16px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#000'}
                  onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                />
              </div>

              {/* Message Content */}
              <div style={{ marginBottom: '32px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  marginBottom: '8px',
                  color: '#333'
                }}>
                  Message *
                </label>
                <textarea
                  value={composeData.content}
                  onChange={(e) => setComposeData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Please provide details about your request..."
                  rows={6}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '16px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#000'}
                  onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                />
              </div>

              {/* Info Box */}
              <div style={{
                padding: '16px',
                background: '#f9f9f9',
                borderRadius: '8px',
                marginBottom: '24px',
                fontSize: '14px',
                color: '#666'
              }}>
                <p style={{ margin: '0 0 8px 0' }}>
                  <strong>Response times:</strong>
                </p>
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  <li>General Support: 24 hours</li>
                  <li>Authenticator: 24-48 hours</li>
                  <li>Security Team: 1-2 hours (urgent), 24 hours (normal)</li>
                  <li>Valuation Expert: 3-5 business days</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => setShowCompose(false)}
                  style={{
                    padding: '12px 24px',
                    background: 'none',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.3s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#000';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e0e0e0';
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={!composeData.recipient_type || !composeData.content || !composeData.message_category}
                  style={{
                    padding: '12px 24px',
                    background: (!composeData.recipient_type || !composeData.content || !composeData.message_category) ? '#ccc' : '#000',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: 500,
                    cursor: (!composeData.recipient_type || !composeData.content || !composeData.message_category) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    if (composeData.recipient_type && composeData.content && composeData.message_category) {
                      e.currentTarget.style.background = '#333';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (composeData.recipient_type && composeData.content && composeData.message_category) {
                      e.currentTarget.style.background = '#000';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  <Send size={20} />
                  Send Message
                </button>
              </div>
            </div>
          </div>
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