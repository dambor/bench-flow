import React, { createContext, useContext, useState, useEffect } from 'react';
import { dsbulkApi } from '../services/api';
import { useAppContext } from './AppContext';

// Create the context
const DSBulkContext = createContext();

// Create a hook to use the context
export const useDSBulkContext = () => useContext(DSBulkContext);

// Provider component
export const DSBulkProvider = ({ children }) => {
  const { setError, addNotification, updateWorkflow } = useAppContext();
  
  // DSBulk state
  const [isValidated, setIsValidated] = useState(false);
  const [dsbulkPath, setDsbulkPath] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [currentCommand, setCurrentCommand] = useState('');
  const [executions, setExecutions] = useState([]);
  const [activeExecution, setActiveExecution] = useState(null);
  
  // Validate that DSBulk JAR exists
  const validateDSBulk = async () => {
    setIsValidating(true);
    
    try {
      const result = await dsbulkApi.validate();
      setIsValidated(result.valid);
      setDsbulkPath(result.path);
      
      if (result.valid) {
        addNotification({
          type: 'success',
          title: 'DSBulk Validated',
          message: `DSBulk JAR found at ${result.path}`,
        });
      } else {
        addNotification({
          type: 'warning',
          title: 'DSBulk Not Found',
          message: `DSBulk JAR not found at ${result.path}`,
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
  };
  
  // Generate DSBulk commands based on given parameters
  const generateCommand = async (params) => {
    try {
      const result = await dsbulkApi.generateCommands(params);
      setCurrentCommand(result.command);
      
      addNotification({
        type: 'info',
        title: 'Command Generated',
        message: `${result.operation.toUpperCase()} command generated`,
      });
      
      return result;
    } catch (error) {
      setError(error);
      throw error;
    }
  };
  
  // Execute a DSBulk command
  const executeCommand = async (command = currentCommand, saveOutput = false) => {
    if (!command) {
      setError(new Error('No command specified for execution'));
      return null;
    }
    
    try {
      // Update workflow step - starting
      updateWorkflow({
        steps: [{
          name: 'Execute DSBulk',
          status: 'in-progress',
          timestamp: new Date(),
          details: `Starting DSBulk execution: ${command.split(' ')[0]}...`
        }]
      });
      
      const result = await dsbulkApi.executeCommand(command, saveOutput);
      
      // Create a new execution record
      const execution = {
        id: Date.now(),
        command,
        result,
        timestamp: new Date(),
      };
      
      // Update executions list
      setExecutions(prev => [execution, ...prev]);
      setActiveExecution(execution);
      
      // Update workflow step - completed or failed
      updateWorkflow({
        steps: [{
          name: 'Execute DSBulk',
          status: result.success ? 'completed' : 'failed',
          timestamp: new Date(),
          details: result.success ? 
            'DSBulk execution completed successfully' : 
            `DSBulk execution failed: ${result.error || 'Unknown error'}`
        }]
      });
      
      // Notification
      addNotification({
        type: result.success ? 'success' : 'error',
        title: result.success ? 'Execution Successful' : 'Execution Failed',
        message: result.success ? 
          'DSBulk command executed successfully' : 
          `Error: ${result.error || 'Unknown error'}`,
      });
      
      return execution;
    } catch (error) {
      setError(error);
      
      // Update workflow step - failed
      updateWorkflow({
        steps: [{
          name: 'Execute DSBulk',
          status: 'failed',
          timestamp: new Date(),
          error: error.message
        }]
      });
      
      throw error;
    }
  };
  
  // Download a DSBulk script
  const downloadScript = async (params) => {
    try {
      const response = await dsbulkApi.downloadScript(params);
      
      // Get the filename from the Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition && contentDisposition.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch ? filenameMatch[1] : 'dsbulk_script.sh';
      
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
  
  // Run validation on component mount
  useEffect(() => {
    validateDSBulk().catch(err => console.error('Initial DSBulk validation failed:', err));
  }, []);
  
  // Value object that will be provided to consumers
  const contextValue = {
    isValidated,
    dsbulkPath,
    isValidating,
    currentCommand,
    executions,
    activeExecution,
    validateDSBulk,
    generateCommand,
    executeCommand,
    downloadScript,
    clearExecutions,
    setCurrentCommand
  };
  
  return (
    <DSBulkContext.Provider value={contextValue}>
      {children}
    </DSBulkContext.Provider>
  );
};

export default DSBulkContext;