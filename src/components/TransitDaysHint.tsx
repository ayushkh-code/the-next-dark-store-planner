import { SERVICE_HOURS_TOOLTIP, SERVICE_SPEED_KM_TOOLTIP } from '../labels';

interface TransitDaysHintProps {
  /** Accessible label override for the ? control. */
  ariaLabel?: string;
}

/** Superscript ? with hover/focus tooltip explaining service-hour methodology. */
export function TransitDaysHint({
  ariaLabel = 'How service hours are calculated',
}: TransitDaysHintProps) {
  return (
    <SuperscriptHint
      ariaLabel={ariaLabel}
      tooltip={SERVICE_HOURS_TOOLTIP}
      title={SERVICE_HOURS_TOOLTIP}
    >
      ?
    </SuperscriptHint>
  );
}

interface SuperscriptHintProps {
  children: React.ReactNode;
  ariaLabel: string;
  tooltip: string;
  /** Native title tooltip (omit for hover-only custom tooltip). */
  title?: string;
}

/** Superscript mark with CSS hover/focus tooltip. */
export function SuperscriptHint({
  children,
  ariaLabel,
  tooltip,
  title,
}: SuperscriptHintProps) {
  return (
    <span className="transit-hint">
      <sup
        className="transit-hint__mark"
        tabIndex={0}
        aria-label={ariaLabel}
        {...(title ? { title } : {})}
      >
        {children}
      </sup>
      <span className="transit-hint__tooltip" role="tooltip">
        {tooltip}
      </span>
    </span>
  );
}

/** Km thresholds for 1/2/3-hour service speed (hover only). */
export function ShipSpeedHint() {
  return (
    <SuperscriptHint
      ariaLabel="Service speed kilometre thresholds"
      tooltip={SERVICE_SPEED_KM_TOOLTIP}
    >
      *
    </SuperscriptHint>
  );
}

interface TransitDayTextProps {
  hours: number;
  /** Include the methodology hint after the label. */
  hint?: boolean;
}

/** e.g. "2 hours" with optional ? superscript. */
export function TransitDayText({ hours, hint = false }: TransitDayTextProps) {
  return (
    <>
      {hours} hour{hours === 1 ? '' : 's'}
      {hint && <TransitDaysHint />}
    </>
  );
}
