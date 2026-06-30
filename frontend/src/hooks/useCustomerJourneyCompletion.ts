import { useEffect, useState } from 'react';

// CAPADEX 3.0 Phase 1.4 — Customer Journey Completion gate (client side).
// Reads the public-config boolean `customer_journey_completion` (exposed by
// /api/capadex/public-config, backed by the `customerJourneyCompletion` flag).
// Defaults false → every journey-continuation CTA / redirect added in this phase
// is byte-identical-absent when the flag is OFF. Never throws; a failed/absent
// config simply leaves the flag false.
export function useCustomerJourneyCompletion(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/capadex/public-config')
      .then((r) => r.json())
      .then((cfg: { customer_journey_completion?: boolean }) => {
        if (!cancelled && cfg?.customer_journey_completion) setEnabled(true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return enabled;
}
