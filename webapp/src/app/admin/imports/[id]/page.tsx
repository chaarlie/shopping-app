import ImportReview from '../../../components/admin/import-review';
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ImportReview id={id} />;
}
