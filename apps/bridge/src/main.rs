/// RaidVault Bridge — minimal localhost companion (M7).
///
/// Serves three loopback-only GET endpoints (`/health`, `/version`,
/// `/gaming-mode`) backed by narrow process-existence detection and
/// fail-safe Gaming Mode mapping. No game integration, no process
/// memory access, no anti-cheat interaction, no traffic interception,
/// no automation, and no elevated privileges. Ordinary user permissions
/// suffice. See `docs/BRIDGE.md` for the enforced boundaries.
use raidvault_bridge::process_detection::ProductionArcProcessDetector;
use raidvault_bridge::server::{self, App};

/// Compose the Bridge and serve on loopback. Startup failures (such as
/// an occupied port) are reported on stderr with a nonzero exit.
/// Request handling itself never panics on expected runtime errors.
fn main() {
    let application = App::new(ProductionArcProcessDetector);
    let address = server::loopback_address();
    if let Err(error) = server::run(application, address) {
        eprintln!("raidvault-bridge: failed to serve {address}: {error}");
        std::process::exit(1);
    }
}
