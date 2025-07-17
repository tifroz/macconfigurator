// 10 Lines by Claude Opus
// Hook for implementing autosave functionality with debouncing and blur support
import { useEffect, useRef, useState, useCallback } from "react";

export function useAutosave(
  saveFunction: () => Promise<void>,
  delay: number = 1000 // Changed default to 10 seconds
) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const isSavingRef = useRef(false);

  const executeSave = useCallback(async () => {
    if (isSavingRef.current) return;

    isSavingRef.current = true;
    setStatus("saving");
    setError(null);

    try {
      await saveFunction();
      setStatus("saved");

      // Reset to idle after showing saved status
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      isSavingRef.current = false;
    }
  }, [saveFunction]);

  const triggerSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(executeSave, delay);
  }, [executeSave, delay]);

  const saveOnBlur = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    executeSave();
  }, [executeSave]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { triggerSave, saveOnBlur, executeSave, status, error };
}
