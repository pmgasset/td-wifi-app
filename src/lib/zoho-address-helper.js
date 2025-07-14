// ===== src/lib/zoho-address-helper.js ===== (CREATE THIS FILE)

/**
 * Zoho Commerce has strict character limits for address fields.
 * This helper ensures addresses comply with those limits.
 */

export function createZohoCompliantAddress(customerInfo, shippingAddress) {
  // Zoho character limits (based on error message analysis)
  const LIMITS = {
    attention: 50,     // Name field
    address1: 45,      // Main address line
    address2: 35,      // Secondary address line  
    city: 25,          // City name
    state: 20,         // State/Province
    zip: 10,           // Postal code
    country: 5,        // Country code
    phone: 15          // Phone number
  };

  // Smart truncation that preserves important information
  const smartTruncate = (text, limit) => {
    if (!text) return '';
    if (text.length <= limit) return text;
    
    // For addresses, try to keep important parts
    if (limit >= 20) {
      // Look for common separators and truncate intelligently
      const separators = [', ', ' - ', ' | ', '  '];
      for (const sep of separators) {
        if (text.includes(sep)) {
          const parts = text.split(sep);
          let result = parts[0];
          for (let i = 1; i < parts.length; i++) {
            if (result.length + sep.length + parts[i].length <= limit) {
              result += sep + parts[i];
            } else {
              break;
            }
          }
          if (result.length <= limit) return result;
        }
      }
    }
    
    // Simple truncation as fallback
    return text.substring(0, limit);
  };

  // Create the address object with smart truncation
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

  // Calculate total length to ensure we're under 100 characters
  const totalLength = Object.values(address).join('').length;
  
  // If still over 100 chars, be more aggressive
  if (totalLength > 95) { // Leave some buffer
    console.log('Address still too long, applying aggressive truncation...');
    
    // Priority order: keep the most important fields full-length
    const priorities = [
      { field: 'address1', minLength: 20 },
      { field: 'city', minLength: 10 },
      { field: 'state', minLength: 2 },
      { field: 'zip', minLength: 5 },
      { field: 'attention', minLength: 10 },
      { field: 'country', minLength: 2 },
      { field: 'phone', minLength: 0 },
      { field: 'address2', minLength: 0 }
    ];
    
    let currentLength = totalLength;
    
    for (const { field, minLength } of priorities.reverse()) {
      if (currentLength <= 95) break;
      
      const currentFieldLength = address[field].length;
      if (currentFieldLength > minLength) {
        const reduction = Math.min(currentFieldLength - minLength, currentLength - 95);
        address[field] = address[field].substring(0, currentFieldLength - reduction);
        currentLength -= reduction;
      }
    }
  }

  // Final verification
  const finalLength = Object.values(address).join('').length;
  
  console.log('Zoho address created:', {
    field_lengths: Object.fromEntries(
      Object.entries(address).map(([key, value]) => [key, value.length])
    ),
    total_characters: finalLength,
    within_limit: finalLength <= 100,
    original_total: totalLength
  });

  if (finalLength > 100) {
    console.warn(`⚠️ Address still exceeds 100 characters (${finalLength})`);
  }

  return address;
}

/**
 * Validates that an address meets Zoho's requirements
 */
export function validateZohoAddress(address) {
  const errors = [];
  const totalLength = Object.values(address).join('').length;
  
  if (totalLength > 100) {
    errors.push(`Total address length ${totalLength} exceeds 100 character limit`);
  }
  
  // Check required fields
  if (!address.address1) errors.push('address1 is required');
  if (!address.city) errors.push('city is required');
  if (!address.state) errors.push('state is required');
  if (!address.zip) errors.push('zip is required');
  
  return {
    valid: errors.length === 0,
    errors,
    totalLength
  };
}