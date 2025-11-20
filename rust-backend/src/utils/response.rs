use axum::{http::StatusCode, response::IntoResponse, Json};
use serde_json::{json, Value};

pub fn success_response<T: serde::Serialize>(data: T) -> Json<Value> {
    Json(json!({
        "success": true,
        "data": data
    }))
}

pub fn success_response_with_message<T: serde::Serialize>(data: T, message: &str) -> Json<Value> {
    Json(json!({
        "success": true,
        "data": data,
        "message": message
    }))
}

#[allow(dead_code)]
pub fn error_response(status: StatusCode, message: &str) -> impl IntoResponse {
    (status, Json(json!({
        "success": false,
        "error": message
    })))
}

#[allow(dead_code)]
pub fn not_found_error(resource: &str) -> impl IntoResponse {
    error_response(StatusCode::NOT_FOUND, &format!("{} not found", resource))
}

#[allow(dead_code)]
pub fn bad_request_error(message: &str) -> impl IntoResponse {
    error_response(StatusCode::BAD_REQUEST, message)
}