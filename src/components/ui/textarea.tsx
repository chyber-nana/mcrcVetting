import React from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', ...props }, ref) => (
    <textarea
      ref={ref}
      className={`w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none ${className}`}
      {...props}
    />
  )
);

Textarea.displayName = 'Textarea';
