FROM python:3.12-slim as builder
WORKDIR /app/services/ai
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir --upgrade setuptools wheel
COPY services/ai/pyproject.toml pyproject.toml
COPY services/ai/app app
RUN pip install --no-cache-dir --user .

FROM python:3.12-slim
WORKDIR /app/services/ai
ENV PYTHONUNBUFFERED=1
RUN pip install --no-cache-dir --upgrade setuptools wheel
COPY --from=builder /root/.local /root/.local
COPY services/ai/app app
ENV PATH=/root/.local/bin:$PATH
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
