# backend/nb5_executor.py
import os
import subprocess
import tempfile
import threading
import time
import json
from typing import Dict, List, Optional, Tuple, Any

class NB5Executor:
    def __init__(self, nb5_path: str = None):
        # Default to a common location if not specified
        self.nb5_path = nb5_path or os.path.expanduser("~/workspace/nb5.jar")
        self.active_executions = {}
        self.execution_logs = {}
        
    def validate_nb5_path(self) -> bool:
        """Validate that the NB5 JAR file exists"""
        return os.path.exists(self.nb5_path)
    
    def generate_execution_command(self,
                               yaml_file: str,
                               host: str,
                               datacenter: str,
                               keyspace: str,
                               additional_params: Optional[str] = None) -> str:
        """Generate a NB5 execution command string"""
        
        # Build the command
        command = f'java --enable-preview -jar {self.nb5_path} "{yaml_file}" \\\n'
        command += f'  host={host} \\\n'
        command += f'  localdc={datacenter} \\\n'
        command += f'  keyspace={keyspace}'
        
        if additional_params:
            command += f' \\\n  {additional_params}'
            
        command += ' \\\n  --progress console:1s'
        
        return command
    
    def execute_nb5_command(self,
                        yaml_content: str,
                        host: str, 
                        datacenter: str,
                        keyspace: str,
                        additional_params: Optional[str] = None,
                        timeout: int = 600) -> Dict[str, Any]:
        """
        Execute a NB5 command with the provided parameters
        
        Returns:
            Dict with execution_id and command
        """
        try:
            # Create a temporary file for the YAML content
            with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as temp_yaml:
                temp_yaml.write(yaml_content)
                yaml_path = temp_yaml.name
            
            # Build the command
            command_args = [
                'java', '--enable-preview', '-jar', self.nb5_path,
                yaml_path,
                f'host={host}',
                f'localdc={datacenter}',
                f'keyspace={keyspace}',
                '--progress', 'console:1s'
            ]
            
            # Add additional parameters if provided
            if additional_params:
                # Split the additional parameters string and add each parameter
                for param in additional_params.split():
                    if param:  # Ensure it's not an empty string
                        command_args.insert(-2, param)  # Insert before --progress
            
            # Generate a unique execution ID
            execution_id = f"nb5_{int(time.time() * 1000)}"
            
            # Store the command string for reference
            command_string = self.generate_execution_command(
                yaml_path, host, datacenter, keyspace, additional_params
            )
            
            # Start the process
            process = subprocess.Popen(
                command_args,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1
            )
            
            # Store the process and related information
            self.active_executions[execution_id] = {
                'process': process,
                'command': command_string,
                'yaml_path': yaml_path,
                'start_time': time.time(),
                'timeout': timeout
            }
            
            # Initialize logs for this execution
            self.execution_logs[execution_id] = {
                'stdout': [],
                'stderr': [],
                'status': 'running'
            }
            
            # Start threads to capture stdout and stderr
            stdout_thread = threading.Thread(
                target=self._capture_output,
                args=(process.stdout, execution_id, 'stdout')
            )
            stderr_thread = threading.Thread(
                target=self._capture_output,
                args=(process.stderr, execution_id, 'stderr')
            )
            
            stdout_thread.daemon = True
            stderr_thread.daemon = True
            stdout_thread.start()
            stderr_thread.start()
            
            # Start a thread to monitor the process
            monitor_thread = threading.Thread(
                target=self._monitor_process,
                args=(execution_id,)
            )
            monitor_thread.daemon = True
            monitor_thread.start()
            
            return {
                'execution_id': execution_id,
                'command': command_string,
                'status': 'running'
            }
            
        except Exception as e:
            # Clean up the temporary file if it exists
            if 'yaml_path' in locals():
                try:
                    os.unlink(yaml_path)
                except:
                    pass
            
            raise Exception(f"Error executing NB5 command: {str(e)}")
    
    def _capture_output(self, stream, execution_id: str, stream_type: str):
        """Capture output from stdout or stderr stream"""
        try:
            for line in stream:
                if execution_id in self.execution_logs:
                    self.execution_logs[execution_id][stream_type].append(line.rstrip())
        except Exception as e:
            print(f"Error capturing {stream_type} for execution {execution_id}: {str(e)}")
        finally:
            stream.close()
    
    def _monitor_process(self, execution_id: str):
        """Monitor a running process and clean up when finished"""
        try:
            if execution_id not in self.active_executions:
                return
            
            execution = self.active_executions[execution_id]
            process = execution['process']
            start_time = execution['start_time']
            timeout = execution['timeout']
            
            # Wait for the process to complete or timeout
            while process.poll() is None:
                # Check if the process has exceeded the timeout
                if timeout and (time.time() - start_time) > timeout:
                    process.terminate()
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        process.kill()
                    
                    if execution_id in self.execution_logs:
                        self.execution_logs[execution_id]['status'] = 'timeout'
                        self.execution_logs[execution_id]['stderr'].append("Execution timed out and was terminated.")
                    break
                
                time.sleep(1)
            
            # Get the return code
            return_code = process.poll()
            
            # Update status based on return code
            if execution_id in self.execution_logs:
                if self.execution_logs[execution_id]['status'] != 'timeout':
                    if return_code == 0:
                        self.execution_logs[execution_id]['status'] = 'completed'
                    else:
                        self.execution_logs[execution_id]['status'] = 'failed'
                        self.execution_logs[execution_id]['stderr'].append(f"Process exited with return code {return_code}")
            
            # Clean up the temporary YAML file
            if 'yaml_path' in execution:
                try:
                    os.unlink(execution['yaml_path'])
                except:
                    pass
            
            # Remove the execution from active executions after a period
            # but leave the logs available for retrieval
            cleanup_time = 3600  # 1 hour
            def delayed_cleanup():
                time.sleep(cleanup_time)
                if execution_id in self.active_executions:
                    del self.active_executions[execution_id]
            
            cleanup_thread = threading.Thread(target=delayed_cleanup)
            cleanup_thread.daemon = True
            cleanup_thread.start()
            
        except Exception as e:
            print(f"Error monitoring process for execution {execution_id}: {str(e)}")
            if execution_id in self.execution_logs:
                self.execution_logs[execution_id]['status'] = 'error'
                self.execution_logs[execution_id]['stderr'].append(f"Error monitoring process: {str(e)}")
    
    def get_execution_status(self, execution_id: str) -> Dict[str, Any]:
        """Get the status and logs of an execution"""
        if execution_id not in self.execution_logs:
            raise Exception(f"Execution {execution_id} not found")
        
        logs = self.execution_logs[execution_id]
        
        # Get command if available
        command = self.active_executions.get(execution_id, {}).get('command', 'Command not available')
        
        # Is the process still running?
        is_running = False
        if execution_id in self.active_executions:
            process = self.active_executions[execution_id]['process']
            is_running = process.poll() is None
        
        return {
            'execution_id': execution_id,
            'status': logs['status'],
            'command': command,
            'is_running': is_running,
            'stdout': logs['stdout'],
            'stderr': logs['stderr']
        }
    
    def terminate_execution(self, execution_id: str) -> Dict[str, Any]:
        """Terminate a running execution"""
        if execution_id not in self.active_executions:
            raise Exception(f"Execution {execution_id} not found or already completed")
        
        execution = self.active_executions[execution_id]
        process = execution['process']
        
        if process.poll() is None:
            # Process is still running, terminate it
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
            
            if execution_id in self.execution_logs:
                self.execution_logs[execution_id]['status'] = 'terminated'
                self.execution_logs[execution_id]['stderr'].append("Execution was manually terminated.")
        
        return self.get_execution_status(execution_id)
    
    def list_executions(self) -> List[Dict[str, Any]]:
        """List all executions with their status"""
        results = []
        
        for execution_id, logs in self.execution_logs.items():
            # Is the process still running?
            is_running = False
            if execution_id in self.active_executions:
                process = self.active_executions[execution_id]['process']
                is_running = process.poll() is None
            
            # Get command if available
            command = self.active_executions.get(execution_id, {}).get('command', 'Command not available')
            
            # Get start time if available
            start_time = self.active_executions.get(execution_id, {}).get('start_time', 0)
            
            results.append({
                'execution_id': execution_id,
                'status': logs['status'],
                'is_running': is_running,
                'command': command,
                'start_time': start_time,
                'log_size': len(logs['stdout']) + len(logs['stderr'])
            })
        
        # Sort by start time, most recent first
        results.sort(key=lambda x: x['start_time'], reverse=True)
        
        return results