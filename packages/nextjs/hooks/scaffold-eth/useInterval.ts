import { useEffect, useRef } from "react";

/**
 * React hook that uses setInterval with automatic cleanup when the component unmounts.
 * @param callback Function to execute periodically
 * @param delay Milliseconds between executions, if null execution is disabled
 */
export const useInterval = (callback: () => void, delay: number | null): void => {
  const savedCallback = useRef<() => void | null>(null);

  // Save the new callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    const tick = () => {
      if (savedCallback.current) {
        savedCallback.current();
      }
    };

    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
    
    return undefined;
  }, [delay]);
}; 