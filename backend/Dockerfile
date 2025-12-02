FROM pytorch/pytorch:2.5.1-cuda12.1-cudnn9-runtime

# --- Environment variables ---
ARG MODEL_SIZE=base_plus
ENV APP_ROOT=/app \
    MODEL_SIZE=${MODEL_SIZE} \
    PYTHONUNBUFFERED=1

WORKDIR ${APP_ROOT}

# --- System dependencies ---
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libavutil-dev \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    pkg-config \
    build-essential \
    libffi-dev \
    curl \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./ 

# --- Install Python dependencies ---
RUN pip install --no-cache-dir --upgrade pip setuptools \
 && pip install --no-cache-dir -e ".[interactive-UI]"

# Fix ffmpeg path
RUN [ -f /opt/conda/bin/ffmpeg ] && rm -f /opt/conda/bin/ffmpeg || true \
 && ln -s /bin/ffmpeg /opt/conda/bin/ffmpeg

# Copy backend server files
COPY . ${APP_ROOT}

# Copy SAM 2 checkpoints
COPY checkpoints ./checkpoints
RUN chmod +x /app/checkpoints/download_ckpts.sh

# --- Add entrypoint script ---
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# --- Create user (optional, for non-root execution) ---
ARG USERNAME=appuser
ARG USER_UID=1001
ARG USER_GID=1001
RUN groupadd --gid $USER_GID $USERNAME \
	&& useradd --uid $USER_UID --gid $USER_GID --create-home $USERNAME \
	&& chown -R $USER_UID:$USER_GID /app
USER $USERNAME

# --- Expose port ---
EXPOSE 8000

# --- Run server using Render's PORT env variable ---
ENTRYPOINT ["/entrypoint.sh"]