// Quote Settings Configuration
// Default values for WG rates, buffers, and other calculations

export interface QuoteSettings {
  wg: {
    hourlyRate: number;
    overtimeThreshold: number; // hours
    overtimeMultiplier: number;
    perDiemRate: number;
  };
  buffers: {
    airportCheckIn: number; // minutes
    trainBuffer: number; // minutes
    transferBuffer: number; // minutes (default)
  };
  internal: {
    rolloutCostPerItem: number;
  };
  defaults: {
    marginPercentage: number;
    currency: string;
    insuranceRate: number; // percentage of declared value
  };
}

// Default settings (would be loaded from API/database in production)
export const defaultQuoteSettings: QuoteSettings = {
  wg: {
    hourlyRate: 75, // EUR per hour
    overtimeThreshold: 8, // hours
    overtimeMultiplier: 1.5,
    perDiemRate: 150 // EUR per day
  },
  buffers: {
    airportCheckIn: 90, // minutes
    trainBuffer: 20, // minutes
    transferBuffer: 30 // minutes
  },
  internal: {
    rolloutCostPerItem: 50 // EUR per item
  },
  defaults: {
    marginPercentage: 30,
    currency: 'EUR',
    insuranceRate: 0.003 // 0.3%
  }
};

// Load settings from localStorage (for demo purposes)
export function loadQuoteSettings(): QuoteSettings {
  try {
    const stored = localStorage.getItem('quoteSettings');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to ensure all fields exist
      return { ...defaultQuoteSettings, ...parsed };
    }
  } catch (error) {
    console.error('Failed to load quote settings:', error);
  }
  return defaultQuoteSettings;
}

// Save settings to localStorage
export function saveQuoteSettings(settings: QuoteSettings): void {
  try {
    localStorage.setItem('quoteSettings', JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save quote settings:', error);
  }
}

// Get specific setting value with fallback
export function getSettingValue<T>(
  path: string,
  fallback: T
): T {
  const settings = loadQuoteSettings();
  const keys = path.split('.');
  let value: any = settings;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return fallback;
    }
  }
  
  return value as T;
}

// Format currency based on settings
export function formatCurrency(
  amount: number,
  currency?: string,
  showSymbol: boolean = true
): string {
  const curr = currency || defaultQuoteSettings.defaults.currency;
  const symbol = curr === 'EUR' ? '€' : 
                 curr === 'USD' ? '$' : 
                 curr === 'GBP' ? '£' : curr;
  
  const formatted = amount.toFixed(2);
  return showSymbol ? `${symbol}${formatted}` : formatted;
}

// Convert minutes to hours
export function minutesToHours(minutes: number): number {
  return minutes / 60;
}

// Calculate buffer time in hours
export function calculateBufferHours(
  buffers: {
    airportCheckIn?: boolean;
    trainBuffer?: boolean;
    transferBuffer?: { enabled: boolean; minutes: number };
  }
): number {
  const settings = loadQuoteSettings();
  let totalMinutes = 0;
  
  if (buffers.airportCheckIn) {
    totalMinutes += settings.buffers.airportCheckIn;
  }
  
  if (buffers.trainBuffer) {
    totalMinutes += settings.buffers.trainBuffer;
  }
  
  if (buffers.transferBuffer?.enabled) {
    totalMinutes += buffers.transferBuffer.minutes || settings.buffers.transferBuffer;
  }
  
  return minutesToHours(totalMinutes);
}
