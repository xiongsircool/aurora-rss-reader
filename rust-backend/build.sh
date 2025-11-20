#!/bin/bash

# RSS Backend Build Script
# This script builds the Rust backend for different platforms

set -e

PROJECT_NAME="rss-backend"
VERSION=${1:-"0.1.0"}

echo "🚀 Building RSS Backend $VERSION"

# Clean previous builds
echo "🧹 Cleaning previous builds..."
cargo clean

# Build for current platform (development)
echo "📦 Building for current platform (development)..."
cargo build

# Build for current platform (release)
echo "📦 Building for current platform (release)..."
cargo build --release

# Create release directory
mkdir -p dist

# Copy the release binary
if [[ "$OSTYPE" == "darwin"* ]]; then
    cp target/release/$PROJECT_NAME dist/$PROJECT_NAME-macos
    echo "✅ macOS binary created: dist/$PROJECT_NAME-macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    cp target/release/$PROJECT_NAME dist/$PROJECT_NAME-linux
    echo "✅ Linux binary created: dist/$PROJECT_NAME-linux"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    cp target/release/$PROJECT_NAME.exe dist/$PROJECT_NAME-windows.exe
    echo "✅ Windows binary created: dist/$PROJECT_NAME-windows.exe"
fi

# Show binary size
echo "📊 Binary size:"
ls -lh dist/

echo "✨ Build completed successfully!"
echo "📁 Binaries are available in the 'dist' directory"