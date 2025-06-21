FROM node:20-alpine AS build
WORKDIR /app

# Copy package.json and tsconfig.json from server folder relative to repo root
COPY server/package*.json server/tsconfig.json ./
RUN npm install

# Copy all server source files
COPY server/. .
RUN npm run build

FROM node:20-alpine AS prod
WORKDIR /app

# Copy built files and package.json for production install
COPY --from=build /app/package*.json ./
COPY --from=build /app/dist ./dist
RUN npm install --production

EXPOSE 3000
CMD ["node", "dist/index.js"]