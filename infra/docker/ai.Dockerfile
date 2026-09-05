FROM python:3.12-slim
WORKDIR /app/services/ai
ENV PYTHONUNBUFFERED=1
COPY services/ai/pyproject.toml pyproject.toml
COPY services/ai/app app
RUN pip install --no-cache-dir .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

