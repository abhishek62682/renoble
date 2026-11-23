import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { addActivity, deleteActivity } from "@/config/api/agency.api";
import { errMsg } from "@/components/agency/common";
import { formatDate, toInputDate, type Client } from "@/types/agency";

const today = () => toInputDate(new Date().toISOString());

/** A lead's running log: a date and a line about what happened. Nothing else. */
export function LeadActivitySheet({ lead, onOpenChange, onChange }: {
  lead: Client | null; onOpenChange: (o: boolean) => void; onChange: (c: Client) => void;
}) {
  const qc = useQueryClient();
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  useEffect(() => { setDate(today()); setNote(""); }, [lead?._id]);

  const done = (c: Client) => { onChange(c); qc.invalidateQueries({ queryKey: ["clients"] }); };
  const add = useMutation({
    mutationFn: () => addActivity(lead!._id, { type: "note", note, date: date || null, nextFollowUp: null }),
    onSuccess: (c) => { done(c); setNote(""); setDate(today()); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const remove = useMutation({
    mutationFn: (aid: string) => deleteActivity(lead!._id, aid),
    onSuccess: done,
    onError: (e) => toast.error(errMsg(e)),
  });

  const items = [...(lead?.activities ?? [])].sort((a, b) => +new Date(b.date) - +new Date(a.date));

  return (
    <Sheet open={!!lead} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{lead?.name}</SheetTitle>
          <SheetDescription>{lead?.phone || "Conversation so far"}</SheetDescription>
        </SheetHeader>

        <form className="space-y-2 px-4" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened? e.g. Called, wants a website, will confirm next week" />
          <div className="flex gap-2">
            <Input type="date" className="w-40" value={date} onChange={(e) => setDate(e.target.value)} />
            <Button type="submit" className="flex-1" disabled={add.isPending || !note.trim()}>
              {add.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />} Add
            </Button>
          </div>
        </form>

        <div className="px-4 pb-6">
          {items.length === 0 ? <p className="text-sm text-muted-foreground">Nothing yet.</p> : (
            <ul className="divide-y">
              {items.map((a) => (
                <li key={a._id} className="flex items-start justify-between gap-2 py-3">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">{formatDate(a.date)}</div>
                    <p className="whitespace-pre-wrap text-sm">{a.note}</p>
                  </div>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-600" aria-label="Remove" disabled={remove.isPending} onClick={() => remove.mutate(a._id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
