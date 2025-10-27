FROM python:3.11-slim

WORKDIR /app

# --- Install system dependencies ---
RUN apt-get update && apt-get install -y ffmpeg && apt-get clean

# --- Install Python dependencies ---
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# --- Copy app source ---
COPY . .

# --- Create user (optional, for non-root execution) ---
ARG USERNAME=appuser
ARG USER_UID=1001
ARG USER_GID=1001
RUN groupadd --gid $USER_GID $USERNAME \
	&& useradd --uid $USER_UID --gid $USER_GID --create-home $USERNAME \
	&& chown -R $USER_UID:$USER_GID /app
USER $USERNAME

# --- Expose port (Render auto-assigns $PORT) ---
EXPOSE 8000

# --- Run server using Render's PORT env variable ---
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]