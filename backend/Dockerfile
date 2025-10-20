FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y ffmpeg && apt-get clean
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

ARG USERNAME=appuser
ARG USER_UID=1001
ARG USER_GID=1001
RUN groupadd --gid $USER_GID $USERNAME \
	&& useradd --uid $USER_UID --gid $USER_GID --create-home $USERNAME \
	&& chown -R $USER_UID:$USER_GID /app
USER $USERNAME

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]