"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";

interface AnimatedNumberProps {
  value: number | null | undefined;
  precision?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  fallback?: string;
}

/**
 * AnimatedNumber
 * Smoothly interpolates from the previous number to the new number.
 * Respects user's prefers-reduced-motion preference.
 */
export function AnimatedNumber({
  value,
  precision = 1,
  duration = 0.8,
  prefix = "",
  suffix = "",
  className,
  fallback = "—",
}: AnimatedNumberProps) {
  const shouldReduceMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState<string>(() => {
    if (value == null || isNaN(value)) return fallback;
    return `${prefix}${formatNumber(value, precision)}${suffix}`;
  });

  const prevValueRef = useRef<number>(value ?? 0);

  useEffect(() => {
    if (value == null || isNaN(value)) {
      setDisplayValue(fallback);
      return;
    }

    // If reduced motion is requested, instantly set value without tweening
    if (shouldReduceMotion) {
      setDisplayValue(`${prefix}${formatNumber(value, precision)}${suffix}`);
      prevValueRef.current = value;
      return;
    }

    const startVal = prevValueRef.current ?? 0;
    const endVal = value;

    if (startVal === endVal) {
      setDisplayValue(`${prefix}${formatNumber(endVal, precision)}${suffix}`);
      return;
    }

    const controls = animate(startVal, endVal, {
      duration,
      ease: [0.16, 1, 0.3, 1], // Smooth cubic-bezier easeOutExpo
      onUpdate(current) {
        setDisplayValue(`${prefix}${formatNumber(current, precision)}${suffix}`);
      },
      onComplete() {
        setDisplayValue(`${prefix}${formatNumber(endVal, precision)}${suffix}`);
        prevValueRef.current = endVal;
      },
    });

    return () => controls.stop();
  }, [value, precision, duration, prefix, suffix, fallback, shouldReduceMotion]);

  return <span className={className}>{displayValue}</span>;
}

function formatNumber(num: number, precision: number): string {
  const rounded = Number(num.toFixed(precision));
  return precision > 0 && rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(precision);
}
