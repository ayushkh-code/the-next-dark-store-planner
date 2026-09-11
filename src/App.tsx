import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildPinIndex,
  loadPinData,
  totalPopulation,
  totalDemandIndex,
  type PinZone,
} from './data';
import { PincodeLookup } from './components/PincodeLookup';
import { MethodologyFaq } from './components/MethodologyFaq';
import { ReachAndExpand } from './components/ReachAndExpand';
import { ZoneDensityMap } from './components/ZoneDensityMap';
import { AppHero } from './components/AppHero';
import { PIN_HELP } from './labels';
import './App.css';

type Mode = 'reach' | 'lookup' | 'density' | 'methodology';

function App() {
  const [mode, setMode] = useState<Mode>('reach');
  const [zones, setZones] = useState<PinZone[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedPins, setSavedPins] = useState<string[]>([]);
  const [addError, setAddError] = useState<string | null>(null);
  const savedPinsRef = useRef<string[]>([]);

  useEffect(() => {
    savedPinsRef.current = savedPins;
  }, [savedPins]);

  useEffect(() => {
    loadPinData()
      .then(setZones)
      .catch((err: Error) => setLoadError(err.message));
  }, []);

  const pinIndex = useMemo(
    () => (zones ? buildPinIndex(zones) : new Map<string, PinZone>()),
    [zones],
  );

  const metroTotalPop = useMemo(
    () => (zones ? totalPopulation(zones) : 0),
    [zones],
  );

  const metroTotalDemand = useMemo(
    () => (zones ? totalDemandIndex(zones) : 0),
    [zones],
  );

  const addSavedPin = useCallback(
    (pincode: string): boolean => {
      if (!pinIndex.has(pincode)) {
        setAddError(`PIN ${PIN_HELP} not in dataset.`);
        return false;
      }
      if (savedPinsRef.current.includes(pincode)) {
        setAddError('Location already saved.');
        return false;
      }
      const next = [...savedPinsRef.current, pincode];
      savedPinsRef.current = next;
      setSavedPins(next);
      setAddError(null);
      return true;
    },
    [pinIndex],
  );

  const removeSavedPin = useCallback((pincode: string) => {
    setSavedPins((prev) => {
      const next = prev.filter((z) => z !== pincode);
      savedPinsRef.current = next;
      return next;
    });
    setAddError(null);
  }, []);

  return (
    <div className="app-shell">
      <header className="site-header">
        <AppHero
          totalPopulation={metroTotalPop}
          zoneCount={zones?.length ?? 0}
          statsReady={!!zones}
        />

        <div className="site-header__chrome">
          <div className="site-header__inner">
            <nav className="mode-tabs" aria-label="Application mode">
              <button
                type="button"
                className={mode === 'reach' ? 'tab tab--active' : 'tab'}
                onClick={() => setMode('reach')}
              >
                Reach &amp; Expand
              </button>
              <button
                type="button"
                className={mode === 'density' ? 'tab tab--active' : 'tab'}
                onClick={() => setMode('density')}
              >
                Population Density
              </button>
              <button
                type="button"
                className={mode === 'lookup' ? 'tab tab--active' : 'tab'}
                onClick={() => setMode('lookup')}
              >
                Pincode Lookup
              </button>
              <button
                type="button"
                className={mode === 'methodology' ? 'tab tab--active' : 'tab'}
                onClick={() => setMode('methodology')}
              >
                Methodology
              </button>
            </nav>
          </div>
        </div>
      </header>

      <div className="app">
        <main className="app-main">
          {loadError && (
            <p className="message message--error">
              Failed to load data: {loadError}
            </p>
          )}

          {!zones && !loadError && (
            <p className="message message--loading">Loading reference data…</p>
          )}

          {mode === 'methodology' && <MethodologyFaq />}

          {zones && mode === 'lookup' && (
            <PincodeLookup
              savedPins={savedPins}
              pinIndex={pinIndex}
              onAdd={addSavedPin}
              onRemove={removeSavedPin}
              addError={addError}
              onClearError={() => setAddError(null)}
            />
          )}

          {zones && mode === 'reach' && (
            <ReachAndExpand
              zones={zones}
              pinIndex={pinIndex}
              totalMetroPopulation={metroTotalPop}
              totalMetroDemandIndex={metroTotalDemand}
              savedPins={savedPins}
              onAdd={addSavedPin}
              onRemove={removeSavedPin}
              addError={addError}
              onClearError={() => setAddError(null)}
            />
          )}

          {zones && mode === 'density' && <ZoneDensityMap zones={zones} />}
        </main>
      </div>
    </div>
  );
}

export default App;
