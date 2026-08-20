"use client";

import EventCarousel from "./_components/EventCarousel";
import EventList from "./_components/EventList";
import { useEventos } from "./_lib/use-eventos";

export default function Home() {
  const eventos = useEventos();

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 dark:bg-black">
      <main className="flex w-full max-w-6xl flex-1 flex-col items-center px-4">
        <EventCarousel eventos={eventos.slice(0, 5)} />
        <EventList eventos={eventos} />
      </main>
    </div>
  );
}
