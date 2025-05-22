import os
import subprocess
import tempfile
import threading
import time
# import json # F401: json imported but unused
from typing import Dict, List, Optional, Any  # Tuple removed as it's not used
# from pathlib import Path # F401: Path imported but unused
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("nb5_executor")


class NB5Executor:
    def __init__(self, nb5_path: str = None):
        # Default to a common location if not specified
        self.nb5_path = nb5_path or os.path.expanduser(
            "~/workspace/nb5.jar"
        )  # E501: line too long
        self.active_executions: Dict[str, Dict[str, Any]] = {}
        self.execution_logs: Dict[str, Dict[str, Any]] = {}

    def validate_nb5_path(self) -> bool:
        """
        Validate that the NB5 JAR file exists.

        Returns:
            bool: True if the file exists, False otherwise
        """
        # Don't need to download here - that happens in main.py
        return os.path.exists(self.nb5_path)

    def generate_execution_command(self,
                                   yaml_file: str,
                                   host: str,
                                   datacenter: str,
                                   keyspace: str,
                                   additional_params: Optional[str] = None
                                   ) -> str:
        """Generate a NB5 execution command string"""
        # Build the command
        command_parts = [
            "java", "--enable-preview", "-jar", self.nb5_path,
            f'"{yaml_file}"',  # Quote yaml_file in case it has spaces
            f'host={host}',
            f'localdc={datacenter}',
            f'keyspace={keyspace}'
        ]

        if additional_params:
            command_parts.append(additional_params)

        command_parts.append('--progress console:1s')
        command = " \\\n  ".join(command_parts)
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
        # Make sure nb5.jar exists
        if not self.validate_nb5_path():
            # E501: line too long
            raise Exception(f"NB5 JAR file not found at {self.nb5_path}")

        temp_yaml_file = None
        try:
            # Create a temporary file for the YAML content
            # delete=False is necessary for Windows compatibility with Popen
            with tempfile.NamedTemporaryFile(
                    mode='w', suffix='.yaml', delete=False) as temp_yaml:
                temp_yaml.write(yaml_content)
                yaml_path = temp_yaml.name
            temp_yaml_file = yaml_path  # Keep track for cleanup

            # Build the command
            command_args = [
                'java', '--enable-preview', '-jar', self.nb5_path,
                yaml_path,
                f'host={host}',
                f'localdc={datacenter}',
                f'keyspace={keyspace}'
            ]

            # Add additional parameters if provided
            if additional_params:
                # Split the additional parameters string and add each parameter
                # Ensure parameters are added before --progress
                # E128: continuation line under-indented (if not handled by black)
                params_list = [
                    param for param in additional_params.split() if param
                ]
                command_args.extend(params_list)

            command_args.extend(['--progress', 'console:1s'])

            # Generate a unique execution ID
            execution_id = f"nb5_{int(time.time() * 1000)}"

            # Store the command string for reference
            # This command string is for display/logging, actual execution uses list
            command_string_display = self.generate_execution_command(
                yaml_path, host, datacenter, keyspace, additional_params
            )

            # Start the process
            process = subprocess.Popen(
                command_args,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,  # Line buffered
                # Consider adding a creationflags for Windows if needed
            )

            # Store the process and related information
            self.active_executions[execution_id] = {
                'process': process,
                'command': command_string_display,
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
                'command': command_string_display,
                'status': 'running'
            }

        except Exception as e:
            # Clean up the temporary file if it exists and was created
            if temp_yaml_file and os.path.exists(temp_yaml_file):
                try:
                    os.unlink(temp_yaml_file)
                except OSError as unlink_e:
                    logger.error(f"Error deleting temp file {temp_yaml_file}: {unlink_e}") # noqa E501
            # E722: do not use bare 'except' (already fixed, using except Exception as e)
            raise Exception(f"Error executing NB5 command: {str(e)}")

    def _capture_output(self, stream, execution_id: str, stream_type: str):
        """Capture output from stdout or stderr stream"""
        try:
            if stream: # Ensure stream is not None
                for line in iter(stream.readline, ''):
                    if execution_id in self.execution_logs:
                        self.execution_logs[execution_id][stream_type].append(
                            line.rstrip()
                        )
                    else: # Process might have been cleaned up
                        break
        except Exception as e:
            logger.error(f"Error capturing {stream_type} for {execution_id}: {str(e)}") # noqa E501
        finally:
            if stream:
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
                        process.wait(timeout=5)  # Give it a chance to terminate
                    except subprocess.TimeoutExpired:
                        process.kill()  # Force kill if terminate fails

                    if execution_id in self.execution_logs:
                        self.execution_logs[execution_id]['status'] = 'timeout'
                        self.execution_logs[execution_id]['stderr'].append(
                            "Execution timed out and was terminated."
                        )
                    break
                time.sleep(1)

            return_code = process.poll()

            # Update status based on return code
            if execution_id in self.execution_logs:
                current_status = self.execution_logs[execution_id]['status']
                if current_status not in ['timeout', 'terminated']: # Don't overwrite manual termination
                    if return_code == 0:
                        self.execution_logs[execution_id]['status'] = 'completed'
                    else:
                        self.execution_logs[execution_id]['status'] = 'failed'
                        self.execution_logs[execution_id]['stderr'].append(
                            f"Process exited with return code {return_code}"
                        )

            # Clean up the temporary YAML file
            yaml_path_to_clean = execution.get('yaml_path')
            if yaml_path_to_clean and os.path.exists(yaml_path_to_clean):
                try:
                    os.unlink(yaml_path_to_clean)
                except OSError as e:
                    logger.error(f"Error deleting temp file {yaml_path_to_clean}: {e}") # noqa E501

            # Remove the execution from active executions after a period
            # but leave the logs available for retrieval
            cleanup_time = 3600  # 1 hour

            # E306: expected 1 blank line before a nested definition, found 0
            def delayed_cleanup():
                time.sleep(cleanup_time)
                if execution_id in self.active_executions:
                    del self.active_executions[execution_id]
                # Optionally, could also schedule log cleanup here if desired

            cleanup_thread = threading.Thread(target=delayed_cleanup)
            cleanup_thread.daemon = True
            cleanup_thread.start()

        except Exception as e: # E722: do not use bare 'except' (already fixed)
            logger.error(
                f"Error monitoring process for execution {execution_id}: {str(e)}"
            )
            if execution_id in self.execution_logs:
                self.execution_logs[execution_id]['status'] = 'error'
                self.execution_logs[execution_id]['stderr'].append(
                    f"Error monitoring process: {str(e)}"
                )

    def get_execution_status(self, execution_id: str) -> Dict[str, Any]:
        """Get the status and logs of an execution"""
        if execution_id not in self.execution_logs:
            raise Exception(f"Execution {execution_id} not found")

        logs = self.execution_logs[execution_id]

        # Get command if available
        command = self.active_executions.get(execution_id, {}).get(
            'command', 'Command not available'
        )

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
            raise Exception(
                f"Execution {execution_id} not found or already completed"
            )

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
                self.execution_logs[execution_id]['stderr'].append(
                    "Execution was manually terminated."
                )

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
            command = self.active_executions.get(execution_id, {}).get(
                'command', 'Command not available'
            )

            # Get start time if available
            start_time = self.active_executions.get(execution_id, {})\
                .get('start_time', 0)

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