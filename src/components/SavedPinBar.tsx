import { useEffect, useState } from 'react';
import { toPincode, type PinZone } from '../data';
import { useTypingPlaceholder } from '../useTypingPlaceholder';
import { parsePinInputSegments } from '../pinInput';
import { PIN_HELP } from '../labels';

interface SavedPinBarProps {
  savedPins: string[];
  pinIndex: Map<string, PinZone>;
  onAdd: (pincode: string) => boolean;
  onRemove: (pincode: string) => void;
  addError: string | null;
  onClearError: () => void;
  inputId?: string;
  /** Render inside a tab panel without a second card chrome. */
  embedded?: boolean;
  /** Show removable chip list below the input (off on Pincode Lookup; cards list locations). */
  showChips?: boolean;
  label?: string;
  emptyHint?: string | null;
  /** Short note shown under the input (e.g. comma-separated entry). */
  inputNote?: string | null;
  /** Example typed in the input when empty (grey text, amber border on field). */
  examplePlaceholder?: string | null;
  /** One-click sample PINs shown under the input when not yet loaded. */
  samplePins?: string[] | null;
}

export function SavedPinChips({
  savedPins,
  pinIndex,
  onRemove,
}: {
  savedPins: string[];
  pinIndex: Map<string, PinZone>;
  onRemove: (pincode: string) => void;
}) {
  if (savedPins.length === 0) return null;
  return (
    <ul className="warehouse-list">
      {savedPins.map((pincode) => {
        const zone = pinIndex.get(pincode);
        return (
          <li key={pincode} className="warehouse-chip">
            <span className="mono warehouse-chip__zip">{pincode}</span>
            {zone && (
              <span className="warehouse-chip__place">
                {zone.locality}, {zone.zone_or_taluk}
              </span>
            )}
            <button
              type="button"
              className="warehouse-chip__remove"
              onClick={() => onRemove(pincode)}
              aria-label={`Remove ${pincode}`}
            >
              ×
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function SavedPinBar({
  savedPins,
  pinIndex,
  onAdd,
  onRemove,
  addError,
  onClearError,
  inputId = 'saved-pin-input',
  embedded = false,
  showChips = true,
  label,
  emptyHint = 'Add a location here. It stays saved as you switch tabs.',
  inputNote = null,
  examplePlaceholder = null,
  samplePins = null,
}: SavedPinBarProps) {
  const [input, setInput] = useState('');
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const showPrompt = Boolean(examplePlaceholder) && !input;
  const showTyping = showPrompt && !reduceMotion;
  const typedExample = useTypingPlaceholder(
    examplePlaceholder ?? '',
    showTyping,
  );
  const promptText = reduceMotion ? (examplePlaceholder ?? '') : typedExample;

  const sampleList = samplePins?.map((z) => toPincode(z)) ?? [];
  const samplePending = sampleList.filter((z) => !savedPins.includes(z));
  const showSample =
    samplePending.length > 0 &&
    sampleList.every((z) => pinIndex.has(z));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onClearError();
    const segments = parsePinInputSegments(input);
    if (segments.length === 0) return;

    let addedAny = false;
    for (const segment of segments) {
      if (onAdd(toPincode(segment))) {
        addedAny = true;
      }
    }

    if (addedAny) {
      setInput('');
    }
  };

  const handleLoadSample = () => {
    onClearError();
    for (const pincode of samplePending) {
      onAdd(pincode);
    }
    setInput('');
  };

  const resolvedLabel =
    label ?? `PIN ${PIN_HELP}`;

  return (
    <div
      className={
        embedded ? 'saved-zip-bar saved-zip-bar--embedded' : 'saved-zip-bar'
      }
    >
      <form className="saved-zip-bar__form" onSubmit={handleSubmit}>
        <label htmlFor={inputId}>{resolvedLabel}</label>
        <div className="search-row">
          <div
            className={
              showPrompt
                ? 'search-row__input-wrap search-row__input-wrap--prompt'
                : 'search-row__input-wrap'
            }
          >
            <input
              id={inputId}
              type="text"
              inputMode="text"
              placeholder={examplePlaceholder ? '' : 'e.g. 560034, 560066, 560100'}
              maxLength={80}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoComplete="off"
              aria-describedby={
                showPrompt ? `${inputId}-typing-hint` : undefined
              }
            />
            {showPrompt && (
              <span
                id={`${inputId}-typing-hint`}
                className="search-row__typing mono"
                aria-hidden="true"
              >
                {promptText}
                {showTyping && (
                  <span className="search-row__typing-caret" />
                )}
              </span>
            )}
          </div>
          <button type="submit" className="btn-primary">
            Add
          </button>
        </div>
        {inputNote && (
          <p className="saved-zip-bar__note">{inputNote}</p>
        )}
      </form>

      {showSample && (
        <button
          type="button"
          className="sample-zip-chip"
          onClick={handleLoadSample}
        >
          <span className="sample-zip-chip__action">Try sample network</span>
          <span className="sample-zip-chip__zips mono">
            {sampleList.join(' · ')}
          </span>
          <span className="sample-zip-chip__places">
            {sampleList
              .map((pincode) => {
                const zone = pinIndex.get(pincode);
                return zone ? zone.locality : pincode;
              })
              .join(' · ')}
          </span>
        </button>
      )}

      {addError && <p className="message message--warn">{addError}</p>}

      {showChips &&
        (savedPins.length > 0 ? (
          <SavedPinChips
            savedPins={savedPins}
            pinIndex={pinIndex}
            onRemove={onRemove}
          />
        ) : (
          emptyHint != null && (
            <p className="saved-zip-bar__empty">{emptyHint}</p>
          )
        ))}
    </div>
  );
}
