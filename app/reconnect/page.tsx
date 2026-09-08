import { SchwabReconnect } from "@/components/desktop/SchwabReconnect";

export const dynamic = "force-dynamic";

export const metadata = { title: "Schwab connection" };

export default function ReconnectPage() {
  return (
    <main>
      <SchwabReconnect />
    </main>
  );
}
