import type { ComponentPropsWithRef } from 'react';

type ButtonProps = ComponentPropsWithRef<'button'> & {
  variant?: 'primary' | 'secondary';
};

export function Button({
  variant = 'secondary',
  type = 'button',
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`${variant === 'primary' ? 'btn-black' : 'btn-grey'} ${className}`.trim()}
    />
  );
}
