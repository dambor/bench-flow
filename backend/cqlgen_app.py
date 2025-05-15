"""
CQL to YAML Generator

This application generates YAML files from CQL schema files using the nb5.jar utility.
It handles file management, Java environment verification, and provides an API interface.

Usage:
    - As a standalone script: python cqlgen_app.py [schema_file] [output_file]
    - As an API: Run with `python cqlgen_app.py server`
"""

import os
import sys
import uuid
import shutil
import subprocess
import requests
import logging
from pathlib import Path
from typing import Optional, Tuple, Dict, Any
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("cqlgen")

# Constants
NB5_JAR_URL = "https://github.com/nosqlbench/nosqlbench/releases/latest/download/nb5.jar"  # Replace with actual URL
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
        Verify that Java 23 is installed.
        
        Returns:
            bool: True if Java 23 is available, False otherwise.
        """
        try:
            result = subprocess.run(
                ["java", "--version"], 
                capture_output=True, 
                text=True, 
                check=True
            )
            version_output = result.stdout
            
            # Check if Java 23 is in the version string
            if "23" in version_output:
                logger.info("Java 23 is available")
                return True
            else:
                logger.warning(f"Java 23 not found. Found: {version_output.strip()}")
                return False
        except subprocess.SubprocessError as e:
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

    def process_files(
        self, 
        schema_file: str, 
        conf_file: str, 
        output_file: str,
        session_id: Optional[str] = None
    ) -> Tuple[bool, str, Optional[Path]]:
        """
        Process CQL schema and configuration files to generate YAML.
        
        Args:
            schema_file (str): Path to the schema.cql file.
            conf_file (str): Path to the configuration file.
            output_file (str): Name for the output YAML file.
            session_id (Optional[str]): Session ID, or None to create a new session.
            
        Returns:
            Tuple[bool, str, Optional[Path]]: Success status, message, and path to output file.
        """
        # Verify Java 23 is available
        if not self._verify_java_version():
            return False, "Java 23 is not available. Please install Java 23 and try again.", None
        
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
            
            # Use the provided configuration file directly
            conf_file_path = Path(conf_file)
            logger.info(f"Using configuration file: {conf_file_path}")
            
            # Set up paths for schema and output
            schema_path = Path(schema_file)
            output_path = session_dir / output_file
            
            # Run nb5.jar from the session directory
            cmd = [
                "java", "--enable-preview", "-jar", 
                str(session_nb5_jar),
                "cqlgen", str(schema_path), str(output_path),
                "--show-stacktraces"
            ]
            
            logger.info(f"Running command: {' '.join(cmd)}")
            
            process = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=False  # Don't raise an exception on non-zero exit
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
            logger.error(error_msg)
            return False, error_msg, None
    
    def remove_nb5_jar(self, session_id: str) -> None:
        """
        Remove only the nb5.jar file from the session directory.
        
        Args:
            session_id (str): The session ID.
        """
        session_dir = SESSIONS_DIR / session_id
        session_nb5_jar = session_dir / "nb5.jar"
        
        if session_nb5_jar.exists():
            try:
                session_nb5_jar.unlink()
                logger.info(f"Deleted nb5.jar from session directory: {session_dir}")
            except Exception as e:
                logger.error(f"Error deleting nb5.jar from session {session_id}: {e}")
        else:
            logger.info(f"nb5.jar not found in session {session_id}, nothing to clean up")

# FastAPI application for API access
app = FastAPI(
    title="CQL to YAML Generator API",
    description="API for generating YAML files from CQL schema files",
    version="1.0.0"
)

@app.post("/generate")
async def generate_yaml(
    background_tasks: BackgroundTasks,
    schema_file: UploadFile = File(...),
    conf_file: UploadFile = File(...)
) -> Dict[str, Any]:
    """
    Generate a YAML file from CQL schema and configuration files.
    
    Args:
        schema_file (UploadFile): The schema.cql file.
        conf_file (UploadFile): The cqlgen.conf file.
        
    Returns:
        Dict[str, Any]: Response containing success status, message, and download URL.
    """
    generator = CQLGenerator()
    
    # Create a session
    session_id = generator.create_session()
    session_dir = SESSIONS_DIR / session_id
    
    try:
        # Save uploaded files to session directory
        schema_path = session_dir / schema_file.filename
        conf_path = session_dir / conf_file.filename  # Keep original filename
        output_file = "output.yaml"
        
        # Save the uploaded schema file
        with open(schema_path, "wb") as f:
            f.write(await schema_file.read())
            
        # Save the uploaded conf file with its original name
        with open(conf_path, "wb") as f:
            f.write(await conf_file.read())
        
        logger.info(f"Saved uploaded files to session directory: {session_dir}")
        logger.info(f"Schema file: {schema_path}")
        logger.info(f"Conf file: {conf_path}")
        
        # Process the files
        success, message, output_path = generator.process_files(
            str(schema_path),
            str(conf_path),
            output_file,
            session_id
        )
        
        if not success:
            # Only delete nb5.jar, not the whole session
            background_tasks.add_task(generator.remove_nb5_jar, session_id)
            raise HTTPException(status_code=500, detail=message)
        
        # Only delete nb5.jar, not the whole session
        background_tasks.add_task(generator.remove_nb5_jar, session_id)
        
        return {
            "success": True,
            "message": message,
            "download_url": f"/download/{session_id}/{output_file}",
            "session_id": session_id
        }
        
    except Exception as e:
        # Only delete nb5.jar, not the whole session
        background_tasks.add_task(generator.remove_nb5_jar, session_id)
        error_msg = f"Error processing files: {str(e)}"
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)

@app.get("/download/{session_id}/{filename}")
async def download_file(session_id: str, filename: str):
    """
    Download a generated file.
    
    Args:
        session_id (str): The session ID.
        filename (str): The file to download.
        
    Returns:
        FileResponse: The file to download.
    """
    file_path = SESSIONS_DIR / session_id / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
        
    # Do NOT clean up the session directory after download
    # Just provide the file directly
    response = FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/octet-stream"
    )
    
    return response

def cli_main() -> None:
    """
    Command-line interface for the application.
    """
    if len(sys.argv) > 1 and sys.argv[1] == "server":
        # Start API server
        logger.info("Starting API server")
        uvicorn.run("cqlgen_app:app", host="0.0.0.0", port=8001, reload=False)
    elif len(sys.argv) >= 3:
        # CLI mode - process files directly
        schema_file = sys.argv[1]
        output_file = sys.argv[2]
        
        # Look for a conf file in the same directory as the schema file
        schema_dir = os.path.dirname(os.path.abspath(schema_file))
        conf_file = os.path.join(schema_dir, "cqlgen.conf")
        
        if not os.path.exists(conf_file):
            logger.error(f"Configuration file not found: {conf_file}")
            sys.exit(1)
            
        generator = CQLGenerator()
        success, message, output_path = generator.process_files(schema_file, conf_file, output_file)
        
        # Only clean up the nb5.jar file, not the session directory
        if success:
            session_id = os.path.basename(os.path.dirname(output_path))
            generator.remove_nb5_jar(session_id)
            
            logger.info(message)
            logger.info(f"Output file: {output_path}")
            sys.exit(0)
        else:
            logger.error(message)
            sys.exit(1)
    else:
        # Show usage
        print("Usage:")
        print("  python cqlgen_app.py server                  - Start the API server")
        print("  python cqlgen_app.py schema.cql output.yaml  - Process a schema file")
        sys.exit(1)

if __name__ == "__main__":
    cli_main()