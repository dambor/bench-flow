import React, { createContext, useContext, useState } from 'react';
import { readYamlApi } from '../services/api';
import { useAppContext } from './AppContext';

// Create the context
const ReadYamlContext = createContext();

// Create a hook to use the context
export const useReadYamlContext = () => useContext(ReadYamlContext);

// Provider component
export const ReadYamlProvider = ({ children }) => {
  const { setError, addNotification, updateWorkflow } = useAppContext();
  
  // Read YAML state
  const [generatedReadYamlFiles, setGeneratedReadYamlFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [primaryKeyColumns, setPrimaryKeyColumns] = useState([]);
  const [csvPath, setCsvPath] = useState('');
  
  // Process a ZIP file containing ingestion YAML files
  const processIngestionZip = async (zipFile) => {
    setIsProcessing(true);
    
    try {
      // Update workflow step - starting
      updateWorkflow({
        steps: [{
          name: 'Process Ingestion Files',
          status: 'in-progress',
          timestamp: new Date(),
          details: `Processing ZIP file: ${zipFile.name}`
        }]
      });
      
      const result = await readYamlApi.processIngestionFiles(zipFile);
      setGeneratedReadYamlFiles(result.files || []);
      
      addNotification({
        type: 'success',
        title: 'Files Processed',
        message: `Successfully processed ${result.files.length} files`,
      });
      
      // Update workflow step - completed
      updateWorkflow({
        steps: [{
          name: 'Process Ingestion Files',
          status: 'completed',
          timestamp: new Date(),
          details: `Processed ${result.files.length} files from ${zipFile.name}`
        }]
      });
      
      return result.files;
    } catch (error) {
      setError(error);
      
      // Update workflow step - failed
      updateWorkflow({
        steps: [{
          name: 'Process Ingestion Files',
          status: 'failed',
          timestamp: new Date(),
          error: error.message
        }]
      });
      
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Process multiple individual YAML files
  const processMultipleFiles = async (files) => {
    setIsProcessing(true);
    
    try {
      // Update workflow step - starting
      updateWorkflow({
        steps: [{
          name: 'Process Multiple Files',
          status: 'in-progress',
          timestamp: new Date(),
          details: `Processing ${files.length} files`
        }]
      });
      
      const result = await readYamlApi.processMultipleFiles(files);
      setGeneratedReadYamlFiles(result.files || []);
      
      addNotification({
        type: 'success',
        title: 'Files Processed',
        message: `Successfully processed ${result.files.length} files`,
      });
      
      // Update workflow step - completed
      updateWorkflow({
        steps: [{
          name: 'Process Multiple Files',
          status: 'completed',
          timestamp: new Date(),
          details: `Processed ${result.files.length} files`
        }]
      });
      
      return result.files;
    } catch (error) {
      setError(error);
      
      // Update workflow step - failed
      updateWorkflow({
        steps: [{
          name: 'Process Multiple Files',
          status: 'failed',
          timestamp: new Date(),
          error: error.message
        }]
      });
      
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Process a single ingestion YAML file and return a download response
  const processIngestionFile = async (file) => {
    setIsProcessing(true);
    
    try {
      // Update workflow step - starting
      updateWorkflow({
        steps: [{
          name: 'Process Ingestion File',
          status: 'in-progress',
          timestamp: new Date(),
          details: `Processing file: ${file.name}`
        }]
      });
      
      const response = await readYamlApi.processIngestionFile(file);
      
      // Get the filename from the Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition && contentDisposition.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch ? filenameMatch[1] : `${file.name.split('.')[0]}_read.yaml`;
      
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
        title: 'File Processed',
        message: `${filename} has been processed and downloaded`,
      });
      
      // Update workflow step - completed
      updateWorkflow({
        steps: [{
          name: 'Process Ingestion File',
          status: 'completed',
          timestamp: new Date(),
          details: `Processed ${file.name} and generated ${filename}`
        }]
      });
      
      return true;
    } catch (error) {
      setError(error);
      
      // Update workflow step - failed
      updateWorkflow({
        steps: [{
          name: 'Process Ingestion File',
          status: 'failed',
          timestamp: new Date(),
          error: error.message
        }]
      });
      
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Generate a read YAML file from a write YAML file, CSV path, and primary key columns
  const generateReadYaml = async (writeYamlFile, csvPath, primaryKeyColumns) => {
    setIsProcessing(true);
    
    try {
      // Update workflow step - starting
      updateWorkflow({
        steps: [{
          name: 'Generate Read YAML',
          status: 'in-progress',
          timestamp: new Date(),
          details: `Generating Read YAML from ${writeYamlFile.name}`
        }]
      });
      
      const response = await readYamlApi.generateReadYaml(writeYamlFile, csvPath, primaryKeyColumns);
      
      // Get the filename from the Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition && contentDisposition.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch ? filenameMatch[1] : `${writeYamlFile.name.split('.')[0]}_read.yaml`;
      
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
        title: 'Read YAML Generated',
        message: `${filename} has been generated and downloaded`,
      });
      
      // Update workflow step - completed
      updateWorkflow({
        steps: [{
          name: 'Generate Read YAML',
          status: 'completed',
          timestamp: new Date(),
          details: `Generated Read YAML from ${writeYamlFile.name} using CSV at ${csvPath}`
        }]
      });
      
      return true;
    } catch (error) {
      setError(error);
      
      // Update workflow step - failed
      updateWorkflow({
        steps: [{
          name: 'Generate Read YAML',
          status: 'failed',
          timestamp: new Date(),
          error: error.message
        }]
      });
      
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Generate a read YAML file and get JSON response instead of file download
  const generateReadYamlJson = async (writeYamlFile, csvPath, primaryKeyColumns) => {
    setIsProcessing(true);
    
    try {
      const result = await readYamlApi.generateReadYamlJson(writeYamlFile, csvPath, primaryKeyColumns);
      
      // Add the file to the list of generated files
      const newFile = {
        filename: result.filename,
        content: result.content,
        primary_key_columns: result.primary_key_columns,
        csv_path: result.csv_path
      };
      
      setGeneratedReadYamlFiles(prev => [newFile, ...prev]);
      
      // Store these for reuse
      setPrimaryKeyColumns(result.primary_key_columns);
      setCsvPath(result.csv_path);
      
      addNotification({
        type: 'success',
        title: 'Read YAML Generated',
        message: `${result.filename} has been generated`,
      });
      
      return result;
    } catch (error) {
      setError(error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Clear all generated read YAML files
  const clearGeneratedFiles = () => {
    setGeneratedReadYamlFiles([]);
  };
  
  // Value object that will be provided to consumers
  const contextValue = {
    generatedReadYamlFiles,
    isProcessing,
    primaryKeyColumns,
    csvPath,
    processIngestionZip,
    processMultipleFiles,
    processIngestionFile,
    generateReadYaml,
    generateReadYamlJson,
    clearGeneratedFiles,
    setPrimaryKeyColumns,
    setCsvPath
  };
  
  return (
    <ReadYamlContext.Provider value={contextValue}>
      {children}
    </ReadYamlContext.Provider>
  );
};

export default ReadYamlContext;