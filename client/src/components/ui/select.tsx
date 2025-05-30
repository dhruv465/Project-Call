import React from 'react';

export interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

export interface SelectTriggerProps {
  className?: string;
  children: React.ReactNode;
}

export interface SelectContentProps {
  children: React.ReactNode;
}

export interface SelectItemProps {
  value: string;
  children: React.ReactNode;
}

export interface SelectValueProps {
  placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({ value: _value, onValueChange: _onValueChange, children }) => {
  return (
    <div className="relative">
      {children}
    </div>
  );
};

export const SelectTrigger: React.FC<SelectTriggerProps> = ({ className = '', children }) => {
  return (
    <button
      className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
};

export const SelectContent: React.FC<SelectContentProps> = ({ children }) => {
  return (
    <div className="relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
      {children}
    </div>
  );
};

export const SelectItem: React.FC<SelectItemProps> = ({ value: _value, children }) => {
  return (
    <div className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground">
      {children}
    </div>
  );
};

export const SelectValue: React.FC<SelectValueProps> = ({ placeholder }) => {
  return <span>{placeholder}</span>;
};
