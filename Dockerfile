# syntax=docker/dockerfile:1

# ---- Build stage: cài deps + build dashboard (same-origin) ----
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Dashboard gọi API cùng origin (đường dẫn tương đối) khi chạy trong 1 container.
ARG VITE_CONTROL_API_BASE=""
ENV VITE_CONTROL_API_BASE=$VITE_CONTROL_API_BASE
RUN npm run build

# ---- Runtime stage: chạy Control API (phục vụ luôn dashboard + write-path) ----
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV CONTROL_API_HOST=0.0.0.0
ENV CONTROL_API_PORT=8787
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig.json ./tsconfig.json
# State runtime + backup được gắn volume để không mất khi rebuild container.
VOLUME ["/app/output"]
EXPOSE 8787
CMD ["npm", "run", "control:api"]
