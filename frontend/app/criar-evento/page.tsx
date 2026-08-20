"use client";

import EventForm from "../_components/form/EventForm";
import RequireRole from "../_components/RequireRole";

export default function CriarEventoPage() {
  return (
    <RequireRole papel="organizador">
      <EventForm modo="criar" />
    </RequireRole>
  );
}
