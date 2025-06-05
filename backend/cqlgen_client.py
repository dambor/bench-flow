#!/usr/bin/env python3

"""
CQL Generator API Client Example
--------------------------------

This script demonstrates how to interact with the CQL Generator API
to generate YAML files from CQL schema files.
"""

import requests
import argparse
import sys
from pathlib import Path


def validate_cqlgen(base_url):
    """Validate that the CQL Generator is available"""
    resp = requests.get(f"{base_url}/api/cqlgen/validate")
    resp.raise_for_status()
    result = resp.json()

    if not result.get("valid"):
        print(f"CQL Generator validation failed: {result}")
        return False

    print("CQL Generator validation successful")
    return True


def generate_yaml(base_url, schema_file_path):
    """Generate YAML from a CQL schema file"""
    schema_file = Path(schema_file_path)
    if not schema_file.exists():
        print(f"Schema file not found: {schema_file_path}")
        return None

    with open(schema_file, 'rb') as f:
        files = {'schema_file': (schema_file.name, f, 'text/plain')}
        resp = requests.post(f"{base_url}/api/cqlgen/generate", files=files)

    if resp.status_code != 200:
        print(f"Error generating YAML: {resp.text}")
        return None

    return resp.json()


def download_yaml(base_url, download_url, output_path):
    """Download a generated YAML file"""
    resp = requests.get(f"{base_url}{download_url}")
    if resp.status_code != 200:
        print(f"Error downloading file: {resp.text}")
        return False

    with open(output_path, 'wb') as f:
        f.write(resp.content)

    print(f"Downloaded YAML to {output_path}")
    return True


def process_with_schema(base_url, schema_file_path, parse_for_app=True):
    """Process a schema file and optionally parse it for the application"""
    schema_file = Path(schema_file_path)
    if not schema_file.exists():
        print(f"Schema file not found: {schema_file_path}")
        return None

    with open(schema_file, 'rb') as f:
        files = {'schema_file': (schema_file.name, f, 'text/plain')}
        data = {'parse_for_app': str(parse_for_app).lower()}
        resp = requests.post(
            f"{base_url}/api/cqlgen/process-with-schema",
            files=files, data=data
        )

    if resp.status_code != 200:
        print(f"Error processing schema: {resp.text}")
        return None

    return resp.json()


def main():
    parser = argparse.ArgumentParser(description="CQL Generator API client")
    parser.add_argument("--url", default="http://localhost:8001",
                        help="Base URL for the API "
                             "(default: http://localhost:8001)")
    parser.add_argument("--validate", action="store_true",
                        help="Validate CQL Generator setup")
    parser.add_argument("--schema",
                        help="Path to CQL schema file")
    parser.add_argument("--output",
                        help="Path to save output YAML file")
    parser.add_argument("--parse", action="store_true",
                        help="Also parse schema for application use")

    args = parser.parse_args()

    if args.validate:
        if not validate_cqlgen(args.url):
            sys.exit(1)

    if args.schema:
        if args.parse:
            result = process_with_schema(args.url, args.schema)
        else:
            result = generate_yaml(args.url, args.schema)

        if not result:
            sys.exit(1)

        print(f"YAML generation successful: {result['message']}")

        if args.output and 'download_url' in result:
            download_yaml(args.url, result['download_url'], args.output)

        if args.parse and 'tables' in result:
            print("\nDetected tables:")
            for table in result['tables']:
                print(f"  - {table}")


if __name__ == "__main__":
    main()
