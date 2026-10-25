'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function Header() {
  const path = usePathname();
  if (path.startsWith('/admin') && path !== '/admin/login') {
    return null;
  }
  return (
    <header className="store-header">
      <Link className="wordmark" href="/">
        Stockroom
      </Link>
      <nav className="store-nav" aria-label="Store">
        <Link href="/shop">Shop</Link>
        <Link href="/#categories">Categories</Link>
        <Link href="/admin/products">Admin</Link>
        <Link className="cart-pill" href="/cart">
          Cart →
        </Link>
      </nav>
    </header>
  );
}
