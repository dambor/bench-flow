import os
import subprocess
from typing import Dict, List, Optional
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("dsbulk_manager")


class DSBulkManager:
    def __init__(self, dsbulk_path: str = None):
        # Use the provided path or default to a common location
        self.dsbulk_path = dsbulk_path or os.path.expanduser(
            "~/workspace/dsbulk-1.11.0.jar"
        )

    def validate_dsbulk_path(self) -> bool:
        """
        Validate that the DSBulk JAR file exists.

        Returns:
            bool: True if the file exists, False otherwise.
        """
        # Don't need to download here - that happens in main.py
        return os.path.exists(self.dsbulk_path)

    def generate_unload_command(
        self,
        keyspace: str,
        table: str,
        primary_key: str,
        output_path: str,
        limit: int = 1000000
    ) -> List[str]:
        """Generate a DSBulk unload command as a list of arguments."""
        # Build the query with proper quoting for identifiers
        query = f'SELECT "{primary_key}" FROM "{keyspace}"."{table}"'

        if limit and limit > 0:
            query += f" LIMIT {limit};"
        else:
            query += ";"

        # Build the command as a list of arguments
        command_args = [
            "java", "-jar", self.dsbulk_path, "unload",
            "-query", query,
            "-url", output_path
        ]

        logger.debug(f"Generated DSBulk unload command args: {command_args}")
        return command_args

    def generate_load_command(
        self,
        keyspace: str,
        table: str,
        csv_path: str
    ) -> List[str]:
        """Generate a DSBulk load command as a list of arguments."""
        # Build the command as a list of arguments
        command_args = [
            "java", "-jar", self.dsbulk_path, "load",
            "-k", keyspace,
            "-t", table,
            "-url", csv_path
        ]

        logger.debug(f"Generated DSBulk load command args: {command_args}")
        return command_args

    def generate_count_command(
        self,
        keyspace: str,
        table: str
    ) -> List[str]:
        """Generate a DSBulk count command as a list of arguments."""
        # Build the command as a list of arguments
        command_args = [
            "java", "-jar", self.dsbulk_path, "count",
            "-k", keyspace,
            "-t", table
        ]

        logger.debug(f"Generated DSBulk count command args: {command_args}")
        return command_args

    # _sanitize_input method is removed as it's no longer needed with shell=False

    def execute_command(self, command_args: List[str]) -> Dict:
        """Execute a DSBulk command and return results."""
        try:
            # Make sure dsbulk.jar exists before executing
            if not self.validate_dsbulk_path():
                # Consider raising a specific exception here
                raise FileNotFoundError(
                    f"DSBulk JAR file not found at {self.dsbulk_path}"
                )

            # Execute the command and capture output
            logger.info(f"Executing DSBulk command: {' '.join(command_args)}")
            result = subprocess.run(
                command_args,
                shell=False,
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )

            return {
                "success": True,
                "stdout": result.stdout,
                "stderr": result.stderr
            }
        except subprocess.CalledProcessError as e:
            logger.error(f"DSBulk command failed: {e.stderr}")
            return {
                "success": False,
                "error": str(e),
                "stdout": e.stdout if hasattr(e, 'stdout') else "",
                "stderr": e.stderr if hasattr(e, 'stderr') else ""
            }
        except FileNotFoundError as e:  # Catch specific FileNotFoundError
            logger.error(f"DSBulk executable or java not found: {str(e)}")
            # Re-raise for clarity or handle as a specific error response
            raise FileNotFoundError(
                f"DSBulk executable not found at {self.dsbulk_path} or java "
                f"command not found. Please check DSBulk path and Java installation."
            )
        except Exception as e:
            logger.error(f"Error during DSBulk command execution: {e}")
            return {
                "success": False,
                "error": str(e),
                "stdout": "",
                "stderr": f"Error: {str(e)}"
            }