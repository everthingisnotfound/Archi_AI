#!/usr/bin/env bash
set -euo pipefail

if ! docker info >/dev/null 2>&1; then
  if [[ -w /var/run/docker.sock ]]; then
    :
  elif [[ -S /var/run/docker.sock ]]; then
    sudo chmod 666 /var/run/docker.sock 2>/dev/null || true
  else
    sudo dockerd --iptables=false --storage-driver=fuse-overlayfs >/tmp/dockerd.log 2>&1 &
    for _ in $(seq 1 30); do
      if docker info >/dev/null 2>&1; then
        break
      fi
      sleep 1
    done
    sudo chmod 666 /var/run/docker.sock 2>/dev/null || true
  fi
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not available" >&2
  exit 1
fi

echo "Docker is ready"
