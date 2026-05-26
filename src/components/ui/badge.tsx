import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className = '', variant = 'default', children, ...props }, ref) => {
    const variantClasses = {
      default: 'bg-blue-100 text-blue-800',
      secondary: 'bg-gray-100 text-gray-800',
      destructive: 'bg-red-100 text-red-800',
      outline: 'border border-gray-300 text-gray-800',
    };

    return (
      <div
        ref={ref}
        className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${variantClasses[variant]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Badge.displayName = 'Badge';
