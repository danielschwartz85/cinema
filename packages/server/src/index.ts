import { createApp } from './app';
import { env } from './config/env';
import { sweepExpiredReservations } from './services/reservationService';

type RunMode = 'server' | 'sweep' | 'server-with-sweep';
const RUN_MODES: RunMode[] = ['server', 'sweep', 'server-with-sweep'];

function parseRunMode(): RunMode {
  const flag = process.argv.find((arg) => arg.startsWith('--mode='));
  const raw = flag?.slice('--mode='.length) ?? process.env.RUN_MODE ?? 'server-with-sweep';
  if (!RUN_MODES.includes(raw as RunMode)) {
    throw new Error(`Invalid run mode "${raw}". Expected one of: ${RUN_MODES.join(', ')}.`);
  }
  return raw as RunMode;
}

const mode = parseRunMode();
const runsServer = mode === 'server' || mode === 'server-with-sweep';
const runsSweep = mode === 'sweep' || mode === 'server-with-sweep';

// The only global expiry op, kept off the request path and out of app.ts so
// tests that import createApp() don't spawn a timer.
const sweepTimer = runsSweep
  ? setInterval(() => {
      sweepExpiredReservations().catch((err) => {
        console.error('Sweep failed:', err);
      });
    }, env.SWEEP_INTERVAL_MS)
  : undefined;

const BANNER = String.raw`
 ██████╗██╗███╗   ██╗███████╗███╗   ███╗ █████╗
██╔════╝██║████╗  ██║██╔════╝████╗ ████║██╔══██╗
██║     ██║██╔██╗ ██║█████╗  ██╔████╔██║███████║
██║     ██║██║╚██╗██║██╔══╝  ██║╚██╔╝██║██╔══██║
╚██████╗██║██║ ╚████║███████╗██║ ╚═╝ ██║██║  ██║
 ╚═════╝╚═╝╚═╝  ╚═══╝╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝
        🎬  R E S E R V A T I O N   S Y S T E M  🎬
`;

const server = runsServer
  ? createApp().listen(env.PORT, () => {
      console.log(BANNER);
      console.log(`Cinema server listening on port ${env.PORT} (mode: ${mode})`);
    })
  : undefined;

if (!server) {
  console.log(`Cinema sweeper running (mode: ${mode}, interval: ${env.SWEEP_INTERVAL_MS}ms)`);
}

function shutdown() {
  if (sweepTimer) clearInterval(sweepTimer);
  if (server) server.close(() => process.exit(0));
  else process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
