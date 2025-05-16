from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, Depends, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from typing import List, Dict, Any, Optional
import io
import zipfile
import json
import os
import sys
import requests
from pathlib import Path
import logging
import tempfile
from schema_parser import CQLParser

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("nosqlbench_flow")

# Define constants
BASE_DIR = Path(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = BASE_DIR
SESSIONS_DIR = BASE_DIR / "sessions"
SESSIONS_DIR.mkdir(exist_ok=True)

# NB5 and DSBulk JAR URLs and paths
NB5_JAR_URL = "https://github.com/nosqlbench/nosqlbench/releases/latest/download/nb5.jar"
NB5_JAR_PATH = PROJECT_ROOT / "nb5.jar"

DSBULK_VERSION = "1.11.0"
DSBULK_JAR_PATH = PROJECT_ROOT / f"dsbulk-{DSBULK_VERSION}.jar"
DSBULK_DOWNLOAD_URL = f"https://downloads.datastax.com/dsbulk/dsbulk-{DSBULK_VERSION}.tar.gz"

# Create the application
app = FastAPI(title="NoSQLBench Schema Generator")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory cache for the latest parsed schema
SCHEMA_CACHE = {}

# Helper function to download NB5 JAR
def ensure_nb5_jar():
    """
    Check if nb5.jar exists, download if not present.
    
    Returns:
        Path: Path to the nb5.jar file
    """
    if not NB5_JAR_PATH.exists():
        logger.info(f"nb5.jar not found at {NB5_JAR_PATH}, downloading...")
        try:
            response = requests.get(NB5_JAR_URL, stream=True)
            response.raise_for_status()
            
            # Create parent directories if they don't exist
            os.makedirs(os.path.dirname(NB5_JAR_PATH), exist_ok=True)
            
            with open(NB5_JAR_PATH, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            logger.info(f"nb5.jar downloaded successfully to {NB5_JAR_PATH}")
        except Exception as e:
            logger.error(f"Failed to download nb5.jar: {e}")
            raise RuntimeError(f"Failed to download nb5.jar: {e}")
    else:
        logger.info(f"nb5.jar already exists at {NB5_JAR_PATH}")
    
    return NB5_JAR_PATH

# Helper function to download DSBulk
def ensure_dsbulk():
    """
    Check if dsbulk.jar exists, download if not present.
    
    Returns:
        Path: Path to the dsbulk.jar file
    """
    if not DSBULK_JAR_PATH.exists():
        logger.info(f"DSBulk not found at {DSBULK_JAR_PATH}, downloading...")
        try:
            import tarfile
            import shutil
            
            # Create temporary directory
            temp_dir = tempfile.mkdtemp()
            temp_file = os.path.join(temp_dir, "dsbulk.tar.gz")
            
            # Download the file
            logger.info(f"Downloading DSBulk from {DSBULK_DOWNLOAD_URL}")
            response = requests.get(DSBULK_DOWNLOAD_URL, stream=True)
            response.raise_for_status()
            
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
            jar_found = False
            
            for root, dirs, files in os.walk(dsbulk_dir):
                for file in files:
                    if file.endswith(".jar") and "dsbulk" in file.lower():
                        jar_path = os.path.join(root, file)
                        
                        # Create parent directories of target if needed
                        os.makedirs(os.path.dirname(DSBULK_JAR_PATH), exist_ok=True)
                        
                        # Copy jar to target destination
                        shutil.copy2(jar_path, DSBULK_JAR_PATH)
                        logger.info(f"Copied {jar_path} to {DSBULK_JAR_PATH}")
                        jar_found = True
                        break
                
                if jar_found:
                    break
            
            # Clean up temp directory
            shutil.rmtree(temp_dir)
            
            if not jar_found:
                raise Exception(f"Could not find DSBulk jar in the extracted archive")
                
            logger.info(f"DSBulk downloaded successfully to {DSBULK_JAR_PATH}")
        except Exception as e:
            logger.error(f"Failed to download DSBulk: {e}")
            raise RuntimeError(f"Failed to download DSBulk: {e}")
    else:
        logger.info(f"DSBulk already exists at {DSBULK_JAR_PATH}")
    
    return DSBULK_JAR_PATH

# Initialize the CQL parser
parser = CQLParser()

# Import remaining modules after the helper functions are defined
from dsbulk_utils import DSBulkManager
from nb5_executor import NB5Executor
from cql_generator import CQLGenerator

# Initialize components with proper JAR paths
nb5_executor = NB5Executor(str(NB5_JAR_PATH))
dsbulk_manager = DSBulkManager(str(DSBULK_JAR_PATH))
cql_generator = CQLGenerator()

# Application startup event handler
@app.on_event("startup")
async def startup_event():
    """
    Application startup event handler.
    This function is called when the application starts.
    We'll use it to ensure the required JAR files are available.
    """
    logger.info("Initializing NoSQLBench Flow application...")
    
    # Ensure NB5 jar is available
    logger.info("Checking for nb5.jar...")
    nb5_path = nb5_path = BASE_DIR / "nb5.jar"
    logger.info(f"NB5 jar path: {nb5_path}")
    
    # Ensure DSBulk jar is available
    logger.info("Checking for dsbulk.jar...")
    dsbulk_path = ensure_dsbulk()
    logger.info(f"DSBulk jar path: {dsbulk_path}")
    
    # Update the paths in the executors
    nb5_executor.nb5_path = str(nb5_path)
    dsbulk_manager.dsbulk_path = str(dsbulk_path)
    
    logger.info("Initialization complete!")

@app.post("/api/parse-schema")
async def parse_schema(schema_file: UploadFile = File(...)):
    """Parse a CQL schema file and return structured information"""
    if not schema_file.filename.endswith(('.cql', '.txt')):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a .cql or .txt file")
    
    content = await schema_file.read()
    schema_text = content.decode('utf-8')
    
    try:
        schema_info = parser.parse_cql(schema_text)
        
        # Store the schema in cache for later use
        SCHEMA_CACHE['latest'] = schema_info
        
        return JSONResponse(content=schema_info)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing schema: {str(e)}")

@app.post("/api/generate-yaml")
async def generate_yaml(
    schema_json: str = Form(...),
    table_selection: str = Form(...),
):
    """Generate NoSQLBench YAML files for selected tables"""
    try:
        schema_info = json.loads(schema_json)
        selected_tables = json.loads(table_selection)
        
        if not selected_tables:
            raise HTTPException(status_code=400, detail="No tables selected")
            
        # Store the schema in cache for later use
        SCHEMA_CACHE['latest'] = schema_info
            
        # Process the tables and return them in JSON format
        processed_files = []
        for table_name in selected_tables:
            yaml_content = parser.generate_nosqlbench_yaml(schema_info, table_name)
            
            # Clean the table name for the filename
            safe_name = table_name.replace('.', '_')
            filename = f"{safe_name}.yaml"
            
            processed_files.append({
                "filename": filename,
                "content": yaml_content,
                "table_name": table_name
            })
        
        # Return a JSON response with all files
        return JSONResponse(content={
            "message": f"Successfully generated {len(processed_files)} YAML files",
            "files": processed_files
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating YAML files: {str(e)}")

@app.post("/api/process-ingestion-files")
async def process_ingestion_files(ingestion_zip: UploadFile = File(...)):
    """Process a zip file containing ingestion YAML files and generate read YAML files"""
    if not ingestion_zip.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a .zip file")
    
    try:
        # Read the uploaded zip file
        content = await ingestion_zip.read()
        input_zip_buffer = io.BytesIO(content)
        
        try:
            # Process the files and store them in memory
            processed_files = []
            
            with zipfile.ZipFile(input_zip_buffer, 'r') as input_zip:
                # Check for valid YAML files
                yaml_files = [f for f in input_zip.namelist() if f.endswith(('.yaml', '.yml'))]
                
                if not yaml_files:
                    raise HTTPException(status_code=400, detail="No YAML files found in the zip file")
                
                for yaml_file in yaml_files:
                    # Read the ingestion YAML
                    ingestion_yaml = input_zip.read(yaml_file).decode('utf-8')
                    
                    # Convert ingestion YAML to read YAML
                    read_yaml = parser.convert_ingestion_to_read_yaml(ingestion_yaml)
                    
                    # Generate the output filename
                    base_name = os.path.splitext(os.path.basename(yaml_file))[0]
                    read_filename = f"{base_name}_read.yaml"
                    
                    # Store the processed file information
                    processed_files.append({
                        "filename": read_filename,
                        "content": read_yaml
                    })
            
            # Return a JSON response with all processed files
            return JSONResponse(content={
                "message": f"Successfully processed {len(processed_files)} files",
                "files": processed_files
            })
            
        except zipfile.BadZipFile:
            # If the input can't be read as a ZIP file, return an error
            raise HTTPException(status_code=400, detail="The uploaded file is not a valid ZIP file")
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing ingestion files: {str(e)}")

@app.post("/api/process-multiple-files")
async def process_multiple_files(
    files: List[UploadFile] = File(..., description="Multiple YAML files to process")
):
    """Process multiple individual YAML files and convert them to read files"""
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")
    
    processed_files = []
    
    for file in files:
        if not file.filename.endswith(('.yaml', '.yml')):
            continue  # Skip non-YAML files
        
        try:
            # Read the uploaded YAML file
            content = await file.read()
            ingestion_yaml = content.decode('utf-8')
            
            # Convert ingestion YAML to read YAML
            read_yaml = parser.convert_ingestion_to_read_yaml(ingestion_yaml)
            
            # Generate the output filename
            base_name = os.path.splitext(os.path.basename(file.filename))[0]
            read_filename = f"{base_name}_read.yaml"
            
            # Store the processed file information
            processed_files.append({
                "filename": read_filename,
                "content": read_yaml
            })
        except Exception as e:
            # Log the error but continue processing other files
            logger.error(f"Error processing file {file.filename}: {str(e)}")
    
    if not processed_files:
        raise HTTPException(status_code=400, detail="No valid YAML files were processed")
        
    # Return a JSON response with all processed files
    return JSONResponse(content={
        "message": f"Successfully processed {len(processed_files)} files",
        "files": processed_files
    })

@app.get("/api/generate-yaml-single")
async def generate_yaml_single_get(
    table_name: str = Query(..., description="Table name to generate YAML for"),
    schema_json: Optional[str] = Query(None, description="Schema JSON data")
):
    """Generate a single NoSQLBench YAML file for a specific table (GET method)"""
    return await _generate_yaml_single(table_name, schema_json)

@app.post("/api/generate-yaml-single")
async def generate_yaml_single_post(
    table_name: str = Form(..., description="Table name to generate YAML for"),
    schema_json: Optional[str] = Form(None, description="Schema JSON data")
):
    """Generate a single NoSQLBench YAML file for a specific table (POST method)"""
    return await _generate_yaml_single(table_name, schema_json)

async def _generate_yaml_single(table_name: str, schema_json: Optional[str] = None):
    """Internal function to handle YAML generation for both GET and POST methods"""
    try:
        # Validate required parameters
        if not table_name:
            raise HTTPException(status_code=400, detail="Missing required parameter: table_name")
        
        schema_info = None
        
        # If schema_json is provided, use it
        if schema_json:
            schema_info = json.loads(schema_json)
        # Otherwise, try to get it from the cache
        elif 'latest' in SCHEMA_CACHE:
            schema_info = SCHEMA_CACHE['latest']
        # If not available anywhere, return an error
        else:
            raise HTTPException(
                status_code=400, 
                detail="Schema information not available. Please upload a schema first or provide schema_json."
            )
        
        # Generate the YAML content
        yaml_content = parser.generate_nosqlbench_yaml(schema_info, table_name)
        
        # Clean the table name for the filename
        safe_name = table_name.replace('.', '_')
        filename = f"{safe_name}.yaml"
        
        # Return the YAML content directly as plain text
        return StreamingResponse(
            io.StringIO(yaml_content),
            media_type="text/plain",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Type": "text/plain; charset=utf-8"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating YAML file: {str(e)}")

@app.post("/api/process-ingestion-file")
async def process_ingestion_file(
    ingestion_file: UploadFile = File(..., description="Ingestion YAML file")
):
    """Process a single ingestion YAML file and generate a read YAML file"""
    if not ingestion_file.filename.endswith(('.yaml', '.yml')):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a .yaml or .yml file")
    
    try:
        # Read the uploaded YAML file
        content = await ingestion_file.read()
        ingestion_yaml = content.decode('utf-8')
        
        # Convert ingestion YAML to read YAML
        read_yaml = parser.convert_ingestion_to_read_yaml(ingestion_yaml)
        
        # Generate the output filename
        base_name = os.path.splitext(os.path.basename(ingestion_file.filename))[0]
        read_filename = f"{base_name}_read.yaml"
        
        # Return the YAML content directly as plain text
        return StreamingResponse(
            io.StringIO(read_yaml),
            media_type="text/plain",
            headers={
                "Content-Disposition": f"attachment; filename={read_filename}",
                "Content-Type": "text/plain; charset=utf-8"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing ingestion file: {str(e)}")

@app.post("/api/generate-read-yaml")
async def generate_read_yaml(
    write_yaml_file: UploadFile = File(..., description="Write mode YAML file"),
    csv_path: str = Form(..., description="Path to DSBulk CSV output"),
    primary_key_columns: str = Form(..., description="Comma-separated list of primary key columns")
):
    """Generate a read YAML file from a write YAML file, DSBulk CSV path, and primary key columns"""
    if not write_yaml_file.filename.endswith(('.yaml', '.yml')):
        raise HTTPException(status_code=400, detail="Invalid write YAML file type. Please upload a .yaml or .yml file")
    
    try:
        # Read the uploaded YAML file
        content = await write_yaml_file.read()
        write_yaml = content.decode('utf-8')
        
        # Parse primary key columns
        pk_columns = [col.strip() for col in primary_key_columns.split(',') if col.strip()]
        
        if not pk_columns:
            raise HTTPException(status_code=400, detail="No primary key columns provided")
        
        # Generate read YAML
        read_yaml = parser.generate_read_yaml_from_write_and_csv(write_yaml, csv_path, pk_columns)
        
        # Generate the output filename
        base_name = os.path.splitext(os.path.basename(write_yaml_file.filename))[0]
        read_filename = f"{base_name}_read.yaml"
        
        # Return the YAML content directly as plain text
        return StreamingResponse(
            io.StringIO(read_yaml),
            media_type="text/plain",
            headers={
                "Content-Disposition": f"attachment; filename={read_filename}",
                "Content-Type": "text/plain; charset=utf-8"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating read YAML: {str(e)}")

@app.post("/api/generate-read-yaml-json")
async def generate_read_yaml_json(
    write_yaml_file: UploadFile = File(..., description="Write mode YAML file"),
    csv_path: str = Form(..., description="Path to DSBulk CSV output"),
    primary_key_columns: str = Form(..., description="Comma-separated list of primary key columns")
):
    """Generate a read YAML file and return as JSON response"""
    if not write_yaml_file.filename.endswith(('.yaml', '.yml')):
        raise HTTPException(status_code=400, detail="Invalid write YAML file type. Please upload a .yaml or .yml file")
    
    try:
        # Read the uploaded YAML file
        content = await write_yaml_file.read()
        write_yaml = content.decode('utf-8')
        
        # Parse primary key columns
        pk_columns = [col.strip() for col in primary_key_columns.split(',') if col.strip()]
        
        if not pk_columns:
            raise HTTPException(status_code=400, detail="No primary key columns provided")
        
        # Generate read YAML
        read_yaml = parser.generate_read_yaml_from_write_and_csv(write_yaml, csv_path, pk_columns)
        
        # Generate the output filename
        base_name = os.path.splitext(os.path.basename(write_yaml_file.filename))[0]
        read_filename = f"{base_name}_read.yaml"
        
        # Return JSON response with the generated content
        return JSONResponse(content={
            "message": "Successfully generated read YAML file",
            "filename": read_filename,
            "content": read_yaml,
            "primary_key_columns": pk_columns,
            "csv_path": csv_path
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating read YAML: {str(e)}")

@app.get("/api/dsbulk/validate")
async def validate_dsbulk():
    """Validate that the DSBulk JAR exists"""
    is_valid = dsbulk_manager.validate_dsbulk_path()
    return {
        "valid": is_valid,
        "path": dsbulk_manager.dsbulk_path
    }

@app.post("/api/dsbulk/generate-commands")
async def generate_dsbulk_commands(
    keyspace: str = Form(..., description="Keyspace name"),
    table: str = Form(..., description="Table name"),
    operation: str = Form(..., description="Operation type (unload, load, count)"),
    primary_key: Optional[str] = Form(None, description="Primary key column for unload"),
    output_path: Optional[str] = Form(None, description="Output path for unload"),
    csv_path: Optional[str] = Form(None, description="CSV path for load"),
    limit: Optional[int] = Form(1000000, description="Limit for unload query")
):
    """Generate DSBulk command(s) based on given parameters"""
    
    try:
        if operation == "unload":
            if not primary_key:
                raise HTTPException(status_code=400, detail="Primary key is required for unload operations")
            if not output_path:
                raise HTTPException(status_code=400, detail="Output path is required for unload operations")
                
            command = dsbulk_manager.generate_unload_command(
                keyspace=keyspace,
                table=table,
                primary_key=primary_key,
                output_path=output_path,
                limit=limit
            )
            
            return {
                "command": command,
                "operation": operation,
                "description": f"Exports {primary_key} values from {keyspace}.{table} to {output_path}"
            }
            
        elif operation == "load":
            if not csv_path:
                raise HTTPException(status_code=400, detail="CSV path is required for load operations")
                
            command = dsbulk_manager.generate_load_command(
                keyspace=keyspace,
                table=table,
                csv_path=csv_path
            )
            
            return {
                "command": command,
                "operation": operation,
                "description": f"Imports data from {csv_path} into {keyspace}.{table}"
            }
            
        elif operation == "count":
            command = dsbulk_manager.generate_count_command(
                keyspace=keyspace,
                table=table
            )
            
            return {
                "command": command,
                "operation": operation,
                "description": f"Counts rows in {keyspace}.{table}"
            }
            
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported operation: {operation}")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating DSBulk command: {str(e)}")

@app.post("/api/dsbulk/execute")
async def execute_dsbulk_command(
    command: str = Form(..., description="DSBulk command to execute"),
    save_output: bool = Form(False, description="Whether to save command output to a file")
):
    """Execute a DSBulk command and return the result"""
    
    # Security check - very basic, additional validation recommended
    if ";" in command or "&" in command or "|" in command:
        raise HTTPException(status_code=400, detail="Invalid command: contains disallowed characters")
    
    try:
        result = dsbulk_manager.execute_command(command)
        
        if save_output and result["success"]:
            # Save output to a temporary file
            fd, temp_path = tempfile.mkstemp(suffix='.txt')
            with os.fdopen(fd, 'w') as f:
                f.write("STDOUT:\n")
                f.write(result["stdout"])
                f.write("\n\nSTDERR:\n")
                f.write(result["stderr"])
            
            result["output_file"] = temp_path
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error executing DSBulk command: {str(e)}")

@app.post("/api/dsbulk/download-script")
async def download_dsbulk_script(
    keyspace: str = Form(..., description="Keyspace name"),
    table: str = Form(..., description="Table name"),
    primary_key: str = Form(..., description="Primary key column"),
    output_path: str = Form(..., description="Output path for CSV"),
    limit: Optional[int] = Form(1000000, description="Limit for unload query")
):
    """Generate a DSBulk unload script and return it for download"""
    
    try:
        # Generate the command
        command = dsbulk_manager.generate_unload_command(
            keyspace=keyspace,
            table=table,
            primary_key=primary_key,
            output_path=output_path,
            limit=limit
        )
        
        # Create a shell script with the command
        script_content = "#!/bin/bash\n\n"
        script_content += "# DSBulk unload script generated by NoSQLBench Schema Generator\n"
        script_content += f"# Exports data from {keyspace}.{table}\n\n"
        script_content += command
        script_content += "\n\n# End of script\n"
        
        # Return the script for download
        filename = f"dsbulk_unload_{keyspace}_{table}.sh"
        
        return StreamingResponse(
            io.StringIO(script_content),
            media_type="text/plain",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Type": "text/plain; charset=utf-8"
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating DSBulk script: {str(e)}")

@app.get("/api/nb5/validate")
async def validate_nb5():
    """Validate that the NB5 JAR exists"""
    is_valid = nb5_executor.validate_nb5_path()
    return {
        "valid": is_valid,
        "path": nb5_executor.nb5_path
    }

@app.post("/api/nb5/generate-command")
async def generate_nb5_command(
    yaml_file: str = Form(..., description="Path to YAML file"),
    host: str = Form(..., description="Cassandra host"),
    datacenter: str = Form(..., description="Cassandra datacenter"),
    keyspace: str = Form(..., description="Cassandra keyspace"),
    additional_params: Optional[str] = Form(None, description="Additional parameters")
):
    """Generate a NB5 command string based on the given parameters"""
    try:
        command = nb5_executor.generate_execution_command(
            yaml_file=yaml_file,
            host=host,
            datacenter=datacenter,
            keyspace=keyspace,
            additional_params=additional_params
        )
        
        return {
            "command": command
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating NB5 command: {str(e)}")

@app.post("/api/nb5/execute")
async def execute_nb5(
    yaml_content: str = Form(..., description="YAML content"),
    host: str = Form(..., description="Cassandra host"),
    datacenter: str = Form(..., description="Cassandra datacenter"),
    keyspace: str = Form(..., description="Cassandra keyspace"),
    additional_params: Optional[str] = Form(None, description="Additional parameters"),
    timeout: Optional[int] = Form(600, description="Execution timeout in seconds")
):
    """Execute a NB5 command with the provided YAML and parameters"""
    try:
        result = nb5_executor.execute_nb5_command(
            yaml_content=yaml_content,
            host=host,
            datacenter=datacenter,
            keyspace=keyspace,
            additional_params=additional_params,
            timeout=timeout
        )
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error executing NB5 command: {str(e)}")

@app.get("/api/nb5/status/{execution_id}")
async def get_nb5_execution_status(execution_id: str):
    """Get the status and logs of a NB5 execution"""
    try:
        status = nb5_executor.get_execution_status(execution_id)
        return status
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Execution not found: {str(e)}")

@app.post("/api/nb5/terminate/{execution_id}")
async def terminate_nb5_execution(execution_id: str):
    """Terminate a running NB5 execution"""
    try:
        result = nb5_executor.terminate_execution(execution_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Execution not found or cannot be terminated: {str(e)}")

@app.get("/api/nb5/list")
async def list_nb5_executions():
    """List all NB5 executions with their status"""
    try:
        executions = nb5_executor.list_executions()
        return {
            "executions": executions
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing executions: {str(e)}")

@app.post("/api/nb5/download-script")
async def download_nb5_script(
    yaml_file: str = Form(..., description="Path to YAML file"),
    host: str = Form(..., description="Cassandra host"),
    datacenter: str = Form(..., description="Cassandra datacenter"),
    keyspace: str = Form(..., description="Cassandra keyspace"),
    additional_params: Optional[str] = Form(None, description="Additional parameters")
):
    """Generate a NB5 execution script and return it for download"""
    try:
        # Generate the command
        command = nb5_executor.generate_execution_command(
            yaml_file=yaml_file,
            host=host,
            datacenter=datacenter,
            keyspace=keyspace,
            additional_params=additional_params
        )
        
        # Create a shell script with the command
        script_content = "#!/bin/bash\n\n"
        script_content += "# NoSQLBench 5 execution script generated by NoSQLBench Schema Generator\n"
        script_content += f"# Executes workload against {host}\n\n"
        script_content += command
        script_content += "\n\n# End of script\n"
        
        # Return the script for download
        yaml_file_basename = os.path.basename(yaml_file)
        filename = f"nb5_execute_{yaml_file_basename}.sh"
        
        return StreamingResponse(
            io.StringIO(script_content),
            media_type="text/plain",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Type": "text/plain; charset=utf-8"
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating NB5 script: {str(e)}")

# CQL Generator API Endpoints
@app.get("/api/cqlgen/validate")
async def validate_cqlgen():
    """Validate that the CQL Generator is available and Java is installed"""
    try:
        # Check if Java is available
        java_available = cql_generator._verify_java_version()
        
        return {
            "valid": java_available,
            "nb5_jar_exists": os.path.exists(cql_generator.NB5_JAR_PATH),
            "java_version": "Java 17+" if java_available else "Java 17+ not found"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error validating CQL Generator: {str(e)}")

@app.get("/api/cqlgen/download/{session_id}/{filename}")
async def download_cqlgen_file(session_id: str, filename: str):
    """Download a generated file from a CQLGen session"""
    file_path = SESSIONS_DIR / session_id / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
        
    # Provide the file directly
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/octet-stream"
    )

@app.post("/api/cqlgen/generate")
async def generate_cqlgen_yaml(
    background_tasks: BackgroundTasks,
    schema_file: UploadFile = File(..., description="CQL schema file"),
    conf_file: Optional[UploadFile] = File(None, description="Configuration file (optional)")
):
    """Generate a YAML file from a CQL schema file using nb5.jar cqlgen"""
    if not schema_file.filename.endswith(('.cql', '.txt')):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a .cql or .txt file")
    
    try:
        # Create a session
        session_id = cql_generator.create_session()
        session_dir = SESSIONS_DIR / session_id
        
        # Save uploaded schema file to session directory
        schema_path = session_dir / schema_file.filename
        output_file = "output.yaml"
        
        # Save the uploaded schema file
        schema_content = await schema_file.read()
        with open(schema_path, "wb") as f:
            f.write(schema_content)
        
        # Handle conf file if provided
        conf_path = None
        if conf_file:
            conf_path = session_dir / conf_file.filename
            conf_content = await conf_file.read()
            with open(conf_path, "wb") as f:
                f.write(conf_content)
        
        # Process the files
        success, message, output_path = cql_generator.process_files(
            str(schema_path),
            output_file,
            str(conf_path) if conf_path else None,
            session_id
        )
        
        # Clean up nb5.jar after processing
        background_tasks.add_task(cql_generator.remove_nb5_jar, session_id)
        
        if not success:
            raise HTTPException(status_code=500, detail=message)
        
        return {
            "success": True,
            "message": message,
            "download_url": f"/api/cqlgen/download/{session_id}/{output_file}",
            "session_id": session_id
        }
        
    except Exception as e:
        # Only delete nb5.jar, not the whole session if it exists
        if 'session_id' in locals():
            background_tasks.add_task(cql_generator.remove_nb5_jar, session_id)
        error_msg = f"Error processing file: {str(e)}"
        raise HTTPException(status_code=500, detail=error_msg)

@app.post("/api/cqlgen/process-with-schema")
async def process_with_schema(
    background_tasks: BackgroundTasks,
    schema_file: UploadFile = File(..., description="CQL schema file"),
    conf_file: Optional[UploadFile] = File(None, description="Configuration file (optional)"),
    parse_for_app: bool = Form(True, description="Parse the schema for use in the application after generating YAML")
):
    """Generate a YAML file from a CQL schema file and optionally parse it for use in the app"""
    if not schema_file.filename.endswith(('.cql', '.txt')):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a .cql or .txt file")
    
    try:
        # Create a session
        session_id = cql_generator.create_session()
        session_dir = SESSIONS_DIR / session_id
        
        # Save uploaded schema file to session directory
        schema_path = session_dir / schema_file.filename
        output_file = "output.yaml"
        
        # Read and save the schema content
        schema_content = await schema_file.read()
        with open(schema_path, "wb") as f:
            f.write(schema_content)
        
        # Handle conf file if provided
        conf_path = None
        if conf_file:
            conf_path = session_dir / conf_file.filename
            conf_content = await conf_file.read()
            with open(conf_path, "wb") as f:
                f.write(conf_content)
        
        # Process the file with CQL Generator
        success, message, output_path = cql_generator.process_files(
            str(schema_path),
            output_file,
            str(conf_path) if conf_path else None,
            session_id
        )
        
        # Clean up nb5.jar after processing
        background_tasks.add_task(cql_generator.remove_nb5_jar, session_id)
        
        if not success:
            raise HTTPException(status_code=500, detail=message)
        
        result = {
            "success": True,
            "message": message,
            "download_url": f"/api/cqlgen/download/{session_id}/{output_file}",
            "session_id": session_id
        }
        
        # If requested, also parse the schema for the application
        if parse_for_app:
            try:
                # Use the schema content we already have
                schema_text = schema_content.decode('utf-8')
                
                # Parse the schema
                schema_info = parser.parse_cql(schema_text)
                
                # Store in cache for later use
                SCHEMA_CACHE['latest'] = schema_info
                
                # Add schema information to the result
                result["schema_info"] = schema_info
                result["tables"] = list(schema_info["tables"].keys())
            except Exception as e:
                # If parsing fails, still return the YAML generation result
                # but include the parsing error
                result["parsing_error"] = str(e)
        
        return result
        
    except Exception as e:
        # Only delete nb5.jar, not the whole session if it exists
        if 'session_id' in locals():
            background_tasks.add_task(cql_generator.remove_nb5_jar, session_id)
        error_msg = f"Error processing file: {str(e)}"
        raise HTTPException(status_code=500, detail=error_msg)

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)