# read_yaml_generator.py

import yaml
import re
from typing import Dict, Any, Optional, Tuple

def extract_table_info_from_ingest_yaml(yaml_content: str) -> Dict[str, Any]:
    """
    Extract table information from the ingest YAML file safely.
    """
    try:
        # First, try to safely parse the YAML
        data = yaml.safe_load(yaml_content)
        
        if not data or 'blocks' not in data or 'schema1' not in data['blocks']:
            raise ValueError("Invalid YAML structure: Missing expected blocks.schema1 section")
        
        if 'ops' not in data['blocks']['schema1']:
            raise ValueError("Invalid YAML structure: Missing expected blocks.schema1.ops section")
        
        # Get the create table statement
        create_stmt = data['blocks']['schema1']['ops'].get('create_table1', '')
        if not create_stmt:
            raise ValueError("Missing CREATE TABLE statement in the YAML file")
        
        # Parse the CREATE TABLE statement
        table_name = None
        keyspace = "baselines"  # Default keyspace
        primary_key_columns = []
        
        # Extract table name and keyspace using regex
        table_match = re.search(r'CREATE\s+TABLE\s+if\s+not\s+exists\s+<<keyspace:([^>]+)>>\.(\w+)', create_stmt)
        if table_match:
            keyspace = table_match.group(1)
            table_name = table_match.group(2)
        else:
            # Try alternative pattern without the keyspace template
            alt_match = re.search(r'CREATE\s+TABLE\s+if\s+not\s+exists\s+(\w+)\.(\w+)', create_stmt)
            if alt_match:
                keyspace = alt_match.group(1)
                table_name = alt_match.group(2)
            else:
                # Just try to get the table name
                name_match = re.search(r'CREATE\s+TABLE\s+if\s+not\s+exists\s+(\w+)', create_stmt)
                if name_match:
                    table_name = name_match.group(1)
        
        # Extract primary key
        pk_match = re.search(r'PRIMARY\s+KEY\s*\(\s*([^)]+)\s*\)', create_stmt)
        if pk_match:
            pk_content = pk_match.group(1)
            pk_parts = [part.strip() for part in pk_content.split(',')]
            
            # Check if first part is a composite key
            if '(' in pk_parts[0] and ')' in pk_parts[0]:
                composite_match = re.search(r'\(\s*([^)]+)\s*\)', pk_parts[0])
                if composite_match:
                    partition_keys = [k.strip() for k in composite_match.group(1).split(',')]
                    primary_key_columns = partition_keys
            else:
                # Single partition key
                primary_key_columns = [pk_parts[0]]
        
        if not table_name:
            raise ValueError("Could not extract table name from the YAML file")
        
        if not primary_key_columns:
            raise ValueError("Could not extract primary key from the YAML file")
        
        return {
            "table_name": table_name,
            "keyspace": keyspace,
            "primary_key": primary_key_columns[0],  # Use the first primary key column
        }
    
    except yaml.YAMLError as e:
        # Try a different approach for problematic YAML
        return extract_table_info_using_regex(yaml_content)

def extract_table_info_using_regex(yaml_content: str) -> Dict[str, Any]:
    """
    Fallback method to extract table info using regex when YAML parsing fails.
    """
    # Extract table name
    table_match = re.search(r'CREATE\s+TABLE\s+if\s+not\s+exists\s+<<keyspace:([^>]+)>>\.(\w+)', yaml_content)
    if not table_match:
        table_match = re.search(r'CREATE\s+TABLE\s+if\s+not\s+exists\s+(\w+)\.(\w+)', yaml_content)
    
    if not table_match:
        raise ValueError("Could not extract table name from the YAML content")
    
    keyspace = table_match.group(1) if table_match.group(1) else "baselines"
    table_name = table_match.group(2) if len(table_match.groups()) > 1 else table_match.group(1)
    
    # Extract primary key
    pk_match = re.search(r'PRIMARY\s+KEY\s*\(\s*([^,)]+)', yaml_content)
    if not pk_match:
        raise ValueError("Could not extract primary key from the YAML content")
    
    primary_key = pk_match.group(1).strip()
    
    # If it's a composite key, extract the first component
    if primary_key.startswith('('):
        composite_match = re.search(r'\(\s*([^,)]+)', primary_key)
        if composite_match:
            primary_key = composite_match.group(1).strip()
    
    return {
        "table_name": table_name,
        "keyspace": keyspace,
        "primary_key": primary_key
    }

def generate_read_yaml_from_text(ingest_yaml_text: str, dsbulk_csv_path: str, keyspace: str = None) -> str:
    """
    Generate a read YAML file from an ingest YAML file.
    """
    try:
        # Extract table info
        table_info = extract_table_info_from_ingest_yaml(ingest_yaml_text)
        
        # Use provided keyspace if specified, otherwise use the one from the ingest YAML
        ks = keyspace if keyspace else table_info["keyspace"]
        
        # Get the primary key and table name
        primary_key = table_info["primary_key"]
        table_name = table_info["table_name"]
        
        # Create the read YAML as a dictionary first
        read_yaml_dict = {
            "scenarios": {
                "default": {
                    "read1": "run driver=cql tags='block:read1' cycles==TEMPLATE(read-cycles,1000) threads=auto"
                }
            },
            "bindings": {
                primary_key: f"CSVSampler('{primary_key}','{primary_key}-weight','{dsbulk_csv_path}')"
            },
            "blocks": {
                "read1": {
                    "params": {
                        "cl": "TEMPLATE(read_cl,LOCAL_QUORUM)",
                        "instrument": True,
                        "prepared": True
                    },
                    "ops": {
                        f"read_by_{primary_key}": f"SELECT {primary_key}, insertedtimestamp \nFROM <<keyspace:{ks}>>.{table_name}\nWHERE {primary_key} = {{{primary_key}}}\nLIMIT 1;"
                    }
                }
            }
        }
        
        # Convert to YAML
        read_yaml = yaml.safe_dump(read_yaml_dict, default_flow_style=False, sort_keys=False)
        
        return read_yaml
        
    except Exception as e:
        raise ValueError(f"Error generating read YAML: {str(e)}")