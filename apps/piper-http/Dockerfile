FROM python:3.11-slim
RUN pip install --no-cache-dir piper-tts flask
COPY server.py /app/server.py
WORKDIR /app
EXPOSE 5000
CMD ["python", "server.py"]
