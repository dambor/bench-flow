import React, { createContext, useContext, useState } from 'react';
import { useAppContext } from './AppContext';

// Create the context
const YamlContext = createContext();

// Create a hook to use the context
export const useYamlContext = () => useContext(YamlContext);

// Provider component
export const YamlProvider = ({ children }) => {
  const { addNotification } = useAppContext();
  
  // State for YAML content
  const [generatedYaml, setGeneratedYaml] = useState({
    content: '',
    filename: '',
    sessionId: '',
    downloadUrl: ''
  });
  
  // API client for CQLGen operations
  const cqlgenApi = {
    // Generate YAML from a CQL schema file and optional config file
    generateYaml: async (schemaFile, confFile = null) => {
      const formData = new FormData();
      formData.append('schema_file', schemaFile);
      
      if (confFile) {
        formData.append('conf_file', confFile);
      }
      
      try {
        console.log('Sending request to /api/cqlgen/generate with files:', {
          schema: schemaFile.name,
          conf: confFile ? confFile.name : 'none'
        });
        
        const response = await fetch('/api/cqlgen/generate', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          // Try to parse error message from response
          let errorMessage;
          try {
            const errorData = await response.json();
            errorMessage = errorData.detail || `Server error: ${response.status}`;
            console.error('Server returned error:', errorData);
          } catch (e) {
            // If we can't parse JSON, try to get text
            try {
              const errorText = await response.text();
              errorMessage = `Server error (${response.status}): ${errorText}`;
              console.error('Server returned error text:', errorText);
            } catch (textError) {
              errorMessage = `Server error: ${response.status}`;
            }
          }
          throw new Error(errorMessage);
        }
        
        const result = await response.json();
        
        // Store the download URL and session ID
        if (result.success) {
          // Extract filename from download_url
          const filename = result.download_url.split('/').pop();
          
          try {
            // Download the YAML content
            const yamlBlob = await downloadFile(result.session_id, filename);
            const yamlContent = await yamlBlob.text();
            
            // Store the generated YAML data
            setGeneratedYaml({
              content: yamlContent,
              filename: filename,
              sessionId: result.session_id,
              downloadUrl: result.download_url
            });
          } catch (error) {
            console.error('Error reading YAML content:', error);
          }
        }
        
        return result;
      } catch (error) {
        console.error('API call failed:', error);
        throw error;
      }
    },
    
    // Process schema with parsing for app use
    processWithSchema: async (schemaFile, confFile = null, parseForApp = true) => {
      const formData = new FormData();
      formData.append('schema_file', schemaFile);
      
      if (confFile) {
        formData.append('conf_file', confFile);
      }
      
      formData.append('parse_for_app', parseForApp.toString());
      
      try {
        console.log('Sending request to /api/cqlgen/process-with-schema with files:', {
          schema: schemaFile.name,
          conf: confFile ? confFile.name : 'none',
          parse_for_app: parseForApp
        });
        
        const response = await fetch('/api/cqlgen/process-with-schema', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          // Try to parse error message from response
          let errorMessage;
          try {
            const errorData = await response.json();
            errorMessage = errorData.detail || `Server error: ${response.status}`;
            console.error('Server returned error:', errorData);
          } catch (e) {
            // If we can't parse JSON, try to get text
            try {
              const errorText = await response.text();
              errorMessage = `Server error (${response.status}): ${errorText}`;
              console.error('Server returned error text:', errorText);
            } catch (textError) {
              errorMessage = `Server error: ${response.status}`;
            }
          }
          throw new Error(errorMessage);
        }
        
        const result = await response.json();
        
        // Store the download URL and session ID
        if (result.success) {
          // Extract filename from download_url
          const filename = result.download_url.split('/').pop();
          
          try {
            // Download the YAML content
            const yamlBlob = await downloadFile(result.session_id, filename);
            const yamlContent = await yamlBlob.text();
            
            // Store the generated YAML data
            setGeneratedYaml({
              content: yamlContent,
              filename: filename,
              sessionId: result.session_id,
              downloadUrl: result.download_url
            });
          } catch (error) {
            console.error('Error reading YAML content:', error);
          }
        }
        
        return result;
      } catch (error) {
        console.error('API call failed:', error);
        throw error;
      }
    }
  };
  
  // Download a file from the API
  const downloadFile = async (sessionId, filename) => {
    try {
      const response = await fetch(`/api/cqlgen/download/${sessionId}/${filename}`);
      
      if (!response.ok) {
        throw new Error(`Error downloading file: ${response.statusText}`);
      }
      
      return await response.blob();
    } catch (error) {
      console.error('Download failed:', error);
      throw error;
    }
  };
  
  // Manual function to set YAML content
  const setYamlContent = (content, filename = 'workload.yaml') => {
    setGeneratedYaml({
      content,
      filename,
      sessionId: '',
      downloadUrl: ''
    });
  };
  
  // Download the current YAML as a file
  const downloadYaml = () => {
    if (!generatedYaml.content) {
      addNotification({
        type: 'warning',
        title: 'No YAML Content',
        message: 'There is no YAML content to download.'
      });
      return;
    }
    
    const blob = new Blob([generatedYaml.content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = generatedYaml.filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
    
    addNotification({
      type: 'success',
      title: 'File Downloaded',
      message: `${generatedYaml.filename} has been downloaded`
    });
  };
  
  // Clear the generated YAML
  const clearYaml = () => {
    setGeneratedYaml({
      content: '',
      filename: '',
      sessionId: '',
      downloadUrl: ''
    });
  };
  
  // Context value to be provided
  const contextValue = {
    generatedYaml,
    cqlgenApi,
    downloadFile,
    setYamlContent,
    downloadYaml,
    clearYaml
  };
  
  return (
    <YamlContext.Provider value={contextValue}>
      {children}
    </YamlContext.Provider>
  );
};

export default YamlContext;