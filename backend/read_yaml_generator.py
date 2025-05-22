# read_yaml_generator.py

import yaml
import re
from typing import Dict, Any, Optional, List  # Tuple removed, List was already there
import logging

logger = logging.getLogger(__name__)


# Define custom exceptions for this module
class ReadYamlGeneratorError(Exception):
    """Base class for errors in the Read YAML generator."""
    pass


class YamlParsingError(ReadYamlGeneratorError):
    """Raised when YAML parsing fails or essential content is missing."""
    pass


class MissingDataError(ReadYamlGeneratorError):
    """Raised when expected data (like table name or PK) cannot be extracted."""
    pass


def extract_table_info_from_ingest_yaml(yaml_content: str) -> Dict[str, Any]:
    """
    Extract table information from the ingest YAML file safely.
    """
    try:
        # First, try to safely parse the YAML
        data = yaml.safe_load(yaml_content)

        if not data or not isinstance(data, dict) or \
           'blocks' not in data or 'schema1' not in data['blocks'] or \
           not isinstance(data['blocks'].get('schema1'), dict) or \
           'ops' not in data['blocks']['schema1'] or \
           not isinstance(data['blocks']['schema1'].get('ops'), dict):
            raise YamlParsingError(
                "Invalid YAML structure: Missing expected "
                "blocks.schema1.ops section"
            )

        create_stmt = data['blocks']['schema1']['ops'].get('create_table1', '')
        if not create_stmt or not isinstance(create_stmt, str):
            raise MissingDataError(
                "Missing or invalid CREATE TABLE statement in the YAML file"
            )

        # Parse the CREATE TABLE statement
        table_name = None
        keyspace = "baselines"  # Default keyspace
        primary_key_columns = []

        # Extract table name and keyspace using regex
        # Pattern for <<keyspace:ks_name>>.table_name
        table_match_ks_template = re.search(
            r'CREATE\s+TABLE\s+(?:if\s+not\s+exists\s+)?'
            r'<<keyspace:([^>]+)>>\.(\w+)',
            create_stmt, re.IGNORECASE
        )
        # Pattern for keyspace.table_name
        table_match_direct_ks = re.search(
            r'CREATE\s+TABLE\s+(?:if\s+not\s+exists\s+)?(\w+)\.(\w+)',
            create_stmt, re.IGNORECASE
        )
        # Pattern for just table_name (assuming default keyspace)
        table_match_no_ks = re.search(
            r'CREATE\s+TABLE\s+(?:if\s+not\s+exists\s+)?(\w+)',
            create_stmt, re.IGNORECASE
        )

        if table_match_ks_template:
            keyspace = table_match_ks_template.group(1)
            table_name = table_match_ks_template.group(2)
        elif table_match_direct_ks:
            keyspace = table_match_direct_ks.group(1)
            table_name = table_match_direct_ks.group(2)
        elif table_match_no_ks:
            table_name = table_match_no_ks.group(1)
        else:
            raise MissingDataError(
                "Could not extract table name from the CREATE TABLE statement in YAML"  # noqa: E501
            )

        table_name = table_name.strip('"')
        keyspace = keyspace.strip('"')

        # Extract primary key
        pk_match = re.search(
            r'PRIMARY\s+KEY\s*\(\s*([^)]+)\s*\)',
            create_stmt, re.IGNORECASE
        )
        if pk_match:
            pk_content = pk_match.group(1)
            # Handle composite partition keys like ((pk1, pk2), ck1, ck2)
            pk_parts_raw = re.findall(r'\(\s*([^)]+)\s*\)|([\w."]+)', pk_content)
            for group, single_col in pk_parts_raw:
                part_to_process = group if group else single_col
                if part_to_process:
                    primary_key_columns.extend(
                        [p.strip().strip('"') for p in part_to_process.split(',') if p.strip()]  # noqa: E501
                    )
            primary_key_columns = [pk for pk in primary_key_columns if pk] # Remove empty strings
        
        if not table_name:  # Should be caught by MissingDataError earlier
            raise MissingDataError("Could not extract table name from the YAML file") # noqa: E501
        if not primary_key_columns:
            raise MissingDataError("Could not extract primary key columns from the YAML file") # noqa: E501

        return {
            "table_name": table_name,
            "keyspace": keyspace,
            "primary_key_columns": primary_key_columns,
        }

    except yaml.YAMLError as e:
        logger.warning(f"YAML parsing failed with PyYAML: {e}. "
                       "Attempting regex-based extraction.")
        try:
            return extract_table_info_using_regex(yaml_content)
        except MissingDataError as regex_err:
            raise YamlParsingError(f"YAML parsing failed ({e}) and regex fallback also failed: {regex_err}") # noqa: E501
        except Exception as regex_fallback_e:
            raise YamlParsingError(f"YAML parsing failed ({e}) and regex fallback encountered an error: {regex_fallback_e}") # noqa: E501
    except (MissingDataError, YamlParsingError):
        raise
    except Exception as e:
        logger.error(f"Error extracting table info from YAML: {e}",
                     exc_info=True)
        raise YamlParsingError(f"Error extracting table info from YAML: {e}")


def extract_table_info_using_regex(yaml_content: str) -> Dict[str, Any]:
    """
    Fallback method to extract table info using regex when YAML parsing fails.
    """
    table_name = None
    keyspace = "baselines"

    # Try to extract from CREATE TABLE statement (more robustly)
    create_match = re.search(
        r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?'
        r'(?:<<keyspace:([^>]+)>>\.|\"?([a-zA-Z0-9_]+)\"?\.)?'
        r'\"?([a-zA-Z0-9_]+)\"?',
        yaml_content,
        re.IGNORECASE
    )
    if create_match:
        ks_template = create_match.group(1)
        ks_direct = create_match.group(2)
        table_name_match = create_match.group(3)

        if ks_template:
            keyspace = ks_template
        elif ks_direct:
            keyspace = ks_direct
        table_name = table_name_match
    else:
        raise MissingDataError(
            "Could not extract table name from the YAML content using regex (CREATE TABLE)."  # noqa: E501
        )

    # Extract primary key columns
    pk_match = re.search(r'PRIMARY\s+KEY\s*\(\s*([^)]+)\s*\)',
                         yaml_content, re.IGNORECASE)
    if not pk_match:
        raise MissingDataError(
            "Could not extract primary key from the YAML content using regex."
        )

    pk_content = pk_match.group(1)
    primary_key_columns = []
    pk_parts_raw = re.findall(r'(?:\(\s*([\w",\s]+)\s*\)|[\w."]+)', pk_content)
    for part_tuple in pk_parts_raw: # findall returns list of tuples if groups exist
        # part_tuple can be (group_content, None) or (None, ungrouped_match)
        part_str = next(s for s in part_tuple if s is not None)
        if part_str:
            cleaned_cols = [p.strip().strip('"') for p in part_str.split(',') if p.strip()] # noqa: E501
            primary_key_columns.extend(cleaned_cols)
    
    primary_key_columns = [pk for pk in primary_key_columns if pk] # Ensure no empty strings from complex splitting

    if not primary_key_columns:
        raise MissingDataError(
            "Could not extract primary key columns from the YAML content using regex" # noqa: E501
        )

    return {
        "table_name": table_name.strip('"'),
        "keyspace": keyspace.strip('"'),
        "primary_key_columns": primary_key_columns
    }


def generate_read_yaml_from_text(
    ingest_yaml_text: str,
    dsbulk_csv_path: str,
    primary_key_columns: Optional[List[str]] = None,
    keyspace: Optional[str] = None
) -> str:
    """
    Generate a read YAML file from an ingest YAML file.
    Now accepts an optional list of primary_key_columns.
    """
    try:
        table_info = extract_table_info_from_ingest_yaml(ingest_yaml_text)

        ks = keyspace if keyspace else table_info["keyspace"]
        pk_cols_to_use = primary_key_columns if primary_key_columns \
            else table_info.get("primary_key_columns")

        if not pk_cols_to_use or \
           not isinstance(pk_cols_to_use, list) or \
           not all(isinstance(pk, str) for pk in pk_cols_to_use):
            raise MissingDataError(
                "Primary key columns are missing or not in the correct format "
                "(list of strings)."
            )

        primary_key_for_sampler = pk_cols_to_use[0]
        table_name = table_info["table_name"]

        read_yaml_dict = {
            "scenarios": {
                "default": {
                    "read1": ("run driver=cql tags='block:read1' "
                              "cycles==TEMPLATE(read-cycles,1000) threads=auto")
                }
            },
            "bindings": {
                primary_key_for_sampler: (
                    f"CSVSampler('{primary_key_for_sampler}',"
                    f"'{primary_key_for_sampler}-weight',"
                    f"'{dsbulk_csv_path}')"
                )
            },
            "blocks": {
                "read1": {
                    "params": {
                        "cl": "TEMPLATE(read_cl,LOCAL_QUORUM)",
                        "instrument": True,
                        "prepared": True
                    },
                    "ops": {
                        f"read_by_{primary_key_for_sampler}": (
                            f"SELECT {', '.join(f'\\"{col}\\"' for col in pk_cols_to_use)}, insertedtimestamp " # noqa: E501
                            f"\nFROM <<keyspace:{ks}>>.{table_name}\n"
                            f"WHERE {' AND '.join([f'\\"{col}\\" = {{{col}}}' for col in pk_cols_to_use])}\n"  # noqa: E501
                            "LIMIT 1;"
                        )
                    }
                }
            }
        }

        read_yaml = yaml.safe_dump(
            read_yaml_dict, default_flow_style=False, sort_keys=False
        )

        return read_yaml

    except (YamlParsingError, MissingDataError) as e:
        # Re-wrap as ReadYamlGeneratorError for consistent error type
        raise ReadYamlGeneratorError(
            f"Error generating read YAML from text: {str(e)}"
        )
    except Exception as e:
        logger.error(
            f"Unexpected error in generate_read_yaml_from_text: {str(e)}",
            exc_info=True
        )
        raise ReadYamlGeneratorError(
            f"Unexpected error generating read YAML: {str(e)}"
        )