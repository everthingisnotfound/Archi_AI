"""Security validation utilities for active assessment."""

from __future__ import annotations

import ipaddress
from typing import Final

# IP ranges that should be blocked to prevent SSRF attacks
# Includes: loopback, private networks, link-local, multicast, reserved ranges
BLOCKED_IP_RANGES: Final[list[str]] = [
    # IPv4 ranges
    "0.0.0.0/8",              # This network
    "10.0.0.0/8",             # Private network
    "127.0.0.0/8",            # Loopback
    "169.254.0.0/16",         # Link-local
    "172.16.0.0/12",          # Private network
    "192.0.0.0/24",           # Documentation
    "192.0.2.0/24",           # Documentation
    "192.88.99.0/24",         # Reserved
    "192.168.0.0/16",         # Private network
    "198.18.0.0/15",          # Benchmarking
    "198.51.100.0/24",        # Documentation
    "203.0.113.0/24",         # Documentation
    "224.0.0.0/4",            # Multicast
    "240.0.0.0/4",            # Reserved
    "255.255.255.255/32",     # Broadcast
    
    # IPv6 ranges
    "::/128",                 # Unspecified
    "::1/128",                # Loopback
    "::ffff:0:0/96",          # IPv4-mapped
    "64:ff9b::/96",           # IPv4/IPv6 translation
    "100::/64",               # Discard prefix
    "2001::/32",              # TEREDO
    "2001:10::/28",           # Deprecated (ORCHID)
    "2001:20::/28",           # ORCHIDv2
    "2001:db8::/32",          # Documentation
    "fc00::/7",               # Unique local
    "fe80::/10",              # Link-local
    "ff00::/8",               # Multicast
]


def validate_allowed_hosts(allowed_hosts: list[str]) -> None:
    """
    Validate that all allowed_hosts are safe public hostnames/domains.
    
    Rejects:
    - Empty lists
    - Private IP ranges (10.*, 192.168.*, 172.16-31.*)
    - Loopback addresses (127.*, ::1)
    - Reserved/special-use ranges
    
    Allows:
    - Public domain names (example.com)
    - Public IP addresses (8.8.8.8, 1.1.1.1)
    - Wildcard domains (*.example.com)
    
    Args:
        allowed_hosts: List of hostnames/domains to validate
        
    Raises:
        ValueError: If any host is invalid or in a blocked range
    """
    blocked_subnets = [ipaddress.ip_network(r) for r in BLOCKED_IP_RANGES]
    
    if not allowed_hosts:
        raise ValueError("allowed_hosts cannot be empty")
    
    for host in allowed_hosts:
        if not host:
            raise ValueError("allowed_hosts contains empty string")
        
        normalized = host.lower().rstrip(".")
        
        # Handle wildcard domains (*.example.com)
        if normalized.startswith("*."):
            domain_part = normalized[2:]
            if not domain_part or "." not in domain_part:
                raise ValueError(f"Invalid wildcard domain: {host}")
            # Validate the base domain, not the wildcard
            hostname_to_check = domain_part
        else:
            hostname_to_check = normalized
        
        # Try parsing as IP address
        try:
            ip = ipaddress.ip_address(hostname_to_check)
            # IP address — check if it's in blocked ranges
            for subnet in blocked_subnets:
                if ip in subnet:
                    raise ValueError(f"Blocked IP range (private/reserved): {host}")
        except ipaddress.AddressValueError:
            # Not an IP address; validate as hostname
            if ":" in hostname_to_check and not hostname_to_check.startswith("["):
                # Likely IPv6 without brackets — reject
                raise ValueError(f"Invalid hostname format: {host}")
            # Hostnames are allowed; they don't match blocked ranges
            pass
