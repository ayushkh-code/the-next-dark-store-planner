interface DayThresholdToggleProps {
  value: 1 | 2 | 3;
  onChange: (hours: 1 | 2 | 3) => void;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
}

/** Segmented 1h / 2h / 3h control; active segment uses amber fill. */
export function DayThresholdToggle({
  value,
  onChange,
  disabled = false,
  id = 'hour-threshold-toggle',
  ariaLabel = 'Service speed',
}: DayThresholdToggleProps) {
  return (
    <div
      id={id}
      className="day-threshold-toggle"
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {([1, 2, 3] as const).map((d) => (
        <button
          key={d}
          type="button"
          role="radio"
          aria-checked={value === d}
          className={
            value === d
              ? 'day-threshold-toggle__btn day-threshold-toggle__btn--active mono'
              : 'day-threshold-toggle__btn mono'
          }
          onClick={() => onChange(d)}
          disabled={disabled}
        >
          {d}h
        </button>
      ))}
    </div>
  );
}
