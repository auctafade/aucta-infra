// frontend/src/components/ModernComponents.tsx
'use client';

import React from 'react';

// Modern Card Component
export const Card = ({ title, subtitle, children, minimal = false, onClick }: any) => {
  return (
    <div 
      className={`card ${minimal ? 'card-minimal' : ''} hover-lift`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {(title || subtitle) && (
        <div className="card-header">
          {title && <h3 className="card-title">{title}</h3>}
          {subtitle && <p className="text-small text-muted">{subtitle}</p>}
        </div>
      )}
      <div className="card-content">
        {children}
      </div>
    </div>
  );
};

// Modern Button Component
export const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'medium', 
  onClick,
  disabled = false,
  fullWidth = false,
  icon = null
}: any) => {
  const classNames = [
    'btn',
    `btn-${variant}`,
    size === 'large' && 'btn-large',
    size === 'small' && 'btn-small',
    fullWidth && 'btn-fullwidth',
    disabled && 'btn-disabled'
  ].filter(Boolean).join(' ');

  return (
    <button 
      className={classNames}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <span className="btn-icon">{icon}</span>}
      {children}
    </button>
  );
};

// Modern Form Components
export const FormGroup = ({ label, required, children, error }: any) => {
  return (
    <div className="form-group">
      {label && (
        <label className="form-label">
          {label}
          {required && <span className="text-muted"> *</span>}
        </label>
      )}
      {children}
      {error && <p className="form-error text-small">{error}</p>}
    </div>
  );
};

export const Input = ({ 
  type = 'text', 
  placeholder, 
  value, 
  onChange, 
  disabled = false,
  ...props 
}: any) => {
  return (
    <input
      type={type}
      className="form-input"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
      {...props}
    />
  );
};

// Modern Modal Component
export const Modal = ({ isOpen, onClose, title, children, size = 'medium' }: any) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={`modal modal-${size}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="modal-header">
            <h3>{title}</h3>
            <button className="modal-close" onClick={onClose}>
              ×
            </button>
          </div>
        )}
        <div className="modal-content">
          {children}
        </div>
      </div>
    </div>
  );
};

// Modern Loading Component
export const Loading = ({ size = 'medium', fullScreen = false }: any) => {
  if (fullScreen) {
    return (
      <div className="loading-fullscreen">
        <div className={`spinner spinner-${size}`}></div>
        <p className="text-small text-muted mt-3">Loading...</p>
      </div>
    );
  }

  return <div className={`spinner spinner-${size}`}></div>;
};

// Modern Stats Component
export const Stat = ({ label, value, trend }: any) => {
  return (
    <div className="stat">
      <p className="stat-label text-micro uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="stat-value">
        {value}
      </p>
      {trend && (
        <p className={`stat-trend ${trend > 0 ? 'positive' : 'negative'}`}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </p>
      )}
    </div>
  );
};

// Modern Feature List Component
export const FeatureList = ({ features }: any) => {
  return (
    <div className="feature-list">
      {features.map((feature: any, index: number) => (
        <div key={index} className="feature-item">
          <span className="feature-number">
            {String(index + 1).padStart(2, '0')}
          </span>
          <h4 className="feature-title">{feature.title}</h4>
          {feature.action && (
            <button className="btn btn-ghost btn-small">
              {feature.action}
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

// Modern Timeline Component
export const Timeline = ({ items }: any) => {
  return (
    <div className="timeline">
      {items.map((item: any, index: number) => (
        <div key={index} className="timeline-item">
          <div className="timeline-marker">
            <span>{String(index + 1).padStart(2, '0')}</span>
          </div>
          <div className="timeline-content">
            <h4>{item.title}</h4>
            <p className="text-small text-muted">{item.description}</p>
            {item.date && (
              <p className="text-micro text-muted mt-2">{item.date}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// Modern Empty State Component
export const EmptyState = ({ title, description, action }: any) => {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <svg width="64" height="64" fill="none" viewBox="0 0 24 24">
          <path 
            stroke="currentColor" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth="1"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h3>{title}</h3>
      {description && (
        <p className="text-muted mt-2">{description}</p>
      )}
      {action && (
        <div className="mt-4">
          {action}
        </div>
      )}
    </div>
  );
};