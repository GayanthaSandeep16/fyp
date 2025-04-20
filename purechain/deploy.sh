
#!/bin/bash

# Exit on error
set -e

# Check if Docker username is provided
if [ -z "$1" ]; then
  echo "Usage: ./deploy.sh <your_dockerhub_username>"
  exit 1
fi

DOCKER_USERNAME=$1
IMAGE_NAME="${DOCKER_USERNAME}/purechain"
IMAGE_TAG="latest"

echo "Building Docker image..."
docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .

echo "Logging in to Docker Hub..."
echo "Please enter your Docker Hub password when prompted:"
docker login -u ${DOCKER_USERNAME}

echo "Pushing image to Docker Hub..."
docker push ${IMAGE_NAME}:${IMAGE_TAG}

echo "Creating deployment docker-compose.yml..."
cat > docker-compose.prod.yml << EOL
services:
  ganache:
    image: trufflesuite/ganache:latest
    ports:
      - "8545:8545"
    command: --deterministic
    restart: unless-stopped
    networks:
      - purechain-network

  app:
    image: ${IMAGE_NAME}:${IMAGE_TAG}
    depends_on:
      - ganache
    env_file:
      - .env
    ports:
      - "3000:3000"
    command: sh -c "sleep 15 && truffle migrate --config truffle-config.cjs && node app.js"
    restart: unless-stopped
    networks:
      - purechain-network

networks:
  purechain-network:
    driver: bridge
EOL

echo "Done! Your image is now available at ${IMAGE_NAME}:${IMAGE_TAG}"
echo "To deploy on your server:"
echo "1. Copy docker-compose.prod.yml and .env to your server"
echo "2. Run: docker-compose -f docker-compose.prod.yml up -d" 