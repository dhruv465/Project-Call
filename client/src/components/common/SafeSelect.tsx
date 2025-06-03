import { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import {
  Select as UISelect,
  SelectContent as UISelectContent,
  SelectItem as UISelectItem,
  SelectTrigger as UISelectTrigger,
  SelectValue as UISelectValue
} from '../ui/select';

// Define props interface to fix TypeScript errors
interface SafeSelectProps {
  children: React.ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  [key: string]: any; // For other props
}

// A safer version of Select that properly handles unmounting
export const SafeSelect = forwardRef<HTMLDivElement, SafeSelectProps>(({ children, value, onValueChange, disabled, ...props }, ref) => {
  const selectRef = useRef<HTMLDivElement | null>(null);
  
  useImperativeHandle(ref, () => selectRef.current as HTMLDivElement);
  
  // Reset open state when unmounting to prevent React DOM errors
  useEffect(() => {
    return () => {
      // Clean up any potential lingering popovers/portals
      if (selectRef.current) {
        try {
          // Force close select dropdown if it's open
          const element = selectRef.current as HTMLElement;
          if (element.dataset && element.dataset.state === 'open') {
            element.dataset.state = 'closed';
          }
        } catch (error) {
          console.error('Error closing select dropdown:', error);
        }
      }
    };
  }, []);

  return (
    <UISelect
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      {...props}
    >
      {children}
    </UISelect>
  );
});

SafeSelect.displayName = 'SafeSelect';

// Re-export the other components for convenience
export const SelectContent = UISelectContent;
export const SelectItem = UISelectItem;
export const SelectTrigger = UISelectTrigger;
export const SelectValue = UISelectValue;
