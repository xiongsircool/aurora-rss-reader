use axum::{http::StatusCode, response::IntoResponse, Json};
use serde::Serialize;
use serde_json::{json, Value};

pub fn success_response<T: Serialize>(data: T) -> Json<Value> {
    Json(serde_json::to_value(data).unwrap_or_else(|_| json!({})))
}

pub fn success_response_with_message<T: Serialize>(data: T, message: &str) -> Json<Value> {
    let mut value = serde_json::to_value(data).unwrap_or_else(|_| json!({}));

    if let Value::Object(ref mut map) = value {
        map.entry("message")
            .or_insert_with(|| Value::String(message.to_string()));
    }

    Json(value)
}

#[allow(dead_code)]
pub fn error_response(status: StatusCode, message: &str) -> impl IntoResponse {
    (
        status,
        Json(json!({
            "success": false,
            "error": message
        })),
    )
}

#[allow(dead_code)]
pub fn not_found_error(resource: &str) -> impl IntoResponse {
    error_response(StatusCode::NOT_FOUND, &format!("{} not found", resource))
}

#[allow(dead_code)]
pub fn bad_request_error(message: &str) -> impl IntoResponse {
    error_response(StatusCode::BAD_REQUEST, message)
}
