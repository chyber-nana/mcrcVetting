import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', ...props }, ref) => (
    <input
      ref={ref}
      className={`w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    />
  )
);

Input.displayName = 'Input';
