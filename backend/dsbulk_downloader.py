"""
DSBulk Downloader Utility

This module handles the automatic downloading of dsbulk.jar if it's not found
in the expected location. It ensures the DSBulk jar file is available
for the application to use.
"""

import os
import sys
import requests
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("dsbulk_downloader")

# Constants
DSBULK_VERSION = "1.11.0"
DSBULK_DOWNLOAD_URL = f"https://downloads.datastax.com/dsbulk/dsbulk-{DSBULK_VERSION}.tar.gz"

def ensure_dsbulk(target_path=None):
    """
    Check if dsbulk.jar exists at the specified path, download if not present.
    
    Args:
        target_path (str, optional): Path where dsbulk.jar should be located. 
                                    If None, defaults to project root.
    
    Returns:
        Path: Path to the dsbulk.jar file
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
            
        target_path = project_root / f"dsbulk-{DSBULK_VERSION}.jar"
    else:
        target_path = Path(target_path)
    
    # Check if dsbulk.jar exists
    if not target_path.exists():
        logger.info(f"DSBulk not found at {target_path}, downloading...")
        try:
            download_dsbulk(target_path)
            logger.info(f"DSBulk downloaded successfully to {target_path}")
        except Exception as e:
            logger.error(f"Failed to download DSBulk: {e}")
            # Return original path, but the file won't exist
            return target_path
    else:
        logger.info(f"DSBulk already exists at {target_path}")
    
    return target_path

def download_dsbulk(target_path):
    """
    Download and extract DSBulk from the DataStax website.
    
    Args:
        target_path (Path): The path where dsbulk.jar should be saved
    
    Raises:
        Exception: If download fails
    """
    try:
        import tempfile
        import tarfile
        import shutil
        
        # Create temporary directory
        temp_dir = tempfile.mkdtemp()
        temp_file = os.path.join(temp_dir, "dsbulk.tar.gz")
        
        # Download the file
        logger.info(f"Downloading DSBulk from {DSBULK_DOWNLOAD_URL}")
        response = requests.get(DSBULK_DOWNLOAD_URL, stream=True)
        response.raise_for_status()  # Raise an exception for HTTP errors
        
        # Save the file
        with open(temp_file, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        # Extract the archive
        logger.info(f"Extracting DSBulk archive")
        with tarfile.open(temp_file, 'r:gz') as tar:
            tar.extractall(path=temp_dir)
        
        # Find the jar file in the extracted directory
        dsbulk_dir = os.path.join(temp_dir, f"dsbulk-{DSBULK_VERSION}")
        for root, dirs, files in os.walk(dsbulk_dir):
            for file in files:
                if file.endswith(".jar") and "dsbulk" in file.lower():
                    jar_path = os.path.join(root, file)
                    
                    # Create parent directories of target if needed
                    os.makedirs(os.path.dirname(target_path), exist_ok=True)
                    
                    # Copy jar to target destination
                    shutil.copy2(jar_path, target_path)
                    logger.info(f"Copied {jar_path} to {target_path}")
                    
                    # Clean up temp directory
                    shutil.rmtree(temp_dir)
                    return True
        
        # If we got here, we couldn't find the jar
        raise Exception(f"Could not find DSBulk jar in the extracted archive")
    
    except Exception as e:
        logger.error(f"Error downloading and extracting DSBulk: {e}")
        # Clean up
        if 'temp_dir' in locals():
            shutil.rmtree(temp_dir)
        raise

if __name__ == "__main__":
    # If run directly, ensure dsbulk is available
    jar_path = ensure_dsbulk()
    print(f"DSBulk JAR available at: {jar_path}")