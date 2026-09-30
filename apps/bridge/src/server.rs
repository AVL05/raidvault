//! Loopback-only HTTP server (M7).
//!
//! A single-threaded accept loop over `std::net` with no async runtime,
//! no framework, and no dependencies. The socket binds loopback only
//! (never `0.0.0.0`), every response closes its connection, and no CORS
//! headers are emitted because no browser integration consumes the
//! Bridge yet. Ordinary user permissions suffice; nothing here requests
//! elevation or touches another process.

use std::io::{Read, Write};
use std::net::{IpAddr, Ipv4Addr, SocketAddr, TcpListener, TcpStream};
use std::time::Duration;

use crate::api::{StatusCode, parse_request_line, render_response, respond};
use crate::gaming_mode::GamingMode;
use crate::process_detection::ArcProcessDetector;

/// Loopback address the server binds. LAN exposure is not permitted.
pub const LOOPBACK: Ipv4Addr = Ipv4Addr::LOCALHOST;

/// Default unprivileged loopback port for local consumers.
pub const DEFAULT_PORT: u16 = 39313;

/// Maximum request-head bytes accepted before responding 431.
pub const MAX_HEADER_BYTES: usize = 8192;

/// Per-connection read timeout bounding slow clients.
pub const READ_TIMEOUT: Duration = Duration::from_secs(5);

/// Server composition: a detector plus its request handling.
pub struct App<Detector> {
    detector: Detector,
}

impl<Detector: ArcProcessDetector> App<Detector> {
    /// Compose the server from a process-existence detector.
    pub fn new(detector: Detector) -> Self {
        Self { detector }
    }

    /// Current Gaming Mode status. Detector failures become UNKNOWN;
    /// this function cannot fail and never panics.
    pub fn gaming_mode(&self) -> GamingMode {
        GamingMode::from_detector_result(self.detector.detect())
    }
}

/// Default loopback socket address for the Bridge.
pub fn loopback_address() -> SocketAddr {
    SocketAddr::new(IpAddr::V4(LOOPBACK), DEFAULT_PORT)
}

/// Read an HTTP request head up to the header cap.
/// Returns `None` when the client exceeds the cap.
fn read_head(stream: &mut TcpStream) -> std::io::Result<Option<Vec<u8>>> {
    let mut head: Vec<u8> = Vec::new();
    let mut chunk = [0u8; 1024];
    loop {
        let count = stream.read(&mut chunk)?;
        if count == 0 {
            break;
        }
        head.extend_from_slice(&chunk[..count]);
        if head.len() > MAX_HEADER_BYTES {
            return Ok(None);
        }
        if head.ends_with(b"\r\n\r\n") {
            break;
        }
    }
    Ok(Some(head))
}

/// Handle one connection: read, parse, route, respond, close.
/// Request bodies are never required and never read.
pub fn handle_connection<Detector: ArcProcessDetector>(
    mut stream: TcpStream,
    app: &App<Detector>,
) -> std::io::Result<()> {
    stream.set_read_timeout(Some(READ_TIMEOUT))?;
    let response = match read_head(&mut stream)? {
        None => render_response(StatusCode::HeaderFieldsTooLarge, "", false),
        Some(head) => respond_to_head(&head, app),
    };
    stream.write_all(response.as_bytes())?;
    stream.flush()?;
    Ok(())
}

/// Route an already-read request head to a serialized response.
fn respond_to_head<Detector: ArcProcessDetector>(head: &[u8], app: &App<Detector>) -> String {
    let Ok(text) = std::str::from_utf8(head) else {
        return render_response(StatusCode::BadRequest, "", false);
    };
    let line = text.lines().next().unwrap_or("");
    let Some(request) = parse_request_line(line) else {
        return render_response(StatusCode::BadRequest, "", false);
    };
    let outcome = respond(
        request.method.as_str(),
        request.path.as_str(),
        app.gaming_mode(),
    );
    render_response(
        outcome.status,
        outcome.body.as_str(),
        outcome.allow_get_only,
    )
}

/// Serve forever on the given address. Accept and per-connection
/// failures are logged to stderr without stopping the loop.
pub fn run<Detector: ArcProcessDetector>(
    app: App<Detector>,
    address: SocketAddr,
) -> std::io::Result<()> {
    let listener = TcpListener::bind(address)?;
    for connection in listener.incoming() {
        match connection {
            Ok(stream) => {
                if let Err(error) = handle_connection(stream, &app) {
                    eprintln!("raidvault-bridge: connection error: {error}");
                }
            }
            Err(error) => {
                eprintln!("raidvault-bridge: accept error: {error}");
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::process_detection::{FakeArcProcessDetector, ProcessDetection};
    use std::io::Read;

    /// Drive one request through a real loopback socket pair.
    fn roundtrip(request: &[u8], detector: FakeArcProcessDetector) -> String {
        let listener = TcpListener::bind((LOOPBACK, 0)).expect("bind loopback");
        let address = listener.local_addr().expect("local address");
        let application = App::new(detector);
        let mut client = TcpStream::connect(address).expect("connect loopback");
        client.write_all(request).expect("send request");
        let (server, _) = listener.accept().expect("accept loopback");
        handle_connection(server, &application).expect("handle connection");
        client
            .set_read_timeout(Some(Duration::from_secs(5)))
            .expect("set timeout");
        let mut body: Vec<u8> = Vec::new();
        client.read_to_end(&mut body).expect("read response");
        String::from_utf8(body).expect("response is UTF-8")
    }

    #[test]
    fn loopback_constant_is_loopback_only() {
        assert_eq!(LOOPBACK, Ipv4Addr::LOCALHOST);
        assert!(LOOPBACK.is_loopback());
        assert_ne!(LOOPBACK, Ipv4Addr::UNSPECIFIED);
    }

    /// Default port stays unprivileged so ordinary users can bind it.
    const _: () = assert!(DEFAULT_PORT >= 1024);

    #[test]
    fn loopback_address_uses_loopback_and_default_port() {
        let address = loopback_address();
        assert_eq!(address.ip(), IpAddr::V4(Ipv4Addr::LOCALHOST));
        assert_eq!(address.port(), DEFAULT_PORT);
    }

    #[test]
    fn ephemeral_loopback_bind_stays_on_loopback() {
        let listener = TcpListener::bind((LOOPBACK, 0)).expect("bind loopback");
        let address = listener.local_addr().expect("local address");
        assert!(address.ip().is_loopback());
    }

    #[test]
    fn health_roundtrip_serves_deterministic_json() {
        let response = roundtrip(
            b"GET /health HTTP/1.1\r\nHost: localhost\r\n\r\n",
            FakeArcProcessDetector::new(ProcessDetection::Unknown),
        );
        assert!(response.starts_with("HTTP/1.1 200 OK\r\n"));
        assert!(response.contains("\"status\":\"ok\""));
        assert!(response.contains("connection: close"));
        assert!(
            !response
                .to_lowercase()
                .contains("access-control-allow-origin")
        );
    }

    #[test]
    fn version_roundtrip_reports_explicit_versions() {
        let response = roundtrip(
            b"GET /version HTTP/1.1\r\n\r\n",
            FakeArcProcessDetector::new(ProcessDetection::Unknown),
        );
        assert!(response.starts_with("HTTP/1.1 200 OK\r\n"));
        assert!(response.contains("\"bridgeVersion\":\"0.1.0\""));
        assert!(response.contains("\"protocolVersion\":\"1\""));
    }

    #[test]
    fn gaming_mode_roundtrip_reflects_each_detector_state() {
        for (detection, label) in [
            (ProcessDetection::Running, "ACTIVE"),
            (ProcessDetection::NotRunning, "INACTIVE"),
            (ProcessDetection::Unknown, "UNKNOWN"),
        ] {
            let response = roundtrip(
                b"GET /gaming-mode HTTP/1.1\r\n\r\n",
                FakeArcProcessDetector::new(detection),
            );
            assert!(response.starts_with("HTTP/1.1 200 OK\r\n"));
            assert!(
                response.contains(label),
                "response must contain {label}: {response}"
            );
        }
    }

    #[test]
    fn unknown_route_roundtrip_is_404() {
        let response = roundtrip(
            b"GET /processes HTTP/1.1\r\n\r\n",
            FakeArcProcessDetector::new(ProcessDetection::Unknown),
        );
        assert!(response.starts_with("HTTP/1.1 404 Not Found\r\n"));
    }

    #[test]
    fn post_method_roundtrip_is_405_with_allow_header() {
        let response = roundtrip(
            b"POST /health HTTP/1.1\r\nContent-Length: 0\r\n\r\n",
            FakeArcProcessDetector::new(ProcessDetection::Unknown),
        );
        assert!(response.starts_with("HTTP/1.1 405 Method Not Allowed\r\n"));
        assert!(response.contains("allow: GET\r\n"));
    }

    #[test]
    fn garbage_request_roundtrip_is_400_without_panic() {
        let response = roundtrip(
            b"this is not http\r\n\r\n",
            FakeArcProcessDetector::new(ProcessDetection::Unknown),
        );
        assert!(response.starts_with("HTTP/1.1 400 Bad Request\r\n"));
    }

    #[test]
    fn oversized_headers_roundtrip_is_rejected_without_panic() {
        let mut request = b"GET /health HTTP/1.1\r\nX-Pad: ".to_vec();
        request.extend(vec![b'x'; MAX_HEADER_BYTES + 64]);
        request.extend_from_slice(b"\r\n\r\n");
        let response = roundtrip(
            request.as_slice(),
            FakeArcProcessDetector::new(ProcessDetection::Unknown),
        );
        assert!(response.starts_with("HTTP/1.1 431 "));
    }
}
