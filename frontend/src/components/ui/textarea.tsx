
import * as React from 'react';
import { cn } from '../../lib/utils';

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full px-4 py-2 border border-gray-300 rounded-xl bg-white/95 text-gray-900 outline-none focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-colors',
        className
      )}
      {...props}
    />
  )
);

Textarea.displayName = 'Textarea';

export default Textarea;
