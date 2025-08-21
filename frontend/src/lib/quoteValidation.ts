// Quote Validation Utilities
// Ensures data integrity without blocking user flow

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// Validate service model and tier consistency
export function validateServiceModel(
  tier: number,
  serviceModel: string,
  hub1Address: any,
  hub2Address: any,
  noSecondHub: boolean
): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Tier 2 cannot have hybrid
  if (tier === 2 && serviceModel === 'hybrid') {
    errors.push({
      field: 'serviceModel',
      message: 'Tier 2 does not support hybrid service model',
      severity: 'error'
    });
  }
  
  // Tier > 1 requires Hub #1
  if (tier > 1 && (!hub1Address?.name || !hub1Address?.city)) {
    errors.push({
      field: 'hub1Address',
      message: 'Hub #1 (Authenticator) is required for Tier 2 and 3',
      severity: 'error'
    });
  }
  
  // Tier 3 requires Hub #2 unless toggled off
  if (tier === 3 && !noSecondHub && (!hub2Address?.name || !hub2Address?.city)) {
    errors.push({
      field: 'hub2Address',
      message: 'Hub #2 (Couturier) is required for Tier 3 unless "No second hub" is selected',
      severity: 'warning'
    });
  }
  
  return errors;
}

// Validate segment times
export function validateSegmentTimes(segments: any[]): ValidationError[] {
  const errors: ValidationError[] = [];
  
  segments.forEach((segment, index) => {
    if (segment.departure && segment.arrival) {
      const depTime = new Date(segment.departure).getTime();
      const arrTime = new Date(segment.arrival).getTime();
      
      if (arrTime <= depTime) {
        errors.push({
          field: `segment_${index}_time`,
          message: `Segment ${index + 1}: Arrival must be after departure`,
          severity: 'error'
        });
      }
      
      // Check if duration is reasonable (not more than 48 hours for a single segment)
      const durationHours = (arrTime - depTime) / (1000 * 60 * 60);
      if (durationHours > 48) {
        errors.push({
          field: `segment_${index}_duration`,
          message: `Segment ${index + 1}: Duration exceeds 48 hours, please verify`,
          severity: 'warning'
        });
      }
    }
    
    // Check continuity between segments
    if (index > 0 && segments[index - 1].arrival && segment.departure) {
      const prevArrival = new Date(segments[index - 1].arrival).getTime();
      const currDeparture = new Date(segment.departure).getTime();
      
      if (currDeparture < prevArrival) {
        errors.push({
          field: `segment_${index}_continuity`,
          message: `Segment ${index + 1}: Departure cannot be before previous segment's arrival`,
          severity: 'error'
        });
      }
      
      // Warning if gap is more than 24 hours
      const gapHours = (currDeparture - prevArrival) / (1000 * 60 * 60);
      if (gapHours > 24) {
        errors.push({
          field: `segment_${index}_gap`,
          message: `Segment ${index + 1}: ${Math.round(gapHours)}h gap from previous segment`,
          severity: 'info'
        });
      }
    }
  });
  
  return errors;
}

// Validate pricing fields
export function validatePricing(segments: any[], hubFees: any, margin: number): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Check segment pricing
  segments.forEach((segment, index) => {
    if (segment.mode === 'dhl' && segment.dhlPricing) {
      if (!segment.dhlPricing.quote || segment.dhlPricing.quote <= 0) {
        errors.push({
          field: `segment_${index}_dhl_price`,
          message: `Segment ${index + 1}: DHL price is required`,
          severity: 'error'
        });
      }
    }
    
    if (segment.mode === 'wg' && segment.wgPricing) {
      const total = (segment.wgPricing.flights || 0) + 
                   (segment.wgPricing.trains || 0) + 
                   (segment.wgPricing.ground || 0);
      
      if (total === 0 && !segment.wgPricing.other) {
        errors.push({
          field: `segment_${index}_wg_price`,
          message: `Segment ${index + 1}: WG transport costs not entered (will show as TBD)`,
          severity: 'info'
        });
      }
    }
  });
  
  // Check hub fees are numeric
  Object.entries(hubFees || {}).forEach(([key, value]) => {
    if (typeof value !== 'number' || isNaN(value as number)) {
      errors.push({
        field: `hubFee_${key}`,
        message: `Hub fee "${key}" must be a valid number`,
        severity: 'error'
      });
    }
  });
  
  // Check margin
  if (typeof margin !== 'number' || isNaN(margin) || margin < 0) {
    errors.push({
      field: 'margin',
      message: 'Margin must be a valid positive number',
      severity: 'error'
    });
  }
  
  if (margin > 100) {
    errors.push({
      field: 'margin',
      message: 'Margin exceeds 100% - please verify',
      severity: 'warning'
    });
  }
  
  return errors;
}

// Main validation function
export function validateQuote(quote: any): ValidationResult {
  const allErrors: ValidationError[] = [];
  
  // Validate service model and tier
  allErrors.push(...validateServiceModel(
    quote.tier,
    quote.serviceModel,
    quote.parties?.hub1,
    quote.parties?.hub2,
    quote.noSecondHub
  ));
  
  // Validate segment times
  if (quote.segments?.length > 0) {
    allErrors.push(...validateSegmentTimes(quote.segments));
  }
  
  // Validate pricing
  allErrors.push(...validatePricing(
    quote.segments || [],
    quote.hubFees,
    quote.margin
  ));
  
  // Separate errors and warnings
  const errors = allErrors.filter(e => e.severity === 'error');
  const warnings = allErrors.filter(e => e.severity === 'warning' || e.severity === 'info');
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// Format validation messages for display
export function formatValidationMessage(error: ValidationError): string {
  const icon = error.severity === 'error' ? '❌' : 
               error.severity === 'warning' ? '⚠️' : 'ℹ️';
  return `${icon} ${error.message}`;
}

// Check if specific field has errors
export function hasFieldError(field: string, errors: ValidationError[]): boolean {
  return errors.some(e => e.field === field && e.severity === 'error');
}

// Get field-specific errors
export function getFieldErrors(field: string, errors: ValidationError[]): ValidationError[] {
  return errors.filter(e => e.field === field || e.field.startsWith(`${field}_`));
}
