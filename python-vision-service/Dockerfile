FROM python:3.11-slim

# Install system dependencies for OCR and PDF rendering (tesseract-ocr, poppler-utils)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-spa \
    poppler-utils \
    ffmpeg \
    libsm6 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py ./

EXPOSE 5000

ENV PORT=5000
ENV OLLAMA_HOST=http://host.docker.internal:11434

CMD ["python", "main.py"]
