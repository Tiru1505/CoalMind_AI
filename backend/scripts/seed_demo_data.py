"""Reset and seed the CoalMind AI demo database.

Usage (from backend/):  python -m scripts.seed_demo_data
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database.seed import reset_and_seed  # noqa: E402

if __name__ == "__main__":
    result = reset_and_seed()
    print(f"Demo scenario loaded: {result}")
