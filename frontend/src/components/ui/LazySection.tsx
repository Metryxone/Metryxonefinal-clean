import React, { useEffect, useRef, useState, ReactNode } from 'react';
import { motion } from 'framer-motion';

interface LazySectionProps {
  children: ReactNode;
  className?: string;
  threshold?: number;
  rootMargin?: string;
  fallback?: ReactNode;
  animateOnLoad?: boolean;
}

export function LazySection({
  children,
  className = '',
  threshold = 0.1,
  rootMargin = '100px',
  fallback,
  animateOnLoad = true,
}: LazySectionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          setHasLoaded(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  const defaultFallback = (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-2 border-[var(--metryx-blue)] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!hasLoaded) {
    return (
      <div ref={ref} className={className}>
        {fallback || defaultFallback}
      </div>
    );
  }

  if (animateOnLoad) {
    return (
      <motion.div
        ref={ref}
        className={className}
        initial={{ opacity: 0, y: 20 }}
        animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
