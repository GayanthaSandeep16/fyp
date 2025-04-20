# Stage 1: Build dependencies
FROM python:3.9-slim AS builder

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl xz-utils bash && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://nodejs.org/dist/v20.18.3/node-v20.18.3-linux-x64.tar.xz | tar -xJf - -C /usr/local --strip-components=1 && \
    npm install -g npm@latest

WORKDIR /app

COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

COPY package*.json ./
RUN npm install
RUN npm install -g truffle

# Stage 2: Final image
FROM python:3.9-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl xz-utils bash netcat-openbsd && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://nodejs.org/dist/v20.18.3/node-v20.18.3-linux-x64.tar.xz | tar -xJf - -C /usr/local --strip-components=1

WORKDIR /app

COPY --from=builder /root/.local /root/.local
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/truffle/build/cli.bundled.js /usr/local/bin/truffle

COPY . .

ENV PATH=/root/.local/bin:$PATH

EXPOSE 3000

CMD ["node", "app.js"]