# Using Poetry for Dependency Management

## Installation

If you don't have Poetry installed:

```bash
curl -sSL https://install.python-poetry.org | python3 -
```

Or with pip:

```bash
pip install poetry
```

## Setup with Poetry

```bash
cd backend

# Install dependencies
poetry install

# Activate virtual environment
poetry shell

# Or run commands directly
poetry run python seed_data.py
poetry run python ingestion.py
poetry run python main.py
```

## Managing Dependencies

```bash
# Add a new dependency
poetry add package-name

# Add a dev dependency
poetry add --group dev package-name

# Update dependencies
poetry update

# Show installed packages
poetry show
```

## Running the Application

```bash
# With Poetry shell activated
poetry shell
python main.py

# Or directly
poetry run python main.py
```

## Export requirements.txt (if needed)

```bash
poetry export -f requirements.txt --output requirements.txt --without-hashes
```
