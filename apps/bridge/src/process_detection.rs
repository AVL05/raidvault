//! Narrow ARC Raiders process-existence detection (M7).
//!
//! This module answers exactly one question: is the specifically approved
//! ARC Raiders executable currently running? It never inspects process
//! memory, loaded modules, windows, handles, command lines, anti-cheat
//! state, or game state, and it never enumerates processes for external
//! consumption.
//!
//! No approved executable identity exists in project documentation yet.
//! The production detector therefore reports that it cannot operate
//! instead of guessing names or scanning processes. Every failure maps
//! to GamingMode::Unknown downstream (fail-safe).

use std::fmt;

/// Outcome of asking whether the approved process exists.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProcessDetection {
    /// The approved executable was safely detected running.
    Running,
    /// Absence of the approved executable was safely established.
    NotRunning,
    /// Status could not be safely determined.
    Unknown,
}

/// Why a detector could not produce an existence answer.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DetectorError {
    /// Detection is not implemented for this platform or configuration.
    Unsupported,
    /// No approved ARC Raiders executable identity exists yet.
    NoApprovedIdentity,
}

impl fmt::Display for DetectorError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DetectorError::Unsupported => write!(formatter, "detection unsupported"),
            DetectorError::NoApprovedIdentity => {
                write!(formatter, "no approved executable identity")
            }
        }
    }
}

/// Narrow existence-detection contract. Implementations must not perform
/// memory access, injection, hooking, traffic interception, or any other
/// invasive technique; failures are reported, never escalated.
pub trait ArcProcessDetector {
    fn detect(&self) -> Result<ProcessDetection, DetectorError>;
}

/// Deterministic test double reporting a fixed outcome.
#[derive(Debug, Clone, Copy)]
pub struct FakeArcProcessDetector {
    result: ProcessDetection,
}

impl FakeArcProcessDetector {
    /// Build a double that always reports the given outcome.
    pub fn new(result: ProcessDetection) -> Self {
        Self { result }
    }
}

impl ArcProcessDetector for FakeArcProcessDetector {
    fn detect(&self) -> Result<ProcessDetection, DetectorError> {
        Ok(self.result)
    }
}

/// Production detector.
///
/// No approved ARC Raiders executable identity exists in project
/// documentation, so there is nothing safe to match against. This
/// detector reports that condition instead of guessing executable names
/// or scanning the process table. When an identity is approved, an
/// ordinary OS-level exact-name existence check belongs here (behind a
/// Windows configuration gate), still without memory, module, window,
/// handle, or anti-cheat inspection.
#[derive(Debug, Clone, Copy)]
pub struct ProductionArcProcessDetector;

impl ArcProcessDetector for ProductionArcProcessDetector {
    fn detect(&self) -> Result<ProcessDetection, DetectorError> {
        Err(DetectorError::NoApprovedIdentity)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fake_detector_reports_running() {
        let detector = FakeArcProcessDetector::new(ProcessDetection::Running);
        assert_eq!(detector.detect(), Ok(ProcessDetection::Running));
    }

    #[test]
    fn fake_detector_reports_not_running() {
        let detector = FakeArcProcessDetector::new(ProcessDetection::NotRunning);
        assert_eq!(detector.detect(), Ok(ProcessDetection::NotRunning));
    }

    #[test]
    fn fake_detector_reports_unknown() {
        let detector = FakeArcProcessDetector::new(ProcessDetection::Unknown);
        assert_eq!(detector.detect(), Ok(ProcessDetection::Unknown));
    }

    #[test]
    fn production_detector_reports_missing_identity() {
        let detector = ProductionArcProcessDetector;
        assert_eq!(detector.detect(), Err(DetectorError::NoApprovedIdentity));
    }

    #[test]
    fn production_detector_can_never_report_running() {
        // No input, name, or process state can make the production
        // detector claim the game is running: there is no approved
        // identity to match against.
        let detector = ProductionArcProcessDetector;
        assert_ne!(detector.detect(), Ok(ProcessDetection::Running));
    }

    #[test]
    fn detector_error_describes_itself() {
        assert_eq!(
            DetectorError::NoApprovedIdentity.to_string(),
            "no approved executable identity"
        );
        assert_eq!(
            DetectorError::Unsupported.to_string(),
            "detection unsupported"
        );
    }
}
