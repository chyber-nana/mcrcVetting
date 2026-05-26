import React, { useState } from 'react';

interface TabsProps {
  defaultValue?: string;
  children: React.ReactNode;
  className?: string;
}

interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {}

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

const TabsContext = React.createContext<{
  activeTab: string;
  setActiveTab: (value: string) => void;
} | null>(null);

export const Tabs: React.FC<TabsProps> = ({ defaultValue = '', children, className = '' }) => {
  const [activeTab, setActiveTab] = useState(defaultValue);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

export const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ className = '', children, ...props }, ref) => (
    <div
      ref={ref}
      className={`inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
);
TabsList.displayName = 'TabsList';

export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ value, className = '', children, ...props }, ref) => {
    const context = React.useContext(TabsContext);
    if (!context) throw new Error('TabsTrigger must be used within Tabs');

    const isActive = context.activeTab === value;

    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
          isActive ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
        } ${className}`}
        onClick={() => context.setActiveTab(value)}
        {...props}
      >
        {children}
      </button>
    );
  }
);
TabsTrigger.displayName = 'TabsTrigger';

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ value, className = '', children, ...props }, ref) => {
    const context = React.useContext(TabsContext);
    if (!context) throw new Error('TabsContent must be used within Tabs');

    if (context.activeTab !== value) return null;

    return (
      <div
        ref={ref}
        className={`mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsContent.displayName = 'TabsContent';
