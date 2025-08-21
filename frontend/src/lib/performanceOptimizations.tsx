// Performance Optimization Utilities
// Ensures fast interactions and smooth rendering

import { useCallback, useMemo, useRef, useEffect, useState } from 'react';

// Debounce hook for expensive operations
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Memoized selector hook to prevent unnecessary re-renders
export const useMemoizedSelector = <T, R>(
  data: T,
  selector: (data: T) => R,
  deps: any[] = []
): R => {
  return useMemo(() => selector(data), [data, ...deps]);
};

// Performance monitoring hook
export const usePerformanceMonitor = (actionName: string) => {
  const startTimeRef = useRef<number>();
  
  const start = useCallback(() => {
    startTimeRef.current = performance.now();
  }, []);
  
  const end = useCallback(() => {
    if (startTimeRef.current) {
      const duration = performance.now() - startTimeRef.current;
      console.log(`⏱️ ${actionName}: ${duration.toFixed(2)}ms`);
      
      if (duration > 200) {
        console.warn(`⚠️ Performance: ${actionName} took ${duration.toFixed(2)}ms (> 200ms threshold)`);
      }
      
      startTimeRef.current = undefined;
      return duration;
    }
    return 0;
  }, [actionName]);
  
  return { start, end };
};

// Throttle hook for high-frequency events (scrolling, resizing)
export const useThrottle = <T extends any[]>(
  callback: (...args: T) => void,
  delay: number
) => {
  const lastCallRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback((...args: T) => {
    const now = Date.now();
    
    if (now - lastCallRef.current >= delay) {
      lastCallRef.current = now;
      callback(...args);
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        lastCallRef.current = Date.now();
        callback(...args);
      }, delay - (now - lastCallRef.current));
    }
  }, [callback, delay]);
};

// Intersection Observer hook for lazy loading
export const useIntersectionObserver = (
  options: IntersectionObserverInit = {}
) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [wasIntersecting, setWasIntersecting] = useState(false);
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
      if (entry.isIntersecting && !wasIntersecting) {
        setWasIntersecting(true);
      }
    }, {
      threshold: 0.1,
      rootMargin: '50px',
      ...options
    });

    observer.observe(target);

    return () => observer.disconnect();
  }, [wasIntersecting]);

  return { ref: targetRef, isIntersecting, wasIntersecting };
};

// Virtual scrolling hook for large lists
export const useVirtualScrolling = (
  items: any[],
  itemHeight: number,
  containerHeight: number
) => {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleCount = Math.ceil(containerHeight / itemHeight) + 1;
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(startIndex + visibleCount, items.length);
  
  const visibleItems = items.slice(startIndex, endIndex);
  
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;
  
  const handleScroll = useThrottle((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, 16); // ~60fps
  
  return {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll,
    startIndex,
    endIndex
  };
};

// Component lazy loading wrapper
export const LazyWrapper: React.FC<{
  children: React.ReactNode;
  fallback?: React.ReactNode;
  threshold?: number;
}> = ({ children, fallback = <div>Loading...</div>, threshold = 0.1 }) => {
  const { ref, wasIntersecting } = useIntersectionObserver({ threshold });

  return (
    <div ref={ref}>
      {wasIntersecting ? children : fallback}
    </div>
  );
};

// Memoized expensive calculations
export const useMemoizedCalculation = <T>(
  calculation: () => T,
  dependencies: any[]
): T => {
  return useMemo(() => {
    const start = performance.now();
    const result = calculation();
    const duration = performance.now() - start;
    
    if (duration > 50) {
      console.log(`🧮 Expensive calculation took ${duration.toFixed(2)}ms`);
    }
    
    return result;
  }, dependencies);
};

// Request idle callback hook for non-critical operations
export const useIdleCallback = (callback: () => void, deps: any[]) => {
  useEffect(() => {
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(callback);
      return () => cancelIdleCallback(id);
    } else {
      // Fallback for browsers without requestIdleCallback
      const id = setTimeout(callback, 0);
      return () => clearTimeout(id);
    }
  }, deps);
};

// Performance budgets and monitoring
export const PERFORMANCE_BUDGETS = {
  INTERACTION_LATENCY: 200, // ms
  CALENDAR_RENDER: 100, // ms
  SIMULATION_LOAD: 500, // ms
  SAVE_OPERATION: 300, // ms
  PUBLISH_OPERATION: 500, // ms
} as const;

export const measurePerformance = async <T>(
  operation: () => Promise<T> | T,
  budgetMs: number,
  operationName: string
): Promise<T> => {
  const start = performance.now();
  
  try {
    const result = await operation();
    const duration = performance.now() - start;
    
    console.log(`⏱️ ${operationName}: ${duration.toFixed(2)}ms`);
    
    if (duration > budgetMs) {
      console.warn(
        `⚠️ Performance Budget Exceeded: ${operationName} took ${duration.toFixed(2)}ms (budget: ${budgetMs}ms)`
      );
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`❌ ${operationName} failed after ${duration.toFixed(2)}ms:`, error);
    throw error;
  }
};

export default {
  useDebounce,
  useMemoizedSelector,
  usePerformanceMonitor,
  useThrottle,
  useIntersectionObserver,
  useVirtualScrolling,
  LazyWrapper,
  useMemoizedCalculation,
  useIdleCallback,
  measurePerformance,
  PERFORMANCE_BUDGETS
};
