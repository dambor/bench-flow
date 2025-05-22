// Modified NB5Context.jsx with improved error handling and request formatting
import { createContext, useContext, useState, useEffect, useCallback } from 'react'; // React removed, useCallback added
import { nb5Api } from '../services/api';
import { useAppContext } from './AppContext';

// Create the context
const NB5Context = createContext();

// Create a hook to use the context
export const useNB5Context = () => useContext(NB5Context);

// Provider component
export const NB5Provider = ({ children }) => {
  const { setError, addNotification, updateWorkflow } = useAppContext();
  
  // NB5 state
  const [isValidated, setIsValidated] = useState(false);
  const [nb5Path, setNB5Path] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [currentCommand, setCurrentCommand] = useState('');
  const [executions, setExecutions] = useState([]);
  const [activeExecution, setActiveExecution] = useState(null);
  const [pollingInterval, setPollingInterval] = useState(null);
  
  // Validate that NB5 JAR exists
  const validateNB5 = useCallback(async () => {
    setIsValidating(true);
    
    try {
      const result = await nb5Api.validate();
      setIsValidated(result.valid);
      setNB5Path(result.path);
      
      if (result.valid) {
        addNotification({
          type: 'success',
          title: 'NB5 Validated',
          message: `NB5 JAR found at ${result.path}`,
        });
      } else {
        addNotification({
          type: 'warning',
          title: 'NB5 Not Found',
          message: `NB5 JAR not found at ${result.path}`,
          persistent: true,
        });
      }
      
      return result;
    } catch (error) {
      setError(error);
      throw error;
    } finally {
      setIsValidating(false);
    }
  }, [setError, addNotification, setIsValidating, setIsValidated, setNB5Path]);
  
  // Generate NB5 command based on given parameters
  const generateCommand = async (params) => {
    try {
      const result = await nb5Api.generateCommand(params);
      setCurrentCommand(result.command);
      
      addNotification({
        type: 'info',
        title: 'Command Generated',
        message: 'NB5 command has been generated',
      });
      
      return result;
    } catch (error) {
      setError(error);
      throw error;
    }
  };
  
  // Execute a NB5 command with YAML content
  const executeNB5 = async (params) => {
    try {
      // Log params for debugging (remove sensitive data)
      console.log('Executing NB5 with params:', {
        ...params,
        yaml_content: params.yaml_content ? `${params.yaml_content.substring(0, 50)}...` : 'No content',
      });
      
      // Update workflow step - starting
      updateWorkflow({
        steps: [{
          name: 'Execute NB5',
          status: 'in-progress',
          timestamp: new Date(),
          details: `Starting NB5 execution for ${params.yaml_content ? 'YAML content' : 'unknown workload'}`
        }]
      });
      
      // Ensure yaml_content is properly formatted
      if (params.yaml_content) {
        // Make sure it's a string and trim it
        params.yaml_content = String(params.yaml_content).trim();
        
        // Check if it's actually YAML content
        if (!params.yaml_content.includes(':')) {
          console.warn('Warning: yaml_content may not be valid YAML');
        }
        
        // Log the size of yaml_content
        console.log(`YAML content size: ${params.yaml_content.length} bytes`);
        
        // If it's too large, we should warn about it
        if (params.yaml_content.length > 500000) {
          console.warn('Warning: yaml_content is very large, consider using a file instead');
        }
      } else {
        console.warn('Warning: No yaml_content provided');
        // Add a fallback YAML content
        params.yaml_content = `# Default fallback YAML\nscenarios:\n  default:\n    schema: run driver=cql tags=block:schema threads===UNDEF cycles==UNDEF\n    main: run driver=cql tags=block:main threads=8 cycles=5000000\n`;
      }
      
      // For testing - if you want to use a fixed YAML file path instead of content
      // Uncomment this to bypass the yaml_content and use a file path instead
      /*
      const fixedParams = {
        ...params,
        yaml_file: '/Users/your_user/path_to/output.yaml', // Example path
        yaml_content: undefined  // Remove yaml_content to force using the file
      };
      */
      
      try {
        // Execute with the modified params
        const result = await nb5Api.executeNb5(params);
        console.log('Execution result from backend:', result);
        
        if (!result || !result.execution_id) {
          throw new Error('No execution ID returned from the server');
        }
        
        // Create a new execution record with initial stdout/stderr arrays
        const execution = {
          id: result.execution_id,
          command: result.command || '',
          status: 'running',
          timestamp: new Date(),
          stdout: [],
          stderr: [],
          is_running: true
        };
        
        // Update executions list
        setExecutions(prev => [execution, ...prev]);
        setActiveExecution(execution);
        
        // Start polling for status updates
        startStatusPolling(result.execution_id);
        
        addNotification({
          type: 'success',
          title: 'Execution Started',
          message: `NB5 execution started with ID: ${result.execution_id}`,
          duration: 3000
        });
        
        return execution;
      } catch (apiError) {
        console.error('API Error Details:', apiError);
        
        // Check if there's a specific error message from the server
        let errorMessage = 'Unknown error occurred';
        if (apiError.message) {
          errorMessage = apiError.message;
        } else if (apiError.details && apiError.details.detail) {
          // Handle FastAPI error format
          if (Array.isArray(apiError.details.detail)) {
            errorMessage = apiError.details.detail.join('; ');
          } else {
            errorMessage = apiError.details.detail;
          }
        }
        
        throw new Error(`NB5 execution failed: ${errorMessage}`);
      }
    } catch (error) {
      console.error('NB5 Execution error:', error);
      setError(error);
      
      // Update workflow step - failed
      updateWorkflow({
        steps: [{
          name: 'Execute NB5',
          status: 'failed',
          timestamp: new Date(),
          error: error.message
        }]
      });
      
      throw error;
    }
  };

  // Start polling for status updates for a specific execution
  const startStatusPolling = (executionId) => {
    console.log(`Starting status polling for execution: ${executionId}`);
    
    // Clear any existing interval
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
    
    // Set up a new polling interval
    const interval = setInterval(async () => {
      try {
        console.log(`Polling status for execution: ${executionId}`);
        const status = await nb5Api.getExecutionStatus(executionId);
        console.log(`Status update for ${executionId}:`, status);
        
        // Format stdout and stderr if they're not arrays
        let formattedStatus = {
          ...status,
          stdout: Array.isArray(status.stdout) ? status.stdout : 
                  (typeof status.stdout === 'string' ? status.stdout.split('\n') : []),
          stderr: Array.isArray(status.stderr) ? status.stderr : 
                  (typeof status.stderr === 'string' ? status.stderr.split('\n') : [])
        };
        
        // Update the execution in the list
        setExecutions(prev => 
          prev.map(exec => 
            exec.id === executionId 
              ? { ...exec, ...formattedStatus, lastUpdated: new Date() } 
              : exec
          )
        );
        
        // Update the active execution if it's the current one
        if (activeExecution && activeExecution.id === executionId) {
          setActiveExecution(prev => ({ ...prev, ...formattedStatus, lastUpdated: new Date() }));
        }
        
        // If the execution is no longer running, stop polling
        if (!status.is_running) {
          console.log(`Execution ${executionId} completed with status: ${status.status}`);
          clearInterval(interval);
          setPollingInterval(null);
          
          // Update workflow step - completed or failed
          updateWorkflow({
            steps: [{
              name: 'Execute NB5',
              status: status.status === 'completed' ? 'completed' : 'failed',
              timestamp: new Date(),
              details: status.status === 'completed' 
                ? 'NB5 execution completed successfully' 
                : `NB5 execution ${status.status}: ${status.stderr && status.stderr.length > 0 ? status.stderr[status.stderr.length - 1] : 'Unknown error'}`
            }]
          });
          
          // Send notification about completion
          addNotification({
            type: status.status === 'completed' ? 'success' : 'error',
            title: status.status === 'completed' ? 'Execution Complete' : 'Execution Failed',
            message: status.status === 'completed' 
              ? 'NB5 execution completed successfully' 
              : `NB5 execution ${status.status}`,
            duration: 4000
          });
        }
      } catch (error) {
        console.error(`Error polling status for execution ${executionId}:`, error);
        // Don't stop polling on temporary errors
      }
    }, 2000); // Poll every 2 seconds
    
    setPollingInterval(interval);
    
    // Clean up interval when component unmounts
    return () => {
      clearInterval(interval);
    };
  };
  
  // Get execution status manually (not through polling)
  const getExecutionStatus = async (executionId) => {
    try {
      const status = await nb5Api.getExecutionStatus(executionId);
      
      // Update the execution in the list
      setExecutions(prev => 
        prev.map(exec => 
          exec.id === executionId 
            ? { ...exec, ...status, lastUpdated: new Date() } 
            : exec
        )
      );
      
      // Update the active execution if it's the current one
      if (activeExecution && activeExecution.id === executionId) {
        setActiveExecution(prev => ({ ...prev, ...status, lastUpdated: new Date() }));
      }
      
      return status;
    } catch (error) {
      setError(error);
      throw error;
    }
  };
  
  // Terminate a running execution
  const terminateExecution = async (executionId) => {
    try {
      const result = await nb5Api.terminateExecution(executionId);
      
      // Update the execution in the list
      setExecutions(prev => 
        prev.map(exec => 
          exec.id === executionId 
            ? { ...exec, ...result, lastUpdated: new Date() } 
            : exec
        )
      );
      
      // Update the active execution if it's the current one
      if (activeExecution && activeExecution.id === executionId) {
        setActiveExecution(prev => ({ ...prev, ...result, lastUpdated: new Date() }));
      }
      
      addNotification({
        type: 'warning',
        title: 'Execution Terminated',
        message: `NB5 execution ${executionId} was terminated`,
      });
      
      return result;
    } catch (error) {
      setError(error);
      throw error;
    }
  };
  
  // List all NB5 executions
  const listExecutions = async () => {
    try {
      const result = await nb5Api.listExecutions();
      
      // Update executions list with the latest data
      setExecutions(result.executions || []);
      
      return result.executions;
    } catch (error) {
      setError(error);
      throw error;
    }
  };
  
  // Download a NB5 script
  const downloadScript = async (params) => {
    try {
      const response = await nb5Api.downloadScript(params);
      
      // Get the filename from the Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition && contentDisposition.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch ? filenameMatch[1] : 'nb5_script.sh';
      
      // Create a download link and trigger the download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      addNotification({
        type: 'success',
        title: 'Script Downloaded',
        message: `${filename} has been downloaded`,
      });
      
      return true;
    } catch (error) {
      setError(error);
      throw error;
    }
  };
  
  // Clear execution history
  const clearExecutions = () => {
    setExecutions([]);
    setActiveExecution(null);
  };
  
  // Set a specific execution as the active one
  const setExecution = (executionId) => {
    const execution = executions.find(exec => exec.id === executionId);
    if (execution) {
      setActiveExecution(execution);
      // Start polling if the execution is still running
      if (execution.is_running) {
        startStatusPolling(executionId);
      }
    }
  };
  
  // Run validation on component mount
  useEffect(() => {
    validateNB5().catch(err => console.error('Initial NB5 validation failed:', err));
    
    // Load existing executions when component mounts
    listExecutions().catch(err => console.error('Failed to load executions:', err));
    
    // Clean up any polling intervals when component unmounts
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [validateNB5, listExecutions, pollingInterval]); // Added dependencies
  
  // Value object that will be provided to consumers
  const contextValue = {
    isValidated,
    nb5Path,
    isValidating,
    currentCommand,
    executions,
    activeExecution,
    validateNB5,
    generateCommand,
    executeNB5,
    getExecutionStatus,
    terminateExecution,
    listExecutions,
    downloadScript,
    clearExecutions,
    setExecution,
    setCurrentCommand
  };
  
  return (
    <NB5Context.Provider value={contextValue}>
      {children}
    </NB5Context.Provider>
  );
};

export default NB5Context;