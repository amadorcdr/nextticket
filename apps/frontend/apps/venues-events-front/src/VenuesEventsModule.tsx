import { Hero } from './components/landing/sections/Hero';
import { BentoGrid } from './components/landing/sections/BentoGrid';
import { RecentEvents } from './components/landing/sections/RecentEvents';
import { Newsletter } from './components/landing/sections/Newsletter';

export function VenuesEventsModule() {
  return (
    <>
      <Hero />
      <BentoGrid />
      <RecentEvents />
      <Newsletter />
    </>
  );
}
