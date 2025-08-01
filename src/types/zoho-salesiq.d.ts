// src/types/zoho-salesiq.d.ts
// TypeScript declarations for Zoho SalesIQ global objects

declare global {
  interface Window {
    $zoho?: {
      salesiq?: {
        widgetcode?: string;
        values?: Record<string, any>;
        ready?: () => void;
        
        chat?: {
          start: () => void;
          hours: (start: string, end: string, timezone: string) => void;
          greeting: (message: string) => void;
          title: (title: string) => void;
          onstart?: () => void;
          onend?: () => void;
          onmessagereceive?: (message: any) => void;
          onmessagesend?: (message: any) => void;
        };
        
        floatbutton?: {
          visible: (state: 'show' | 'hide') => void;
        };
        
        visitor?: {
          department: (dept: string) => void;
          name: (name: string) => void;
          email: (email: string) => void;
          phone: (phone: string) => void;
          info: (key: string, value: string) => void;
        };
        
        theme?: (config: {
          primary?: string;
          secondary?: string;
          background?: string;
          text?: string;
        }) => void;
      };
    };
  }
}

// Export empty object to make this a module
export {};