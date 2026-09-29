/// Minimal RaidVault Bridge - M0 Foundation
///
/// This bridge provides only localhost health and version reporting.
/// No game integration, process detection, or memory access.
#[cfg(not(debug_assertions))]
fn main() {
    eprintln!("RaidVault Bridge (production mode)");
}

/// Debug entry point
#[cfg(debug_assertions)]
fn main() {
    println!("RaidVault Bridge v0.1.0");
    println!("Edition: 2024");
    println!("Safe Rust only - no game integration");
    println!("Bridge capabilities:");
    println!("  - health endpoint");
    println!("  - version reporting");
    println!("  - diagnostics (RaidVault-owned only)");
}
