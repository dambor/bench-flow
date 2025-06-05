"""
NB5 Downloader Utility

This module handles the automatic downloading of nb5.jar if it's not found
in the expected location. It ensures the NoSQLBench jar file is available
for the application to use.
"""

import os
import requests
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("nb5_downloader")

# Constants
NB5_RELEASE_URL = (
    "https://github.com/nosqlbench/nosqlbench/releases/"
    "latest/download/nb5.jar"
)


def ensure_nb5_jar(target_path=None):
    """
    Check if nb5.jar exists at the specified path, download if not present.

    Args:
        target_path (str, optional): Path where nb5.jar should be located.
                                     If None, defaults to project root.

    Returns:
        Path: Path to the nb5.jar file
    """
    # If no target path provided, use project root
    if not target_path:
        # Determine the project root directory (where the backend folder is)
        current_dir = Path(os.path.dirname(os.path.abspath(__file__)))

        # Navigate up to find project root (the directory containing backend)
        if current_dir.name == 'backend':
            project_root = current_dir.parent
        else:
            # Already at project root or another location
            project_root = current_dir

        target_path = project_root / "nb5.jar"
    else:
        target_path = Path(target_path)

    # Check if nb5.jar exists
    if not target_path.exists():
        logger.info(f"nb5.jar not found at {target_path}, downloading...")
        try:
            download_nb5_jar(target_path)
            logger.info(f"nb5.jar downloaded successfully to {target_path}")
        except Exception as e:
            logger.error(f"Failed to download nb5.jar: {e}")
            # Return original path, but the file won't exist
            return target_path
    else:
        logger.info(f"nb5.jar already exists at {target_path}")

    return target_path


def download_nb5_jar(target_path):
    """
    Download nb5.jar from GitHub releases.

    Args:
        target_path (Path): The path where nb5.jar should be saved

    Raises:
        Exception: If download fails
    """
    try:
        # Create parent directories if they don't exist
        os.makedirs(os.path.dirname(target_path), exist_ok=True)

        # Download the file
        response = requests.get(NB5_RELEASE_URL, stream=True)
        response.raise_for_status()  # Raise an exception for HTTP errors

        # Save the file
        with open(target_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        logger.info(f"Successfully downloaded nb5.jar to {target_path}")
        return True
    except Exception as e:
        logger.error(f"Error downloading nb5.jar: {e}")
        raise


if __name__ == "__main__":
    # If run directly, ensure nb5.jar is available
    jar_path = ensure_nb5_jar()
    print(f"NB5 JAR available at: {jar_path}")
