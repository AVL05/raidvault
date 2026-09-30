//! Fail-safe Gaming Mode mapping (M7).
//!
//! Gaming Mode answers only whether ARC Raiders may be running, derived
//! solely from process-existence detection. It never reports menu,
//! in-match, loading, or background states. UNKNOWN is fail-safe:
//! future AI consumers must treat ACTIVE and UNKNOWN as "stop heavy
//! work" and only INACTIVE as "allowed".

use crate::process_detection::{DetectorError, ProcessDetection};

/// Process-existence-derived Gaming Mode status.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GamingMode {
    /// The approved executable was safely detected running.
    Active,
    /// Absence of the approved executable was safely established.
    Inactive,
    /// Status could not be safely determined. Fail-safe.
    Unknown,
}

impl GamingMode {
    /// Map a successful detection outcome. Total: every variant covered.
    pub fn from_detection(detection: ProcessDetection) -> Self {
        match detection {
            ProcessDetection::Running => GamingMode::Active,
            ProcessDetection::NotRunning => GamingMode::Inactive,
            ProcessDetection::Unknown => GamingMode::Unknown,
        }
    }

    /// Map a fallible detection, sending every error to UNKNOWN.
    /// Detector failures never panic and never escalate techniques.
    pub fn from_detector_result(result: Result<ProcessDetection, DetectorError>) -> Self {
        match result {
            Ok(detection) => GamingMode::from_detection(detection),
            Err(_) => GamingMode::Unknown,
        }
    }

    /// Stable wire value for deterministic serialization.
    pub fn as_str(self) -> &'static str {
        match self {
            GamingMode::Active => "ACTIVE",
            GamingMode::Inactive => "INACTIVE",
            GamingMode::Unknown => "UNKNOWN",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn running_maps_to_active() {
        assert_eq!(
            GamingMode::from_detection(ProcessDetection::Running),
            GamingMode::Active
        );
    }

    #[test]
    fn not_running_maps_to_inactive() {
        assert_eq!(
            GamingMode::from_detection(ProcessDetection::NotRunning),
            GamingMode::Inactive
        );
    }

    #[test]
    fn unknown_detection_maps_to_unknown() {
        assert_eq!(
            GamingMode::from_detection(ProcessDetection::Unknown),
            GamingMode::Unknown
        );
    }

    #[test]
    fn detector_error_maps_to_unknown_without_panic() {
        assert_eq!(
            GamingMode::from_detector_result(Err(DetectorError::NoApprovedIdentity)),
            GamingMode::Unknown
        );
        assert_eq!(
            GamingMode::from_detector_result(Err(DetectorError::Unsupported)),
            GamingMode::Unknown
        );
    }

    #[test]
    fn wire_values_are_stable() {
        assert_eq!(GamingMode::Active.as_str(), "ACTIVE");
        assert_eq!(GamingMode::Inactive.as_str(), "INACTIVE");
        assert_eq!(GamingMode::Unknown.as_str(), "UNKNOWN");
    }
}
