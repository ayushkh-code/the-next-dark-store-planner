import { useEffect, useState } from 'react';

interface TypingPlaceholderOptions {
  typeMs?: number;
  deleteMs?: number;
  pauseMs?: number;
}

/** Types out text one character at a time, then deletes and loops. */
export function useTypingPlaceholder(
  text: string,
  enabled: boolean,
  { typeMs = 70, deleteMs = 35, pauseMs = 2200 }: TypingPlaceholderOptions = {},
): string {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!enabled) {
      setValue('');
      return;
    }

    let index = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;

    const step = () => {
      if (!deleting) {
        if (index < text.length) {
          index += 1;
          setValue(text.slice(0, index));
          timer = setTimeout(step, typeMs);
          return;
        }
        timer = setTimeout(() => {
          deleting = true;
          step();
        }, pauseMs);
        return;
      }

      if (index > 0) {
        index -= 1;
        setValue(text.slice(0, index));
        timer = setTimeout(step, deleteMs);
        return;
      }

      deleting = false;
      timer = setTimeout(step, typeMs);
    };

    step();
    return () => clearTimeout(timer);
  }, [text, enabled, typeMs, deleteMs, pauseMs]);

  return value;
}
