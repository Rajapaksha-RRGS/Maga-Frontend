import SupervisorMobileApp from './features/supervisor/SupervisorMobileApp';

/**
 * SupervisorFlowPage — primary single-route container for the daily supervisor flow.
 * Hosts the 5-tab mobile interface:
 *   1. 🏠 Home / Dashboard
 *   2. 👷 Labor Entry
 *   3. 🦺 Operator Entry & Machine Validation
 *   4. 🚜 Equipment Logs & Meter Readings
 *   5. 📋 Daily Summary & Lock
 */
export default function SupervisorFlowPage() {
  return <SupervisorMobileApp />;
}
