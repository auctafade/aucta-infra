// Sprint8StyleWrapper.tsx - Ensures Sprint 8 uses consistent design system
'use client';

import React from 'react';
import '../app/globals.css';

interface StyleWrapperProps {
  children: React.ReactNode;
}

export const Sprint8StyleWrapper: React.FC<StyleWrapperProps> = ({ children }) => {
  return (
    <div className="sprint8-style-wrapper">
      <style jsx global>{`
        /* Sprint 8 Design System Overrides */
        .sprint8-style-wrapper {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color: var(--true-black);
          background: var(--off-white);
        }
        
        /* Comprehensive Tailwind CSS Overrides */
        .sprint8-style-wrapper .bg-white {
          background-color: var(--pure-white) !important;
        }
        
        .sprint8-style-wrapper .bg-gray-50 {
          background-color: var(--smoke) !important;
        }
        
        .sprint8-style-wrapper .bg-gray-100 {
          background-color: var(--off-white) !important;
        }
        
        .sprint8-style-wrapper .text-gray-900 {
          color: var(--true-black) !important;
        }
        
        .sprint8-style-wrapper .text-gray-700 {
          color: var(--charcoal) !important;
        }
        
        .sprint8-style-wrapper .text-gray-600 {
          color: var(--muted) !important;
        }
        
        .sprint8-style-wrapper .text-gray-500 {
          color: var(--muted) !important;
        }
        
        .sprint8-style-wrapper .text-gray-400 {
          color: var(--light-gray) !important;
        }
        
        .sprint8-style-wrapper .border-gray-200 {
          border-color: var(--light-gray) !important;
        }
        
        .sprint8-style-wrapper .border-gray-300 {
          border-color: var(--light-gray) !important;
        }
        
        /* Blue color mappings for buttons and accents */
        .sprint8-style-wrapper .bg-blue-600 {
          background-color: var(--true-black) !important;
        }
        
        .sprint8-style-wrapper .bg-blue-700 {
          background-color: var(--charcoal) !important;
        }
        
        .sprint8-style-wrapper .text-blue-600 {
          color: var(--true-black) !important;
        }
        
        .sprint8-style-wrapper .text-blue-700 {
          color: var(--charcoal) !important;
        }
        
        .sprint8-style-wrapper .border-blue-200 {
          border-color: var(--light-gray) !important;
        }
        
        .sprint8-style-wrapper .from-blue-50 {
          --tw-gradient-from: var(--smoke) !important;
        }
        
        .sprint8-style-wrapper .to-indigo-50 {
          --tw-gradient-to: var(--off-white) !important;
        }
        
        /* Status colors */
        .sprint8-style-wrapper .bg-green-50 {
          background-color: #f0f9f0 !important;
        }
        
        .sprint8-style-wrapper .border-green-200 {
          border-color: #bbf7d0 !important;
        }
        
        .sprint8-style-wrapper .text-green-600,
        .sprint8-style-wrapper .text-green-800 {
          color: #166534 !important;
        }
        
        .sprint8-style-wrapper .bg-red-50 {
          background-color: #fef2f2 !important;
        }
        
        .sprint8-style-wrapper .border-red-200 {
          border-color: #fecaca !important;
        }
        
        .sprint8-style-wrapper .text-red-600,
        .sprint8-style-wrapper .text-red-700,
        .sprint8-style-wrapper .text-red-800 {
          color: #dc2626 !important;
        }
        
        .sprint8-style-wrapper .bg-orange-100 {
          background-color: #fed7aa !important;
        }
        
        .sprint8-style-wrapper .text-orange-800 {
          color: #ea580c !important;
        }
        
        .sprint8-style-wrapper .border-orange-200 {
          border-color: #fed7aa !important;
        }
        
        .sprint8-style-wrapper .bg-yellow-100 {
          background-color: #fef3c7 !important;
        }
        
        .sprint8-style-wrapper .text-yellow-600,
        .sprint8-style-wrapper .text-yellow-800 {
          color: #d97706 !important;
        }
        
        .sprint8-style-wrapper .border-yellow-200 {
          border-color: #fef3c7 !important;
        }
        
        .sprint8-style-wrapper .bg-purple-100 {
          background-color: #f3e8ff !important;
        }
        
        .sprint8-style-wrapper .text-purple-600,
        .sprint8-style-wrapper .text-purple-800 {
          color: #9333ea !important;
        }
        
        .sprint8-style-wrapper .border-purple-200 {
          border-color: #e9d5ff !important;
        }
        
        /* Spacing overrides */
        .sprint8-style-wrapper .space-y-6 > * + * {
          margin-top: var(--space-lg) !important;
        }
        
        .sprint8-style-wrapper .space-y-4 > * + * {
          margin-top: var(--space-md) !important;
        }
        
        .sprint8-style-wrapper .space-y-3 > * + * {
          margin-top: var(--space-sm) !important;
        }
        
        .sprint8-style-wrapper .gap-4 {
          gap: var(--space-md) !important;
        }
        
        .sprint8-style-wrapper .gap-3 {
          gap: var(--space-sm) !important;
        }
        
        .sprint8-style-wrapper .gap-6 {
          gap: var(--space-lg) !important;
        }
        
        .sprint8-style-wrapper .p-6 {
          padding: var(--space-lg) !important;
        }
        
        .sprint8-style-wrapper .p-4 {
          padding: var(--space-md) !important;
        }
        
        .sprint8-style-wrapper .p-3 {
          padding: var(--space-sm) !important;
        }
        
        .sprint8-style-wrapper .px-6 {
          padding-left: var(--space-lg) !important;
          padding-right: var(--space-lg) !important;
        }
        
        .sprint8-style-wrapper .px-4 {
          padding-left: var(--space-md) !important;
          padding-right: var(--space-md) !important;
        }
        
        .sprint8-style-wrapper .px-3 {
          padding-left: var(--space-sm) !important;
          padding-right: var(--space-sm) !important;
        }
        
        .sprint8-style-wrapper .py-4 {
          padding-top: var(--space-md) !important;
          padding-bottom: var(--space-md) !important;
        }
        
        .sprint8-style-wrapper .py-2 {
          padding-top: var(--space-xs) !important;
          padding-bottom: var(--space-xs) !important;
        }
        
        .sprint8-style-wrapper .py-1 {
          padding-top: 4px !important;
          padding-bottom: 4px !important;
        }
        
        .sprint8-style-wrapper .mb-4 {
          margin-bottom: var(--space-md) !important;
        }
        
        .sprint8-style-wrapper .mb-3 {
          margin-bottom: var(--space-sm) !important;
        }
        
        .sprint8-style-wrapper .mb-2 {
          margin-bottom: var(--space-xs) !important;
        }
        
        .sprint8-style-wrapper .mt-4 {
          margin-top: var(--space-md) !important;
        }
        
        .sprint8-style-wrapper .mt-3 {
          margin-top: var(--space-sm) !important;
        }
        
        .sprint8-style-wrapper .mt-2 {
          margin-top: var(--space-xs) !important;
        }
        
        /* Border radius harmonization */
        .sprint8-style-wrapper .rounded-lg {
          border-radius: 8px !important;
        }
        
        .sprint8-style-wrapper .rounded-full {
          border-radius: 9999px !important;
        }
        
        .sprint8-style-wrapper .rounded {
          border-radius: 4px !important;
        }
        
        /* Typography overrides */
        .sprint8-style-wrapper h1 {
          font-size: var(--font-xlarge) !important;
          font-weight: 500 !important;
          line-height: 1.1 !important;
          letter-spacing: -0.02em !important;
          color: var(--true-black) !important;
        }
        
        .sprint8-style-wrapper h2 {
          font-size: var(--font-large) !important;
          font-weight: 500 !important;
          color: var(--true-black) !important;
        }
        
        .sprint8-style-wrapper h3 {
          font-size: var(--font-medium) !important;
          font-weight: 500 !important;
          color: var(--true-black) !important;
        }
        
        .sprint8-style-wrapper .text-2xl {
          font-size: var(--font-large) !important;
          font-weight: 500 !important;
          letter-spacing: -0.02em !important;
        }
        
        .sprint8-style-wrapper .text-lg {
          font-size: var(--font-medium) !important;
          font-weight: 500 !important;
        }
        
        .sprint8-style-wrapper .text-sm {
          font-size: var(--font-small) !important;
        }
        
        .sprint8-style-wrapper .text-xs {
          font-size: var(--font-tiny) !important;
        }
        
        .sprint8-style-wrapper .font-bold {
          font-weight: 600 !important;
        }
        
        .sprint8-style-wrapper .font-semibold {
          font-weight: 500 !important;
        }
        
        .sprint8-style-wrapper .font-medium {
          font-weight: 500 !important;
        }
        
        /* Button and interactive element styling */
        .sprint8-style-wrapper button {
          transition: all var(--transition-fast) !important;
          font-family: inherit !important;
        }
        
        .sprint8-style-wrapper button:hover {
          opacity: 0.9 !important;
        }
        
        .sprint8-style-wrapper .bg-blue-600:hover {
          background-color: var(--charcoal) !important;
        }
        
        .sprint8-style-wrapper .bg-gray-50:hover {
          background-color: var(--smoke) !important;
        }
        
        /* Focus styles */
        .sprint8-style-wrapper button:focus,
        .sprint8-style-wrapper input:focus,
        .sprint8-style-wrapper select:focus {
          box-shadow: 0 0 0 2px var(--true-black) !important;
          border-color: var(--true-black) !important;
        }
        
        /* Grid system */
        .sprint8-style-wrapper .grid-cols-1 {
          grid-template-columns: repeat(1, minmax(0, 1fr)) !important;
        }
        
        .sprint8-style-wrapper .grid-cols-3 {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        }
        
        .sprint8-style-wrapper .grid-cols-4 {
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
        }
        
        /* Flexbox utilities */
        .sprint8-style-wrapper .flex {
          display: flex !important;
        }
        
        .sprint8-style-wrapper .flex-1 {
          flex: 1 1 0% !important;
        }
        
        .sprint8-style-wrapper .items-center {
          align-items: center !important;
        }
        
        .sprint8-style-wrapper .justify-between {
          justify-content: space-between !important;
        }
        
        /* Additional layout utilities */
        .sprint8-style-wrapper .min-h-64 {
          min-height: 16rem !important;
        }
        
        .sprint8-style-wrapper .animate-spin {
          animation: spin 1s linear infinite !important;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .sprint8-style-wrapper .divide-y > * + * {
          border-top: 1px solid var(--light-gray) !important;
        }
        
        .sprint8-style-wrapper .max-w-md {
          max-width: 28rem !important;
        }
        
        .sprint8-style-wrapper .w-full {
          width: 100% !important;
        }
        
        .sprint8-style-wrapper .relative {
          position: relative !important;
        }
        
        .sprint8-style-wrapper .absolute {
          position: absolute !important;
        }
        
        .sprint8-style-wrapper .left-3 {
          left: 0.75rem !important;
        }
        
        .sprint8-style-wrapper .top-1\/2 {
          top: 50% !important;
        }
        
        .sprint8-style-wrapper .transform {
          transform: translateY(-50%) !important;
        }
        
        .sprint8-style-wrapper .-translate-y-1\/2 {
          transform: translateY(-50%) !important;
        }
        
        .sprint8-style-wrapper .inline-flex {
          display: inline-flex !important;
        }
        
        .sprint8-style-wrapper .space-x-3 > * + * {
          margin-left: var(--space-sm) !important;
        }
        
        .sprint8-style-wrapper .space-x-2 > * + * {
          margin-left: var(--space-xs) !important;
        }
        
        /* Icon and sizing utilities */
        .sprint8-style-wrapper .h-4 { height: 1rem !important; }
        .sprint8-style-wrapper .w-4 { width: 1rem !important; }
        .sprint8-style-wrapper .h-5 { height: 1.25rem !important; }
        .sprint8-style-wrapper .w-5 { width: 1.25rem !important; }
        .sprint8-style-wrapper .h-8 { height: 2rem !important; }
        .sprint8-style-wrapper .w-8 { width: 2rem !important; }
        .sprint8-style-wrapper .h-12 { height: 3rem !important; }
        .sprint8-style-wrapper .w-12 { width: 3rem !important; }
        
        .sprint8-style-wrapper .mr-2 { margin-right: var(--space-xs) !important; }
        .sprint8-style-wrapper .ml-2 { margin-left: var(--space-xs) !important; }
        .sprint8-style-wrapper .mr-1 { margin-right: 4px !important; }
        .sprint8-style-wrapper .ml-1 { margin-left: 4px !important; }
        .sprint8-style-wrapper .ml-3 { margin-left: var(--space-sm) !important; }
        .sprint8-style-wrapper .mx-auto { margin-left: auto !important; margin-right: auto !important; }
        
        /* Text utilities */
        .sprint8-style-wrapper .text-center { text-align: center !important; }
        .sprint8-style-wrapper .text-white { color: var(--pure-white) !important; }
        .sprint8-style-wrapper .overflow-hidden { overflow: hidden !important; }
        
        /* Remove focus outline conflicts */
        .sprint8-style-wrapper *:focus-visible {
          outline: 2px solid var(--true-black) !important;
          outline-offset: 2px !important;
        }
        
        /* Input styling */
        .sprint8-style-wrapper input,
        .sprint8-style-wrapper select {
          font-family: inherit !important;
          font-size: var(--font-small) !important;
          background-color: var(--pure-white) !important;
          border: 1px solid var(--light-gray) !important;
          color: var(--true-black) !important;
        }
        
        .sprint8-style-wrapper input:focus,
        .sprint8-style-wrapper select:focus {
          border-color: var(--true-black) !important;
          box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.1) !important;
          outline: none !important;
        }
        
        /* Disabled state styling */
        .sprint8-style-wrapper button:disabled {
          background-color: var(--light-gray) !important;
          color: var(--muted) !important;
          cursor: not-allowed !important;
        }
        
        /* Link styling */
        .sprint8-style-wrapper a {
          color: inherit !important;
          text-decoration: none !important;
          transition: all var(--transition-fast) !important;
        }
        
        /* Responsive utilities */
        @media (min-width: 768px) {
          .sprint8-style-wrapper .md\:flex-row {
            flex-direction: row !important;
          }
          
          .sprint8-style-wrapper .md\:grid-cols-3 {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }
          
          .sprint8-style-wrapper .md\:grid-cols-4 {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          }
          
          .sprint8-style-wrapper .md\:space-x-3 > * + * {
            margin-left: var(--space-sm) !important;
            margin-top: 0 !important;
          }
        }
        
        /* Ensure consistent line heights */
        .sprint8-style-wrapper p,
        .sprint8-style-wrapper span,
        .sprint8-style-wrapper div {
          line-height: 1.6 !important;
        }
      `}</style>
      {children}
    </div>
  );
};

export default Sprint8StyleWrapper;
