from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from typing import List, Dict, Any, Optional
import io
import zipfile
import json
import os
from schema_parser import CQLParser
from dsbulk_utils import DSBulkManager
import tempfile
from nb5_executor import NB5Executor


app = FastAPI(title="NoSQLBench Schema Generator")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the CQL parser
parser = CQLParser()

# Initialize the DSBulk manager
dsbulk_manager = DSBulkManager()

# Initialize the NB5 executor
nb5_executor = NB5Executor()

# In-memory cache for the latest parsed schema
SCHEMA_CACHE = {}

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
            print(f"Error processing file {file.filename}: {str(e)}")
    
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

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)