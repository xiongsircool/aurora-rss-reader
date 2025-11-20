# RSS Backend - Rust Implementation

A high-performance RSS reader backend implemented in Rust, migrating from the original Python FastAPI implementation.

## 🚀 Features

- **High Performance**: Built with Rust and Tokio for excellent concurrency and performance
- **Memory Safety**: Leverage Rust's ownership system for memory-safe operations
- **Type Safety**: Strong type system preventing runtime errors
- **Async/Await**: Full async support for I/O intensive operations
- **RESTful API**: Compatible with existing frontend applications
- **AI Integration**: GLM-4-Flash integration for article summarization and translation
- **RSS Management**: Complete RSS feed and article management
- **Real-time Updates**: Scheduled RSS fetching with configurable intervals

## 🛠️ Tech Stack

- **Web Framework**: Axum + Tokio
- **Database**: SeaORM + SQLx + SQLite
- **HTTP Client**: Reqwest
- **RSS Parsing**: feed-rs
- **HTML Parsing**: scraper + readability
- **AI Integration**: async-openai
- **Task Scheduling**: tokio-cron-scheduler
- **Serialization**: Serde
- **Logging**: tracing

## 📋 Requirements

- Rust 1.70+
- SQLite 3
- (Optional) Docker for containerized deployment

## 🚀 Quick Start

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd rust-backend
```

2. Install Rust:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

3. Copy environment configuration:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Build and run:
```bash
cargo run --release
```

### Development

1. Install development dependencies:
```bash
cargo build
```

2. Run in development mode:
```bash
cargo run
```

3. Run tests:
```bash
cargo test
```

4. Format code:
```bash
cargo fmt
```

5. Run linter:
```bash
cargo clippy
```

## 📁 Project Structure

```
rust-backend/
├── src/
│   ├── main.rs              # Application entry point
│   ├── config/              # Configuration management
│   ├── handlers/            # API route handlers
│   ├── models/              # Data models and entities
│   ├── services/            # Business logic services
│   └── utils/               # Utility functions
├── migrations/              # Database migrations
├── tests/                   # Integration tests
├── Cargo.toml               # Dependencies configuration
├── .env.example             # Environment variables template
└── README.md                # This file
```

## 🔧 Configuration

The application uses environment variables for configuration. See `.env.example` for available options:

```env
APP_ENV=development
API_HOST=127.0.0.1
API_PORT=8787
RSSHUB_BASE=https://rsshub.app
FETCH_INTERVAL_MINUTES=15
GLM_API_KEY=your_api_key_here
```

## 📚 API Documentation

### RSS Feeds

- `GET /api/feeds` - List all RSS feeds
- `POST /api/feeds` - Create new RSS feed
- `GET /api/feeds/:id` - Get specific RSS feed
- `PUT /api/feeds/:id` - Update RSS feed
- `DELETE /api/feeds/:id` - Delete RSS feed
- `POST /api/feeds/:id/refresh` - Manually refresh RSS feed

### Articles

- `GET /api/entries` - List articles with pagination and filtering
- `GET /api/entries/:id` - Get specific article
- `PUT /api/entries/:id` - Update article
- `POST /api/entries/:id/read` - Mark as read
- `POST /api/entries/:id/unread` - Mark as unread
- `POST /api/entries/:id/star` - Star article
- `POST /api/entries/:id/unstar` - Unstar article

### AI Features

- `POST /api/ai/summarize` - Generate article summary
- `POST /api/ai/translate` - Translate article content

### Settings

- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update user settings

### OPML

- `POST /api/opml/import` - Import OPML file
- `GET /api/opml/export` - Export OPML file

## 🧪 Testing

Run all tests:
```bash
cargo test
```

Run specific test modules:
```bash
cargo test --test integration_tests
cargo test handlers::feeds
```

## 📊 Migration Status

This is a work-in-progress migration from the Python implementation. See [TODOLIST.md](./TODOLIST.md) for detailed migration progress.

### Current Status: Phase 1 - Infrastructure Setup

✅ Project Structure
✅ Dependencies Configuration
⏳ Database Models
⏳ Basic Web Server
⏳ Configuration Management

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Run tests: `cargo test`
5. Commit changes: `git commit -am 'Add feature'`
6. Push to branch: `git push origin feature-name`
7. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

## 🔗 Related Projects

- [RSS Reader Frontend](../rss-desktop/) - Electron desktop application
- [Original Python Backend](../backend/) - Python FastAPI implementation
- [Project Documentation](../README.md) - Main project documentation