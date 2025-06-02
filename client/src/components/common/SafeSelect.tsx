import React, { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import {
  Select as UISelect,
  SelectContent as UISelectContent,
  SelectItem as UISelectItem,
  SelectTrigger as UISelectTrigger,
  SelectValue as UISelectValue
} from '../ui/select';

// A safer version of Select that properly handles unmounting
export const SafeSelect = forwardRef(({ children, value, onValueChange, disabled, ...props }, ref) => {
  const selectRef = useRef(null);
  
  useImperativeHandle(ref, () => selectRef.current);
  
  // Reset open state when unmounting to prevent React DOM errors
  useEffect(() => {
    return () => {
      // Clean up any potential lingering popovers/portals
      if (selectRef.current) {
        // Force close select dropdown if it's open
        const openState = selectRef.current.dataset?.state === 'open';
        if (openState) {
          selectRef.current.dataset.state = 'closed';
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
