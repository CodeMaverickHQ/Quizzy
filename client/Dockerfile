FROM node:20-alpine as build
WORKDIR /app

# Copy package.json from client folder relative to root (build context is repo root)
COPY client/package*.json ./
RUN npm install

# Copy all client source files
COPY client/. .
RUN npm run build

FROM nginx:alpine
# Copy built frontend to nginx root
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx config relative to root, assuming it's at client/nginx.conf
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]