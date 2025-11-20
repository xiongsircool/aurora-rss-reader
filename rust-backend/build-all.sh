#!/bin/bash

# Cross-platform build script for RSS Backend
# Requires: rustup target add <target>

set -e

PROJECT_NAME="rss-backend"
VERSION=${1:-"0.1.0"}

echo "🌍 Building RSS Backend $VERSION for all platforms"

# Install additional targets if not already installed
echo "📥 Installing additional Rust targets..."
rustup target add x86_64-unknown-linux-gnu
rustup target add x86_64-pc-windows-gnu
rustup target add x86_64-apple-darwin
rustup target add aarch64-apple-darwin

# Clean previous builds
echo "🧹 Cleaning previous builds..."
cargo clean

# Create release directory
mkdir -p dist

# Build for different platforms
PLATFORMS=(
    "x86_64-unknown-linux-gnu:linux"
    "x86_64-pc-windows-gnu:windows.exe"
    "x86_64-apple-darwin:macos-intel"
    "aarch64-apple-darwin:macos-apple"
)

for platform in "${PLATFORMS[@]}"; do
    target=$(echo $platform | cut -d: -f1)
    suffix=$(echo $platform | cut -d: -f2)

    echo "📦 Building for $target..."
    cargo build --release --target $target

    # Copy binary with platform-specific name
    if [[ $suffix == *.exe ]]; then
        cp target/$target/release/$PROJECT_NAME.exe dist/$PROJECT_NAME-$suffix
    else
        cp target/$target/release/$PROJECT_NAME dist/$PROJECT_NAME-$suffix
    fi

    echo "✅ Binary created: dist/$PROJECT_NAME-$suffix"
done

# Also build for current platform
echo "📦 Building for current platform..."
cargo build --release
cp target/release/$PROJECT_NAME dist/$PROJECT_NAME-native

# Show all binaries
echo "📊 All created binaries:"
ls -lh dist/

echo "✨ Cross-platform build completed!"
echo "📁 Binaries are available in the 'dist' directory"

# Create archives
echo "📦 Creating archives..."
cd dist
for binary in $PROJECT_NAME-*; do
    if [[ $binary == *.exe ]]; then
        zip "${binary%.exe}.zip" "$binary"
    else
        tar -czf "${binary}.tar.gz" "$binary"
    fi
done
cd ..

echo "📦 Archives created in dist/"