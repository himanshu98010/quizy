"use client";
import { ReactNode, useEffect } from "react";
import Lenis from "lenis";

export function LenisProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    type LenisCtor = new (options: {
      smoothWheel: boolean;
      duration: number;
    }) => { raf: (time: number) => void; destroy: () => void };
    const LenisClass = Lenis as unknown as LenisCtor;
    const lenis = new LenisClass({ smoothWheel: true, duration: 1.1 });
    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    return () => {
      lenis.destroy();
    };
  }, []);
  return <>{children}</>;
}
