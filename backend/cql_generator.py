# backend/cql_generator.py
"""
CQL Generator module with improved directory handling for NoSQLBench Schema
Generator application. Provides functionality for generating YAML files from
CQL schema files using the nb5.jar utility.
"""

import os
import uuid
import shutil
import subprocess
import requests
import logging
import re
import time  # Import time module
from pathlib import Path
from typing import Optional, Tuple, Dict, Any  # Dict and Any are unused

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("cql_generator")

# Constants
NB5_JAR_URL = (
    "https://github.com/nosqlbench/nosqlbench/releases/latest/download/nb5.jar"
)
BASE_DIR = Path(os.path.dirname(os.path.abspath(__file__)))
SESSIONS_DIR = BASE_DIR / "sessions"
NB5_JAR_PATH = BASE_DIR / "nb5.jar"

# Create sessions directory if it doesn't exist
SESSIONS_DIR.mkdir(exist_ok=True)


class CQLGenerator:
    """
    Main class for handling CQL to YAML generation process.
    """

    def __init__(self):
        """Initialize the CQL Generator."""
        self._check_nb5_jar()

    def _check_nb5_jar(self) -> None:
        """
        Check if nb5.jar exists, download if not present.
        """
        if not NB5_JAR_PATH.exists():
            logger.info("nb5.jar not found, downloading...")
            try:
                response = requests.get(NB5_JAR_URL, stream=True)
                response.raise_for_status()
                with open(NB5_JAR_PATH, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                logger.info(f"nb5.jar downloaded to {NB5_JAR_PATH}")
            except requests.RequestException as e:
                logger.error(f"Failed to download nb5.jar: {e}")
                raise RuntimeError(f"Failed to download nb5.jar: {e}")
        else:
            logger.info(f"nb5.jar already exists at {NB5_JAR_PATH}")

    def _verify_java_version(self) -> bool:
        """
        Verify that Java is installed (version 17 or higher).

        Returns:
            bool: True if a suitable Java version is available, False otherwise.
        """
        try:
            result = subprocess.run(
                ["java", "--version"],
                capture_output=True,
                text=True,
                check=True
            )
            version_output = result.stdout

            # Extract the Java version using regex
            version_match = re.search(r'version\s+"?(\d+)\.', version_output)
            if version_match:
                java_version = int(version_match.group(1))
                logger.info(f"Found Java version: {java_version}")

                # Accept Java 17 or higher
                if java_version >= 17:
                    logger.info(
                        f"Java {java_version} is suitable (17+ required)"
                    )
                    return True
                else:
                    logger.warning(
                        f"Java version {java_version} is too old, 17+ required"
                    )
                    return False
            else:
                # Alternative pattern for newer Java releases
                alt_match = re.search(r'java\s+(\d+)', version_output)
                if alt_match:
                    java_version = int(alt_match.group(1))
                    logger.info(f"Found Java version: {java_version}")

                    if java_version >= 17:
                        logger.info(
                            f"Java {java_version} is suitable (17+ required)"
                        )
                        return True
                    else:
                        logger.warning(
                            f"Java version {java_version} is too old, 17+ required"
                        )
                        return False
                else:
                    logger.warning(
                        f"Could not determine Java version from: {version_output.strip()}"
                    )
                    # Default to accepting the Java version if we can't determine it
                    # but it exists and ran correctly
                    return True
        except subprocess.CalledProcessError as e: # More specific exception
            logger.error(f"Java version check command failed: {e.stderr}")
            return False
        except FileNotFoundError: # Java not found
            logger.error("Java command not found. Please ensure Java is installed and in PATH.")
            return False
        except Exception as e: # Catch any other unexpected error
            logger.error(f"Error checking Java version: {e}")
            return False

    def create_session(self) -> str:
        """
        Create a new session directory and copy nb5.jar to it.

        Returns:
            str: The session ID.
        """
        session_id = str(uuid.uuid4())
        session_dir = SESSIONS_DIR / session_id
        session_dir.mkdir(exist_ok=True)

        # Copy nb5.jar to session directory
        session_nb5_jar = session_dir / "nb5.jar"
        shutil.copy(NB5_JAR_PATH, session_nb5_jar)
        logger.info(f"Created session: {session_id}")
        logger.info(f"Copied nb5.jar to session directory: {session_dir}")

        return session_id

    def _create_default_conf_file(self, session_dir: Path) -> Path:
        """
        Create a default cqlgen.conf file in the session directory.

        Args:
            session_dir (Path): Path to the session directory.

        Returns:
            Path: Path to the created conf file.
        """
        conf_path = session_dir / "cqlgen.conf"

        # Create a minimal default conf
        with open(conf_path, "w") as f:
            f.write("# Default cqlgen.conf\n")
            f.write(
                "# This file contains default configuration for CQL Generator\n\n"
            )
            f.write("# Example configuration options might be added here\n")

        logger.info(f"Created default conf file: {conf_path}")
        return conf_path

    def process_files(
        self,
        schema_file: str,
        output_file: str,
        conf_file: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> Tuple[bool, str, Optional[Path]]:
        """
        Process CQL schema file to generate YAML.

        Args:
            schema_file (str): Path to the schema.cql file.
            output_file (str): Name for the output YAML file.
            conf_file (Optional[str]): Path to the configuration file,
                                       or None to use a default.
            session_id (Optional[str]): Session ID, or None to create a new
                                        session.

        Returns:
            Tuple[bool, str, Optional[Path]]: Success status, message, and path
                                             to output file.
        """
        # Verify Java is available (version 17+)
        if not self._verify_java_version():
            return False, "Java 17+ is not available. Please install Java 17 or newer and try again.", None

        # Create or use existing session
        if session_id is None:
            session_id = self.create_session()

        session_dir = SESSIONS_DIR / session_id
        logger.info(f"Processing files in session directory: {session_dir}")

        try:
            # Make sure nb5.jar is copied to the session directory
            session_nb5_jar = session_dir / "nb5.jar"
            if not session_nb5_jar.exists():
                shutil.copy(NB5_JAR_PATH, session_nb5_jar)
                logger.info(f"Copied nb5.jar to session directory: {session_dir}")

            # Set up paths for schema and output
            # Make sure to use absolute paths
            schema_path = Path(schema_file).absolute()
            output_path = session_dir / output_file

            # Determine the conf file to use
            # conf_path_obj: Optional[Path] = None # Explicitly type for clarity
            if conf_file and Path(conf_file).name != "None": # Check if conf_file is meaningful
                conf_path_obj = Path(conf_file).absolute()
                logger.info(f"Using provided conf file: {conf_path_obj}")
            else:
                # Create a default conf file in the session directory
                conf_path_obj = self._create_default_conf_file(session_dir)
                logger.info(f"Using default conf file: {conf_path_obj}")
            
            # Command uses absolute path for nb5.jar and conf_file.
            # Schema_path is absolute. Output file is relative to CWD.
            cmd = [
                "java", "--enable-preview", "-jar",
                str(session_nb5_jar),
                "cqlgen", str(schema_path), output_file,
                "--conf", str(conf_path_obj),
                "--show-stacktraces"
            ]

            logger.info(f"Running command: {' '.join(cmd)} in directory {session_dir}")

            process = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=False,  # Don't raise an exception on non-zero exit
                cwd=str(session_dir)  # Execute with session_dir as CWD
            )

            if process.returncode != 0:
                error_msg = f"Error generating YAML: {process.stderr}"
                logger.error(error_msg)
                return False, error_msg, None

            if not output_path.exists():
                error_msg = "Output file was not generated"
                logger.error(error_msg)
                return False, error_msg, None

            logger.info(f"Successfully generated YAML file: {output_path}")
            return True, "YAML file generated successfully", output_path

        except Exception as e:
            error_msg = f"Error processing files: {str(e)}"
            logger.error(error_msg, exc_info=True) # Add exc_info for more details
            return False, error_msg, None

    def remove_session_directory_after_delay(self, session_id: str, delay_seconds: int) -> None:
        """
        Remove the entire session directory after a specified delay.

        Args:
            session_id (str): The session ID.
            delay_seconds (int): The delay in seconds before removing the directory.
        """
        try:
            logger.info(f"Scheduled deletion of session directory {session_id} after {delay_seconds} seconds.")
            time.sleep(delay_seconds)

            session_dir = SESSIONS_DIR / session_id
            if session_dir.exists() and session_dir.is_dir():
                shutil.rmtree(session_dir, ignore_errors=False) # Set ignore_errors=False to log issues
                logger.info(f"Successfully deleted session directory: {session_dir}")
            else:
                logger.info(f"Session directory {session_dir} not found or is not a directory. Nothing to delete.")
        except Exception as e:
            logger.error(f"Error deleting session directory {session_id}: {e}", exc_info=True)