/// Minimal RaidVault Bridge - M0 Foundation
///
/// This binary is a minimal executable providing no game integration,
/// no process detection, no networking, and no localhost API.
/// It is intended only as a foundation artifact for the M0 milestone.
///
/// No process detection, networking, or localhost endpoints are
/// implemented or intended for this milestone.
#[cfg(not(debug_assertions))]
fn main() {
    eprintln!("RaidVault Bridge (production mode)");
}

/// Debug entry point
#[cfg(debug_assertions)]
fn main() {
    println!("RaidVault Bridge v0.1.0");
    println!("Edition: 2024");
    println!("Minimal foundation binary - M0 phase");
    println!("No game integration, no process detection");
}
