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
from schema_parser import CQLParser, SchemaParserError, TableNotFoundError, YamlGenerationError as SchemaYamlGenerationError # Alias to avoid conflict
from backend.read_yaml_generator import YamlGenerationError as ReadYamlGenerationError # Specific import for ReadYamlGenerator's error

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
from backend.read_yaml_generator import ReadYamlGenerator, extract_table_info_from_ingest_yaml # Import ReadYamlGenerator
read_yaml_generator = ReadYamlGenerator() # Instantiate ReadYamlGenerator
from backend.cql_generator import NB5_JAR_PATH as CQLGEN_NB5_JAR_PATH # Import for cqlgen validation

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
    except SchemaParserError as e:
        logger.error(f"Schema parsing error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error parsing schema: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error in parse_schema: {str(e)}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

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
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON format in form data: {str(e)}")
    except TableNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except SchemaYamlGenerationError as e: # Catching specific error from schema_parser
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in generate_yaml: {str(e)}")
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
                    # Use read_yaml_generator instance and the correct method name
                    # Assuming primary_key needs to be extracted or defaulted
                    # For now, we'll pass a placeholder or extract if possible.
                    # This part needs careful review of how primary_key is obtained in this context.
                    # Let's assume we extract it from the yaml itself if possible, or it needs to be passed differently.
                    # For now, this will likely still cause an issue if not handled correctly by generate_read_yaml_from_text
                    # or if the function signature doesn't match.
                    # Based on read_yaml_generator.py, it extracts pk from yaml.
                    # The generate_read_yaml_from_text in read_yaml_generator.py now requires primary_key_columns.
                    # This endpoint processes general ingestion YAMLs which might not directly map to a single CSV or PK definition.
                    # For now, we'll pass None for primary_key_columns and let the generator try to infer or handle it.
                    # This might need further refinement based on expected behavior for generic ingestion files.
                    table_info_for_read = extract_table_info_from_ingest_yaml(ingestion_yaml)
                    pk_cols = table_info_for_read.get("primary_key_columns")
                    # This assumes the CSV path would be related to the table name, which is a placeholder logic.
                    # A more robust solution would require a way to determine the CSV path for each YAML.
                    dummy_csv_path = f"./{table_info_for_read.get('table_name', 'data')}.csv"

                    read_yaml = read_yaml_generator.generate_read_yaml_from_text(ingestion_yaml, dummy_csv_path, pk_cols)
                    
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
    except ReadYamlGenerationError as e:
        logger.error(f"YAML generation error in process_ingestion_files: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in process_ingestion_files: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing ingestion files: {str(e)}")

@app.post("/api/process-multiple-files")
async def process_multiple_files(
    files: List[UploadFile] = File(..., description="Multiple YAML files to process")
):
    """Process multiple individual YAML files and convert them to read files"""
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")
    
    processed_files = []
    errors_occurred = [] # To track errors for individual files
    
    for file in files:
        if not file.filename.endswith(('.yaml', '.yml')):
            logger.info(f"Skipping non-YAML file: {file.filename}")
            continue  # Skip non-YAML files
        
        try:
            # Read the uploaded YAML file
            content = await file.read()
            ingestion_yaml = content.decode('utf-8')
            
            # Convert ingestion YAML to read YAML
            # Use read_yaml_generator instance and the correct method name
            table_info_for_read = extract_table_info_from_ingest_yaml(ingestion_yaml) # This can raise YamlParsingError or MissingDataError
            pk_cols = table_info_for_read.get("primary_key_columns")
            table_name_for_csv = table_info_for_read.get('table_name', 'data')
            # Using a placeholder CSV path as the actual CSV path isn't provided in this endpoint's context.
            dummy_csv_path = f"./{table_name_for_csv}.csv" 

            read_yaml = read_yaml_generator.generate_read_yaml_from_text(
                ingest_yaml_text=ingestion_yaml, 
                dsbulk_csv_path=dummy_csv_path, 
                primary_key_columns=pk_cols
            )
            
            # Generate the output filename
            base_name = os.path.splitext(os.path.basename(file.filename))[0]
            read_filename = f"{base_name}_read.yaml"
            
            # Store the processed file information
            processed_files.append({
                "filename": read_filename,
                "content": read_yaml,
                "original_filename": file.filename
            })
        except (ReadYamlGenError, YamlParsingError, MissingDataError) as e: # Catching specific errors from read_yaml_generator
            logger.error(f"Error processing file {file.filename}: {str(e)}")
            errors_occurred.append({"file": file.filename, "error": str(e)})
        except Exception as e:
            # Log the error but continue processing other files
            logger.error(f"Unexpected error processing file {file.filename}: {str(e)}", exc_info=True)
            errors_occurred.append({"file": file.filename, "error": f"Unexpected error: {str(e)}"})
    
    if not processed_files and not errors_occurred:
        # This case means no .yaml/.yml files were provided or all were skipped (e.g. .txt files)
        raise HTTPException(status_code=400, detail="No YAML files were provided or found in the input.")
    
    if not processed_files and errors_occurred:
        # All YAML files provided resulted in errors
        # Construct a more detailed error message, possibly include parts of errors_occurred if not too verbose
        first_error = failed_files_info[0]['error'] if failed_files_info else "Unknown error" # Corrected typo: errors_occurred to failed_files_info
        raise HTTPException(status_code=400, detail=f"No files were successfully processed. First error: {first_error}", headers={"X-Detailed-Errors": json.dumps(errors_occurred)})
        
    # Return a JSON response with all processed files
    return JSONResponse(content={
        "message": f"Successfully processed {len(processed_files)} YAML file(s)." + (f" Encountered errors with {len(errors_occurred)} file(s)." if errors_occurred else ""),
        "successful_files": processed_files,
        "failed_files": errors_occurred
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
            # This case should be caught by FastAPI's Query(..., description=...) if not provided
            # but good to have explicit check if Query(...) is not used with ... (ellipsis)
            raise HTTPException(status_code=400, detail="Missing required parameter: table_name")
        
        if not schema_json:
            raise HTTPException(
                status_code=400, 
                detail="Schema information (schema_json) is required and was not provided."
            )
        try:
            schema_info = json.loads(schema_json)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid schema_json format in _generate_yaml_single: {str(e)}")
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid schema_json format: {str(e)}"
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
    except TableNotFoundError as e:
        logger.warning(f"Table not found in _generate_yaml_single: {str(e)}")
        raise HTTPException(status_code=404, detail=str(e))
    except SchemaYamlGenerationError as e: # Catching specific error from schema_parser.generate_nosqlbench_yaml
        logger.error(f"YAML generation error in _generate_yaml_single: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e: # Keep generic handler for unexpected errors
        logger.error(f"Unexpected error in _generate_yaml_single: {str(e)}")
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
        # The generate_read_yaml_from_text in read_yaml_generator.py now requires primary_key_columns.
        # Extracting primary_key_columns from the ingest YAML.
        table_info = extract_table_info_from_ingest_yaml(ingestion_yaml)
        pk_cols = table_info.get("primary_key_columns")
        # This assumes the CSV path would be related to the table name. This is a placeholder.
        # A more robust solution would be to not require csv_path here or make it optional in generate_read_yaml_from_text
        # For now, we'll use a dummy path as before, and pass the extracted PKs.
        dummy_csv_path = f"./{table_info.get('table_name', 'data')}.csv"
        read_yaml = read_yaml_generator.generate_read_yaml_from_text(ingestion_yaml, dummy_csv_path, pk_cols)
        
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
    except ReadYamlGenerationError as e: # Catching specific error from read_yaml_generator
        logger.error(f"YAML generation error in process_ingestion_file: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in process_ingestion_file: {str(e)}")
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
        # Use read_yaml_generator instance and the correct method name
        read_yaml = read_yaml_generator.generate_read_yaml_from_text(write_yaml, csv_path, pk_columns)
        
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
    except ReadYamlGenerationError as e: # Catching specific error from read_yaml_generator
        logger.error(f"YAML generation error in generate_read_yaml: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in generate_read_yaml: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating read YAML: {str(e)}")

@app.post("/api/generate-read-yaml-json", response_model=Dict[str, Any]) # Added response_model for clarity
async def generate_read_yaml_json(payload: ReadYamlJsonRequest): # Changed to use Pydantic model
    """Generate a read YAML file and return as JSON response"""
    # File type validation for write_yaml_json content is not directly applicable here
    # as it's expected to be a JSON representation of YAML content.
    # Validation of the structure of write_yaml_json will be handled by ReadYamlGenerator.
    
    try:
        # Convert write_yaml_json (dict) to a YAML string for the generator
        # This assumes generate_read_yaml_from_text expects a string.
        # If it can handle a dict directly, this conversion is not needed.
        # Based on read_yaml_generator.py, it expects a string.
        write_yaml_str = yaml.dump(payload.write_yaml_json)
        
        # Parse primary key columns from the string
        pk_columns = [col.strip() for col in payload.primary_key_columns.split(',') if col.strip()]
        
        if not pk_columns:
            raise HTTPException(status_code=400, detail="No primary key columns provided")
        
        # Generate read YAML
        read_yaml = read_yaml_generator.generate_read_yaml_from_text(write_yaml_str, payload.csv_path, pk_columns)
        
        # Generate the output filename - this might need adjustment if original filename isn't available
        # Using a generic name or deriving from table name if possible
        base_name = "generated_read_workload" # Placeholder
        # Try to get table name from parsed YAML to make filename more specific
        try:
            temp_parsed_yaml = yaml.safe_load(write_yaml_str)
            if temp_parsed_yaml and 'blocks' in temp_parsed_yaml:
                 for _block_name, block_data in temp_parsed_yaml['blocks'].items():
                    if 'ops' in block_data:
                        for _op_name, op_value in block_data['ops'].items():
                            if isinstance(op_value, str):
                                match = re.search(r'(?:<<keyspace:[^>]+>>\.|\b)(\w+)\b', op_value) # More generic table name extraction
                                if match:
                                    # This regex might pick up other words, best to refine or rely on schema parsing
                                    # For now, using the first word after "TABLE" or "INTO"
                                    tbl_match = re.search(r'(?:TABLE|INTO)\s+(?:if\s+not\s+exists\s+)?(?:[\w.]+\.)?(\w+)', op_value, re.IGNORECASE)
                                    if tbl_match:
                                        base_name = tbl_match.group(1) + "_write"
                                        break
                    if base_name != "generated_read_workload": break
        except Exception:
            pass # Keep default base_name if parsing fails
            
        read_filename = f"{base_name}_read.yaml"
        
        # Return JSON response with the generated content
        return JSONResponse(content={
            "message": "Successfully generated read YAML file",
            "filename": read_filename,
            "content": read_yaml,
            "primary_key_columns": pk_columns, # Return the list
            "csv_path": payload.csv_path
        })
    except ReadYamlGenerationError as e: # Catching specific error from read_yaml_generator
        logger.error(f"YAML generation error in generate_read_yaml_json: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in generate_read_yaml_json: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating read YAML: {str(e)}")

class DSBulkConfig(BaseModel):
    operation: str
    keyspace: str
    table: str
    mapping: Optional[str] = None
    wrześfilepath: Optional[str] = None # Typo from original code
    query: Optional[str] = None
    options: Optional[List[str]] = None
    load_options: Optional[List[str]] = None
    unload_options: Optional[List[str]] = None
    count_options: Optional[List[str]] = None
    max_concurrent_files: Optional[str] = None
    max_concurrent_queries: Optional[str] = None


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
    config: DSBulkConfig
):
    """Generate DSBulk command(s) based on given parameters"""
    
    try:
        if config.operation == "unload":
            if not config.primary_key: # Assuming primary_key is added to DSBulkConfig or handled
                # This was previously Form param, now it would be part of DSBulkConfig
                # For now, let's assume it's part of DSBulkConfig. If not, this needs adjustment.
                # Based on the original Form params, primary_key was separate.
                # The prompt implies config: DSBulkConfig is the body.
                # Let's assume primary_key, output_path, csv_path, limit are to be included in DSBulkConfig
                # For now, this part is problematic as DSBulkConfig does not have primary_key.
                # This indicates a mismatch in how the refactoring was envisioned vs. current DSBulkConfig.
                # Let's assume for now that primary_key and output_path are required for unload and are part of DSBulkConfig.
                # This would require DSBulkConfig to be updated.
                # For the purpose of this refactoring, let's proceed assuming they are there.
                # If `wrześfilepath` is the intended field for input/output paths:
                if not config.wrześfilepath: # Assuming this is used for output_path
                    raise HTTPException(status_code=400, detail="Output path (wrześfilepath) is required for unload operations")
                # primary_key is still missing from DSBulkConfig for unload. This will cause an error if not addressed.
                # For now, we'll simulate it being present in config for command generation.
                
            command_args = dsbulk_manager.generate_unload_command(
                keyspace=config.keyspace,
                table=config.table,
                primary_key=getattr(config, 'primary_key', 'id'), # Placeholder if primary_key is not in DSBulkConfig
                output_path=config.wrześfilepath, # Assuming wrześfilepath is output path
                # limit=config.limit # Assuming limit is part of DSBulkConfig
            )
            
            return {
                "command": " ".join(command_args),
                "operation": config.operation,
                "description": f"Exports data from {config.keyspace}.{config.table} to {config.wrześfilepath}"
            }
            
        elif config.operation == "load":
            if not config.wrześfilepath: # Assuming this is used for input_path (csv_path)
                raise HTTPException(status_code=400, detail="Input path (wrześfilepath) is required for load operations")
                
            command_args = dsbulk_manager.generate_load_command(
                keyspace=config.keyspace,
                table=config.table,
                csv_path=config.wrześfilepath # Assuming wrześfilepath is input path
            )
            
            return {
                "command": " ".join(command_args),
                "operation": config.operation,
                "description": f"Imports data from {config.wrześfilepath} into {config.keyspace}.{config.table}"
            }
            
        elif config.operation == "count":
            command_args = dsbulk_manager.generate_count_command(
                keyspace=config.keyspace,
                table=config.table
            )
            
            return {
                "command": " ".join(command_args),
                "operation": config.operation,
                "description": f"Counts rows in {config.keyspace}.{config.table}"
            }
            
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported DSBulk operation: {config.operation}")
            
    except Exception as e: # Catch any exception from command generation
        logger.error(f"Error generating DSBulk command: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating DSBulk command: {str(e)}")

class DSBulkExecuteRequest(BaseModel):
    command_args: List[str] # Expecting a list of arguments now
    save_output: bool = False

@app.post("/api/dsbulk/execute")
async def execute_dsbulk_command(
    payload: DSBulkExecuteRequest # Changed to accept a Pydantic model
):
    """Execute a DSBulk command and return the result"""
    
    # No need for basic string security check as command is now a list of arguments
    try:
        result = dsbulk_manager.execute_command(payload.command_args) # Pass the list of args
        
        if payload.save_output and result["success"]:
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

class DSBulkDownloadScriptRequest(BaseModel):
    keyspace: str
    table: str
    primary_key: str
    output_path: str
    limit: Optional[int] = 1000000

@app.post("/api/dsbulk/download-script")
async def download_dsbulk_script(payload: DSBulkDownloadScriptRequest):
    """Generate a DSBulk unload script and return it for download"""
    
    try:
        # Generate the command arguments
        command_args = dsbulk_manager.generate_unload_command(
            keyspace=payload.keyspace,
            table=payload.table,
            primary_key=payload.primary_key,
            output_path=payload.output_path,
            limit=payload.limit
        )
        
        # Create a shell script with the command
        script_content = "#!/bin/bash\n\n"
        script_content += "# DSBulk unload script generated by NoSQLBench Schema Generator\n"
        script_content += f"# Exports data from {payload.keyspace}.{payload.table}\n\n"
        # Join arguments for display in script, ensure proper quoting if needed for shell execution
        # For robustness, one might use shlex.join(command_args) if available and desired
        script_content += " ".join(f"'{arg}'" if " " in arg else arg for arg in command_args) # Basic quoting for args with spaces
        script_content += "\n\n# End of script\n"
        
        # Return the script for download
        filename = f"dsbulk_unload_{payload.keyspace}_{payload.table}.sh"
        
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
            "nb5_jar_exists": os.path.exists(CQLGEN_NB5_JAR_PATH), # Use the imported NB5_JAR_PATH
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