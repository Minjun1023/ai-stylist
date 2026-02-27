
import * as React from 'react';
import { cn } from '../../lib/utils';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive';
}

const variants = {
  default: 'bg-blue-50 border-blue-100 text-blue-800',
  destructive: 'bg-red-50 border-red-100 text-red-700',
};

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'w-full rounded-lg border px-4 py-3 text-sm',
        variants[variant],
        className
      )}
      role="status"
      {...props}
    />
  )
);
Alert.displayName = 'Alert';

export const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => <p ref={ref} className={cn('text-sm', className)} {...props} />
);

AlertDescription.displayName = 'AlertDescription';

export default Alert;
