// Hub Price Book Configuration
// This would typically be stored in a database and editable via settings

export interface HubPricing {
  hubId: string;
  hubName: string;
  authenticationFee: number;
  sewingFee: number;
  qaFee: number;
  tagUnitCost: number;
  nfcUnitCost: number;
  internalRolloutCost: number;
}

// Default hub price book (would be loaded from API/settings)
export const defaultHubPriceBook: HubPricing[] = [
  {
    hubId: 'LON',
    hubName: 'London Hub',
    authenticationFee: 100,
    sewingFee: 200,
    qaFee: 50,
    tagUnitCost: 25,
    nfcUnitCost: 45,
    internalRolloutCost: 50
  },
  {
    hubId: 'PAR',
    hubName: 'Paris Hub',
    authenticationFee: 120,
    sewingFee: 250,
    qaFee: 60,
    tagUnitCost: 30,
    nfcUnitCost: 50,
    internalRolloutCost: 60
  },
  {
    hubId: 'MIL',
    hubName: 'Milan Hub',
    authenticationFee: 110,
    sewingFee: 220,
    qaFee: 55,
    tagUnitCost: 28,
    nfcUnitCost: 48,
    internalRolloutCost: 55
  },
  {
    hubId: 'NYC',
    hubName: 'New York Hub',
    authenticationFee: 150,
    sewingFee: 300,
    qaFee: 75,
    tagUnitCost: 35,
    nfcUnitCost: 60,
    internalRolloutCost: 80
  }
];

// Get hub pricing by name or return defaults
export function getHubPricing(hubName: string): HubPricing {
  const hub = defaultHubPriceBook.find(h => 
    h.hubName.toLowerCase().includes(hubName.toLowerCase()) ||
    hubName.toLowerCase().includes(h.hubId.toLowerCase())
  );
  
  // Return found hub or default values
  return hub || {
    hubId: 'DEFAULT',
    hubName: hubName || 'Default Hub',
    authenticationFee: 100,
    sewingFee: 200,
    qaFee: 50,
    tagUnitCost: 25,
    nfcUnitCost: 45,
    internalRolloutCost: 50
  };
}

// Calculate hub fees based on tier and configuration
export function calculateHubFees(
  tier: number,
  hub1Name: string,
  hub2Name: string | null,
  noSecondHub: boolean
): {
  authenticationFee: number;
  tagUnitCost: number;
  nfcUnitCost: number;
  sewingFee: number;
  qaFee: number;
  total: number;
  breakdown: {
    hub1: { name: string; fees: { [key: string]: number } };
    hub2?: { name: string; fees: { [key: string]: number } };
  };
} {
  const hub1Pricing = getHubPricing(hub1Name);
  const hub2Pricing = hub2Name && !noSecondHub ? getHubPricing(hub2Name) : null;
  
  let authenticationFee = 0;
  let tagUnitCost = 0;
  let nfcUnitCost = 0;
  let sewingFee = 0;
  let qaFee = 0;
  
  const breakdown: any = {
    hub1: { name: hub1Name, fees: {} }
  };
  
  if (tier === 2) {
    // Tier 2: Authentication + Tag at Hub #1 only
    authenticationFee = hub1Pricing.authenticationFee;
    tagUnitCost = hub1Pricing.tagUnitCost;
    
    breakdown.hub1.fees = {
      'Authentication': authenticationFee,
      'Security Tag': tagUnitCost
    };
  } else if (tier === 3) {
    // Tier 3: Authentication + NFC at Hub #1
    authenticationFee = hub1Pricing.authenticationFee;
    nfcUnitCost = hub1Pricing.nfcUnitCost;
    
    breakdown.hub1.fees = {
      'Authentication': authenticationFee,
      'NFC Chip': nfcUnitCost
    };
    
    // Sewing + QA at Hub #2 (if present)
    if (hub2Pricing && !noSecondHub) {
      sewingFee = hub2Pricing.sewingFee;
      qaFee = hub2Pricing.qaFee;
      
      breakdown.hub2 = {
        name: hub2Name!,
        fees: {
          'Sewing': sewingFee,
          'Quality Assurance': qaFee
        }
      };
    } else if (!noSecondHub) {
      // If no second hub but Tier 3, sewing happens at Hub #1
      sewingFee = hub1Pricing.sewingFee;
      qaFee = hub1Pricing.qaFee;
      
      breakdown.hub1.fees['Sewing'] = sewingFee;
      breakdown.hub1.fees['Quality Assurance'] = qaFee;
    }
  }
  
  const total = authenticationFee + tagUnitCost + nfcUnitCost + sewingFee + qaFee;
  
  return {
    authenticationFee,
    tagUnitCost,
    nfcUnitCost,
    sewingFee,
    qaFee,
    total,
    breakdown
  };
}
