import React, { useState } from 'react';

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

interface SelectTriggerProps extends React.HTMLAttributes<HTMLButtonElement> {}

interface SelectValueProps {
  placeholder?: string;
}

interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {}

interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

const SelectContext = React.createContext<{
  value: string;
  onValueChange?: (value: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
} | null>(null);

export const Select: React.FC<SelectProps> = ({ value = '', onValueChange, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <SelectContext.Provider
      value={{
        value,
        onValueChange,
        isOpen,
        setIsOpen,
      }}
    >
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  );
};

export const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className = '', children, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    if (!context) throw new Error('SelectTrigger must be used within Select');

    return (
      <button
        ref={ref}
        className={`w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-black text-left flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
        onClick={() => context.setIsOpen(!context.isOpen)}
        {...props}
      >
        {children}
        <span>▼</span>
      </button>
    );
  }
);
SelectTrigger.displayName = 'SelectTrigger';

export const SelectValue: React.FC<SelectValueProps> = ({ placeholder = 'Select...' }) => {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error('SelectValue must be used within Select');

  return <span>{context.value || placeholder}</span>;
};

export const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  ({ className = '', children, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    if (!context) throw new Error('SelectContent must be used within Select');

    if (!context.isOpen) return null;

    return (
      <div
        ref={ref}
        className={`absolute top-full left-0 right-0 mt-1 border border-gray-300 rounded-lg bg-white shadow-lg z-50 max-h-60 overflow-y-auto ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
SelectContent.displayName = 'SelectContent';

export const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  ({ value, className = '', children, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    if (!context) throw new Error('SelectItem must be used within Select');

    return (
      <div
        ref={ref}
        className={`px-3 py-2 cursor-pointer hover:bg-blue-100 text-black ${
          context.value === value ? 'bg-blue-200' : ''
        } ${className}`}
        onClick={() => {
          context.onValueChange?.(value);
          context.setIsOpen(false);
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
SelectItem.displayName = 'SelectItem';
