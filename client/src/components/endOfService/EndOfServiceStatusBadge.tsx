import { Badge } from "@/components/ui/badge";
import { getEndOfServiceStatusLabel } from "@shared/endOfService";
import { eosStatusBadgeClass } from "./utils";

export function EndOfServiceStatusBadge({
  status,
  className = "",
}: {
  status: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={`${eosStatusBadgeClass(status)} ${className}`}
    >
      {getEndOfServiceStatusLabel(status).ar}
    </Badge>
  );
}
