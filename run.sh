#!/bin/bash

# Check if Docker is installed
if ! command -v docker &> /dev/null
then
    echo "Docker is not installed. Please install Docker and try again."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null
then
    echo "Docker Compose is not installed. Please install Docker Compose and try again."
    exit 1
fi

# Navigate to the project directory
cd "$(dirname "$0")"

# Check which command was passed
case "$1" in
  start)
    echo "Starting AI Cold-Calling System..."
    docker-compose up -d
    ;;
  stop)
    echo "Stopping AI Cold-Calling System..."
    docker-compose down
    ;;
  restart)
    echo "Restarting AI Cold-Calling System..."
    docker-compose restart
    ;;
  logs)
    echo "Showing logs..."
    docker-compose logs -f
    ;;
  build)
    echo "Building the application..."
    docker-compose build
    ;;
  clean)
    echo "Removing all containers and volumes..."
    docker-compose down -v
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|logs|build|clean}"
    exit 1
    ;;
esac

exit 0
