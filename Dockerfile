# Build stage
FROM node:20-alpine AS build-stage

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_GEMINI_API_KEY
ARG VITE_OLLAMA_HOST
ENV VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY
ENV VITE_OLLAMA_HOST=$VITE_OLLAMA_HOST

RUN npm run build

# Production stage
FROM nginx:stable-alpine AS production-stage

COPY --from=build-stage /app/dist /usr/share/nginx/html

# Copy nginx configuration template
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Expose port 80
EXPOSE 80

# Nginx alpine image handles envsubst for /etc/nginx/templates/*.template automatically
CMD ["nginx", "-g", "daemon off;"]
