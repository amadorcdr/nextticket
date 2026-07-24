import { useEffect, useRef, useState } from 'react';
import { Navbar, Footer } from '@nextticket-frontend/commons/ui';
import { AuroraBackground } from './components/AuroraBackground';
import { LoginFace } from './components/LoginFace';
import { RegisterFace } from './components/RegisterFace';

export function AuthModule() {
  const [flipped, setFlipped] = useState(false);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const [containerH, setContainerH] = useState<number | undefined>(undefined);

  useEffect(() => {
    const frontH = frontRef.current?.offsetHeight ?? 0;
    const backH = backRef.current?.offsetHeight ?? 0;
    setContainerH(Math.max(frontH, backH));
  }, []);

  const flip = () => setFlipped((v) => !v);

  return (
    <div className="bg-background text-on-background font-sans selection:bg-primary-container selection:text-on-primary-container min-h-screen flex flex-col">
      <AuroraBackground />
      <Navbar scrolled={false} minimal />

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 pt-16 pb-10">
        <div className="w-full max-w-sm mx-auto" style={{ perspective: '1400px' }}>
          {/* Flip wrapper — altura fija = la cara más alta */}
          <div
            style={{
              position: 'relative',
              height: containerH,
              transformStyle: 'preserve-3d',
              transition: 'transform 0.65s cubic-bezier(0.4, 0.2, 0.2, 1)',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            {/* FRONT — Login */}
            <div
              ref={frontRef}
              style={{
                position: 'absolute',
                top: '50%',
                left: 0,
                width: '100%',
                transform: 'translateY(-50%)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
            >
              <LoginFace onFlip={flip} />
            </div>

            {/* BACK — Register */}
            <div
              ref={backRef}
              style={{
                position: 'absolute',
                top: '50%',
                left: 0,
                width: '100%',
                transform: 'rotateY(180deg) translateY(-50%)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
            >
              <RegisterFace onFlip={flip} />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
