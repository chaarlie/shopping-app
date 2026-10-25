import Link from 'next/link';
export default function Footer() {
  return (
    <footer className="site-footer">
      <Link className="wordmark" href="/">
        Stockroom
      </Link>
      <nav aria-label="Footer">
        <Link href="/shop">Shop</Link>
        <Link href="/cart">Cart</Link>
        <Link href="/admin/products">Admin</Link>
      </nav>
      <span>Demo store · payments are simulated</span>
    </footer>
  );
}
