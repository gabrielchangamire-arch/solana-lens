FROM rust:1.97-slim AS rust-builder

WORKDIR /build
COPY rust/transaction-inspector/Cargo.toml rust/transaction-inspector/Cargo.lock ./
COPY rust/transaction-inspector/src ./src
RUN cargo build --release --locked

FROM node:22-slim

ENV NODE_ENV=production \
    PORT=4173 \
    RUST_INSPECTOR_PATH=/app/bin/solana-inspect

WORKDIR /app
COPY --chown=node:node . .
COPY --from=rust-builder --chown=node:node /build/target/release/solana-inspect /app/bin/solana-inspect

USER node
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4173/api/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["npm", "start"]
