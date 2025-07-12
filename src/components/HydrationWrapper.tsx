// ===== src/components/HydrationWrapper.tsx =====
import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface HydrationWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const HydrationWrapper: React.FC<HydrationWrapperProps> = ({ 
  children, 
  fallback 
}) => {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Mark as hydrated after component mounts
    setIsHydrated(true);
  }, []);

  if (!isHydrated) {
    return (
      fallback || (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading...</h2>
            <p className="text-gray-600">Please wait while we load the page.</p>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
};

export default HydrationWrapper;