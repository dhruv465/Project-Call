import React, { useState, useRef, useEffect, createContext, useContext } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}

export interface SelectTriggerProps {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

export interface SelectContentProps {
  children: React.ReactNode;
  align?: 'start' | 'center' | 'end';
}

export interface SelectItemProps {
  value: string;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export interface SelectValueProps {
  placeholder?: string;
  children?: React.ReactNode;
}

// Context for passing down select state
interface SelectContextType {
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SelectContext = createContext<SelectContextType>({
  open: false,
  setOpen: () => {},
});

export const Select: React.FC<SelectProps> = ({ 
  value, 
  onValueChange, 
  children, 
  disabled = false 
}) => {
  const [open, setOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [open]);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [open]);

  const contextValue: SelectContextType = {
    value,
    onValueChange,
    disabled,
    open,
    setOpen,
  };

  return (
    <SelectContext.Provider value={contextValue}>
      <div ref={selectRef} className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  );
};

export const SelectTrigger: React.FC<SelectTriggerProps> = ({ 
  className = '', 
  children,
  ...props 
}) => {
  const { open, setOpen, disabled } = useContext(SelectContext);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setOpen(!open);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-expanded={open}
      aria-disabled={disabled}
      disabled={disabled}
      className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      <span className="flex-1 text-left truncate">
        {children}
      </span>
      <ChevronDown className={`h-4 w-4 opacity-50 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
  );
};

export const SelectContent: React.FC<SelectContentProps> = ({ children }) => {
  const { open } = useContext(SelectContext);

  if (!open) return null;

  return (
    <div className="absolute top-full left-0 w-full z-50 mt-1 max-h-60 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
      <div className="p-1">
        {children}
      </div>
    </div>
  );
};

export const SelectItem: React.FC<SelectItemProps> = ({ 
  value, 
  children, 
  className = '',
  ...props 
}) => {
  const { value: selectedValue, onValueChange, setOpen } = useContext(SelectContext);
  const isSelected = value === selectedValue;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onValueChange?.(value);
    setOpen(false);
  };

  return (
    <div
      role="option"
      aria-selected={isSelected}
      onClick={handleClick}
      className={`relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${
        isSelected ? 'bg-accent text-accent-foreground' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const SelectValue: React.FC<SelectValueProps> = ({ placeholder, children }) => {
  const { value } = useContext(SelectContext);

  if (children) {
    return <>{children}</>;
  }

  if (value) {
    // Find the display value from context - we'll need to handle this in the parent
    return <>{value}</>;
  }

  return <span className="text-muted-foreground">{placeholder}</span>;
};
