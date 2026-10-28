# Userspace WireGuard (wireguard-go) for hosts whose kernel has no WireGuard
# module (OpenVZ / LXC VPS). wg-quick only uses it when `ip link add ... type
# wireguard` fails, so kernel WireGuard is still preferred when available.
# Cross-compiled on the build platform: no QEMU emulation needed for arm images.
FROM --platform=$BUILDPLATFORM docker.io/library/golang:1.24-alpine AS build_wireguard_go
ARG TARGETOS
ARG TARGETARCH
ARG TARGETVARIANT
ARG WIREGUARD_GO_VERSION=v0.0.0-20250521234502-f333402bd9cb
RUN set -eux; \
  if [ "$TARGETARCH" = "arm" ]; then export GOARM="${TARGETVARIANT#v}"; fi; \
  CGO_ENABLED=0 GOOS="$TARGETOS" GOARCH="$TARGETARCH" \
    go install -trimpath -ldflags="-s -w" "golang.zx2c4.com/wireguard@${WIREGUARD_GO_VERSION}"; \
  find /go/bin -type f -name wireguard -exec mv {} /wireguard-go \;; \
  test -x /wireguard-go

FROM docker.io/library/node:22-alpine AS build_node_modules

# Copy Web UI
COPY src/ /app/
WORKDIR /app
RUN npm ci --omit=dev && npm cache clean --force

# Copy build result to a new image.
# This saves a lot of disk space.
FROM docker.io/library/node:22-alpine
COPY --from=build_node_modules /app /app
COPY --from=build_wireguard_go /wireguard-go /usr/bin/wireguard-go

# Move node_modules one directory up, so during development
# we don't have to mount it in a volume.
# This results in much faster reloading!
#
# Also, some node_modules might be native, and
# the architecture & OS of your development machine might differ
# than what runs inside of docker.
RUN mv /app/node_modules /node_modules

# Install Linux packages
# - iproute2-tc: Linux Traffic Control (`tc`) for per-peer bandwidth limits
# - conntrack-tools: per-peer connection logging (live `conntrack -E` events)
# - tshark: per-peer hostname extraction (DNS, TLS SNI, HTTP Host)
# - tcpdump: feeds tshark from the kernel NFLOG group (only the first bytes
#   of each logged connection), so bulk traffic never reaches tshark
RUN apk add -U --no-cache \
  iptables \
  iproute2-tc \
  conntrack-tools \
  tshark \
  tcpdump \
  wireguard-tools \
  dumb-init

# Expose Ports
EXPOSE 51820/udp
EXPOSE 51821/tcp

# Set Environment
ENV DEBUG=Server,WireGuard
ENV NODE_ENV=production

# Run Web UI
# A 1 MB young generation keeps the panel's resident memory about 20% lower
# on small VPSes, with no measurable difference in API latency.
WORKDIR /app
CMD ["/usr/bin/dumb-init", "node", "--max-semi-space-size=1", "server.js"]
