// backend/lib/sprint8/contactValidation.js

// Email validation using regex
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Phone normalization to E.164 format
function normalizePhoneToE164(phone, countryCode = 'US') {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Country code mappings for common countries
  const countryPrefixes = {
    'US': '1',
    'CA': '1', 
    'GB': '44',
    'DE': '49',
    'FR': '33',
    'IT': '39',
    'ES': '34',
    'AU': '61',
    'JP': '81',
    'CN': '86',
    'IN': '91',
    'BR': '55'
  };
  
  let normalized = digits;
  const prefix = countryPrefixes[countryCode] || '1';
  
  // If number doesn't start with country code, add it
  if (!normalized.startsWith(prefix)) {
    // For US/CA, if it's 10 digits, add '1'
    if ((countryCode === 'US' || countryCode === 'CA') && digits.length === 10) {
      normalized = '1' + digits;
    } else {
      normalized = prefix + digits;
    }
  }
  
  return '+' + normalized;
}

// Validate country ISO code (simplified - in production use full ISO 3166-1 list)
function validateCountryISO(countryCode) {
  const validCountries = [
    'US', 'CA', 'GB', 'DE', 'FR', 'IT', 'ES', 'AU', 'JP', 'CN', 'IN', 'BR',
    'MX', 'NL', 'SE', 'NO', 'DK', 'FI', 'CH', 'AT', 'BE', 'PL', 'CZ', 'HU',
    'PT', 'GR', 'IE', 'NZ', 'SG', 'HK', 'TW', 'KR', 'TH', 'MY', 'PH', 'ID',
    'VN', 'BD', 'PK', 'LK', 'MM', 'KH', 'LA', 'BN', 'MN', 'KZ', 'UZ', 'KG',
    'TJ', 'TM', 'AF', 'IR', 'IQ', 'SA', 'AE', 'QA', 'BH', 'KW', 'OM', 'YE',
    'JO', 'LB', 'SY', 'IL', 'PS', 'TR', 'GE', 'AM', 'AZ', 'RU', 'UA', 'BY',
    'MD', 'LT', 'LV', 'EE', 'RO', 'BG', 'HR', 'SI', 'SK', 'RS', 'BA', 'ME',
    'MK', 'AL', 'XK', 'MT', 'CY', 'IS', 'LU', 'LI', 'AD', 'MC', 'SM', 'VA'
  ];
  return validCountries.includes(countryCode.toUpperCase());
}

// Infer timezone from country and city (simplified)
function inferTimezone(country, city) {
  const timezoneMap = {
    'US': {
      'New York': 'America/New_York',
      'Los Angeles': 'America/Los_Angeles',
      'Chicago': 'America/Chicago',
      'Denver': 'America/Denver',
      'Phoenix': 'America/Phoenix',
      'Seattle': 'America/Los_Angeles',
      'Miami': 'America/New_York',
      'Las Vegas': 'America/Los_Angeles',
      'default': 'America/New_York'
    },
    'CA': {
      'Toronto': 'America/Toronto',
      'Vancouver': 'America/Vancouver',
      'Montreal': 'America/Montreal',
      'Calgary': 'America/Edmonton',
      'default': 'America/Toronto'
    },
    'GB': { 'default': 'Europe/London' },
    'DE': { 'default': 'Europe/Berlin' },
    'FR': { 'default': 'Europe/Paris' },
    'IT': { 'default': 'Europe/Rome' },
    'ES': { 'default': 'Europe/Madrid' },
    'AU': {
      'Sydney': 'Australia/Sydney',
      'Melbourne': 'Australia/Melbourne',
      'Brisbane': 'Australia/Brisbane',
      'Perth': 'Australia/Perth',
      'default': 'Australia/Sydney'
    },
    'JP': { 'default': 'Asia/Tokyo' },
    'CN': { 'default': 'Asia/Shanghai' },
    'IN': { 'default': 'Asia/Kolkata' },
    'BR': { 'default': 'America/Sao_Paulo' }
  };
  
  const countryTimezones = timezoneMap[country.toUpperCase()];
  if (!countryTimezones) return 'UTC';
  
  return countryTimezones[city] || countryTimezones.default || 'UTC';
}

// Fuzzy name matching using Levenshtein distance
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

function fuzzyNameMatch(name1, name2, threshold = 0.8) {
  const normalized1 = name1.toLowerCase().trim();
  const normalized2 = name2.toLowerCase().trim();
  
  if (normalized1 === normalized2) return 1.0;
  
  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);
  const similarity = 1 - (distance / maxLength);
  
  return similarity >= threshold;
}

// Validate WG insurance
function validateWGInsurance(logistics) {
  if (!logistics || !logistics.insurance) return { valid: false, message: 'Insurance status required for WG profiles' };
  
  if (logistics.insurance === 'Active') {
    if (!logistics.insuranceExpiryDate) {
      return { valid: false, message: 'Insurance expiry date required for Active status' };
    }
    
    const expiryDate = new Date(logistics.insuranceExpiryDate);
    const today = new Date();
    
    if (expiryDate <= today) {
      return { valid: false, message: 'Insurance expiry date must be in the future' };
    }
  }
  
  return { valid: true };
}

// Comprehensive contact validation
function validateContactData(contactData, isUpdate = false) {
  const errors = [];
  
  // Email validation
  if (contactData.emails) {
    contactData.emails.forEach((email, index) => {
      if (!validateEmail(email)) {
        errors.push(`Invalid email format at index ${index}: ${email}`);
      }
    });
  }
  
  // Phone validation and normalization
  if (contactData.phones) {
    const normalizedPhones = [];
    contactData.phones.forEach((phone, index) => {
      try {
        const normalized = normalizePhoneToE164(phone, contactData.country);
        normalizedPhones.push({
          original: phone,
          normalized: normalized
        });
      } catch (error) {
        errors.push(`Invalid phone format at index ${index}: ${phone}`);
      }
    });
    contactData.normalizedPhones = normalizedPhones;
  }
  
  // Country validation
  if (contactData.country && !validateCountryISO(contactData.country)) {
    errors.push(`Invalid country code: ${contactData.country}`);
  }
  
  // WG insurance validation
  if (contactData.role === 'wg') {
    const insuranceValidation = validateWGInsurance(contactData.logistics);
    if (!insuranceValidation.valid) {
      errors.push(insuranceValidation.message);
    }
  }
  
  // Timezone inference
  if (contactData.country && contactData.city && (!contactData.preferences || !contactData.preferences.timezone)) {
    const inferredTimezone = inferTimezone(contactData.country, contactData.city);
    if (!contactData.preferences) contactData.preferences = {};
    contactData.preferences.timezone = inferredTimezone;
  }
  
  return {
    valid: errors.length === 0,
    errors: errors,
    processedData: contactData
  };
}

// Duplicate detection
async function detectDuplicates(contactData, excludeId = null) {
  const pool = require('../database'); // Import database connection
  
  const duplicates = {
    exact: [], // Exact email/phone matches
    fuzzy: [], // Fuzzy name + same city matches
    potential: [] // Other potential matches
  };
  
  try {
    // 1. Check for exact email matches
    if (contactData.emails && contactData.emails.length > 0) {
      const emailQuery = `
        SELECT id, name, emails, phones_original as phones, city, country, role, kyc_status
        FROM contacts 
        WHERE emails && $1 AND status != 'deleted'
        ${excludeId ? 'AND id != $2' : ''}
      `;
      const emailParams = [contactData.emails];
      if (excludeId) emailParams.push(excludeId);
      
      const emailResults = await pool.query(emailQuery, emailParams);
      duplicates.exact.push(...emailResults.rows.map(row => ({
        ...row,
        matchType: 'email',
        confidence: 1.0
      })));
    }
    
    // 2. Check for exact phone matches
    if (contactData.phones && contactData.phones.length > 0) {
      const phoneQuery = `
        SELECT id, name, emails, phones_original as phones, city, country, role, kyc_status
        FROM contacts 
        WHERE phones && $1 AND status != 'deleted'
        ${excludeId ? 'AND id != $2' : ''}
      `;
      const phoneParams = [contactData.phones];
      if (excludeId) phoneParams.push(excludeId);
      
      const phoneResults = await pool.query(phoneQuery, phoneParams);
      duplicates.exact.push(...phoneResults.rows.map(row => ({
        ...row,
        matchType: 'phone',
        confidence: 1.0
      })));
    }
    
    // 3. Check for fuzzy name matches in same city
    if (contactData.name && contactData.city) {
      const nameQuery = `
        SELECT id, name, emails, phones_original as phones, city, country, role, kyc_status,
               similarity(name, $1) as name_similarity
        FROM contacts 
        WHERE city ILIKE $2 AND similarity(name, $1) > 0.6 AND status != 'deleted'
        ${excludeId ? 'AND id != $3' : ''}
        ORDER BY name_similarity DESC
      `;
      const nameParams = [contactData.name, contactData.city];
      if (excludeId) nameParams.push(excludeId);
      
      try {
        const nameResults = await pool.query(nameQuery, nameParams);
        duplicates.fuzzy.push(...nameResults.rows.map(row => ({
          ...row,
          matchType: 'fuzzy_name',
          confidence: row.name_similarity
        })));
      } catch (error) {
        // pg_trgm extension might not be installed, use simpler text matching
        const fallbackQuery = `
          SELECT id, name, emails, phones_original as phones, city, country, role, kyc_status
          FROM contacts 
          WHERE city ILIKE $2 AND name ILIKE $1 AND status != 'deleted'
          ${excludeId ? 'AND id != $3' : ''}
        `;
        const fallbackResults = await pool.query(fallbackQuery, [`%${contactData.name}%`, contactData.city, ...(excludeId ? [excludeId] : [])]);
        duplicates.fuzzy.push(...fallbackResults.rows.map(row => ({
          ...row,
          matchType: 'fuzzy_name',
          confidence: 0.8
        })));
      }
    }
    
    // Remove duplicates from results
    const uniqueExact = duplicates.exact.filter((item, index, self) => 
      index === self.findIndex(t => t.id === item.id)
    );
    const uniqueFuzzy = duplicates.fuzzy.filter((item, index, self) => 
      index === self.findIndex(t => t.id === item.id) && 
      !uniqueExact.some(e => e.id === item.id)
    );
    
    duplicates.exact = uniqueExact;
    duplicates.fuzzy = uniqueFuzzy;
    
  } catch (error) {
    console.error('Error detecting duplicates:', error);
    // Return empty duplicates on error
  }
  
  return duplicates;
}

module.exports = {
  validateEmail,
  normalizePhoneToE164,
  validateCountryISO,
  inferTimezone,
  fuzzyNameMatch,
  validateWGInsurance,
  validateContactData,
  detectDuplicates,
  levenshteinDistance
};
