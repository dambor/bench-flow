# NoSQLBench Flow Makefile
# This Makefile helps set up and run the NoSQLBench Flow application

# Constants for JAR downloads
BACKEND_DIR := backend
NB5_JAR_URL := https://github.com/nosqlbench/nosqlbench/releases/latest/download/nb5.jar
DSBULK_VERSION := 1.11.0
DSBULK_URL := https://downloads.datastax.com/dsbulk/dsbulk-$(DSBULK_VERSION).tar.gz

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
	@echo "  make download-jars - Download both NB5 and DSBulk JAR files"
	@echo "  make download-nb5 - Download only NB5 JAR file"
	@echo "  make download-dsbulk - Download only DSBulk JAR file"
	@echo "  make run         - Start both frontend and backend servers"
	@echo "  make run-fe      - Start frontend server only"
	@echo "  make run-be      - Start backend server only"
	@echo "  make build       - Build the frontend for production"
	@echo "  make clean       - Remove node_modules, __pycache__, and build artifacts"

# Setup targets
.PHONY: setup
setup: setup-fe setup-be download-jars

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

# Download JAR files
.PHONY: download-jars
download-jars: download-nb5 download-dsbulk

# Download NB5 JAR
.PHONY: download-nb5
download-nb5:
	@echo "Downloading NB5 JAR..."
	@mkdir -p $(BACKEND_DIR)
	@curl -fsSL $(NB5_JAR_URL) -o $(BACKEND_DIR)/nb5.jar
	@echo "NB5 JAR downloaded to $(BACKEND_DIR)/nb5.jar"

# Download and extract DSBulk
.PHONY: download-dsbulk
download-dsbulk:
	@echo "Downloading DSBulk..."
	@mkdir -p $(BACKEND_DIR)
	@mkdir -p temp-dsbulk
	@curl -fsSL $(DSBULK_URL) -o temp-dsbulk/dsbulk.tar.gz
	@echo "Extracting DSBulk archive..."
	@tar -xzf temp-dsbulk/dsbulk.tar.gz -C temp-dsbulk
	@find temp-dsbulk -name "*.jar" | grep -i dsbulk | head -1 | xargs -I{} cp {} $(BACKEND_DIR)/dsbulk-$(DSBULK_VERSION).jar
	@echo "DSBulk JAR extracted to $(BACKEND_DIR)/dsbulk-$(DSBULK_VERSION).jar"
	@rm -rf temp-dsbulk
	@echo "Temporary files cleaned up"

# Start targets
.PHONY: run
run:
	@echo "Starting NoSQLBench Flow application..."
	$(MAKE) run-be & $(MAKE) run-fe

.PHONY: run-fe
run-fe:
	@echo "Starting frontend server..."
	cd frontend && npm run dev || npm run dev

.PHONY: run-be
run-be:
	@echo "Starting backend server..."
	cd backend && python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8001

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