import type { Status } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLOR: Record<Status, string> = {
  "APPLIED": "text-status-applied",
  "INTERVIEW": "text-status-interview",
  "FOLLOW-UP": "text-status-followup",
  "SAVED": "text-status-saved",
  "OFFER": "text-status-offer",
  "REJECTED": "text-status-rejected",
  "WAITING": "text-status-waiting",
  "ASSESSMENT": "text-status-assessment",
};

export function StatusLabel({ value, className }: { value: Status; className?: string }) {
  return (
    <span className={cn("flap-text text-[11px] tracking-[0.18em]", COLOR[value], className)}>
      {value}
    </span>
  );
}
