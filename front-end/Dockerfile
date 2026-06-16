# Stage 1: Build the React application
FROM node:20-alpine AS build
WORKDIR /app
COPY front-end/package*.json ./
RUN npm install
COPY front-end/ ./
RUN npm run build

# Stage 2: Serve the build output using Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY front-end/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
