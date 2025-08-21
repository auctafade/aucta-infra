'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ChevronRight, Users, Plus, Search, Filter, Mail, Phone, MapPin, Building, User, Edit, Trash2, Eye,
  Shield, CheckCircle, Clock, AlertTriangle, Star, Tag, Download, MessageSquare, FileText,
  Calendar, Globe, Award, Truck, Home, X, ExternalLink, Copy, History, Settings
} from 'lucide-react';
import { contactsApi, Contact, ContactsResponse } from '../../../../lib/contactsApi';

// Mock user permissions for RBAC
const getUserRole = () => 'ops_admin'; // 'ops_admin', 'ops_user', 'viewer'
const canViewPII = (role: string) => ['ops_admin', 'ops_user'].includes(role);
const canMerge = (role: string) => role === 'ops_admin';
const canEdit = (role: string) => ['ops_admin', 'ops_user'].includes(role);

// PII Masking functions
const maskEmail = (email: string, showFull: boolean = false) => {
  if (showFull) return email;
  const [local, domain] = email.split('@');
  const maskedLocal = local.length > 2 ? local.substring(0, 2) + '***' : '***';
  return `${maskedLocal}@${domain}`;
};

const maskPhone = (phone: string, showFull: boolean = false) => {
  if (showFull) return phone;
  return phone.replace(/\d(?=\d{4})/g, '*');
};

const maskName = (name: string, showFull: boolean = false) => {
  if (showFull) return name;
  const parts = name.split(' ');
  return parts.map((part, index) => {
    if (index === 0) return part; // Keep first name
    return part.charAt(0) + '***'; // Mask last name
  }).join(' ');
};

// Helper functions
const getRoleColor = (role: string) => {
  switch (role) {
    case 'sender': return 'bg-blue-100 text-blue-800';
    case 'buyer': return 'bg-green-100 text-green-800';
    case 'wg': return 'bg-purple-100 text-purple-800';
    case 'hub': return 'bg-orange-100 text-orange-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getKYCColor = (status: string) => {
  switch (status) {
    case 'ok': return 'bg-green-100 text-green-800';
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'failed': return 'bg-red-100 text-red-800';
    case 'n/a': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getKYCIcon = (status: string) => {
  switch (status) {
    case 'ok': return <CheckCircle className="h-3 w-3" />;
    case 'pending': return <Clock className="h-3 w-3" />;
    case 'failed': return <AlertTriangle className="h-3 w-3" />;
    default: return <Shield className="h-3 w-3" />;
  }
};

export default function ContactsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');
  const [filterKYC, setFilterKYC] = useState('all');
  const [filterActivity, setFilterActivity] = useState('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<number[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsStats, setContactsStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<any>(null);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeData, setMergeData] = useState<{ survivor: Contact | null, merged: Contact | null }>({ survivor: null, merged: null });
  const [userRole] = useState(getUserRole());
  const [showFullPII, setShowFullPII] = useState(canViewPII(userRole));
  const [piiLoggedViews, setPiiLoggedViews] = useState<Set<number>>(new Set());

  // Fetch contacts from API
  const fetchContacts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const filters = {
        search: searchQuery || undefined,
        role: filterRole !== 'all' ? filterRole : undefined,
        location: filterLocation !== 'all' ? filterLocation : undefined,
        kycStatus: filterKYC !== 'all' ? filterKYC : undefined,
        activity: filterActivity !== 'all' ? filterActivity : undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
      };

      const response = await contactsApi.getContacts(filters);
      setContacts(response.data);
      setContactsStats(response.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch contacts');
      console.error('Error fetching contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load and filter changes
  useEffect(() => {
    fetchContacts();
  }, [searchQuery, filterRole, filterLocation, filterKYC, filterActivity, selectedTags]);



  const availableTags = Array.from(new Set(contacts.flatMap(c => c.tags)));
  const availableLocations = Array.from(new Set(contacts.map(c => `${c.city}, ${c.country}`)));

  // Since filtering is now done server-side, we use contacts directly
  const filteredContacts = contacts;



  const toggleContactSelection = (contactId: number) => {
    setSelectedContacts(prev => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const toggleTagFilter = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  // Check for duplicates when a contact is selected
  const checkForDuplicates = async (contact: Contact) => {
    try {
      const response = await contactsApi.findDuplicates(contact.id);
      setDuplicates(response.data);
    } catch (error) {
      console.error('Error checking duplicates:', error);
    }
  };

  // Handle contact selection with duplicate check
  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(contact);
    if (!piiLoggedViews.has(contact.id)) {
      console.log(`PII accessed for contact ${contact.id} by user ${userRole}`);
      setPiiLoggedViews(prev => new Set([...prev, contact.id]));
    }
    checkForDuplicates(contact);
  };

  // Handle merge initiation
  const handleMergeContacts = (survivor: Contact, merged: Contact) => {
    setMergeData({ survivor, merged });
    setShowMergeModal(true);
  };

  // Handle unreachable marking
  const handleMarkUnreachable = async (contact: Contact, reason: string) => {
    try {
      await contactsApi.markUnreachable(contact.id, reason, userRole);
      await fetchContacts(); // Refresh data
      alert('Contact marked as unreachable');
    } catch (error) {
      console.error('Error marking unreachable:', error);
      alert('Failed to mark contact as unreachable');
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Breadcrumb */}
      <nav className="flex items-center space-x-2 text-sm text-gray-500">
        <Link href="/sprint-8" className="hover:text-gray-700">Sprint 8</Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/sprint-8/people" className="hover:text-gray-700">People</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-900">Contacts</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Contacts Directory</h1>
          <p className="text-gray-600 mt-2">Reusable contacts for Senders, Buyers, WG Operators, and Hub contacts</p>
        </div>
        
        <div className="flex items-center space-x-3">
          {selectedContacts.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">{selectedContacts.length} selected</span>
              <button className="text-sm bg-gray-100 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-200">
                <Tag className="h-4 w-4 inline mr-1" />
                Tag
              </button>
              <button className="text-sm bg-gray-100 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-200">
                <Download className="h-4 w-4 inline mr-1" />
                Export CSV
              </button>
            </div>
          )}
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>New Contact</span>
          </button>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="space-y-4">
          {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
              placeholder="Search by name, email, phone, company, or shipment ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
          </div>
          
          {/* Filter Row */}
          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Roles</option>
              <option value="sender">Sender</option>
              <option value="buyer">Buyer</option>
              <option value="wg">WG Operator</option>
              <option value="hub">Hub Contact</option>
            </select>
            
            <select
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Locations</option>
              {availableLocations.map(location => (
                <option key={location} value={location}>{location}</option>
              ))}
            </select>
            
            <select
              value={filterKYC}
              onChange={(e) => setFilterKYC(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All KYC Status</option>
              <option value="ok">KYC OK</option>
              <option value="pending">KYC Pending</option>
              <option value="failed">KYC Failed</option>
              <option value="n/a">KYC N/A</option>
            </select>
            
            <select
              value={filterActivity}
              onChange={(e) => setFilterActivity(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Activity</option>
              <option value="30">Used in last 30 days</option>
              <option value="90">Used in last 90 days</option>
            </select>
          </div>
          
          {/* Tags Filter */}
          {availableTags.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-gray-600">Tags:</span>
              {availableTags.map((tag: string) => (
                <button
                  key={tag}
                  onClick={() => toggleTagFilter(tag)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    selectedTags.includes(tag)
                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                      : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
              <div className="mt-3">
                <button
                  onClick={fetchContacts}
                  className="bg-red-100 px-3 py-1 rounded text-sm text-red-800 hover:bg-red-200"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contacts Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">
            Directory ({loading ? '...' : filteredContacts.length} contacts)
          </h2>
          {loading && (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm text-gray-500">Loading...</span>
            </div>
          )}
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedContacts.length === filteredContacts.length && filteredContacts.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedContacts(filteredContacts.map(c => c.id));
                      } else {
                        setSelectedContacts([]);
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name • Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">City/Country</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">KYC</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Primary Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Used</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"># Shipments</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
          {filteredContacts.map((contact) => (
                <tr 
                  key={contact.id} 
                  className={`hover:bg-gray-50 cursor-pointer ${selectedContacts.includes(contact.id) ? 'bg-blue-50' : ''}`}
                  onClick={() => handleContactSelect(contact)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedContacts.includes(contact.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleContactSelection(contact.id);
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      <div>
                        <div className="text-sm font-medium text-gray-900 flex items-center space-x-2">
                          <span>{maskName(contact.name, showFullPII)}</span>
                          {(contact as any).unreachable && (
                            <span className="inline-flex px-2 py-0.5 rounded text-xs bg-red-100 text-red-800">
                              Unreachable
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getRoleColor(contact.role)}`}>
                            {contact.role.toUpperCase()}
                          </span>
                          {contact.tags.map(tag => (
                            <span key={tag} className="inline-flex px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{contact.city}, {contact.country}</div>
                    <div className="text-sm text-gray-500">{contact.company}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getKYCColor(contact.kycStatus)}`}>
                      {getKYCIcon(contact.kycStatus)}
                      <span className="ml-1">{contact.kycStatus.toUpperCase()}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 flex items-center space-x-2">
                      <span>{maskEmail(contact.emails[0], showFullPII)}</span>
                      {!showFullPII && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowFullPII(true);
                            console.log(`Full PII revealed for contact ${contact.id}`);
                          }}
                          className="text-blue-600 hover:text-blue-800"
                          title="Reveal full email"
                        >
                          <Eye className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">{maskPhone(contact.phones[0], showFullPII)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {contact.lastUsed}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {contact.shipmentCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleContactSelect(contact);
                        }}
                        className="text-blue-600 hover:text-blue-900"
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedContact(contact);
                          setShowLinkModal(true);
                        }}
                        className="text-green-600 hover:text-green-900"
                        title="Link to shipment"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </button>
                      {canEdit(userRole) && (
                        <button 
                          className="text-gray-600 hover:text-gray-900"
                          title="Edit contact"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      )}
                      {canMerge(userRole) && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            checkForDuplicates(contact);
                          }}
                          className="text-purple-600 hover:text-purple-900"
                          title="Check duplicates"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      )}
                      {!(contact as any).unreachable && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const reason = prompt('Reason for marking unreachable:');
                            if (reason) handleMarkUnreachable(contact, reason);
                          }}
                          className="text-orange-600 hover:text-orange-900"
                          title="Mark unreachable"
                        >
                          <AlertTriangle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Contact Detail Panel */}
      {selectedContact && (
        <ContactDetailPanel 
          contact={selectedContact} 
          onClose={() => setSelectedContact(null)}
          onLinkToShipment={() => setShowLinkModal(true)}
        />
      )}

      {/* Duplicates Warning */}
      {duplicates && (duplicates.exact.length > 0 || duplicates.fuzzy.length > 0) && (
        <DuplicatesWarning 
          duplicates={duplicates}
          contact={selectedContact}
          onMerge={handleMergeContacts}
          onClose={() => setDuplicates(null)}
        />
      )}

      {/* Link to Shipment Modal */}
      {showLinkModal && (
        <LinkToShipmentModal 
          contact={selectedContact}
          onClose={() => setShowLinkModal(false)}
        />
      )}

      {/* Merge Modal */}
      {showMergeModal && mergeData.survivor && mergeData.merged && (
        <MergeContactsModal 
          survivor={mergeData.survivor}
          merged={mergeData.merged}
          onClose={() => setShowMergeModal(false)}
          onMerge={async (fieldSelections) => {
            try {
              await contactsApi.mergeContacts(
                mergeData.survivor!.id, 
                mergeData.merged!.id, 
                fieldSelections, 
                userRole
              );
              setShowMergeModal(false);
              setMergeData({ survivor: null, merged: null });
              await fetchContacts();
              alert('Contacts merged successfully');
            } catch (error) {
              console.error('Error merging contacts:', error);
              alert('Failed to merge contacts');
            }
          }}
        />
      )}
    </div>
  );
}

// Contact Detail Panel Component
function ContactDetailPanel({ contact, onClose, onLinkToShipment }: { contact: Contact, onClose: () => void, onLinkToShipment: () => void }) {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
      <div className="w-full max-w-2xl bg-white h-full overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-semibold text-gray-900">{contact.name}</h2>
            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(contact.role)}`}>
              {contact.role.toUpperCase()}
            </span>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getKYCColor(contact.kycStatus)}`}>
              {getKYCIcon(contact.kycStatus)}
              <span className="ml-1">{contact.kycStatus.toUpperCase()}</span>
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Status Notes */}
        {contact.role === 'wg' && (
          <div className="px-6 py-3 bg-blue-50 border-b border-blue-200">
            <p className="text-sm text-blue-800">Prefers evening communications • Available LA County</p>
          </div>
        )}

        {/* Tabs */}
        <div className="px-6 py-4 border-b border-gray-200">
          <nav className="flex space-x-8">
            {['profile', 'logistics', 'kyc', 'shipments', 'notes'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="px-6 py-6">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Identifiers */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Identifiers</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email(s)</label>
                    <div className="mt-1 space-y-2">
                      {contact.emails.map((email: string, idx: number) => (
                        <div key={idx} className="flex items-center space-x-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-900">{email}</span>
                          <button className="text-gray-400 hover:text-gray-600">
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone(s)</label>
                    <div className="mt-1 space-y-2">
                      {contact.phones.map((phone: string, idx: number) => (
                        <div key={idx} className="flex items-center space-x-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-900">{phone}</span>
                          <button className="text-gray-400 hover:text-gray-600">
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Company</label>
                    <div className="mt-1 flex items-center space-x-2">
                      <Building className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-900">{contact.company}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Addresses */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Addresses</h3>
                <div className="space-y-4">
                  {contact.addresses.map((address: any, idx: number) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900 capitalize">{address.type}</span>
                        <span className="text-xs text-gray-500">Address {idx + 1}</span>
                      </div>
                      <div className="text-sm text-gray-700">
                        {address.street}<br />
                        {address.city}, {address.zip}<br />
                        {address.country}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Communication Preferences */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Communication Preferences</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Preferred Channels</label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {contact.preferences.communication.map((channel: string) => (
                        <span key={channel} className="inline-flex px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                          {channel}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Language & Timezone</label>
                    <div className="mt-1 text-sm text-gray-900">
                      {contact.preferences.language.toUpperCase()} • {contact.preferences.timezone}
                    </div>
                  </div>
                </div>
              </div>

              {/* Time Windows */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Availability</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Pickup Hours</label>
                    <div className="mt-1 text-sm text-gray-900">{contact.preferences.timeWindows.pickup}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Delivery Hours</label>
                    <div className="mt-1 text-sm text-gray-900">{contact.preferences.timeWindows.delivery}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logistics' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Logistics Preferences</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Delivery Notes</label>
                    <div className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded-md">
                      {contact.logistics.deliveryNotes}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Security Requirements</label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {contact.logistics.securityRequirements?.map((req: string) => (
                        <span key={req} className="inline-flex px-2 py-1 rounded text-xs bg-red-100 text-red-800">
                          {req.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                  {contact.logistics.specialInstructions && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Special Instructions</label>
                      <div className="mt-1 text-sm text-gray-900 bg-yellow-50 p-3 rounded-md">
                        {contact.logistics.specialInstructions}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* WG Specific */}
              {contact.role === 'wg' && contact.logistics.areaCoverage && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">WG Operator Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Area Coverage</label>
                      <div className="mt-1 text-sm text-gray-900">{contact.logistics.areaCoverage}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Max Value Clearance</label>
                      <div className="mt-1 text-sm text-gray-900">${contact.logistics.maxValueClearance?.toLocaleString()}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Vehicle</label>
                      <div className="mt-1 text-sm text-gray-900">{contact.logistics.vehicle}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Rating</label>
                      <div className="mt-1 flex items-center space-x-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="text-sm text-gray-900">{contact.logistics.rating}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'kyc' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">KYC & Compliance</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getKYCColor(contact.kycStatus)}`}>
                        {getKYCIcon(contact.kycStatus)}
                        <span className="ml-2">{contact.kycStatus.toUpperCase()}</span>
                      </span>
                      {contact.kycDate && (
                        <span className="text-sm text-gray-500">Verified on {contact.kycDate}</span>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      {contact.kycStatus === 'failed' && (
                        <button className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">
                          Re-request KYC
                  </button>
                      )}
                      {contact.kycStatus === 'pending' && (
                        <button className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700">
                          Check Status
                  </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Documents on File</label>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="border border-gray-200 rounded-lg p-3 text-center">
                        <FileText className="h-8 w-8 text-gray-400 mx-auto mb-1" />
                        <span className="text-xs text-gray-600">ID Document</span>
                      </div>
                      <div className="border border-gray-200 rounded-lg p-3 text-center">
                        <Home className="h-8 w-8 text-gray-400 mx-auto mb-1" />
                        <span className="text-xs text-gray-600">Proof of Address</span>
                      </div>
                      {contact.role === 'wg' && (
                        <div className="border border-gray-200 rounded-lg p-3 text-center">
                          <Shield className="h-8 w-8 text-gray-400 mx-auto mb-1" />
                          <span className="text-xs text-gray-600">NDA</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'shipments' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Shipment History</h3>
                <span className="text-sm text-gray-500">{contact.shipmentCount} total shipments</span>
              </div>
              <div className="space-y-3">
                {contact.shipmentHistory.map((shipment: any, idx: number) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 cursor-pointer">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <span className="font-medium text-blue-600">{shipment.id}</span>
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{shipment.tier}</span>
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">{shipment.mode}</span>
                      </div>
                      <button className="text-gray-400 hover:text-gray-600">
                        <ExternalLink className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="text-sm text-gray-600">
                      Hub: {shipment.hub} • Role: {shipment.role} • {shipment.date}
                    </div>
                    <div className="mt-2">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        shipment.status === 'delivered' ? 'bg-green-100 text-green-800' :
                        shipment.status === 'in-transit' ? 'bg-blue-100 text-blue-800' :
                        shipment.status === 'returned' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {shipment.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Notes & Audit</h3>
                <button className="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700">
                  Add Note
                </button>
              </div>
              <div className="space-y-4">
                {contact.notes.map((note: any, idx: number) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">{note.author}</span>
                      <span className="text-sm text-gray-500">{note.date}</span>
                    </div>
                    <p className="text-sm text-gray-700">{note.content}</p>
            </div>
          ))}
                <button className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1">
                  <History className="h-4 w-4" />
                  <span>View full audit log</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
          <div className="flex space-x-3">
            <button 
              onClick={onLinkToShipment}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Link to Shipment</span>
            </button>
            <button className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 flex items-center space-x-2">
              <Edit className="h-4 w-4" />
              <span>Edit Contact</span>
            </button>
            <button className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 flex items-center space-x-2">
              <MessageSquare className="h-4 w-4" />
              <span>Test Message</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Link to Shipment Modal Component
function LinkToShipmentModal({ contact, onClose }: { contact: Contact | null, onClose: () => void }) {
  if (!contact) return null;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('sender');
  const [selectedShipment, setSelectedShipment] = useState('');
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);

  const searchShipments = async (query: string) => {
    if (!query.trim()) {
      setShipments([]);
      return;
    }
    
    try {
      setLoading(true);
      const response = await contactsApi.searchShipments(query);
      setShipments(response.data);
    } catch (error) {
      console.error('Error searching shipments:', error);
      setShipments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchShipments(searchQuery);
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const filteredShipments = shipments;

  const handleLink = async () => {
    if (!selectedShipment || !contact || linking) return;
    
    // Validation for WG role
    if (selectedRole === 'wg' && contact.logistics?.maxValueClearance) {
      const shipment = shipments.find(s => s.id === selectedShipment);
      if (shipment && shipment.value > contact.logistics.maxValueClearance) {
        alert(`Cannot assign: shipment value ($${shipment.value.toLocaleString()}) exceeds WG max clearance ($${contact.logistics.maxValueClearance.toLocaleString()})`);
        return;
      }
    }
    
    try {
      setLinking(true);
      const response = await contactsApi.linkToShipment(contact.id, selectedShipment, selectedRole);
      alert(response.message);
      onClose();
    } catch (error) {
      console.error('Error linking contact:', error);
      alert(error instanceof Error ? error.message : 'Failed to link contact to shipment');
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Link to Shipment</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
        
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search Shipment</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Enter shipment ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role in Shipment</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="sender">Sender</option>
              <option value="buyer">Buyer</option>
              <option value="wg">WG Operator</option>
              <option value="hub">Hub Contact</option>
            </select>
        </div>
        
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Shipment</label>
            {loading && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-sm text-gray-500">Searching...</span>
              </div>
            )}
            {!loading && filteredShipments.length === 0 && searchQuery && (
              <div className="text-center py-4 text-gray-500">
                No shipments found for "{searchQuery}"
              </div>
            )}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {filteredShipments.map(shipment => (
                <label key={shipment.id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="shipment"
                    value={shipment.id}
                    checked={selectedShipment === shipment.id}
                    onChange={(e) => setSelectedShipment(e.target.value)}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{shipment.id}</div>
                    <div className="text-sm text-gray-500">{shipment.tier} • ${shipment.value.toLocaleString()} • {shipment.status}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Warning for WG value clearance */}
          {selectedRole === 'wg' && selectedShipment && contact.logistics?.maxValueClearance && (
            (() => {
              const shipment = shipments.find((s: any) => s.id === selectedShipment);
              return shipment && shipment.value > (contact.logistics?.maxValueClearance || 0) ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex">
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Value Clearance Exceeded</h3>
                      <div className="mt-2 text-sm text-red-700">
                        Shipment value (${shipment.value.toLocaleString()}) exceeds WG max clearance (${contact.logistics.maxValueClearance.toLocaleString()})
                      </div>
                    </div>
                  </div>
                </div>
              ) : null;
            })()
          )}
        </div>
        
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleLink}
            disabled={!selectedShipment || linking}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {linking && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
            <span>{linking ? 'Linking...' : 'Link Contact'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// Duplicates Warning Component
function DuplicatesWarning({ duplicates, contact, onMerge, onClose }: { 
  duplicates: any, 
  contact: Contact | null, 
  onMerge: (survivor: Contact, merged: Contact) => void, 
  onClose: () => void 
}) {
  if (!contact) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <span>Potential Duplicates Found</span>
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
        
        <div className="px-6 py-4 space-y-4">
          {duplicates.exact && duplicates.exact.length > 0 && (
            <div>
              <h4 className="font-medium text-red-800 mb-2">Exact Matches (Email/Phone)</h4>
              <div className="space-y-2">
                {duplicates.exact.map((dup: any) => (
                  <div key={dup.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div>
                      <div className="font-medium">{dup.name}</div>
                      <div className="text-sm text-gray-600">{dup.email} • {dup.phone}</div>
                    </div>
                    <button 
                      onClick={() => onMerge(contact, dup)}
                      className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                    >
                      Merge
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {duplicates.fuzzy && duplicates.fuzzy.length > 0 && (
            <div>
              <h4 className="font-medium text-yellow-800 mb-2">Similar Names (Same City)</h4>
              <div className="space-y-2">
                {duplicates.fuzzy.map((dup: any) => (
                  <div key={dup.id} className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div>
                      <div className="font-medium">{dup.name}</div>
                      <div className="text-sm text-gray-600">{dup.city}, {dup.country} • Similarity: {Math.round(dup.similarity * 100)}%</div>
                    </div>
                    <button 
                      onClick={() => onMerge(contact, dup)}
                      className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
                    >
                      Merge
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!duplicates.exact || duplicates.exact.length === 0) && (!duplicates.fuzzy || duplicates.fuzzy.length === 0) && (
            <div className="text-center py-4 text-gray-500">
              No duplicates found for this contact.
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

// Merge Contacts Modal Component
function MergeContactsModal({ survivor, merged, onClose, onMerge }: {
  survivor: Contact,
  merged: Contact,
  onClose: () => void,
  onMerge: (fieldSelections: Record<string, string>) => void
}) {
  const [fieldSelections, setFieldSelections] = useState<Record<string, string>>({});
  
  const mergeableFields = [
    { key: 'name', label: 'Name' },
    { key: 'emails', label: 'Emails' },
    { key: 'phones', label: 'Phones' },
    { key: 'company', label: 'Company' },
    { key: 'addresses', label: 'Addresses' },
    { key: 'preferences', label: 'Preferences' },
    { key: 'logistics', label: 'Logistics' },
    { key: 'tags', label: 'Tags' }
  ];

  const handleFieldSelection = (field: string, source: 'survivor' | 'merged') => {
    setFieldSelections(prev => ({
      ...prev,
      [field]: source
    }));
  };

  const getFieldValue = (contact: Contact, field: string) => {
    const value = (contact as any)[field];
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value || 'N/A');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-96 overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Merge Contacts: {survivor.name} ← {merged.name}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
        
        <div className="px-6 py-4">
          <p className="text-sm text-gray-600 mb-4">
            Select which value to keep for each field. Shipment histories and notes will be combined automatically.
          </p>
          
          <div className="space-y-4">
            {mergeableFields.map(field => (
              <div key={field.key} className="grid grid-cols-3 gap-4 items-center">
                <div className="font-medium text-gray-900">{field.label}</div>
                
                <label className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name={field.key}
                    value="survivor"
                    checked={fieldSelections[field.key] === 'survivor'}
                    onChange={() => handleFieldSelection(field.key, 'survivor')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">Keep: {survivor.name}</div>
                    <div className="text-sm text-gray-500 truncate">{getFieldValue(survivor, field.key)}</div>
                  </div>
                </label>
                
                <label className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name={field.key}
                    value="merged"
                    checked={fieldSelections[field.key] === 'merged'}
                    onChange={() => handleFieldSelection(field.key, 'merged')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">Keep: {merged.name}</div>
                    <div className="text-sm text-gray-500 truncate">{getFieldValue(merged, field.key)}</div>
                  </div>
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onMerge(fieldSelections)}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
          >
            Merge Contacts
          </button>
        </div>
      </div>
    </div>
  );
}
