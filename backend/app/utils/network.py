from __future__ import annotations

import asyncio
import ipaddress
import socket
from urllib.parse import urljoin, urlparse

import httpx

MAX_REDIRECTS = 5


def _is_global_ip(ip: ipaddress._BaseAddress) -> bool:
    return ip.is_global


async def _resolve_host(hostname: str, port: int) -> list[ipaddress._BaseAddress]:
    loop = asyncio.get_running_loop()
    infos = await loop.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
    addresses: list[ipaddress._BaseAddress] = []
    for _, _, _, _, sockaddr in infos:
        ip = sockaddr[0]
        addresses.append(ipaddress.ip_address(ip))
    return addresses


async def is_public_url(url: str) -> bool:
    if not url:
        return False
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        return False
    if not parsed.hostname:
        return False
    if parsed.username or parsed.password:
        return False

    hostname = parsed.hostname
    try:
        ip = ipaddress.ip_address(hostname)
        return _is_global_ip(ip)
    except ValueError:
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        try:
            addresses = await _resolve_host(hostname, port)
        except Exception:
            return False
        if not addresses:
            return False
        return all(_is_global_ip(addr) for addr in addresses)


async def fetch_with_redirects(
    client: httpx.AsyncClient,
    url: str,
    *,
    max_redirects: int = MAX_REDIRECTS,
    headers: dict[str, str] | None = None,
) -> httpx.Response:
    if not await is_public_url(url):
        raise ValueError("URL is not allowed")

    current_url = url
    for _ in range(max_redirects + 1):
        response = await client.get(current_url, headers=headers, follow_redirects=False)
        if response.status_code in {301, 302, 303, 307, 308}:
            location = response.headers.get("location")
            if not location:
                return response
            next_url = urljoin(current_url, location)
            await response.aclose()
            if not await is_public_url(next_url):
                raise ValueError("Redirect target is not allowed")
            current_url = next_url
            continue
        return response

    raise ValueError("Too many redirects")
