import Link from "next/link";
import { AuditForm } from "@/components/AuditForm";

export default function NewAuditPage() {
  return (
    <main className="min-h-screen bg-mist">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-gray-600 hover:text-ink">
            Back to dashboard
          </Link>
          <p className="text-sm text-gray-500">V1: CSV/XLSX uploads only</p>
        </div>
        <AuditForm />
      </div>
    </main>
  );
}
