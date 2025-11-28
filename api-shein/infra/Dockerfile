# syntax=docker/dockerfile:1

# Base image: Debian 12.5 slim (pinned)
FROM debian:12.5-slim

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl ca-certificates gnupg unzip redis-server supervisor && \
    rm -rf /var/lib/apt/lists/*

# Create non‑root user
RUN groupadd -r infrauser && useradd -r -g infrauser infrauser && \
    mkdir -p /opt/browserless && chown -R infrauser:infrauser /opt/browserless

# Install Browserless Chrome (v2.30.0) – pinned version
ENV BROWSERLESS_VERSION=2.30.0
RUN curl -L "https://github.com/browserless/chrome/releases/download/v${BROWSERLESS_VERSION}/chrome-linux.zip" -o /tmp/chrome.zip && \
    unzip /tmp/chrome.zip -d /opt/browserless && \
    rm /tmp/chrome.zip && \
    chmod +x /opt/browserless/chrome-linux/chrome

# Copy supervisord configuration
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Expose ports: 3000 (Browserless) and 6379 (Redis)
EXPOSE 3000 6379

# Healthchecks (Docker will use the ones defined in docker‑compose)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s \
  CMD curl -f http://localhost:3000/pressure || exit 1

# Switch to non‑root user
USER infrauser

# Entrypoint runs supervisord
ENTRYPOINT ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
