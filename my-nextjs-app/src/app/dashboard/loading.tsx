// app/dashboard/loading.tsx
import { LoadingState } from '../../../packages/ui/src/LoadingState/LoadingState'; // Adjusted path

export default function Loading() {
  // You can add any UI inside Loading, including a Skeleton.
  return <LoadingState data-testid="dashboard-loading" />;
}
