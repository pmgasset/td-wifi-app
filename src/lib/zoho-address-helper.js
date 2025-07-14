// ===== src/lib/zoho-address-helper.js ===== (COMPLETE UPDATED FILE)

/**
 * Enhanced Zoho Address Helper with improved truncation logic
 * FIXES: billing_address character limit issues, better field prioritization
 */

// Zoho Commerce Admin API address field limits
const LIMITS = {
  attention: 30,
  address1: 35,
  address2: 25,
  city: 20,
  state: 5,
  zip: 10,
  country: 3,
  phone: 15
};

// Total character limit for all address fields combined
const TOTAL_LIMIT = 100;

/**
 * Smart truncation that preserves important information
 */
function smartTruncate(text, maxLength) {
  if (!text || typeof text !== 'string') return '';
  if (text.length <= maxLength) return text;
  
  // For addresses, try to preserve important parts
  if (maxLength >= 10) {
    // Remove common words that add little value
    const cleaned = text
      .replace(/\b(apartment|apt|suite|ste|unit|building|bldg)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (cleaned.length <= maxLength) return cleaned;
  }
  
  return text.substring(0, maxLength).trim();
}

/**
 * Creates a Zoho-compatible address object with intelligent truncation
 */
export function createZohoAddress(customerInfo, shippingAddress) {
  console.log('Creating Zoho address from:', {
    customer: `${customerInfo.firstName} ${customerInfo.lastName}`,
    address: shippingAddress.address1,
    city: shippingAddress.city,
    state: shippingAddress.state,
    zip: shippingAddress.zipCode
  });

  // Start with basic truncation based on individual field limits
  const address = {
    attention: smartTruncate(`${customerInfo.firstName} ${customerInfo.lastName}`, LIMITS.attention),
    address1: smartTruncate(shippingAddress.address1, LIMITS.address1),
    address2: smartTruncate(shippingAddress.address2 || '', LIMITS.address2),
    city: smartTruncate(shippingAddress.city, LIMITS.city),
    state: smartTruncate(shippingAddress.state, LIMITS.state),
    zip: smartTruncate(shippingAddress.zipCode, LIMITS.zip),
    country: smartTruncate(shippingAddress.country || 'US', LIMITS.country),
    phone: smartTruncate(customerInfo.phone || '', LIMITS.phone)
  };

  // Calculate total length to ensure we're under the combined limit
  let totalLength = Object.values(address).join('').length;
  
  console.log('Initial address length calculation:', {
    fields: Object.fromEntries(
      Object.entries(address).map(([key, value]) => [key, { value, length: value.length }])
    ),
    totalLength,
    withinLimit: totalLength <= TOTAL_LIMIT
  });

  // If still over the total limit, apply progressive truncation
  if (totalLength > TOTAL_LIMIT) {
    console.log('Address exceeds total limit, applying progressive truncation...');
    
    // Priority order: keep the most important fields at full length
    // Higher priority = truncated last
    const truncationPriority = [
      { field: 'phone', minLength: 0, importance: 1 },
      { field: 'address2', minLength: 0, importance: 2 },
      { field: 'country', minLength: 2, importance: 3 },
      { field: 'attention', minLength: 8, importance: 4 },
      { field: 'zip', minLength: 5, importance: 5 },
      { field: 'state', minLength: 2, importance: 6 },
      { field: 'city', minLength: 6, importance: 7 },
      { field: 'address1', minLength: 15, importance: 8 }  // Most important - truncate last
    ];

    // Sort by importance (lowest first - these get truncated first)
    const sortedFields = truncationPriority.sort((a, b) => a.importance - b.importance);
    
    for (const { field, minLength } of sortedFields) {
      if (totalLength <= TOTAL_LIMIT) break;
      
      const currentLength = address[field].length;
      if (currentLength > minLength) {
        const maxReduction = currentLength - minLength;
        const neededReduction = Math.min(maxReduction, totalLength - TOTAL_LIMIT);
        
        if (neededReduction > 0) {
          const newLength = currentLength - neededReduction;
          address[field] = address[field].substring(0, newLength).trim();
          totalLength -= neededReduction;
          
          console.log(`Truncated ${field}: ${currentLength} → ${newLength} chars (saved ${neededReduction})`);
        }
      }
    }
  }

  // Final aggressive truncation if still over limit
  totalLength = Object.values(address).join('').length;
  if (totalLength > TOTAL_LIMIT) {
    console.log(`Still over limit (${totalLength}), applying emergency truncation...`);
    
    const excess = totalLength - TOTAL_LIMIT;
    
    // Emergency truncation: remove from least important fields first
    const emergencyOrder = ['phone', 'address2', 'attention', 'city', 'address1'];
    
    let remaining = excess;
    for (const field of emergencyOrder) {
      if (remaining <= 0) break;
      
      const currentLength = address[field].length;
      const canRemove = Math.max(0, currentLength - 1); // Leave at least 1 char
      const toRemove = Math.min(canRemove, remaining);
      
      if (toRemove > 0) {
        address[field] = address[field].substring(0, currentLength - toRemove).trim();
        remaining -= toRemove;
        console.log(`Emergency truncation ${field}: removed ${toRemove} chars`);
      }
    }
  }

  // Final verification and logging
  const finalLength = Object.values(address).join('').length;
  
  console.log('Final Zoho address created:', {
    address,
    field_lengths: Object.fromEntries(
      Object.entries(address).map(([key, value]) => [key, value.length])
    ),
    total_characters: finalLength,
    within_limit: finalLength <= TOTAL_LIMIT,
    character_savings: totalLength > TOTAL_LIMIT ? (totalLength - finalLength) : 0
  });

  if (finalLength > TOTAL_LIMIT) {
    console.error(`⚠️ CRITICAL: Address still exceeds limit! ${finalLength}/${TOTAL_LIMIT} characters`);
    
    // Last resort: truncate everything proportionally
    const scaleFactor = (TOTAL_LIMIT - 10) / finalLength; // Leave 10 char buffer
    Object.keys(address).forEach(field => {
      const newLength = Math.floor(address[field].length * scaleFactor);
      if (newLength > 0) {
        address[field] = address[field].substring(0, newLength).trim();
      }
    });
    
    console.log('Applied proportional scaling as last resort');
  }

  return address;
}

/**
 * Validates that an address meets Zoho's requirements
 */
export function validateZohoAddress(address) {
  const errors = [];
  const warnings = [];
  const totalLength = Object.values(address).join('').length;
  
  // Critical validations
  if (totalLength > TOTAL_LIMIT) {
    errors.push(`Total address length ${totalLength} exceeds ${TOTAL_LIMIT} character limit`);
  }
  
  // Check required fields
  if (!address.address1) errors.push('address1 is required');
  if (!address.city) errors.push('city is required');
  if (!address.state) errors.push('state is required');
  if (!address.zip) errors.push('zip is required');
  
  // Field length warnings
  Object.entries(LIMITS).forEach(([field, limit]) => {
    if (address[field] && address[field].length > limit) {
      warnings.push(`${field} length ${address[field].length} exceeds recommended limit of ${limit}`);
    }
  });
  
  // Content warnings
  if (totalLength > TOTAL_LIMIT * 0.9) {
    warnings.push(`Address is ${Math.round((totalLength / TOTAL_LIMIT) * 100)}% of character limit`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    totalLength,
    utilizationPercent: Math.round((totalLength / TOTAL_LIMIT) * 100)
  };
}

/**
 * Creates a minimal address for when space is extremely limited
 */
export function createMinimalZohoAddress(customerInfo, shippingAddress) {
  const minimal = {
    attention: `${customerInfo.firstName?.charAt(0) || ''}${customerInfo.lastName?.substring(0, 8) || ''}`,
    address1: shippingAddress.address1.substring(0, 20),
    city: shippingAddress.city.substring(0, 8),
    state: shippingAddress.state.substring(0, 2),
    zip: shippingAddress.zipCode.substring(0, 5),
    country: 'US'
  };
  
  // Remove empty fields
  Object.keys(minimal).forEach(key => {
    if (!minimal[key]) delete minimal[key];
  });
  
  const totalLength = Object.values(minimal).join('').length;
  console.log('Created minimal address:', { minimal, totalLength });
  
  return minimal;
}

/**
 * Formats address for different Zoho API endpoints
 */
export function formatForAPI(address, apiType = 'admin') {
  if (apiType === 'storefront') {
    // Storefront API uses different field names and has more relaxed limits
    return {
      first_name: address.attention?.split(' ')[0] || '',
      last_name: address.attention?.split(' ').slice(1).join(' ') || '',
      address: address.address1,
      address2: address.address2 || '',
      city: address.city,
      state: address.state,
      postal_code: address.zip,
      country: address.country || 'US'
    };
  }
  
  // Admin API format (default)
  return address;
}

export default {
  createZohoAddress,
  validateZohoAddress,
  createMinimalZohoAddress,
  formatForAPI,
  LIMITS,
  TOTAL_LIMIT
};