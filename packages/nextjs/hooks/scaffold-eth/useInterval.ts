import { useEffect, useRef } from "react";

/**
 * 使用setInterval的React钩子，支持在组件卸载时自动清除。
 * @param callback 要定期执行的函数
 * @param delay 执行间隔的毫秒数，如果为null则不执行
 */
export const useInterval = (callback: () => void, delay: number | null): void => {
  const savedCallback = useRef<() => void>();

  // 保存新的回调函数
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // 设置interval
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