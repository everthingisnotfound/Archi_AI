FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        build-essential \
        python3 \
        python3-dev \
        python3-pip \
        python3.12-venv \
        python3-venv \
        fuse-overlayfs \
        iptables \
        docker.io \
        docker-compose-v2 \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable \
    && corepack prepare npm@11.12.1 --activate

RUN useradd -m -s /bin/bash ubuntu \
    && usermod -aG docker ubuntu

USER ubuntu
WORKDIR /home/ubuntu
