'use client';

import Link from 'next/link';
import { Button, type ButtonProps } from '@chakra-ui/react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const styles: Record<Variant, ButtonProps> = {
  primary: {
    bg: 'bg.brand',
    color: 'fg.inverse',
    _hover: { bg: 'bg.brand.hover', textDecoration: 'none' },
    _active: { bg: 'slack.aubergineDeep' },
    boxShadow: 'elevation.sm',
  },
  secondary: {
    bg: 'bg.panel',
    color: 'fg.default',
    borderWidth: '1px',
    borderColor: 'border.default',
    boxShadow: 'elevation.sm',
    _hover: { bg: 'slack.hover', textDecoration: 'none' },
  },
  ghost: {
    bg: 'transparent',
    color: 'fg.link',
    _hover: { bg: 'slack.hover', textDecoration: 'underline' },
  },
  danger: {
    bg: 'slack.red',
    color: 'fg.inverse',
    _hover: { opacity: 0.92, textDecoration: 'none' },
  },
};

function isExternalHref(href: string): boolean {
  return /^(https?:\/\/|mailto:|tel:)/i.test(href);
}

type Props = Omit<ButtonProps, 'variant'> & {
  variant?: Variant;
  href?: string;
  /** Force new-tab behavior for external links (default true when href is absolute). */
  openInNewTab?: boolean;
};

export function SlackButton({
  variant = 'primary',
  href,
  openInNewTab,
  children,
  ...props
}: Props) {
  const common: ButtonProps = {
    size: 'md',
    fontWeight: '700',
    borderRadius: 'slack',
    ...styles[variant],
    ...props,
  };

  if (href) {
    if (isExternalHref(href)) {
      const newTab = openInNewTab !== false;
      return (
        <Button asChild {...common}>
          <a
            href={href}
            target={newTab ? '_blank' : undefined}
            rel={newTab ? 'noopener noreferrer' : undefined}
          >
            {children}
          </a>
        </Button>
      );
    }

    return (
      <Button asChild {...common}>
        <Link href={href}>{children}</Link>
      </Button>
    );
  }

  return <Button {...common}>{children}</Button>;
}
