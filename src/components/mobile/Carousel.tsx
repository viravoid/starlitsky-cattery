import { useEffect, useRef, useState, type ReactNode } from "react";
import { Placeholder } from "./ui";

export interface Slide {
  label: string;
  overlay?: ReactNode;
}

export function Carousel({
  slides,
  ratio = "aspect-[16/10]",
  rounded = "rounded-3xl",
  auto = true,
}: {
  slides: Slide[];
  ratio?: string;
  rounded?: string;
  auto?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    if (!auto || slides.length <= 1) return;
    timer.current = setInterval(
      () => setIndex((i) => (i + 1) % slides.length),
      3800,
    );
    return () => clearInterval(timer.current);
  }, [auto, slides.length]);

  return (
    <div className={`relative overflow-hidden ${rounded}`}>
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((s, i) => (
          <div key={i} className="relative w-full shrink-0">
            <Placeholder label={s.label} ratio={ratio} rounded={rounded} />
            {s.overlay && (
              <div className="pointer-events-none absolute inset-0 flex flex-col justify-end p-4">
                {s.overlay}
              </div>
            )}
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              aria-label={`第 ${i + 1} 张`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-5 bg-sunflower" : "w-1.5 bg-card/80"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
