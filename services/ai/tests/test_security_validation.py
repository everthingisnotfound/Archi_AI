"""Security validation tests for active assessment SSRF prevention."""

import pytest
from app.security_validation import validate_allowed_hosts


class TestSSRFValidation:
    """Test SSRF prevention in allowed_hosts validation."""

    # ========== IPv4 Private Ranges Tests ==========
    
    def test_rejects_private_ip_10_range(self):
        """Should reject 10.0.0.0/8 private range."""
        with pytest.raises(ValueError, match="Blocked IP range"):
            validate_allowed_hosts(["10.0.0.1"])
        with pytest.raises(ValueError, match="Blocked IP range"):
            validate_allowed_hosts(["10.255.255.254"])

    def test_rejects_private_ip_172_range(self):
        """Should reject 172.16.0.0/12 private range."""
        with pytest.raises(ValueError, match="Blocked IP range"):
            validate_allowed_hosts(["172.16.0.1"])
        with pytest.raises(ValueError, match="Blocked IP range"):
            validate_allowed_hosts(["172.31.255.254"])

    def test_rejects_private_ip_192_168_range(self):
        """Should reject 192.168.0.0/16 private range."""
        with pytest.raises(ValueError, match="Blocked IP range"):
            validate_allowed_hosts(["192.168.0.1"])
        with pytest.raises(ValueError, match="Blocked IP range"):
            validate_allowed_hosts(["192.168.255.254"])

    # ========== Loopback & Link-Local Tests ==========

    def test_rejects_ipv4_loopback(self):
        """Should reject IPv4 loopback 127.0.0.0/8."""
        with pytest.raises(ValueError, match="Blocked IP range"):
            validate_allowed_hosts(["127.0.0.1"])
        with pytest.raises(ValueError, match="Blocked IP range"):
            validate_allowed_hosts(["127.255.255.254"])

    def test_rejects_ipv4_link_local(self):
        """Should reject IPv4 link-local 169.254.0.0/16."""
        with pytest.raises(ValueError, match="Blocked IP range"):
            validate_allowed_hosts(["169.254.0.1"])
        with pytest.raises(ValueError, match="Blocked IP range"):
            validate_allowed_hosts(["169.254.255.254"])

    # ========== IPv6 Private & Reserved Tests ==========

    def test_rejects_ipv6_loopback(self):
        """Should reject IPv6 loopback ::1."""
        with pytest.raises(ValueError, match="Blocked IP range"):
            validate_allowed_hosts(["::1"])

    def test_rejects_ipv6_link_local(self):
        """Should reject IPv6 link-local fe80::/10."""
        with pytest.raises(ValueError, match="Blocked IP range"):
            validate_allowed_hosts(["fe80::1"])
        with pytest.raises(ValueError, match="Blocked IP range"):
            validate_allowed_hosts(["fe80::ffff:192.168.1.1"])

    def test_rejects_ipv6_unique_local(self):
        """Should reject IPv6 unique local fc00::/7."""
        with pytest.raises(ValueError, match="Blocked IP range"):
            validate_allowed_hosts(["fc00::1"])
        with pytest.raises(ValueError, match="Blocked IP range"):
            validate_allowed_hosts(["fd00::1"])

    def test_rejects_ipv6_multicast(self):
        """Should reject IPv6 multicast ff00::/8."""
        with pytest.raises(ValueError, match="Blocked IP range"):
            validate_allowed_hosts(["ff00::1"])
        with pytest.raises(ValueError, match="Blocked IP range"):
            validate_allowed_hosts(["ff02::1"])

    # ========== IPv4 Multicast & Reserved Tests ==========

    def test_rejects_ipv4_multicast(self):
        """Should reject IPv4 multicast 224.0.0.0/4."""
        with pytest.raises(ValueError, match="Blocked IP range"):
            validate_allowed_hosts(["224.0.0.1"])
        with pytest.raises(ValueError, match="Blocked IP range"):
            validate_allowed_hosts(["239.255.255.254"])

    def test_rejects_ipv4_broadcast(self):
        """Should reject IPv4 broadcast 255.255.255.255."""
        with pytest.raises(ValueError, match="Blocked IP range"):
            validate_allowed_hosts(["255.255.255.255"])

    # ========== Valid Public IPs Tests ==========

    def test_accepts_public_ipv4(self):
        """Should accept public IPv4 addresses."""
        validate_allowed_hosts(["8.8.8.8"])  # Google DNS
        validate_allowed_hosts(["1.1.1.1"])  # Cloudflare DNS
        validate_allowed_hosts(["208.67.222.222"])  # OpenDNS

    def test_accepts_public_ipv6(self):
        """Should accept public IPv6 addresses."""
        validate_allowed_hosts(["2001:4860:4860::8888"])  # Google DNS
        validate_allowed_hosts(["2606:4700:4700::1111"])  # Cloudflare DNS

    # ========== Domain Names Tests ==========

    def test_accepts_public_domain(self):
        """Should accept public domain names."""
        validate_allowed_hosts(["example.com"])
        validate_allowed_hosts(["github.com"])
        validate_allowed_hosts(["api.example.com"])

    def test_accepts_wildcard_domain(self):
        """Should accept wildcard domains."""
        validate_allowed_hosts(["*.example.com"])
        validate_allowed_hosts(["*.api.example.com"])

    def test_rejects_invalid_wildcard(self):
        """Should reject invalid wildcard patterns."""
        with pytest.raises(ValueError, match="Invalid wildcard domain"):
            validate_allowed_hosts(["*."])
        with pytest.raises(ValueError, match="Invalid wildcard domain"):
            validate_allowed_hosts(["*.localhost"])

    # ========== Edge Cases Tests ==========

    def test_rejects_empty_list(self):
        """Should reject empty allowed_hosts list."""
        with pytest.raises(ValueError, match="empty"):
            validate_allowed_hosts([])

    def test_rejects_empty_string(self):
        """Should reject empty strings in list."""
        with pytest.raises(ValueError, match="empty string"):
            validate_allowed_hosts([""])
        with pytest.raises(ValueError, match="empty string"):
            validate_allowed_hosts(["example.com", "", "example.org"])

    def test_case_insensitive(self):
        """Should normalize hostnames to lowercase."""
        validate_allowed_hosts(["EXAMPLE.COM"])
        validate_allowed_hosts(["Example.COM"])

    def test_multiple_hosts(self):
        """Should validate all hosts in list."""
        validate_allowed_hosts(["example.com", "8.8.8.8", "*.api.example.com"])
        
        # One invalid should reject all
        with pytest.raises(ValueError, match="Blocked IP range"):
            validate_allowed_hosts(["example.com", "192.168.1.1"])

    def test_ipv6_without_brackets_rejected(self):
        """Should reject IPv6 notation without brackets if ambiguous."""
        # Pure IPv6 addresses are OK
        validate_allowed_hosts(["2001:4860:4860::8888"])
        
        # But malformed patterns should be rejected
        with pytest.raises(ValueError):
            validate_allowed_hosts(["example.com:8080"])  # Ambiguous format
