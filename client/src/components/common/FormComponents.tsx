import React from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';

interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  labelClassName?: string;
  children: React.ReactNode;
}

export function FormField({
  id,
  label,
  required = false,
  error,
  hint,
  className,
  labelClassName,
  children
}: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex justify-between">
        <Label 
          htmlFor={id} 
          className={cn(
            error && "text-destructive",
            labelClassName
          )}
        >
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
      </div>
      
      {children}
      
      {(error || hint) && (
        <div className="text-xs mt-1">
          {error && (
            <div className="flex items-center text-destructive gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>{error}</span>
            </div>
          )}
          
          {!error && hint && (
            <div className="flex items-center text-muted-foreground gap-1">
              <Info className="h-3.5 w-3.5" />
              <span>{hint}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TextInputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export function TextInputField({
  id,
  label,
  error,
  hint,
  required = false,
  className,
  iconLeft,
  iconRight,
  ...props
}: TextInputFieldProps) {
  return (
    <FormField
      id={id}
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={className}
    >
      <div className="relative">
        {iconLeft && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {iconLeft}
          </div>
        )}
        
        <Input
          id={id}
          className={cn(
            iconLeft && "pl-10",
            iconRight && "pr-10",
            error && "border-destructive focus-visible:ring-destructive"
          )}
          aria-invalid={!!error}
          {...props}
        />
        
        {iconRight && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {iconRight}
          </div>
        )}
      </div>
    </FormField>
  );
}

interface TextareaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
}

export function TextareaField({
  id,
  label,
  error,
  hint,
  required = false,
  className,
  ...props
}: TextareaFieldProps) {
  return (
    <FormField
      id={id}
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={className}
    >
      <Textarea
        id={id}
        className={cn(
          error && "border-destructive focus-visible:ring-destructive"
        )}
        aria-invalid={!!error}
        {...props}
      />
    </FormField>
  );
}

interface SelectFieldProps {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function SelectField({
  id,
  label,
  options,
  value,
  onChange,
  error,
  hint,
  required = false,
  placeholder = "Select an option",
  disabled = false,
  className
}: SelectFieldProps) {
  return (
    <FormField
      id={id}
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={className}
    >
      <Select
        value={value}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          className={cn(
            error && "border-destructive focus-visible:ring-destructive"
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

interface CheckboxFieldProps {
  id: string;
  label: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  error?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
}

export function CheckboxField({
  id,
  label,
  checked,
  onChange,
  error,
  hint,
  disabled = false,
  className
}: CheckboxFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center space-x-2">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={onChange}
          disabled={disabled}
        />
        <Label
          htmlFor={id}
          className={cn(
            "text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
            error && "text-destructive"
          )}
        >
          {label}
        </Label>
      </div>
      
      {(error || hint) && (
        <div className="text-xs pl-6">
          {error && (
            <div className="flex items-center text-destructive gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>{error}</span>
            </div>
          )}
          
          {!error && hint && (
            <div className="flex items-center text-muted-foreground gap-1">
              <Info className="h-3.5 w-3.5" />
              <span>{hint}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface SwitchFieldProps {
  id: string;
  label: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  error?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
}

export function SwitchField({
  id,
  label,
  checked,
  onChange,
  error,
  hint,
  disabled = false,
  className
}: SwitchFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <Label
          htmlFor={id}
          className={cn(
            "text-sm peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
            error && "text-destructive"
          )}
        >
          {label}
        </Label>
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onChange}
          disabled={disabled}
        />
      </div>
      
      {(error || hint) && (
        <div className="text-xs">
          {error && (
            <div className="flex items-center text-destructive gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>{error}</span>
            </div>
          )}
          
          {!error && hint && (
            <div className="flex items-center text-muted-foreground gap-1">
              <Info className="h-3.5 w-3.5" />
              <span>{hint}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface FormFooterProps {
  submitText?: string;
  cancelText?: string;
  onCancel?: () => void;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
  successMessage?: string;
  errorMessage?: string;
  className?: string;
}

export function FormFooter({
  submitText = "Save Changes",
  cancelText = "Cancel",
  onCancel,
  isSubmitting = false,
  submitDisabled = false,
  successMessage,
  errorMessage,
  className
}: FormFooterProps) {
  return (
    <div className={cn("flex flex-col space-y-4", className)}>
      {(successMessage || errorMessage) && (
        <div className={cn(
          "p-3 rounded-md text-sm flex items-start gap-2",
          successMessage ? "bg-green-500/10 text-green-500" : "bg-destructive/10 text-destructive"
        )}>
          {successMessage && <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />}
          {errorMessage && <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />}
          <span>{successMessage || errorMessage}</span>
        </div>
      )}
      
      <div className="flex items-center justify-end gap-3">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {cancelText}
          </Button>
        )}
        
        <Button
          type="submit"
          disabled={isSubmitting || submitDisabled}
        >
          {isSubmitting ? (
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span>Saving...</span>
            </div>
          ) : (
            submitText
          )}
        </Button>
      </div>
    </div>
  );
}
