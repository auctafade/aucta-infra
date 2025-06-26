'use client';

import React from 'react';
import Navigation from './Navigation';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, title, subtitle }) => {
  return (
    <>
      <Navigation />
      
      <main style={{ paddingTop: '80px' }}> {/* Add padding to account for fixed nav */}
        {title && (
          <section className="section">
            <div className="container">
              <div className="text-center fade-in-up">
                <h1 className="hero-title">{title}</h1>
                {subtitle && (
                  <p className="hero-subtitle" style={{ maxWidth: '600px', margin: '0 auto' }}>
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}
        
        <div className="fade-in">
          {children}
        </div>
      </main>
    </>
  );
};

export default Layout;