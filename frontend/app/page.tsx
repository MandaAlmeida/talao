"use client";

import EmBreveSection from "./_components/EmBreveSection";
import EventCarousel from "./_components/EventCarousel";
import EventList from "./_components/EventList";
import { useEmBreve, useEventos } from "./_lib/use-eventos";

export default function Home() {
  const eventos = useEventos();
  const eventosEmBreve = useEmBreve();

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 dark:bg-[#111111]  px-4 lg:px-28">
      <main className="flex w-full flex-1 flex-col items-center">
        <EventCarousel eventos={eventos.slice(0, 5)} />
        <EmBreveSection eventos={eventosEmBreve} />
        <EventList eventos={eventos} />
      </main>
    </div>
  );
}
