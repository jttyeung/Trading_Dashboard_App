import { notFound } from "next/navigation";
import { BRIDGE } from "@/lib/features";
import { SchwabReconnect } from "@/components/desktop/SchwabReconnect";
import { ETradeReconnect } from "@/components/desktop/ETradeReconnect";

export const dynamic = "force-dynamic";

export const metadata = { title: "Connections" };

export default function ReconnectPage() {
  if (BRIDGE) notFound(); // OptionsEvaluator-only; see lib/features.ts
  return (
    <main>
      <SchwabReconnect />
      <ETradeReconnect />
    </main>
  );
}
