import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getDocument } from "@/config/api/agency.api";
import { EmptyState } from "@/components/agency/common";
import { PreviewPanel } from "@/components/documents/PreviewPanel";
import { printDocument } from "@/components/documents/DocumentSheet";
import { idOf } from "@/types/agency";

/** Read-only view of an issued receipt (receipts are never edited). */
export default function ReceiptViewPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const { data, isLoading, isError } = useQuery({ queryKey: ["document", id], queryFn: () => getDocument(id) });
  useEffect(() => { if (data && sp.get("print")) { const t = setTimeout(() => printDocument(data.number), 600); return () => clearTimeout(t); } }, [data, sp]);
  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (isError || !data) return <EmptyState text="Receipt not found." action={<Button size="sm" onClick={() => navigate("/dashboard/payments")}>Back</Button>} />;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link to={`/dashboard/projects/${idOf(data.project!)}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to project</Link>
        <Button onClick={() => printDocument(data.number)}><Download className="h-4 w-4" /> Download PDF</Button>
      </div>
      <div className="h-[calc(100vh-190px)] min-h-[520px] overflow-hidden rounded-xl"><PreviewPanel doc={data} url="renoble.agency" /></div>
    </div>
  );
}
