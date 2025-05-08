from typing import Dict, List, Tuple, Optional, Any, Set
import re
import yaml
import io
import os


class CQLParser:
    def __init__(self):
        # Regular expressions for parsing CQL
        self.keyspace_pattern = re.compile(
            r"CREATE\s+KEYSPACE\s+(\w+)\s+WITH\s+replication\s*=\s*({[^}]+})\s*(?:AND\s+durable_writes\s*=\s*(true|false))?",
            re.IGNORECASE | re.DOTALL
        )
        
        self.table_pattern = re.compile(
            r"CREATE\s+TABLE\s+(?:if\s+not\s+exists\s+)?(?:(\w+)\.)?(\w+)\s*\(\s*([^;]+?)\s*\)\s*(?:WITH[^;]+)?;",
            re.IGNORECASE | re.DOTALL
        )
        
        self.type_pattern = re.compile(
            r"CREATE\s+TYPE\s+(?:if\s+not\s+exists\s+)?(?:(\w+)\.)?(\w+)\s*\(\s*([^;]+?)\s*\)\s*;",
            re.IGNORECASE | re.DOTALL
        )
        
        self.index_pattern = re.compile(
            r"CREATE\s+INDEX\s+(?:if\s+not\s+exists\s+)?(\w+)\s+ON\s+(?:(\w+)\.)?(\w+)\s*\(([^)]+)\);",
            re.IGNORECASE | re.DOTALL
        )
        
        self.primary_key_pattern = re.compile(
            r"PRIMARY\s+KEY\s*\(\s*([^)]+)\s*\)",
            re.IGNORECASE
        )
        
        self.clustering_order_pattern = re.compile(
            r"CLUSTERING\s+ORDER\s+BY\s*\(\s*([^)]+)\s*\)",
            re.IGNORECASE
        )

        # Pattern to extract the table name from insert statement
        self.insert_table_pattern = re.compile(
            r'insert\s+into\s+(?:<<keyspace:(\w+)>>\.)?(\w+)',
            re.IGNORECASE
        )

        # Pattern to extract column names from insert statement
        self.insert_columns_pattern = re.compile(
            r'insert\s+into\s+[^\(]+\(([^)]+)\)',
            re.IGNORECASE | re.DOTALL
        )

    def parse_cql(self, cql_content: str) -> Dict[str, Any]:
        """Parse CQL content and return structured schema information"""
        result = {
            "keyspaces": {},
            "tables": {},
            "types": {},
            "indices": []
        }
        
        # Extract keyspaces
        keyspace_matches = self.keyspace_pattern.finditer(cql_content)
        for match in keyspace_matches:
            keyspace_name = match.group(1)
            replication = match.group(2)
            durable_writes = match.group(3) if match.group(3) else "true"
            
            result["keyspaces"][keyspace_name] = {
                "replication": replication,
                "durable_writes": durable_writes == "true"
            }
        
        # Extract UDTs
        type_matches = self.type_pattern.finditer(cql_content)
        for match in type_matches:
            keyspace_name = match.group(1) if match.group(1) else None
            type_name = match.group(2)
            fields_str = match.group(3)
            
            fields = {}
            for field_def in re.split(r',\s*(?=\w+\s+\w+)', fields_str):
                field_parts = field_def.strip().split(None, 1)
                if len(field_parts) == 2:
                    field_name, field_type = field_parts
                    fields[field_name.strip()] = field_type.strip()
            
            if keyspace_name:
                full_type_name = f"{keyspace_name}.{type_name}"
            else:
                full_type_name = type_name
                
            result["types"][full_type_name] = {
                "keyspace": keyspace_name,
                "name": type_name,
                "fields": fields
            }
        
        # Extract tables
        table_matches = self.table_pattern.finditer(cql_content)
        for match in table_matches:
            keyspace_name = match.group(1) if match.group(1) else None
            table_name = match.group(2)
            column_definitions = match.group(3)
            
            # Find the WITH clause for this table
            table_with_clause = self._extract_with_clause(cql_content, keyspace_name, table_name)
            
            # Parse columns, primary key, and clustering order
            columns, primary_key, clustering_order = self._parse_column_definitions(column_definitions)
            
            if keyspace_name:
                full_table_name = f"{keyspace_name}.{table_name}"
            else:
                full_table_name = table_name
                
            result["tables"][full_table_name] = {
                "keyspace": keyspace_name,
                "name": table_name,
                "columns": columns,
                "primary_key": primary_key,
                "clustering_order": clustering_order,
                "with_options": table_with_clause
            }
        
        # Extract indices
        index_matches = self.index_pattern.finditer(cql_content)
        for match in index_matches:
            index_name = match.group(1)
            keyspace_name = match.group(2) if match.group(2) else None
            table_name = match.group(3)
            indexed_columns = match.group(4).strip()
            
            if keyspace_name:
                full_table_name = f"{keyspace_name}.{table_name}"
            else:
                full_table_name = table_name
                
            result["indices"].append({
                "name": index_name,
                "table": full_table_name,
                "columns": indexed_columns
            })
        
        return result

    def _extract_with_clause(self, cql_content: str, keyspace_name: Optional[str], table_name: str) -> Dict[str, Any]:
        """Extract the WITH clause for a table"""
        pattern = rf"CREATE\s+TABLE\s+(?:if\s+not\s+exists\s+)?(?:{keyspace_name}\.)?\s*{table_name}[^;]+?WITH\s+([^;]+)"
        match = re.search(pattern, cql_content, re.IGNORECASE | re.DOTALL)
        
        if not match:
            return {}
        
        with_content = match.group(1)
        options = {}
        
        # Handle nested structures like maps in options
        current_option = ""
        brace_level = 0
        
        for char in with_content + " AND ":  # Add a separator at the end
            if char == '{':
                brace_level += 1
                current_option += char
            elif char == '}':
                brace_level -= 1
                current_option += char
            elif char == "'" and brace_level > 0:
                current_option += char
            elif brace_level == 0 and re.match(r'\s+AND\s+', char + with_content[with_content.index(char)+1:], re.IGNORECASE):
                # Found the end of an option
                if current_option.strip():
                    key_value = current_option.strip().split('=', 1)
                    if len(key_value) == 2:
                        key, value = key_value
                        options[key.strip()] = value.strip()
                current_option = ""
            else:
                current_option += char
        
        return options

    def _parse_column_definitions(self, column_defs: str) -> Tuple[Dict[str, str], List[List[str]], Dict[str, str]]:
        """Parse column definitions, extract primary key and clustering order"""
        # Extract PRIMARY KEY, if present
        primary_key_match = self.primary_key_pattern.search(column_defs)
        primary_key = []
        if primary_key_match:
            pk_str = primary_key_match.group(1)
            # Handle composite partition keys
            if '(' in pk_str:
                partition_key = re.findall(r'\(([^)]+)\)', pk_str)
                if partition_key:
                    primary_key.append([col.strip() for col in partition_key[0].split(',')])
                    
                # Extract clustering keys
                clustering_keys = re.sub(r'\([^)]+\),\s*', '', pk_str)
                if clustering_keys:
                    for col in clustering_keys.split(','):
                        if col.strip():
                            primary_key.append([col.strip()])
            else:
                # Simple primary key
                primary_key = [[col.strip()] for col in pk_str.split(',')]
        
        # Extract CLUSTERING ORDER, if present
        clustering_order = {}
        clustering_order_match = self.clustering_order_pattern.search(column_defs)
        if clustering_order_match:
            clustering_str = clustering_order_match.group(1)
            for part in clustering_str.split(','):
                if ' ' in part:
                    col, order = part.strip().rsplit(' ', 1)
                    clustering_order[col.strip()] = order.strip()
        
        # Remove PRIMARY KEY and CLUSTERING ORDER from column definitions
        clean_column_defs = re.sub(self.primary_key_pattern, '', column_defs)
        clean_column_defs = re.sub(self.clustering_order_pattern, '', clean_column_defs)
        
        # Extract column names and types
        columns = {}
        for col_def in re.split(r',\s*(?=\w+\s+\w+)', clean_column_defs):
            col_def = col_def.strip()
            if col_def:
                parts = col_def.split(None, 1)
                if len(parts) == 2:
                    col_name, col_type = parts
                    columns[col_name.strip()] = col_type.strip()
        
        return columns, primary_key, clustering_order

    def map_cql_to_nosqlbench_type(self, cql_type: str) -> str:
        """Map CQL data types to NoSQLBench binding types"""
        cql_type = cql_type.lower()
        
        if cql_type == 'uuid':
            return 'ToHashedUUID()'
        elif cql_type == 'timestamp':
            return "AddHashRange(0,2419200000L); StartingEpochMillis('2025-01-01 05:00:00'); ToJavaInstant()"
        elif cql_type == 'boolean':
            return 'AddCycleRange(0,1); ToBoolean()'
        elif cql_type == 'text' or cql_type == 'varchar':
            return 'AlphaNumericString(36)'
        elif cql_type == 'decimal':
            return 'AddHashRange(0,99999); ToBigDecimal()'
        elif cql_type == 'int':
            return 'AddHashRange(0,99999); ToInt()'
        elif cql_type == 'bigint':
            return 'AddHashRange(287854000L,4493779500L)'
        elif cql_type == 'double':
            return 'AddHashRange(1,10); ToDouble()'
        elif cql_type.startswith('map<'):
            # Extract key and value types from map definition
            map_types = re.match(r'map<\s*([^,]+)\s*,\s*([^>]+)\s*>', cql_type)
            if map_types:
                return 'MapSizedStepped(Mod(7), NumberNameToString(), NumberNameToString())'
            return 'MapSizedStepped(Mod(7), NumberNameToString(), NumberNameToString())'
        elif cql_type.startswith('list<'):
            return 'ListSizedStepped(Mod(7), NumberNameToString())'
        else:
            # Default for other types
            return 'AlphaNumericString(36)'

    def generate_nosqlbench_yaml(self, cql_schema: Dict[str, Any], table_name: str) -> str:
        """Generate NoSQLBench YAML for a specific table"""
        # Find the table in the schema
        table_info = None
        for full_name, info in cql_schema["tables"].items():
            if full_name == table_name or info["name"] == table_name:
                table_info = info
                break
        
        if not table_info:
            return f"# Table {table_name} not found in the schema"
        
        # Determine the keyspace
        keyspace_name = table_info["keyspace"]
        
        # Start building the YAML
        yaml_content = [
            "scenarios:",
            "  default:",
            "    schema1: run driver=cql tags=block:\"schema.*\" threads===UNDEF cycles==UNDEF",
            "    rampup1: run driver=cql tags='block:rampup1' cycles===TEMPLATE(rampup-cycles,1000000) threads=auto",
            "",
            "bindings:"
        ]
        
        # Generate bindings based on column types
        for col_name, col_type in table_info["columns"].items():
            binding_type = self.map_cql_to_nosqlbench_type(col_type)
            yaml_content.append(f"  {col_name} : {binding_type};")
        
        yaml_content.append("")
        yaml_content.append("blocks:")
        yaml_content.append("  schema1:")
        yaml_content.append("    params:")
        yaml_content.append("      prepared: false")
        yaml_content.append("    ops:")
        
        # Generate the CREATE TABLE statement
        table_name_only = table_info["name"]
        full_keyspace_table = f"{keyspace_name}.{table_name_only}" if keyspace_name else table_name_only
        
        # Create the schema block
        yaml_content.append("      create_table1: | ")
        yaml_content.append(f"        CREATE TABLE if not exists <<keyspace:{keyspace_name or 'baselines'}>>.{table_name_only} (")
        
        # Add column definitions
        columns_lines = []
        for col_name, col_type in table_info["columns"].items():
            columns_lines.append(f"        {col_name} {col_type},")
        
        # Add primary key
        if table_info["primary_key"]:
            pk_parts = []
            for part in table_info["primary_key"]:
                if len(part) > 1:  # Composite partition key
                    pk_parts.append(f"({', '.join(part)})")
                else:
                    pk_parts.append(part[0])
            
            pk_definition = f"        PRIMARY KEY ({', '.join(pk_parts)})"
            columns_lines.append(pk_definition)
        
        yaml_content.extend(columns_lines)
        yaml_content.append("        )")
        
        # Add clustering order if present
        if table_info["clustering_order"]:
            clustering_parts = []
            for col, order in table_info["clustering_order"].items():
                clustering_parts.append(f"{col} {order}")
            
            yaml_content.append(f"        WITH CLUSTERING ORDER BY ({', '.join(clustering_parts)});")
        else:
            yaml_content.append(";")
        
        # Add the rampup block
        yaml_content.append("  rampup1:")
        yaml_content.append("   params:")
        yaml_content.append("     cl: ONE #TEMPLATE(write_cl,LOCAL_QUORUM)")
        yaml_content.append("     instrument: true")
        yaml_content.append("     prepared: true")
        yaml_content.append("   ops:")
        yaml_content.append("     insert_rampup1: |")
        
        # Generate insert statement
        insert_columns = ", ".join(table_info["columns"].keys())
        yaml_content.append(f"          insert into <<keyspace:{keyspace_name or 'baselines'}>>.{table_name_only} (")
        
        # Add column names for insert
        for col_name in table_info["columns"].keys():
            yaml_content.append(f"          {col_name},")
        
        yaml_content.append("          ) values ")
        yaml_content.append("          (")
        
        # Add parameter bindings for insert values
        for col_name in table_info["columns"].keys():
            yaml_content.append(f"          {{{col_name}}},")
        
        yaml_content.append("          );")
        
        return "\n".join(yaml_content)

def generate_read_yaml_from_write_and_csv(
    self, 
    write_yaml: str, 
    csv_file_path: str, 
    primary_key_columns: List[str]
) -> str:
    """Generate a read YAML file from a write YAML file, DSBulk CSV path, and primary key columns"""
    try:
        # Preprocess the YAML to fix common syntax issues
        preprocessed_yaml = self._preprocess_yaml(write_yaml)
        
        # Extract the write YAML to get the table name
        yaml_data = None
        try:
            yaml_data = yaml.safe_load(preprocessed_yaml)
        except Exception as e:
            # If still failing, try a regex-based approach
            return self._generate_read_yaml_from_text(preprocessed_yaml, csv_file_path, primary_key_columns)
        
        # Extract table name from the write YAML
        table_name = None
        keyspace = 'baselines'  # Default keyspace
        
        if yaml_data and 'blocks' in yaml_data:
            for block_name, block_data in yaml_data['blocks'].items():
                if 'ops' in block_data:
                    for op_name, op_value in block_data['ops'].items():
                        if isinstance(op_value, str) and 'insert into' in op_value.lower():
                            # Extract table name from insert statement
                            table_match = self.insert_table_pattern.search(op_value)
                            if table_match:
                                if table_match.group(1):
                                    keyspace = table_match.group(1)
                                table_name = table_match.group(2)
                                break
                    if table_name:
                        break
        
        if not table_name:
            # Try to extract from CREATE TABLE statement
            if yaml_data and 'blocks' in yaml_data:
                for block_name, block_data in yaml_data['blocks'].items():
                    if 'ops' in block_data:
                        for op_name, op_value in block_data['ops'].items():
                            if isinstance(op_value, str) and 'CREATE TABLE' in op_value:
                                # Extract table name from create statement
                                table_match = re.search(r'CREATE\s+TABLE\s+if\s+not\s+exists\s+<<keyspace:([^>]+)>>\.(\w+)', op_value)
                                if table_match:
                                    keyspace = table_match.group(1)
                                    table_name = table_match.group(2)
                                    break
                                # Try alternative pattern
                                alt_match = re.search(r'CREATE\s+TABLE\s+if\s+not\s+exists\s+(\w+)\.(\w+)', op_value)
                                if alt_match:
                                    keyspace = alt_match.group(1)
                                    table_name = alt_match.group(2)
                                    break
                        if table_name:
                            break
        
        if not table_name:
            # Try to find table name in the filename
            if hasattr(write_yaml, 'filename'):
                filename = write_yaml.filename
                parts = os.path.basename(filename).split('_')
                if len(parts) > 0:
                    table_name = parts[-1].split('.')[0]
        
        if not table_name:
            return "# Error: Could not determine table name from write YAML"
        
        # Determine columns for the select statement
        columns = []
        
        # Always include the primary key columns
        columns.extend(primary_key_columns)
        
        # Try to find other columns that might be interesting for read operations
        timestamp_cols = ['insertedtimestamp', 'created_at', 'timestamp', 'last_updated']
        for col in timestamp_cols:
            if yaml_data and 'bindings' in yaml_data and col in yaml_data['bindings']:
                if col not in columns:
                    columns.append(col)
        
        # If no timestamp column found, add a default one
        if not any(col in columns for col in timestamp_cols):
            columns.append('insertedtimestamp')
        
        # Create the read YAML
        read_yaml_lines = [
            "scenarios:",
            "  default:",
            f"    read1: run driver=cql tags='block:read1' cycles==TEMPLATE(read-cycles,1000) threads=auto",
            "",
            "bindings:"
        ]
        
        # Primary key in CSVSampler format
        primary_key_column = primary_key_columns[0]  # Use the first primary key column for CSVSampler
        read_yaml_lines.append(f"  {primary_key_column}: CSVSampler('{primary_key_column}','{primary_key_column}-weight','{csv_file_path}');")
        read_yaml_lines.append("")
        
        # Add blocks section
        read_yaml_lines.extend([
            "blocks:",
            "  read1:",
            "    params:",
            "      cl: TEMPLATE(read_cl,LOCAL_QUORUM)",
            "      instrument: true",
            "      prepared: true",
            "    ops:",
            f"      read_by_{primary_key_column}: |"
        ])
        
        # Create a SELECT statement with primary key as WHERE clause
        selected_columns = ", ".join(columns)
        select_statement = [
            f"        SELECT {selected_columns}",
            f"        FROM <<keyspace:{keyspace}>>.{table_name}",
            f"        WHERE {primary_key_column} = {{{primary_key_column}}}"
        ]
        
        # Add additional primary key columns to WHERE clause if any
        for i, pk_col in enumerate(primary_key_columns[1:], 1):
            select_statement.append(f"        AND {pk_col} = {{{pk_col}}}")
        
        select_statement.append("        LIMIT 1;")
        
        # Add select statement to YAML
        read_yaml_lines.extend(select_statement)
        
        return "\n".join(read_yaml_lines)
            
    except Exception as e:
        # If there's an error, return a comment explaining the error
        return f"# Error generating read YAML: {str(e)}"

def _preprocess_yaml(self, yaml_content: str) -> str:
    """Preprocess YAML content to fix common syntax issues"""
    if isinstance(yaml_content, bytes):
        yaml_content = yaml_content.decode('utf-8')
    
    # Fix common issues:
    
    # 1. Remove trailing semicolons in bindings section
    lines = yaml_content.split('\n')
    in_bindings = False
    
    for i, line in enumerate(lines):
        if line.strip() == 'bindings:':
            in_bindings = True
        elif line.strip() and line[0] not in ' \t' and in_bindings:
            in_bindings = False
        
        if in_bindings and ':' in line and line.rstrip().endswith(';'):
            binding_parts = line.split(':', 1)
            binding_name = binding_parts[0]
            binding_value = binding_parts[1].rstrip(';')
            lines[i] = f"{binding_name}:{binding_value}"
    
    # 2. Fix extra commas in CREATE TABLE statements
    content = '\n'.join(lines)
    content = re.sub(r',(\s*PRIMARY\s+KEY)', r'\1', content)
    content = re.sub(r',\s*\)', r'\n)', content)
    
    # 3. Fix standalone semicolons
    content = re.sub(r'^\s*;\s*$', '', content, flags=re.MULTILINE)
    
    # 4. Fix CREATE TABLE statements ending with semicolon on a separate line
    content = re.sub(r'\)\s*\n\s*;', r'\);', content)
    
    # 5. Fix INSERT statements with trailing commas before values or closing parentheses
    content = re.sub(r',\s*\)\s*values', r'\n) values', content, flags=re.MULTILINE | re.IGNORECASE)
    content = re.sub(r',\s*\);', r'\n);', content, flags=re.MULTILINE)
    
    # Fix YAML structure issues (indentation, etc.)
    lines = content.split('\n')
    for i, line in enumerate(lines):
        # Fix indentation for rampup1 section
        if line.strip() == 'rampup1:' and i > 0 and lines[i-1].strip().endswith(';'):
            indent = re.match(r'(\s*)', line).group(1)
            if len(indent) == 0:
                lines[i] = '  ' + line
        
        # Fix indentation for params, ops, etc.
        if any(key in line for key in ['params:', 'ops:', 'instrument:', 'prepared:']) and ':' in line:
            if len(re.match(r'(\s*)', line).group(1)) == 0:
                lines[i] = '    ' + line
    
    return '\n'.join(lines)

def _generate_read_yaml_from_text(self, yaml_content: str, csv_file_path: str, primary_key_columns: List[str]) -> str:
    """
    Fallback method to generate read YAML using regex when YAML parsing fails.
    This is a more robust approach for malformed YAML files.
    """
    # Try to extract table information using regex
    table_name = None
    keyspace = 'baselines'  # Default keyspace
    
    # Try to extract from CREATE TABLE statement
    create_match = re.search(r'CREATE\s+TABLE\s+if\s+not\s+exists\s+<<keyspace:([^>]+)>>\.(\w+)', yaml_content)
    if create_match:
        keyspace = create_match.group(1)
        table_name = create_match.group(2)
    else:
        # Try alternative pattern
        alt_match = re.search(r'CREATE\s+TABLE\s+if\s+not\s+exists\s+(\w+)\.(\w+)', yaml_content)
        if alt_match:
            keyspace = alt_match.group(1)
            table_name = alt_match.group(2)
    
    # If still no table name, try the insert statement
    if not table_name:
        insert_match = re.search(r'insert\s+into\s+<<keyspace:([^>]+)>>\.(\w+)', yaml_content, re.IGNORECASE)
        if insert_match:
            keyspace = insert_match.group(1)
            table_name = insert_match.group(2)
        else:
            # Try alternative pattern
            alt_match = re.search(r'insert\s+into\s+(\w+)\.(\w+)', yaml_content, re.IGNORECASE)
            if alt_match:
                keyspace = alt_match.group(1)
                table_name = alt_match.group(2)
    
    if not table_name:
        return "# Error: Could not determine table name from write YAML"
    
    # Create the read YAML
    read_yaml_lines = [
        "scenarios:",
        "  default:",
        f"    read1: run driver=cql tags='block:read1' cycles==TEMPLATE(read-cycles,1000) threads=auto",
        "",
        "bindings:"
    ]
    
    # Primary key in CSVSampler format
    primary_key_column = primary_key_columns[0]  # Use the first primary key column for CSVSampler
    read_yaml_lines.append(f"  {primary_key_column}: CSVSampler('{primary_key_column}','{primary_key_column}-weight','{csv_file_path}');")
    read_yaml_lines.append("")
    
    # Add blocks section
    read_yaml_lines.extend([
        "blocks:",
        "  read1:",
        "    params:",
        "      cl: TEMPLATE(read_cl,LOCAL_QUORUM)",
        "      instrument: true",
        "      prepared: true",
        "    ops:",
        f"      read_by_{primary_key_column}: |"
    ])
    
    # Create a SELECT statement with primary key as WHERE clause
    selected_columns = ", ".join(primary_key_columns + ["insertedtimestamp"])  # Include timestamp
    select_statement = [
        f"        SELECT {selected_columns}",
        f"        FROM <<keyspace:{keyspace}>>.{table_name}",
        f"        WHERE {primary_key_column} = {{{primary_key_column}}}"
    ]
    
    # Add additional primary key columns to WHERE clause if any
    for i, pk_col in enumerate(primary_key_columns[1:], 1):
        select_statement.append(f"        AND {pk_col} = {{{pk_col}}}")
    
    select_statement.append("        LIMIT 1;")
    
    # Add select statement to YAML
    read_yaml_lines.extend(select_statement)
    
    return "\n".join(read_yaml_lines)

# Example usage
if __name__ == "__main__":
    parser = CQLParser()
    with open('schema.cql', 'r') as f:
        cql_content = f.read()
    
    schema = parser.parse_cql(cql_content)
    yaml = parser.generate_nosqlbench_yaml(schema, "example_table")
    print(yaml)