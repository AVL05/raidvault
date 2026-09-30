//! RaidVault Bridge library: minimal localhost API surface.
//!
//! Process-existence detection, fail-safe Gaming Mode mapping, a small
//! HTTP router, and the loopback server. See `docs/BRIDGE.md` for the
//! enforced safety boundaries.

pub mod api;
pub mod gaming_mode;
pub mod process_detection;
pub mod server;
