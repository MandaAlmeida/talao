import type { StatusBooking } from "../_lib/bookings-store";

const config: Record<StatusBooking, { label: string; classes: string; dot: string }> = {
  PENDENTE: {
    label: "Pendente",
    classes: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  CONFIRMADO: {
    label: "Confirmado",
    classes: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
    dot: "bg-green-500",
  },
  CANCELADO: {
    label: "Cancelado",
    classes: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
    dot: "bg-red-500",
  },
  EXPIRADO: {
    label: "Expirado",
    classes: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
    dot: "bg-red-500",
  },
  USADO: {
    label: "Utilizado",
    classes: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    dot: "bg-zinc-400",
  },
};

export default function BookingStatusBadge({ status }: { status: StatusBooking }) {
  const { label, classes, dot } = config[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
