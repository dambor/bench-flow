import os
import subprocess
from typing import Dict, List, Optional
from pathlib import Path
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
        self.dsbulk_path = dsbulk_path or str(Path(os.path.dirname(os.path.abspath(__file__))) / f"dsbulk-1.11.0.jar")
        
    def validate_dsbulk_path(self) -> bool:
        """
        Validate that the DSBulk JAR file exists
        
        Returns:
            bool: True if the file exists, False otherwise
        """
        # Don't need to download here - that happens in main.py
        return os.path.exists(self.dsbulk_path)
    
    def generate_unload_command(self, 
                              keyspace: str, 
                              table: str, 
                              primary_key: str,
                              output_path: str,
                              limit: int = 1000000) -> str:
        """Generate a DSBulk unload command string for export"""
        
        # Sanitize inputs to prevent command injection
        keyspace = self._sanitize_input(keyspace)
        table = self._sanitize_input(table)
        primary_key = self._sanitize_input(primary_key)
        
        # Build the query with proper quoting
        query = f'SELECT "{primary_key}" FROM {keyspace}.{table}'
        
        if limit and limit > 0:
            query += f" LIMIT {limit};"
        else:
            query += ";"
            
        # Build the command
        command = f'java -jar {self.dsbulk_path} unload \\\n'
        command += f'  -query "{query}" \\\n'
        command += f'  -url {output_path}'
        
        return command
    
    def generate_load_command(self,
                            keyspace: str,
                            table: str,
                            csv_path: str) -> str:
        """Generate a DSBulk load command string for import"""
        
        # Sanitize inputs to prevent command injection
        keyspace = self._sanitize_input(keyspace)
        table = self._sanitize_input(table)
        
        # Build the command
        command = f'java -jar {self.dsbulk_path} load \\\n'
        command += f'  -k {keyspace} -t {table} \\\n'
        command += f'  -url {csv_path}'
        
        return command
    
    def generate_count_command(self,
                             keyspace: str,
                             table: str) -> str:
        """Generate a DSBulk count command string"""
        
        # Sanitize inputs to prevent command injection
        keyspace = self._sanitize_input(keyspace)
        table = self._sanitize_input(table)
        
        # Build the command
        command = f'java -jar {self.dsbulk_path} count \\\n'
        command += f'  -k {keyspace} -t {table}'
        
        return command
    
    def _sanitize_input(self, input_str: str) -> str:
        """Sanitize input to prevent command injection"""
        # Replace any potentially dangerous characters
        return input_str.replace(';', '').replace('&', '').replace('|', '').replace('>', '').replace('<', '')
    
    def execute_command(self, command: str) -> Dict:
        """Execute a DSBulk command and return results"""
        try:
            # Make sure dsbulk.jar exists before executing
            if not self.validate_dsbulk_path():
                raise Exception(f"DSBulk JAR file not found at {self.dsbulk_path}")
            
            # Execute the command and capture output
            result = subprocess.run(command, shell=True, check=True, 
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                   text=True)
            
            return {
                "success": True,
                "stdout": result.stdout,
                "stderr": result.stderr
            }
        except subprocess.CalledProcessError as e:
            logger.error(f"DSBulk command execution failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "stdout": e.stdout if hasattr(e, 'stdout') else "",
                "stderr": e.stderr if hasattr(e, 'stderr') else ""
            }
        except Exception as e:
            logger.error(f"Error during DSBulk command execution: {e}")
            return {
                "success": False,
                "error": str(e),
                "stdout": "",
                "stderr": f"Error: {str(e)}"
            }