# Use Python 3.11 slim base
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Prevent Python from writing .pyc files and enable unbuffered stdout
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Install system dependencies (bash + build tools)
RUN apt-get update && \
    apt-get install -y --no-install-recommends bash build-essential && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the app code and start.sh
COPY . .

# Ensure start.sh is executable
RUN chmod +x start.sh

# Expose port for Cloud Run
EXPOSE 8080

# Start the app using start.sh
CMD ["./start.sh"]
