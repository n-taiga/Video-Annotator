DOCKER_COMPOSE = docker compose
PORT_FRONTEND = 5173
PORT_BACKEND = 8000

.PHONY: up down build logs ps help bash-backend bash-frontend

help:
	@echo "Available targets:"
	@echo "  up               - Start containers and open browser"
	@echo "  down             - Stop and remove containers"
	@echo "  build            - Build docker images"
	@echo "  logs             - Show container logs"
	@echo "  ps               - List running containers"
	@echo "  bash-backend     - Open bash shell in backend container"
	@echo "  bash-frontend    - Open bash shell in frontend container"

up:
	@$(DOCKER_COMPOSE) up -d
	@echo "Waiting for container to start..."
	@sleep 3
	@if [ "$$(uname)" = "Darwin" ]; then \
		open http://localhost:$(PORT_FRONTEND) & \
	else \
		xdg-open http://localhost:$(PORT_FRONTEND) >/dev/null 2>&1 & \
	fi
	@echo "✅ Container started and browser opened at http://localhost:$(PORT_FRONTEND)"

down:
	@$(DOCKER_COMPOSE) down

build:
	@$(DOCKER_COMPOSE) build

logs:
	@$(DOCKER_COMPOSE) logs -f

ps:
	@$(DOCKER_COMPOSE) ps

bash-backend:
	@$(DOCKER_COMPOSE) exec backend bash

bash-frontend:
	@$(DOCKER_COMPOSE) exec frontend bash
