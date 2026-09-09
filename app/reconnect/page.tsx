import { SchwabReconnect } from "@/components/desktop/SchwabReconnect";
import { ETradeReconnect } from "@/components/desktop/ETradeReconnect";

export const dynamic = "force-dynamic";

export const metadata = { title: "Connections" };

export default function ReconnectPage() {
  return (
    <main>
      <SchwabReconnect />
      <ETradeReconnect />
    </main>
  );
}
