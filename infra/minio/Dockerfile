FROM golang:1.24-alpine AS server-build
RUN apk add --no-cache git
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build CGO_ENABLED=0 GOPROXY='https://proxy.golang.org|direct' go install github.com/minio/minio@7aac2a2c5b7c882e68c1ce017d8256be2feea27f

FROM golang:1.24-alpine AS client-build
RUN apk add --no-cache git
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build CGO_ENABLED=0 GOPROXY='https://proxy.golang.org|direct' go install github.com/minio/mc@77f82e18b5401a65958f1619df6ebb994634bd88

FROM alpine:3.22 AS server
RUN apk add --no-cache ca-certificates curl
COPY --from=server-build /go/bin/minio /usr/local/bin/minio
ENTRYPOINT ["minio"]

FROM alpine:3.22 AS client
RUN apk add --no-cache ca-certificates
COPY --from=client-build /go/bin/mc /usr/local/bin/mc
ENTRYPOINT ["mc"]
