import * as React from 'react';
import { cn } from '../utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "px-4 py-2 rounded-md font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2",
          variant === 'primary' && "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
          variant === 'secondary' && "bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500",
          variant === 'outline' && "border border-gray-300 bg-transparent text-gray-700 hover:bg-gray-50 focus:ring-blue-500",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
