import { useMemo } from 'react';
import type { PinZone } from '../data';
import { formatCurrency, formatDecimal, formatNumber } from '../format';
import { TAB_PURPOSE } from '../tabPurpose';
import { TabPurpose } from './TabPurpose';
import { SavedPinBar } from './SavedPinBar';
import { PIN_HELP } from '../labels';

interface PincodeLookupProps {
  savedPins: string[];
  pinIndex: Map<string, PinZone>;
  onAdd: (pincode: string) => boolean;
  onRemove: (pincode: string) => void;
  addError: string | null;
  onClearError: () => void;
}

function ZoneCard({
  zone,
  onRemove,
}: {
  zone: PinZone;
  onRemove: (pincode: string) => void;
}) {
  return (
    <article className="detail-card">
      <header className="detail-card__header">
        <div className="detail-card__title">
          <span className="detail-card__zip">{zone.pincode}</span>
          <span className="detail-card__place">
            {zone.locality}, {zone.zone_or_taluk}
          </span>
        </div>
        <button
          type="button"
          className="detail-card__remove"
          onClick={() => onRemove(zone.pincode)}
          aria-label={`Remove ${zone.pincode}`}
        >
          Remove
        </button>
      </header>
      <dl className="detail-grid">
        <div>
          <dt>Population</dt>
          <dd className="mono">{formatNumber(zone.population)}</dd>
        </div>
        <div>
          <dt>Households</dt>
          <dd className="mono">{formatNumber(zone.households)}</dd>
        </div>
        <div>
          <dt>Median HH Income</dt>
          <dd className="mono">{formatCurrency(zone.median_hh_income)}</dd>
        </div>
        <div>
          <dt>Demand Index</dt>
          <dd className="mono">{formatDecimal(zone.demand_index)}</dd>
        </div>
        <div>
          <dt>Zone / taluk</dt>
          <dd>{zone.zone_or_taluk}</dd>
        </div>
      </dl>
    </article>
  );
}

export function PincodeLookup({
  savedPins,
  pinIndex,
  onAdd,
  onRemove,
  addError,
  onClearError,
}: PincodeLookupProps) {
  const entries = useMemo(
    () =>
      savedPins
        .map((z) => pinIndex.get(z))
        .filter((z): z is PinZone => z !== undefined),
    [savedPins, pinIndex],
  );

  const totals = useMemo(
    () => ({
      population: entries.reduce((s, z) => s + (z.population ?? 0), 0),
      households: entries.reduce((s, z) => s + (z.households ?? 0), 0),
      demand_index: entries.reduce((s, z) => s + (z.demand_index ?? 0), 0),
    }),
    [entries],
  );

  return (
    <section className="mode-panel">
      <TabPurpose>{TAB_PURPOSE.lookup}</TabPurpose>

      <SavedPinBar
        embedded
        savedPins={savedPins}
        pinIndex={pinIndex}
        onAdd={onAdd}
        onRemove={onRemove}
        addError={addError}
        onClearError={onClearError}
        inputId="lookup-pin-input"
        label={`Location: PIN ${PIN_HELP}`}
        showChips={false}
        emptyHint={null}
      />

      {entries.length === 0 && (
        <p className="message message--loading">
          Add a PIN above to see zone data.
        </p>
      )}

      {entries.length > 0 && (
        <div className="lookup-list">
          {entries.map((zone) => (
            <ZoneCard key={zone.pincode} zone={zone} onRemove={onRemove} />
          ))}

          {entries.length > 1 && (
            <article className="detail-card detail-card--total">
              <header className="detail-card__header">
                <span className="detail-card__zip">Total</span>
                <span className="detail-card__place">
                  {entries.length} pincodes
                </span>
              </header>
              <dl className="detail-grid">
                <div>
                  <dt>Population</dt>
                  <dd className="mono">{formatNumber(totals.population)}</dd>
                </div>
                <div>
                  <dt>Households</dt>
                  <dd className="mono">{formatNumber(totals.households)}</dd>
                </div>
                <div>
                  <dt>Median HH Income</dt>
                  <dd className="mono">-</dd>
                </div>
                <div>
                  <dt>Demand Index</dt>
                  <dd className="mono">
                    {formatDecimal(totals.demand_index)}
                  </dd>
                </div>
                <div>
                  <dt>Zone / taluk</dt>
                  <dd>-</dd>
                </div>
              </dl>
            </article>
          )}
        </div>
      )}
    </section>
  );
}
