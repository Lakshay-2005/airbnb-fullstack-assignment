"""CLI: `python seed.py` seeds an empty database, `python seed.py --reset` rebuilds it."""

import sys

from app.seed import seed_database

if __name__ == "__main__":
    reset = "--reset" in sys.argv
    seed_database(reset=reset)
    print("Database ready" + (" (reset)." if reset else "."))
