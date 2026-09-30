//! Minimal localhost HTTP surface (M7).
//!
//! Exactly three GET routes with deterministic hand-built JSON bodies:
//! `/health`, `/version`, `/gaming-mode`. Everything else is rejected
//! (unknown routes → 404, non-GET methods → 405 with `Allow: GET`,
//! malformed request lines → 400, oversized headers → 431).
//! No query-string handling, no request bodies, no CORS, no RPC.

use crate::gaming_mode::GamingMode;

/// Bridge version taken from the package manifest at compile time.
pub const BRIDGE_VERSION: &str = env!("CARGO_PKG_VERSION");

/// Stable API protocol version exposed by every endpoint.
pub const PROTOCOL_VERSION: &str = "1";

/// Routes served by the Bridge. Nothing generic exists.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Route {
    Health,
    Version,
    GamingMode,
}

/// Exact-match router. Query strings or prefixes never match.
pub fn parse_route(path: &str) -> Option<Route> {
    match path {
        "/health" => Some(Route::Health),
        "/version" => Some(Route::Version),
        "/gaming-mode" => Some(Route::GamingMode),
        _ => None,
    }
}

/// HTTP status codes the Bridge can emit.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StatusCode {
    Ok,
    BadRequest,
    NotFound,
    MethodNotAllowed,
    HeaderFieldsTooLarge,
}

impl StatusCode {
    /// Numeric code for the status line.
    pub fn code(self) -> u16 {
        match self {
            StatusCode::Ok => 200,
            StatusCode::BadRequest => 400,
            StatusCode::NotFound => 404,
            StatusCode::MethodNotAllowed => 405,
            StatusCode::HeaderFieldsTooLarge => 431,
        }
    }

    /// Reason phrase for the status line.
    pub fn reason(self) -> &'static str {
        match self {
            StatusCode::Ok => "OK",
            StatusCode::BadRequest => "Bad Request",
            StatusCode::NotFound => "Not Found",
            StatusCode::MethodNotAllowed => "Method Not Allowed",
            StatusCode::HeaderFieldsTooLarge => "Request Header Fields Too Large",
        }
    }
}

/// Parsed request line: method plus path. Bodies are never required.
#[derive(Debug, PartialEq, Eq)]
pub struct ParsedRequest {
    /// HTTP method exactly as sent (compared case-sensitively).
    pub method: String,
    /// Request target exactly as sent (matched exactly, no decoding).
    pub path: String,
}

/// Parse an HTTP request line such as `GET /health HTTP/1.1`.
/// Anything else is rejected; no lenient fallback exists.
pub fn parse_request_line(line: &str) -> Option<ParsedRequest> {
    let mut parts = line.split_whitespace();
    let method = parts.next()?;
    let path = parts.next()?;
    parts.next()?;
    if parts.next().is_some() {
        return None;
    }
    if method.is_empty() || path.is_empty() {
        return None;
    }
    Some(ParsedRequest {
        method: method.to_string(),
        path: path.to_string(),
    })
}

/// Deterministic health body. No host, user, path, or secret data.
pub fn health_body() -> String {
    format!(
        "{{\"status\":\"ok\",\"bridgeVersion\":\"{BRIDGE_VERSION}\",\"protocolVersion\":\"{PROTOCOL_VERSION}\"}}"
    )
}

/// Deterministic version body. No timestamps or machine values.
pub fn version_body() -> String {
    format!("{{\"bridgeVersion\":\"{BRIDGE_VERSION}\",\"protocolVersion\":\"{PROTOCOL_VERSION}\"}}")
}

/// Deterministic Gaming Mode body. Only status plus detector support.
pub fn gaming_mode_body(mode: GamingMode, detector_supported: bool) -> String {
    format!(
        "{{\"gamingMode\":\"{}\",\"detectorSupported\":{},\"protocolVersion\":\"{PROTOCOL_VERSION}\"}}",
        mode.as_str(),
        detector_supported
    )
}

/// Resolved route outcome before serialization.
pub struct RouteResponse {
    /// HTTP status for the response.
    pub status: StatusCode,
    /// Whether to include an `Allow: GET` header (405 only).
    pub allow_get_only: bool,
    /// JSON body (empty for error statuses).
    pub body: String,
}

/// Route a parsed request. Unknown paths 404 even for bad methods;
/// known paths reject non-GET methods with 405.
pub fn respond(method: &str, path: &str, mode: GamingMode) -> RouteResponse {
    let Some(route) = parse_route(path) else {
        return RouteResponse {
            status: StatusCode::NotFound,
            allow_get_only: false,
            body: String::new(),
        };
    };
    if method != "GET" {
        return RouteResponse {
            status: StatusCode::MethodNotAllowed,
            allow_get_only: true,
            body: String::new(),
        };
    }
    // M7 has no approved executable identity, so detection platform
    // support is reported as unavailable alongside the status.
    const DETECTOR_SUPPORTED: bool = false;
    let body = match route {
        Route::Health => health_body(),
        Route::Version => version_body(),
        Route::GamingMode => gaming_mode_body(mode, DETECTOR_SUPPORTED),
    };
    RouteResponse {
        status: StatusCode::Ok,
        allow_get_only: false,
        body,
    }
}

/// Serialize a full HTTP/1.1 response with `Connection: close`.
/// Every connection closes after one response, so unread request
/// bytes can never desynchronize a later exchange.
pub fn render_response(status: StatusCode, body: &str, allow_get_only: bool) -> String {
    let mut response = format!(
        "HTTP/1.1 {} {}\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n",
        status.code(),
        status.reason(),
        body.len()
    );
    if allow_get_only {
        response.push_str("allow: GET\r\n");
    }
    response.push_str("\r\n");
    response.push_str(body);
    response
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn router_matches_only_the_three_expected_routes() {
        assert_eq!(parse_route("/health"), Some(Route::Health));
        assert_eq!(parse_route("/version"), Some(Route::Version));
        assert_eq!(parse_route("/gaming-mode"), Some(Route::GamingMode));
    }

    #[test]
    fn router_rejects_everything_else() {
        for path in [
            "/",
            "/processes",
            "/proc",
            "/api/health",
            "/health/",
            "/health?verbose=true",
            "/HEALTH",
            "",
        ] {
            assert_eq!(parse_route(path), None, "path must not route: {path}");
        }
    }

    #[test]
    fn request_line_parses_valid_get() {
        assert_eq!(
            parse_request_line("GET /health HTTP/1.1"),
            Some(ParsedRequest {
                method: "GET".to_string(),
                path: "/health".to_string(),
            })
        );
    }

    #[test]
    fn request_line_rejects_malformed_input() {
        for line in [
            "",
            "GET",
            "GET /health",
            "GET /health HTTP/1.1 extra",
            "   ",
        ] {
            assert_eq!(
                parse_request_line(line),
                None,
                "line must not parse: {line}"
            );
        }
    }

    #[test]
    fn health_body_is_deterministic() {
        let expected = format!(
            "{{\"status\":\"ok\",\"bridgeVersion\":\"{BRIDGE_VERSION}\",\"protocolVersion\":\"{PROTOCOL_VERSION}\"}}"
        );
        assert_eq!(health_body(), expected);
    }

    #[test]
    fn version_body_is_deterministic() {
        let expected = format!(
            "{{\"bridgeVersion\":\"{BRIDGE_VERSION}\",\"protocolVersion\":\"{PROTOCOL_VERSION}\"}}"
        );
        assert_eq!(version_body(), expected);
        assert_eq!(version_body(), version_body());
    }

    #[test]
    fn gaming_mode_body_covers_all_states() {
        for (mode, label) in [
            (GamingMode::Active, "ACTIVE"),
            (GamingMode::Inactive, "INACTIVE"),
            (GamingMode::Unknown, "UNKNOWN"),
        ] {
            let body = gaming_mode_body(mode, false);
            assert!(body.contains(label), "body must contain {label}: {body}");
            assert!(body.contains("\"protocolVersion\":\"1\""));
        }
    }

    #[test]
    fn unknown_route_yields_404() {
        let response = respond("GET", "/processes", GamingMode::Unknown);
        assert_eq!(response.status, StatusCode::NotFound);
        assert!(!response.allow_get_only);
    }

    #[test]
    fn non_get_method_on_known_route_yields_405() {
        for method in ["POST", "PUT", "DELETE", "get"] {
            let response = respond(method, "/health", GamingMode::Unknown);
            assert_eq!(response.status, StatusCode::MethodNotAllowed);
            assert!(response.allow_get_only);
        }
    }

    #[test]
    fn version_values_are_explicit_and_stable() {
        assert_eq!(BRIDGE_VERSION, "0.1.0");
        assert_eq!(PROTOCOL_VERSION, "1");
    }

    #[test]
    fn rendered_response_carries_length_and_close() {
        let rendered = render_response(StatusCode::Ok, health_body().as_str(), false);
        assert!(rendered.starts_with("HTTP/1.1 200 OK\r\n"));
        assert!(rendered.contains("connection: close\r\n"));
        assert!(rendered.ends_with(health_body().as_str()));
    }

    #[test]
    fn rendered_405_carries_allow_header() {
        let rendered = render_response(StatusCode::MethodNotAllowed, "", true);
        assert!(rendered.starts_with("HTTP/1.1 405 Method Not Allowed\r\n"));
        assert!(rendered.contains("allow: GET\r\n"));
    }
}
