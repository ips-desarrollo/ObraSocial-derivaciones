# Stage 1: Build the React application
FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_BASE_PATH=/derivaciones/
ARG VITE_API_URL=/derivaciones/api
ARG VITE_PORTAL_LOGIN_URL=http://192.168.42.191/login
ENV VITE_BASE_PATH=$VITE_BASE_PATH
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_PORTAL_LOGIN_URL=$VITE_PORTAL_LOGIN_URL

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve the build output using Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
