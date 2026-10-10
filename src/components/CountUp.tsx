"use client";
import { useEffect, useState } from "react";
import { animate } from "framer-motion";

export function CountUp({ value, format, duration = 1.2 }: { value: number; format: (n: number) => string; duration?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const c = animate(0, value, { duration, ease: "easeOut", onUpdate: setV });
    return () => c.stop();
  }, [value, duration]);
  return <>{format(v)}</>;
}
