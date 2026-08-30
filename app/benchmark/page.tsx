import { BackLink, PageHeader } from "@/components/ui";
import { ShowAmounts } from "@/components/privacy";
import { BenchmarkView } from "@/components/BenchmarkView";
import { getBenchmark } from "@/lib/benchmark";

export const dynamic = "force-dynamic";

export default async function BenchmarkPage() {
  const benchmark = await getBenchmark();

  return (
    <main className="px-4">
      <ShowAmounts>
        <PageHeader title="Pre-OTU vs. S&P 500" subtitle="What if you'd never traded again since the cutoff?" right={<BackLink />} />
        <BenchmarkView benchmark={benchmark} />
      </ShowAmounts>
    </main>
  );
}
