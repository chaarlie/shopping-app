import { Suspense } from 'react';
import Catalog from '../components/catalog/catalog';
import { Feedback } from '../components/feedback';
export default function ShopPage() {
  return (
    <Suspense fallback={<Feedback message="Loading catalog…" />}>
      <Catalog />
    </Suspense>
  );
}
