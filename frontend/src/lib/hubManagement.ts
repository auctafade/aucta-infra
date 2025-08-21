// Hub management utility functions
export interface Hub {
  id: string;
  name: string;
  code: string;
  type: 'authenticator' | 'couturier' | 'hybrid';
  status: 'active' | 'inactive' | 'maintenance';
  address: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  contacts: {
    id: string;
    name: string;
    role: string;
    email: string;
    phone: string;
    mobile?: string;
    isPrimary: boolean;
  }[];
  pricing: {
    id: string;
    serviceType: string;
    serviceName: string;
    price: number;
    currency: string;
    unit: string;
    tier1Price?: number;
    tier2Price?: number;
    tier3Price?: number;
  }[];
  capabilities: {
    authentication: boolean;
    sewing: boolean;
    nfc: boolean;
    storage: boolean;
    maxCapacity: number;
    operatingHours: string;
    specializations: string[];
  };
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export const loadHubsFromStorage = (): Hub[] => {
  if (typeof window !== 'undefined') {
    const savedHubs = localStorage.getItem('logistics_hubs');
    if (savedHubs) {
      return JSON.parse(savedHubs);
    }
  }
  
  // Return default hubs if none exist
  return [
    {
      id: 'hub_lhr_01',
      name: 'London Heathrow Hub',
      code: 'LHR01',
      type: 'authenticator',
      status: 'active',
      address: {
        street: '123 Airport Road',
        city: 'London',
        postalCode: 'TW6 1AP',
        country: 'United Kingdom'
      },
      contacts: [
        {
          id: 'contact_1',
          name: 'James Wilson',
          role: 'Hub Manager',
          email: 'james.wilson@aucta.com',
          phone: '+44 20 7946 0958',
          mobile: '+44 7700 900123',
          isPrimary: true
        }
      ],
      pricing: [
        {
          id: 'pricing_1',
          serviceType: 'authentication',
          serviceName: 'Product Authentication',
          price: 150,
          currency: 'EUR',
          unit: 'per item',
          tier1Price: 100,
          tier2Price: 125,
          tier3Price: 150
        }
      ],
      capabilities: {
        authentication: true,
        sewing: false,
        nfc: true,
        storage: true,
        maxCapacity: 100,
        operatingHours: '24/7',
        specializations: ['Luxury Goods', 'Electronics']
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: 'Primary authentication hub for UK and Europe'
    },
    {
      id: 'hub_cdg_01',
      name: 'Paris Charles de Gaulle Hub',
      code: 'CDG01',
      type: 'couturier',
      status: 'active',
      address: {
        street: '456 Rue de l\'Aéroport',
        city: 'Paris',
        postalCode: '95700',
        country: 'France'
      },
      contacts: [
        {
          id: 'contact_2',
          name: 'Marie Dubois',
          role: 'Couturier Specialist',
          email: 'marie.dubois@aucta.com',
          phone: '+33 1 49 75 15 15',
          isPrimary: true
        }
      ],
      pricing: [
        {
          id: 'pricing_2',
          serviceType: 'sewing',
          serviceName: 'Expert Sewing & Restoration',
          price: 200,
          currency: 'EUR',
          unit: 'per item',
          tier1Price: 150,
          tier2Price: 175,
          tier3Price: 200
        }
      ],
      capabilities: {
        authentication: true,
        sewing: true,
        nfc: true,
        storage: true,
        maxCapacity: 75,
        operatingHours: '8:00 AM - 8:00 PM',
        specializations: ['Haute Couture', 'Luxury Fashion', 'Historical Pieces']
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: 'Specialized in high-end fashion authentication and couturier services'
    },
    {
      id: 'hub_jfk_01',
      name: 'New York JFK Hub',
      code: 'JFK01',
      type: 'hybrid',
      status: 'active',
      address: {
        street: '789 Terminal Drive',
        city: 'New York',
        postalCode: '11430',
        country: 'United States'
      },
      contacts: [
        {
          id: 'contact_3',
          name: 'Michael Rodriguez',
          role: 'Operations Manager',
          email: 'michael.rodriguez@aucta.com',
          phone: '+1 718 244 4444',
          isPrimary: true
        }
      ],
      pricing: [
        {
          id: 'pricing_3',
          serviceType: 'authentication',
          serviceName: 'Full Authentication Suite',
          price: 175,
          currency: 'EUR',
          unit: 'per item',
          tier1Price: 125,
          tier2Price: 150,
          tier3Price: 175
        }
      ],
      capabilities: {
        authentication: true,
        sewing: true,
        nfc: true,
        storage: true,
        maxCapacity: 150,
        operatingHours: '24/7',
        specializations: ['Electronics', 'Luxury Goods', 'Art & Collectibles']
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: 'Full-service hybrid hub covering North American operations'
    }
  ];
};

export const getActiveHubs = (): Hub[] => {
  return loadHubsFromStorage().filter(hub => hub.status === 'active');
};

export const getHubsByType = (type: Hub['type']): Hub[] => {
  return getActiveHubs().filter(hub => hub.type === type || hub.type === 'hybrid');
};

export const getHubById = (id: string): Hub | undefined => {
  return loadHubsFromStorage().find(hub => hub.id === id);
};

export const getHubByCode = (code: string): Hub | undefined => {
  return loadHubsFromStorage().find(hub => hub.code === code);
};
