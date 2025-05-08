# NoSQLBench Flow Makefile
# This Makefile helps set up and run the NoSQLBench Flow application

# Default target
.PHONY: all
all: help

# Help target
.PHONY: help
help:
	@echo "NoSQLBench Flow Make Commands:"
	@echo "  make setup       - Install both frontend and backend dependencies"
	@echo "  make setup-fe    - Install frontend dependencies"
	@echo "  make setup-be    - Install backend dependencies (requires Python 3.8+)"
	@echo "  make start       - Start both frontend and backend servers"
	@echo "  make start-fe    - Start frontend server only"
	@echo "  make start-be    - Start backend server only"
	@echo "  make build       - Build the frontend for production"
	@echo "  make clean       - Remove node_modules, __pycache__, and build artifacts"

# Setup targets
.PHONY: setup
setup: setup-fe setup-be

.PHONY: setup-fe
setup-fe:
	@echo "Installing frontend dependencies..."
	cd frontend && npm install || npm install
	@echo "Frontend dependencies installed."

.PHONY: setup-be
setup-be:
	@echo "Installing backend dependencies..."
	cd backend && pip install -r requirements.txt
	@echo "Backend dependencies installed."

# Start targets
.PHONY: start
start:
	@echo "Starting NoSQLBench Flow application..."
	$(MAKE) start-be & $(MAKE) start-fe

.PHONY: start-fe
start-fe:
	@echo "Starting frontend server..."
	cd frontend && npm run dev || npm run dev

.PHONY: start-be
start-be:
	@echo "Starting backend server..."
	cd backend && python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Build frontend
.PHONY: build
build:
	@echo "Building frontend for production..."
	cd frontend && npm run build
	@echo "Frontend built. Output is in frontend/dist directory."

# Clean up
.PHONY: clean
clean:
	@echo "Cleaning up..."
	rm -rf frontend/node_modules
	rm -rf frontend/dist
	find . -name "__pycache__" -type d -exec rm -rf {} +
	find . -name "*.pyc" -delete
	@echo "Cleanup complete."

# Check requirements
.PHONY: check-reqs
check-reqs:
	@echo "Checking system requirements..."
	@(node -v && echo "Node.js is installed.") || echo "Node.js is not installed!"
	@(npm -v && echo "npm is installed.") || echo "npm is not installed!"
	@(python3 --version && echo "Python is installed.") || echo "Python is not installed!"
	@(pip --version && echo "pip is installed.") || echo "pip is not installed!"
	@(which uvicorn && echo "uvicorn is installed.") || echo "uvicorn is not installed!"
	@echo "Requirements check complete."