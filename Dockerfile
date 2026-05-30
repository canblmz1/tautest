FROM node:24-bookworm-slim AS base

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates git openssh-client \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@10.33.1 --activate

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .changeset ./.changeset
COPY packages ./packages
COPY examples ./examples
COPY docs ./docs
COPY tsconfig.json ./

RUN pnpm install --frozen-lockfile

# Verify the workspace builds and tests pass at image build time
RUN pnpm typecheck && pnpm test && pnpm build

CMD ["bash"]
