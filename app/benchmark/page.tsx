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
        <PageHeader
          title="Performance vs. Benchmarks"
          subtitle="How my portfolio performs against my previous holdings, the S&P 500, and QQQ."
          right={<BackLink />}
        />
        <BenchmarkView benchmark={benchmark} />
      </ShowAmounts>
    </main>
  );
}
